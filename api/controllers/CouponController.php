<?php
/**
 * Coupon Controller (CouponController.php)
 * Real-time server-side coupon validation and restaurant campaign management
 */

declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../core/Response.php';
require_once __DIR__ . '/../core/Request.php';
require_once __DIR__ . '/../core/Security.php';
require_once __DIR__ . '/../services/OrderService.php';

class CouponController {
    private OrderService $orderService;
    private PDO $db;

    public function __construct() {
        $this->orderService = new OrderService();
        $this->db = Database::getConnection();
    }

    /**
     * List coupons for restaurant
     * GET /coupons
     */
    public function list(Request $request): void {
        $restaurantId = (int)($request->get('restaurant_id', 1));

        $stmt = $this->db->prepare("
            SELECT c.*, 
                   (SELECT COUNT(*) FROM coupon_redemptions cr WHERE cr.coupon_id = c.id) as total_redemptions,
                   (SELECT IFNULL(SUM(cr.discount_applied), 0) FROM coupon_redemptions cr WHERE cr.coupon_id = c.id) as total_discount_given
            FROM coupons c
            WHERE c.restaurant_id = :rid
            ORDER BY c.created_at DESC
        ");
        $stmt->execute([':rid' => $restaurantId]);
        $coupons = $stmt->fetchAll();

        Response::success($coupons);
    }

    /**
     * Create new coupon
     * POST /coupons
     */
    public function create(Request $request): void {
        $restaurantId = (int)($request->post('restaurant_id', 1));
        $code = strtoupper(trim((string)$request->post('code')));
        $type = (string)($request->post('type', 'PERCENTAGE'));
        $value = (float)($request->post('value', 10.0));
        $minimumOrder = (float)($request->post('minimum_order', 0.0));
        $maximumDiscount = (float)($request->post('maximum_discount', 0.0));
        $usagePerCustomer = (int)($request->post('usage_per_customer', 1));
        $startsAt = (string)($request->post('starts_at', date('Y-m-d H:i:s')));
        $expiresAt = (string)($request->post('expires_at', date('Y-m-d H:i:s', time() + (90 * 86400))));

        if (empty($code) || $value <= 0) {
            Response::error('Código e valor do cupom são obrigatórios.', 422);
            return;
        }

        // Check if code exists for restaurant
        $check = $this->db->prepare("SELECT id FROM coupons WHERE restaurant_id = :rid AND code = :code LIMIT 1");
        $check->execute([':rid' => $restaurantId, ':code' => $code]);
        if ($check->fetch()) {
            Response::error("O cupom '{$code}' já existe neste restaurante.", 409);
            return;
        }

        $stmt = $this->db->prepare("
            INSERT INTO coupons (
                restaurant_id, code, type, value, minimum_order, maximum_discount,
                usage_limit, usage_per_customer, starts_at, expires_at, active, created_at
            ) VALUES (
                :rid, :code, :type, :val, :min_ord, :max_disc,
                1000, :upc, :starts, :expires, 1, NOW()
            )
        ");
        $stmt->execute([
            ':rid' => $restaurantId,
            ':code' => $code,
            ':type' => in_array($type, ['PERCENTAGE', 'FIXED'], true) ? $type : 'PERCENTAGE',
            ':val' => $value,
            ':min_ord' => $minimumOrder,
            ':max_disc' => $maximumDiscount > 0 ? $maximumDiscount : null,
            ':upc' => $usagePerCustomer,
            ':starts' => $startsAt,
            ':expires' => $expiresAt
        ]);

        Response::success([
            'id' => (int)$this->db->lastInsertId(),
            'code' => $code
        ], 'Cupom criado com sucesso!', 201);
    }

    /**
     * Toggle coupon active state
     * PATCH /coupons/{id}/toggle
     */
    public function toggle(Request $request, array $params): void {
        $couponId = (int)($params['id'] ?? 0);
        $restaurantId = (int)($request->post('restaurant_id', 1));

        $stmt = $this->db->prepare("SELECT active FROM coupons WHERE id = :id AND restaurant_id = :rid LIMIT 1");
        $stmt->execute([':id' => $couponId, ':rid' => $restaurantId]);
        $coupon = $stmt->fetch();

        if (!$coupon) {
            Response::error('Cupom não encontrado.', 404);
            return;
        }

        $newActive = (int)$coupon['active'] === 1 ? 0 : 1;
        $this->db->prepare("UPDATE coupons SET active = :act WHERE id = :id")->execute([':act' => $newActive, ':id' => $couponId]);

        Response::success([
            'id' => $couponId,
            'active' => $newActive
        ], $newActive === 1 ? 'Cupom ativado!' : 'Cupom desativado!');
    }

    /**
     * Validate Coupon for Client Checkout
     */
    public function validate(Request $request): void {
        $restaurantId = (int)($request->post('restaurant_id') ?? 1);
        $customerId = (int)($request->post('customer_id') ?? 0);
        $code = trim((string)$request->post('code'));
        $subtotal = (float)($request->post('subtotal') ?? 0.0);

        if (empty($code)) {
            Response::error('Código do cupom não informado.');
            return;
        }

        $result = $this->orderService->validateCoupon($restaurantId, $customerId, $code, $subtotal);

        if ($result['valid']) {
            Response::success($result);
        } else {
            Response::error($result['message'], 422);
        }
    }
}
