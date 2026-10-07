<?php
/**
 * Backoffice Controller (BackofficeController.php)
 * Endpoints for Platform Super-Admin / Backoffice (backoffice.liq.ao)
 */

declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../core/Response.php';
require_once __DIR__ . '/../core/Request.php';

class BackofficeController {
    private PDO $db;

    public function __construct() {
        $this->db = Database::getConnection();
    }

    /**
     * Get platform overview metrics
     * GET /backoffice/overview
     */
    public function getOverview(Request $request): void {
        // Total Restaurants
        $rStmt = $this->db->query("SELECT COUNT(*) FROM restaurants");
        $totalRestaurants = (int)$rStmt->fetchColumn();

        // Total Orders across platform
        $oStmt = $this->db->query("SELECT COUNT(*), IFNULL(SUM(total), 0) FROM orders WHERE status = 'COMPLETED'");
        $ordersData = $oStmt->fetch(PDO::FETCH_NUM);
        $totalOrders = (int)($ordersData[0] ?? 0);
        $totalGmv = (float)($ordersData[1] ?? 0);

        // Total Registered Customers
        $cStmt = $this->db->query("SELECT COUNT(*) FROM customers");
        $totalCustomers = (int)$cStmt->fetchColumn();

        // Recent Registered Restaurants
        $recStmt = $this->db->query("
            SELECT id, name, slug, email, phone, status, created_at 
            FROM restaurants 
            ORDER BY id DESC 
            LIMIT 10
        ");
        $recentRestaurants = $recStmt->fetchAll();

        Response::success([
            'metrics' => [
                'total_restaurants' => $totalRestaurants,
                'total_orders' => $totalOrders,
                'total_gmv' => $totalGmv,
                'total_customers' => $totalCustomers
            ],
            'recent_restaurants' => $recentRestaurants
        ]);
    }

    /**
     * List all restaurants
     * GET /backoffice/restaurants
     */
    public function listRestaurants(Request $request): void {
        $stmt = $this->db->query("
            SELECT r.*, COUNT(DISTINCT o.id) as orders_count, IFNULL(SUM(o.total), 0) as total_volume
            FROM restaurants r
            LEFT JOIN orders o ON o.restaurant_id = r.id AND o.status = 'COMPLETED'
            GROUP BY r.id
            ORDER BY r.id DESC
        ");
        $restaurants = $stmt->fetchAll();

        Response::success($restaurants);
    }
}
