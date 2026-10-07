<?php
/**
 * Customer Controller (CustomerController.php)
 * Auto-identification, Persistent Session handling, and Loyalty Wallet
 */

declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../core/Response.php';
require_once __DIR__ . '/../core/Request.php';
require_once __DIR__ . '/../services/CustomerSessionService.php';

class CustomerController {
    private CustomerSessionService $sessionService;
    private PDO $db;

    public function __construct() {
        $this->sessionService = new CustomerSessionService();
        $this->db = Database::getConnection();
    }

    /**
     * Check persistent session
     */
    public function getSession(Request $request): void {
        $restaurantId = (int)($request->post('restaurant_id') ?? $request->get('restaurant_id', 1));
        $rawToken = $request->cookie(CustomerSessionService::COOKIE_NAME);
        $deviceId = $request->cookie(CustomerSessionService::DEVICE_COOKIE);

        $deviceId = $this->sessionService->getOrCreateDeviceId($deviceId);

        if (!$rawToken) {
            Response::json([
                'authenticated' => false,
                'device_id' => $deviceId,
                'customer' => null
            ]);
            return;
        }

        $customer = $this->sessionService->authenticateCustomer($rawToken, $restaurantId);

        if ($customer) {
            Response::json([
                'authenticated' => true,
                'device_id' => $deviceId,
                'customer' => [
                    'id' => $customer['customer_id'],
                    'name' => $customer['name'],
                    'phone' => $customer['phone'],
                    'email' => $customer['email']
                ]
            ]);
        } else {
            Response::json([
                'authenticated' => false,
                'device_id' => $deviceId,
                'customer' => null
            ]);
        }
    }

    /**
     * Customer self-registration / identification on first order
     */
    public function registerOrIdentify(Request $request): void {
        $restaurantId = (int)($request->post('restaurant_id') ?? 1);
        $name = trim((string)$request->post('name'));
        $phone = trim((string)$request->post('phone'));
        $email = $request->post('email');

        if (empty($name) || empty($phone)) {
            Response::error('Nome e Telefone/WhatsApp são campos obrigatórios.');
            return;
        }

        $deviceId = $request->cookie(CustomerSessionService::DEVICE_COOKIE);
        $deviceId = $this->sessionService->getOrCreateDeviceId($deviceId);
        $userAgent = $request->getUserAgent();

        $customerData = $this->sessionService->createCustomerAndSession(
            $restaurantId,
            $name,
            $phone,
            $email,
            $deviceId,
            $userAgent
        );

        Response::success([
            'authenticated' => true,
            'customer' => [
                'id' => $customerData['customer_id'],
                'name' => $customerData['name'],
                'phone' => $customerData['phone'],
                'email' => $customerData['email']
            ]
        ], 'Cliente identificado com sucesso.');
    }

    /**
     * Get Customer Loyalty Wallet
     */
    public function getWallet(Request $request): void {
        $customerId = (int)$request->get('customer_id');
        $restaurantId = (int)($request->get('restaurant_id') ?? 1);

        if (!$customerId) {
            Response::error('ID de cliente não informado.', 400);
            return;
        }

        // 1. Calculate points
        $pointsStmt = $this->db->prepare("
            SELECT IFNULL(SUM(CASE WHEN type = 'EARN' THEN points WHEN type = 'REDEEM' THEN -points ELSE 0 END), 0) as balance
            FROM loyalty_transactions
            WHERE customer_id = :cid AND restaurant_id = :rid
        ");
        $pointsStmt->execute([':cid' => $customerId, ':rid' => $restaurantId]);
        $pointsBalance = (int)$pointsStmt->fetchColumn();

        // 2. Count completed orders
        $ordersStmt = $this->db->prepare("
            SELECT COUNT(*) as total_orders
            FROM orders
            WHERE customer_id = :cid AND restaurant_id = :rid AND status = 'COMPLETED'
        ");
        $ordersStmt->execute([':cid' => $customerId, ':rid' => $restaurantId]);
        $totalOrders = (int)$ordersStmt->fetchColumn();

        // Next milestone
        $nextGoal = 10;
        if ($totalOrders < 5) {
            $nextGoal = 5;
        } elseif ($totalOrders < 10) {
            $nextGoal = 10;
        } else {
            $nextGoal = 20;
        }
        $remaining = max(0, $nextGoal - $totalOrders);

        Response::success([
            'points' => $pointsBalance,
            'orders_completed' => $totalOrders,
            'next_benefit_target' => $nextGoal,
            'remaining_orders' => $remaining
        ]);
    }
}
