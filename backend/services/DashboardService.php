<?php
/**
 * Dashboard & Analytics Service (Rules 31-38, 64, 66)
 * Generates high-accuracy sales, order status counts, top products, and peak hours
 */

declare(strict_types=1);

require_once __DIR__ . '/../../config/database.php';

class DashboardService {
    private PDO $db;

    public function __construct() {
        $this->db = Database::getConnection();
    }

    public function getRestaurantDashboardMetrics(int $restaurantId): array {
        // 1. Sales Metrics (Rule 32 & 64)
        $todaySalesStmt = $this->db->prepare("
            SELECT IFNULL(SUM(total), 0) as sales_today, COUNT(*) as orders_today
            FROM orders 
            WHERE restaurant_id = :rid 
              AND status = 'COMPLETED' 
              AND DATE(created_at) = CURDATE()
        ");
        $todaySalesStmt->execute([':rid' => $restaurantId]);
        $today = $todaySalesStmt->fetch();

        $yesterdaySalesStmt = $this->db->prepare("
            SELECT IFNULL(SUM(total), 0) as sales_yesterday, COUNT(*) as orders_yesterday
            FROM orders 
            WHERE restaurant_id = :rid 
              AND status = 'COMPLETED' 
              AND DATE(created_at) = SUBDATE(CURDATE(), 1)
        ");
        $yesterdaySalesStmt->execute([':rid' => $restaurantId]);
        $yesterday = $yesterdaySalesStmt->fetch();

        $salesToday = (float)$today['sales_today'];
        $salesYesterday = (float)$yesterday['sales_yesterday'];
        $ordersToday = (int)$today['orders_today'];

        // Growth Percentage
        $growthPercent = 0.0;
        if ($salesYesterday > 0) {
            $growthPercent = round((($salesToday - $salesYesterday) / $salesYesterday) * 100, 1);
        } elseif ($salesToday > 0) {
            $growthPercent = 100.0;
        }

        // Ticket Médio (Rule 64)
        $avgTicket = $ordersToday > 0 ? round($salesToday / $ordersToday, 2) : 0.0;

        // 2. Orders Metrics breakdown by status (Rule 33)
        $orderCountsStmt = $this->db->prepare("
            SELECT status, COUNT(*) as total
            FROM orders
            WHERE restaurant_id = :rid AND DATE(created_at) = CURDATE()
            GROUP BY status
        ");
        $orderCountsStmt->execute([':rid' => $restaurantId]);
        $ordersByStatus = [
            'PENDING' => 0,
            'CONFIRMED' => 0,
            'PREPARING' => 0,
            'READY' => 0,
            'DELIVERING' => 0,
            'COMPLETED' => 0,
            'CANCELLED' => 0
        ];
        while ($row = $orderCountsStmt->fetch()) {
            if (isset($ordersByStatus[$row['status']])) {
                $ordersByStatus[$row['status']] = (int)$row['total'];
            }
        }

        // 3. Customers Metrics (Rule 34 & 64)
        $totalCustomersStmt = $this->db->prepare("
            SELECT COUNT(DISTINCT customer_id) as total_customers 
            FROM orders 
            WHERE restaurant_id = :rid
        ");
        $totalCustomersStmt->execute([':rid' => $restaurantId]);
        $totalCustomers = (int)$totalCustomersStmt->fetchColumn();

        $recurrentStmt = $this->db->prepare("
            SELECT COUNT(*) FROM (
                SELECT customer_id FROM orders 
                WHERE restaurant_id = :rid 
                GROUP BY customer_id 
                HAVING COUNT(*) > 1
            ) as recurrent_clients
        ");
        $recurrentStmt->execute([':rid' => $restaurantId]);
        $recurrentCustomers = (int)$recurrentStmt->fetchColumn();

        $returnRate = $totalCustomers > 0 ? round(($recurrentCustomers / $totalCustomers) * 100, 1) : 0.0;

        // 4. Tables Status (Rule 35)
        $tablesStmt = $this->db->prepare("
            SELECT status, COUNT(*) as count 
            FROM tables 
            WHERE restaurant_id = :rid 
            GROUP BY status
        ");
        $tablesStmt->execute([':rid' => $restaurantId]);
        $tablesSummary = ['total' => 0, 'occupied' => 0, 'available' => 0, 'cleaning' => 0];
        while ($t = $tablesStmt->fetch()) {
            $tablesSummary['total'] += (int)$t['count'];
            if ($t['status'] === 'OCCUPIED') $tablesSummary['occupied'] += (int)$t['count'];
            if ($t['status'] === 'AVAILABLE') $tablesSummary['available'] += (int)$t['count'];
            if ($t['status'] === 'CLEANING') $tablesSummary['cleaning'] += (int)$t['count'];
        }

        // 5. Top Products (Rule 36 & 64)
        $topProductsStmt = $this->db->prepare("
            SELECT oi.product_name_snapshot, SUM(oi.quantity) as total_sold, SUM(oi.subtotal) as revenue
            FROM order_items oi
            INNER JOIN orders o ON oi.order_id = o.id
            WHERE o.restaurant_id = :rid AND o.status = 'COMPLETED'
            GROUP BY oi.product_id, oi.product_name_snapshot
            ORDER BY total_sold DESC
            LIMIT 5
        ");
        $topProductsStmt->execute([':rid' => $restaurantId]);
        $topProducts = $topProductsStmt->fetchAll();

        // 6. Peak Hours (Rule 37 & 64)
        $peakHoursStmt = $this->db->prepare("
            SELECT HOUR(created_at) as hour_of_day, COUNT(*) as order_count
            FROM orders
            WHERE restaurant_id = :rid
            GROUP BY HOUR(created_at)
            ORDER BY hour_of_day ASC
        ");
        $peakHoursStmt->execute([':rid' => $restaurantId]);
        $peakHours = $peakHoursStmt->fetchAll();

        return [
            'sales' => [
                'today' => $salesToday,
                'yesterday' => $salesYesterday,
                'orders_today' => $ordersToday,
                'avg_ticket' => $avgTicket,
                'growth_percent' => $growthPercent,
                'currency' => 'Kz'
            ],
            'orders' => [
                'total_today' => array_sum($ordersByStatus),
                'by_status' => $ordersByStatus
            ],
            'customers' => [
                'total' => $totalCustomers,
                'recurrent' => $recurrentCustomers,
                'return_rate_percent' => $returnRate
            ],
            'tables' => $tablesSummary,
            'top_products' => $topProducts,
            'peak_hours' => $peakHours
        ];
    }
}
