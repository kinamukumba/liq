<?php
/**
 * Product & Menu Controller (ProductController.php)
 * Endpoints for Restaurant Menu, Category, and Product Management
 */

declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../core/Response.php';
require_once __DIR__ . '/../core/Request.php';
require_once __DIR__ . '/../core/Security.php';

class ProductController {
    private PDO $db;

    public function __construct() {
        $this->db = Database::getConnection();
    }

    /**
     * List all products with their categories
     * GET /products
     */
    public function list(Request $request): void {
        $restaurantId = (int)($request->get('restaurant_id', 1));

        $stmt = $this->db->prepare("
            SELECT p.id, p.category_id, p.name, p.type, p.description, p.image, p.price,
                   p.is_available, p.is_featured, p.sort_order,
                   c.name as category_name
            FROM products p
            INNER JOIN categories c ON p.category_id = c.id
            WHERE p.restaurant_id = :rid
            ORDER BY c.sort_order ASC, p.sort_order ASC, p.name ASC
        ");
        $stmt->execute([':rid' => $restaurantId]);
        $products = $stmt->fetchAll();

        // Also fetch categories
        $catStmt = $this->db->prepare("
            SELECT id, name, slug, sort_order, is_active
            FROM categories
            WHERE restaurant_id = :rid
            ORDER BY sort_order ASC, name ASC
        ");
        $catStmt->execute([':rid' => $restaurantId]);
        $categories = $catStmt->fetchAll();

        Response::success([
            'products' => $products,
            'categories' => $categories
        ]);
    }

    /**
     * Toggle product availability
     * PATCH /products/{id}/toggle
     */
    public function toggleAvailability(Request $request, array $params): void {
        $productId = (int)($params['id'] ?? 0);
        $restaurantId = (int)($request->post('restaurant_id', 1));

        $stmt = $this->db->prepare("SELECT is_available FROM products WHERE id = :id AND restaurant_id = :rid LIMIT 1");
        $stmt->execute([':id' => $productId, ':rid' => $restaurantId]);
        $current = $stmt->fetch();

        if (!$current) {
            Response::error('Produto não encontrado.', 404);
            return;
        }

        $newVal = (int)$current['is_available'] === 1 ? 0 : 1;

        $update = $this->db->prepare("UPDATE products SET is_available = :avail WHERE id = :id AND restaurant_id = :rid");
        $update->execute([':avail' => $newVal, ':id' => $productId, ':rid' => $restaurantId]);

        Response::success([
            'product_id' => $productId,
            'is_available' => $newVal
        ], $newVal === 1 ? 'Produto ativado para pedidos!' : 'Produto pausado temporariamente.');
    }

    /**
     * Create a new product
     * POST /products
     */
    public function create(Request $request): void {
        $restaurantId = (int)($request->post('restaurant_id', 1));
        $categoryId = (int)($request->post('category_id', 1));
        $name = Security::sanitizeString((string)$request->post('name'));
        $description = Security::sanitizeString((string)$request->post('description'));
        $price = (float)($request->post('price', 0.0));
        $image = Security::sanitizeString((string)$request->post('image'));
        $type = (string)($request->post('type', 'DISH'));

        if (empty($name) || $price <= 0 || !$categoryId) {
            Response::error('Nome, categoria e preço válido são obrigatórios.', 422);
            return;
        }

        // Processar upload de arquivo de imagem físico se enviado
        $imageFile = $request->file('image') ?? $request->file('file');
        if ($imageFile && $imageFile['error'] === UPLOAD_ERR_OK && $imageFile['size'] <= 5242880) {
            $ext = strtolower(pathinfo($imageFile['name'], PATHINFO_EXTENSION));
            if (in_array($ext, ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'], true)) {
                $uploadDir = realpath(__DIR__ . '/../upload') ?: (__DIR__ . '/../upload');
                if (!is_dir($uploadDir)) {
                    mkdir($uploadDir, 0755, true);
                }
                $uniqueName = 'prod_' . date('Ymd_His') . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
                if (move_uploaded_file($imageFile['tmp_name'], $uploadDir . DIRECTORY_SEPARATOR . $uniqueName)) {
                    $image = 'upload/' . $uniqueName;
                }
            }
        }

        if (empty($image)) {
            $image = 'upload/default-product.svg';
        }

        $stmt = $this->db->prepare("
            INSERT INTO products (restaurant_id, category_id, name, type, description, image, price, is_available, is_featured, created_at)
            VALUES (:rid, :cid, :name, :type, :descr, :img, :price, 1, 0, NOW())
        ");
        $stmt->execute([
            ':rid' => $restaurantId,
            ':cid' => $categoryId,
            ':name' => $name,
            ':type' => in_array($type, ['DISH', 'PRODUCT'], true) ? $type : 'DISH',
            ':descr' => $description,
            ':img' => $image,
            ':price' => $price
        ]);
        $productId = (int)$this->db->lastInsertId();

        Response::success([
            'id' => $productId,
            'name' => $name,
            'price' => $price
        ], 'Produto adicionado com sucesso ao cardápio!', 201);
    }

    /**
     * Create a new category
     * POST /categories
     */
    public function createCategory(Request $request): void {
        $restaurantId = (int)($request->post('restaurant_id', 1));
        $name = Security::sanitizeString((string)$request->post('name'));

        if (empty($name)) {
            Response::error('Nome da categoria é obrigatório.', 422);
            return;
        }

        $slug = preg_replace('/[^a-z0-9]+/i', '-', strtolower($name));
        $slug = trim($slug, '-');

        $stmt = $this->db->prepare("
            INSERT INTO categories (restaurant_id, name, slug, sort_order, is_active, created_at)
            VALUES (:rid, :name, :slug, 99, 1, NOW())
        ");
        $stmt->execute([
            ':rid' => $restaurantId,
            ':name' => $name,
            ':slug' => $slug
        ]);
        $catId = (int)$this->db->lastInsertId();

        Response::success([
            'id' => $catId,
            'name' => $name,
            'slug' => $slug
        ], 'Categoria cadastrada com sucesso!', 201);
    }
}
