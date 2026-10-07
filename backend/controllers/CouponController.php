<?php
/**
 * Coupon Controller
 * Real-time server-side coupon validation (Rule 29)
 */

declare(strict_types=1);

require_once __DIR__ . '/../core/Response.php';
require_once __DIR__ . '/../core/Request.php';
require_once __DIR__ . '/../services/OrderService.php';

class CouponController {
    private OrderService $orderService;

    public function __construct() {
        $this->orderService = new OrderService();
    }

    /**
     * Validate Coupon
     * POST /api/coupons/validate
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
