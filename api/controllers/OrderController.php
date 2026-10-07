<?php
/**
 * Order Controller (OrderController.php)
 * REST endpoints for Order creation, status updates, and live kitchen tracking
 */

declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../core/Response.php';
require_once __DIR__ . '/../core/Request.php';
require_once __DIR__ . '/../services/OrderService.php';

class OrderController {
    private OrderService $orderService;
    private PDO $db;

    public function __construct() {
        $this->orderService = new OrderService();
        $this->db = Database::getConnection();
    }

    /**
     * Create Order
     */
    public function create(Request $request): void {
        $restaurantId = (int)($request->post('restaurant_id') ?? 1);
        $customerId = (int)($request->post('customer_id') ?? 0);
        $tableId = (int)($request->post('table_id') ?? 0);
        $items = (array)($request->post('items') ?? []);
        $couponCode = $request->post('coupon_code');
        $notes = $request->post('notes');

        if (!$customerId || !$tableId || empty($items)) {
            Response::error('Dados incompletos. Cliente, mesa e itens são obrigatórios.');
            return;
        }

        try {
            $order = $this->orderService->createOrder(
                $restaurantId,
                $customerId,
                $tableId,
                $items,
                $couponCode,
                $notes
            );
            Response::success($order, 'Pedido enviado com sucesso!', 201);
        } catch (Exception $e) {
            Response::error($e->getMessage(), 400);
        }
    }

    /**
     * Get single order status and items
     */
    public function get(Request $request, array $params): void {
        $orderId = (int)($params['id'] ?? 0);
        $stmt = $this->db->prepare("
            SELECT o.*, t.number as table_number, c.name as customer_name, c.phone as customer_phone
            FROM orders o
            INNER JOIN tables t ON o.table_id = t.id
            INNER JOIN customers c ON o.customer_id = c.id
            WHERE o.id = :id
            LIMIT 1
        ");
        $stmt->execute([':id' => $orderId]);
        $order = $stmt->fetch();

        if (!$order) {
            Response::error('Pedido não encontrado.', 404);
            return;
        }

        // Fetch items
        $itemsStmt = $this->db->prepare("SELECT * FROM order_items WHERE order_id = :id");
        $itemsStmt->execute([':id' => $orderId]);
        $order['items'] = $itemsStmt->fetchAll();

        Response::success($order);
    }

    /**
     * Update order status
     */
    public function updateStatus(Request $request, array $params): void {
        $orderId = (int)($params['id'] ?? 0);
        $restaurantId = (int)($request->post('restaurant_id') ?? 1);
        $newStatus = trim((string)$request->post('status'));

        try {
            $result = $this->orderService->updateOrderStatus($restaurantId, $orderId, $newStatus);
            Response::success($result, 'Estado do pedido atualizado.');
        } catch (Exception $e) {
            Response::error($e->getMessage(), 400);
        }
    }

    /**
     * List active orders for Kitchen / Service
     */
    public function listKitchen(Request $request): void {
        $restaurantId = (int)($request->get('restaurant_id', 1));

        $stmt = $this->db->prepare("
            SELECT o.id, o.status, o.table_id, t.number as table_number,
                   o.created_at, o.confirmed_at, o.preparing_at, o.ready_at,
                   c.name as customer_name, o.notes, o.total
            FROM orders o
            INNER JOIN tables t ON o.table_id = t.id
            INNER JOIN customers c ON o.customer_id = c.id
            WHERE o.restaurant_id = :rid AND o.status IN ('PENDING', 'CONFIRMED', 'PREPARING', 'READY')
            ORDER BY o.created_at ASC
        ");
        $stmt->execute([':rid' => $restaurantId]);
        $orders = $stmt->fetchAll();

        // Attach items to each order
        foreach ($orders as &$ord) {
            $iStmt = $this->db->prepare("SELECT product_name_snapshot, quantity, notes FROM order_items WHERE order_id = :id");
            $iStmt->execute([':id' => $ord['id']]);
            $ord['items'] = $iStmt->fetchAll();
        }

        Response::success($orders);
    }
}
