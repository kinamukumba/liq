<?php
/**
 * CRM Controller (CrmController.php)
 * Endpoints for Restaurant Customer Relationship Management and Loyalty Insights
 */

declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../core/Response.php';
require_once __DIR__ . '/../core/Request.php';

class CrmController {
    private PDO $db;

    public function __construct() {
        $this->db = Database::getConnection();
    }

    /**
     * List customers with aggregated stats
     * GET /crm/customers
     */
    public function listCustomers(Request $request): void {
        $restaurantId = (int)($request->get('restaurant_id', 1));

        $stmt = $this->db->prepare("
            SELECT c.id, c.name, c.phone, c.email, c.status, c.created_at, c.last_order_at,
                   COUNT(DISTINCT o.id) as total_orders,
                   IFNULL(SUM(CASE WHEN o.status = 'COMPLETED' THEN o.total ELSE 0 END), 0) as total_spent,
                   IFNULL(
                       (SELECT SUM(CASE WHEN lt.type = 'EARN' THEN lt.points WHEN lt.type = 'REDEEM' THEN -lt.points ELSE 0 END)
                        FROM loyalty_transactions lt
                        WHERE lt.customer_id = c.id AND lt.restaurant_id = :rid_loyalty), 
                       0
                   ) as loyalty_points
            FROM customers c
            INNER JOIN orders o ON o.customer_id = c.id AND o.restaurant_id = :rid
            GROUP BY c.id
            ORDER BY c.last_order_at DESC, total_orders DESC
        ");
        $stmt->execute([
            ':rid' => $restaurantId,
            ':rid_loyalty' => $restaurantId
        ]);
        $customers = $stmt->fetchAll();

        // Calculate CRM KPIs
        $totalCustomers = count($customers);
        $recurrentCount = 0;
        $totalPointsIssued = 0;
        $totalLtv = 0.0;

        foreach ($customers as $cust) {
            if ((int)$cust['total_orders'] > 1) {
                $recurrentCount++;
            }
            $totalPointsIssued += (int)$cust['loyalty_points'];
            $totalLtv += (float)$cust['total_spent'];
        }

        Response::success([
            'customers' => $customers,
            'kpis' => [
                'total_customers' => $totalCustomers,
                'recurrent_customers' => $recurrentCount,
                'recurrent_percent' => $totalCustomers > 0 ? round(($recurrentCount / $totalCustomers) * 100, 1) : 0,
                'total_points_issued' => $totalPointsIssued,
                'average_ltv' => $totalCustomers > 0 ? round($totalLtv / $totalCustomers, 2) : 0
            ]
        ]);
    }

    /**
     * Get single customer details with order history
     * GET /crm/customers/{id}
     */
    public function getCustomer(Request $request, array $params): void {
        $customerId = (int)($params['id'] ?? 0);
        $restaurantId = (int)($request->get('restaurant_id', 1));

        $cStmt = $this->db->prepare("SELECT id, name, phone, email, status, created_at, last_order_at FROM customers WHERE id = :id LIMIT 1");
        $cStmt->execute([':id' => $customerId]);
        $customer = $cStmt->fetch();

        if (!$customer) {
            Response::error('Cliente não encontrado.', 404);
            return;
        }

        // Fetch customer's orders
        $oStmt = $this->db->prepare("
            SELECT o.id, o.status, o.total, o.created_at, t.number as table_number
            FROM orders o
            LEFT JOIN tables t ON o.table_id = t.id
            WHERE o.customer_id = :cid AND o.restaurant_id = :rid
            ORDER BY o.created_at DESC
        ");
        $oStmt->execute([':cid' => $customerId, ':rid' => $restaurantId]);
        $customer['orders'] = $oStmt->fetchAll();

        // Points
        $pStmt = $this->db->prepare("
            SELECT IFNULL(SUM(CASE WHEN type = 'EARN' THEN points WHEN type = 'REDEEM' THEN -points ELSE 0 END), 0)
            FROM loyalty_transactions
            WHERE customer_id = :cid AND restaurant_id = :rid
        ");
        $pStmt->execute([':cid' => $customerId, ':rid' => $restaurantId]);
        $customer['loyalty_points'] = (int)$pStmt->fetchColumn();

        Response::success($customer);
    }
}
