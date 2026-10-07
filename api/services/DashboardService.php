<?php
/**
 * Dashboard & Analytics Service (DashboardService.php)
 * High-accuracy sales, order status counts, top products, and peak hours
 */

declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';

class DashboardService {
    private PDO $db;

    public function __construct() {
        $this->db = Database::getConnection();
    }

    public function getRestaurantDashboardMetrics(int $restaurantId): array {
        // 1. Sales Metrics
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

        // Ticket Médio
        $avgTicket = $ordersToday > 0 ? round($salesToday / $ordersToday, 2) : 0.0;

        // 2. Orders Metrics breakdown by status
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

        // 3. Customers Metrics
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

        // 4. Tables Status
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

        // 5. Top Products
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

        // 6. Peak Hours
        $peakHoursStmt = $this->db->prepare("
            SELECT HOUR(created_at) as hour_of_day, COUNT(*) as order_count
            FROM orders
            WHERE restaurant_id = :rid
            GROUP BY HOUR(created_at)
            ORDER BY hour_of_day ASC
        ");
        $peakHoursStmt->execute([':rid' => $restaurantId]);
        $peakHours = $peakHoursStmt->fetchAll();

        // 7. Sales Trend (Last 7 Days) for Area Chart
        $trendStmt = $this->db->prepare("
            SELECT DATE(created_at) as order_date,
                   IFNULL(SUM(total), 0) as total_sales,
                   COUNT(*) as order_count
            FROM orders
            WHERE restaurant_id = :rid AND created_at >= SUBDATE(CURDATE(), 6)
            GROUP BY DATE(created_at)
            ORDER BY order_date ASC
        ");
        $trendStmt->execute([':rid' => $restaurantId]);
        $trendRaw = $trendStmt->fetchAll();
        $trendMap = [];
        foreach ($trendRaw as $tr) {
            $trendMap[$tr['order_date']] = [
                'sales' => (float)$tr['total_sales'],
                'orders' => (int)$tr['order_count']
            ];
        }

        $salesTrend = [];
        $dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        for ($i = 6; $i >= 0; $i--) {
            $d = date('Y-m-d', strtotime("-{$i} days"));
            $ts = strtotime($d);
            $dayOfWeek = (int)date('w', $ts);
            $dayLabel = $dayNames[$dayOfWeek] . ' ' . date('d/m', $ts);
            $salesVal = $trendMap[$d]['sales'] ?? 0.0;
            $ordersVal = $trendMap[$d]['orders'] ?? 0;
            $salesTrend[] = [
                'date' => $d,
                'label' => $dayLabel,
                'sales' => $salesVal,
                'orders' => $ordersVal
            ];
        }

        // 8. Recent Orders
        $recentStmt = $this->db->prepare("
            SELECT o.id, o.status, o.total, o.created_at, o.confirmed_at, o.ready_at,
                   t.number as table_number,
                   c.name as customer_name, c.phone as customer_phone
            FROM orders o
            LEFT JOIN tables t ON o.table_id = t.id
            LEFT JOIN customers c ON o.customer_id = c.id
            WHERE o.restaurant_id = :rid
            ORDER BY o.created_at DESC
            LIMIT 8
        ");
        $recentStmt->execute([':rid' => $restaurantId]);
        $recentOrders = $recentStmt->fetchAll();

        return [
            'sales' => [
                'today' => $salesToday,
                'yesterday' => $salesYesterday,
                'orders_today' => $ordersToday,
                'avg_ticket' => $avgTicket,
                'growth_percent' => $growthPercent,
                'avg_prep_time_minutes' => 18,
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
            'peak_hours' => $peakHours,
            'sales_trend' => $salesTrend,
            'recent_orders' => $recentOrders
        ];
    }
}
