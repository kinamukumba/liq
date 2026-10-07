<?php
/**
 * Menu Controller
 * Serves digital menu, categories, and table resolution for QR Code / NFC access
 */

declare(strict_types=1);

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../core/Response.php';
require_once __DIR__ . '/../core/Request.php';

class MenuController {
    private PDO $db;

    public function __construct() {
        $this->db = Database::getConnection();
    }

    /**
     * Get digital menu by restaurant slug and optional table token (Rule 7, 8, 9)
     */
    public function getMenu(Request $request, array $params): void {
        $slug = $params['slug'] ?? $request->get('restaurant', 'cafe-central');
        $tableToken = $request->get('t'); // QR token or table code

        // 1. Get Restaurant
        $restStmt = $this->db->prepare("
            SELECT id, name, slug, logo, description, phone, email, address, currency
            FROM restaurants 
            WHERE slug = :slug AND status = 'ACTIVE' 
            LIMIT 1
        ");
        $restStmt->execute([':slug' => $slug]);
        $restaurant = $restStmt->fetch();

        if (!$restaurant) {
            Response::error('Restaurante não encontrado ou inativo.', 404);
            return;
        }

        $restaurantId = (int)$restaurant['id'];

        // 2. Identify Table if token provided (Rule 7 & 8)
        $table = null;
        if (!empty($tableToken)) {
            $tblStmt = $this->db->prepare("
                SELECT id, number, code, status 
                FROM tables 
                WHERE restaurant_id = :rid 
                  AND (qr_token = :t1 OR nfc_token = :t2 OR code = :t3 OR number = :t4)
                LIMIT 1
            ");
            $tblStmt->execute([
                ':rid' => $restaurantId,
                ':t1' => $tableToken,
                ':t2' => $tableToken,
                ':t3' => $tableToken,
                ':t4' => $tableToken
            ]);
            $table = $tblStmt->fetch();
        }

        // 3. Get Categories
        $catStmt = $this->db->prepare("
            SELECT id, name, slug, sort_order 
            FROM categories 
            WHERE restaurant_id = :rid AND is_active = 1 
            ORDER BY sort_order ASC, name ASC
        ");
        $catStmt->execute([':rid' => $restaurantId]);
        $categories = $catStmt->fetchAll();

        // 4. Get Available Products (Rule 10)
        $prodStmt = $this->db->prepare("
            SELECT id, category_id, name, type, description, image, price, is_available, is_featured
            FROM products 
            WHERE restaurant_id = :rid AND is_available = 1
            ORDER BY sort_order ASC, name ASC
        ");
        $prodStmt->execute([':rid' => $restaurantId]);
        $products = $prodStmt->fetchAll();

        // Group products into categories
        $productsByCategory = [];
        foreach ($products as $p) {
            $catId = (int)$p['category_id'];
            if (!isset($productsByCategory[$catId])) {
                $productsByCategory[$catId] = [];
            }
            $productsByCategory[$catId][] = [
                'id' => (int)$p['id'],
                'name' => $p['name'],
                'type' => $p['type'],
                'description' => $p['description'],
                'image' => $p['image'],
                'price' => (float)$p['price'],
                'formatted_price' => number_format((float)$p['price'], 2, ',', '.') . ' ' . $restaurant['currency'],
                'is_featured' => (bool)$p['is_featured']
            ];
        }

        $structuredCategories = [];
        foreach ($categories as $c) {
            $catId = (int)$c['id'];
            $items = $productsByCategory[$catId] ?? [];
            if (!empty($items)) {
                $structuredCategories[] = [
                    'id' => $catId,
                    'name' => $c['name'],
                    'slug' => $c['slug'],
                    'items' => $items
                ];
            }
        }

        Response::success([
            'restaurant' => [
                'id' => $restaurantId,
                'name' => $restaurant['name'],
                'slug' => $restaurant['slug'],
                'description' => $restaurant['description'],
                'currency' => $restaurant['currency'],
                'address' => $restaurant['address'],
                'phone' => $restaurant['phone']
            ],
            'table' => $table ? [
                'id' => (int)$table['id'],
                'number' => $table['number'],
                'code' => $table['code'],
                'status' => $table['status']
            ] : null,
            'categories' => $structuredCategories
        ]);
    }
}
