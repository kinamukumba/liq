<?php
/**
 * Order Service
 * Enterprise-grade financial calculation, inventory check, and order lifecycle management
 */

declare(strict_types=1);

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../core/Security.php';

class OrderService {
    private PDO $db;

    public function __construct() {
        $this->db = Database::getConnection();
    }

    /**
     * Create Order with 100% server-side calculation and coupon validation
     * Rule 71: "Nunca confiar no frontend para validação financeira / Aceitar preços enviados pelo cliente sem validação"
     */
    public function createOrder(int $restaurantId, int $customerId, int $tableId, array $items, ?string $couponCode = null, ?string $notes = null): array {
        if (empty($items)) {
            throw new InvalidArgumentException('O pedido deve conter pelo menos um item.');
        }

        // Verify table belongs to restaurant and is valid
        $tblStmt = $this->db->prepare("SELECT id, number, status FROM tables WHERE id = :id AND restaurant_id = :rid LIMIT 1");
        $tblStmt->execute([':id' => $tableId, ':rid' => $restaurantId]);
        $table = $tblStmt->fetch();
        if (!$table) {
            throw new RuntimeException('Mesa não encontrada para este restaurante.');
        }

        $this->db->beginTransaction();

        try {
            $subtotal = 0.0;
            $verifiedItems = [];

            // 1. Fetch official active prices and names directly from DB
            $productIds = array_column($items, 'product_id');
            $placeholders = implode(',', array_fill(0, count($productIds), '?'));
            $prodStmt = $this->db->prepare("
                SELECT id, name, price, is_available 
                FROM products 
                WHERE id IN ($placeholders) AND restaurant_id = ?
            ");
            $params = array_merge($productIds, [$restaurantId]);
            $prodStmt->execute($params);
            $productMap = [];
            while ($row = $prodStmt->fetch()) {
                $productMap[(int)$row['id']] = $row;
            }

            foreach ($items as $item) {
                $pId = (int)($item['product_id'] ?? 0);
                $qty = max(1, (int)($item['quantity'] ?? 1));
                $itemNote = isset($item['notes']) ? Security::sanitizeString($item['notes']) : null;

                if (!isset($productMap[$pId])) {
                    throw new RuntimeException("O produto #{$pId} não foi encontrado no cardápio.");
                }

                $product = $productMap[$pId];
                if ((int)$product['is_available'] !== 1) {
                    throw new RuntimeException("O produto '{$product['name']}' está temporariamente indisponível.");
                }

                $unitPrice = (float)$product['price'];
                $itemSubtotal = $unitPrice * $qty;
                $subtotal += $itemSubtotal;

                $verifiedItems[] = [
                    'product_id' => $pId,
                    'name_snapshot' => $product['name'],
                    'unit_price' => $unitPrice,
                    'quantity' => $qty,
                    'subtotal' => $itemSubtotal,
                    'notes' => $itemNote
                ];
            }

            // 2. Validate Coupon Server-side (Rule 29)
            $discount = 0.0;
            $couponId = null;
            if (!empty($couponCode)) {
                $couponRes = $this->validateCouponInternal($restaurantId, $customerId, $couponCode, $subtotal);
                if ($couponRes['valid']) {
                    $discount = $couponRes['discount'];
                    $couponId = $couponRes['coupon_id'];
                }
            }

            $total = max(0.0, $subtotal - $discount);

            // 3. Insert Order
            $orderStmt = $this->db->prepare("
                INSERT INTO orders (
                    restaurant_id, customer_id, table_id, status, subtotal, discount, total, coupon_id, notes, created_at
                ) VALUES (
                    :rid, :cid, :tid, 'PENDING', :subtotal, :discount, :total, :coupon_id, :notes, NOW()
                )
            ");
            $orderStmt->execute([
                ':rid' => $restaurantId,
                ':cid' => $customerId,
                ':tid' => $tableId,
                ':subtotal' => $subtotal,
                ':discount' => $discount,
                ':total' => $total,
                ':coupon_id' => $couponId,
                ':notes' => $notes ? Security::sanitizeString($notes) : null
            ]);
            $orderId = (int)$this->db->lastInsertId();

            // 4. Insert Order Items with Snapshot (Rule 48)
            $itemInsert = $this->db->prepare("
                INSERT INTO order_items (
                    order_id, product_id, product_name_snapshot, unit_price, quantity, subtotal, notes, created_at
                ) VALUES (
                    :order_id, :product_id, :name_snapshot, :unit_price, :quantity, :subtotal, :notes, NOW()
                )
            ");

            foreach ($verifiedItems as $vi) {
                $itemInsert->execute([
                    ':order_id' => $orderId,
                    ':product_id' => $vi['product_id'],
                    ':name_snapshot' => $vi['name_snapshot'],
                    ':unit_price' => $vi['unit_price'],
                    ':quantity' => $vi['quantity'],
                    ':subtotal' => $vi['subtotal'],
                    ':notes' => $vi['notes']
                ]);
            }

            // 5. Update Table Status to OCCUPIED if currently AVAILABLE
            $this->db->prepare("
                UPDATE tables 
                SET status = 'OCCUPIED' 
                WHERE id = :id AND status IN ('AVAILABLE', 'WAITING_ORDER')
            ")->execute([':id' => $tableId]);

            // 6. Record Coupon Redemption if applied
            if ($couponId) {
                $this->db->prepare("
                    INSERT INTO coupon_redemptions (coupon_id, customer_id, order_id, discount_applied, redeemed_at)
                    VALUES (:coupon_id, :customer_id, :order_id, :discount, NOW())
                ")->execute([
                    ':coupon_id' => $couponId,
                    ':customer_id' => $customerId,
                    ':order_id' => $orderId,
                    ':discount' => $discount
                ]);
            }

            // 7. Update Customer last order timestamp
            $this->db->prepare("UPDATE customers SET last_order_at = NOW() WHERE id = :cid")
                     ->execute([':cid' => $customerId]);

            $this->db->commit();

            return [
                'order_id' => $orderId,
                'status' => 'PENDING',
                'subtotal' => $subtotal,
                'discount' => $discount,
                'total' => $total,
                'table_number' => $table['number'],
                'items_count' => count($verifiedItems)
            ];
        } catch (Exception $e) {
            $this->db->rollBack();
            throw $e;
        }
    }

    /**
     * Update Order Status & handle lifecycle transitions and loyalty points (Rule 11, 24, 62, 66)
     */
    public function updateOrderStatus(int $restaurantId, int $orderId, string $newStatus): array {
        $allowedStatuses = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'DELIVERING', 'COMPLETED', 'CANCELLED'];
        if (!in_array($newStatus, $allowedStatuses, true)) {
            throw new InvalidArgumentException("Estado de pedido '{$newStatus}' inválido.");
        }

        $stmt = $this->db->prepare("
            SELECT id, restaurant_id, customer_id, table_id, status, total 
            FROM orders 
            WHERE id = :id AND restaurant_id = :rid 
            LIMIT 1
        ");
        $stmt->execute([':id' => $orderId, ':rid' => $restaurantId]);
        $order = $stmt->fetch();

        if (!$order) {
            throw new RuntimeException("Pedido não encontrado.");
        }

        $timestampField = match ($newStatus) {
            'CONFIRMED' => 'confirmed_at',
            'PREPARING' => 'preparing_at',
            'READY' => 'ready_at',
            'COMPLETED' => 'completed_at',
            'CANCELLED' => 'cancelled_at',
            default => null
        };

        $sql = "UPDATE orders SET status = :status, updated_at = NOW()";
        if ($timestampField) {
            $sql .= ", {$timestampField} = IFNULL({$timestampField}, NOW())";
        }
        $sql .= " WHERE id = :id";

        $update = $this->db->prepare($sql);
        $update->execute([':status' => $newStatus, ':id' => $orderId]);

        // When order is completed: award loyalty points (Rule 24, 62)
        if ($newStatus === 'COMPLETED' && $order['status'] !== 'COMPLETED') {
            $this->processLoyaltyPointsOnCompletion($restaurantId, (int)$order['customer_id'], $orderId, (float)$order['total']);
        }

        return [
            'order_id' => $orderId,
            'old_status' => $order['status'],
            'new_status' => $newStatus
        ];
    }

    /**
     * Server-side coupon validation
     */
    public function validateCoupon(int $restaurantId, int $customerId, string $code, float $cartSubtotal): array {
        return $this->validateCouponInternal($restaurantId, $customerId, $code, $cartSubtotal);
    }

    private function validateCouponInternal(int $restaurantId, int $customerId, string $code, float $subtotal): array {
        $stmt = $this->db->prepare("
            SELECT id, code, type, value, minimum_order, maximum_discount, usage_limit, usage_per_customer, starts_at, expires_at, active
            FROM coupons
            WHERE restaurant_id = :rid AND code = :code
            LIMIT 1
        ");
        $stmt->execute([':rid' => $restaurantId, ':code' => trim($code)]);
        $coupon = $stmt->fetch();

        if (!$coupon || (int)$coupon['active'] !== 1) {
            return ['valid' => false, 'message' => 'Cupom não existe ou está inativo.'];
        }

        $now = date('Y-m-d H:i:s');
        if ($now < $coupon['starts_at'] || $now > $coupon['expires_at']) {
            return ['valid' => false, 'message' => 'Cupom expirado ou fora do período de validade.'];
        }

        if ($subtotal < (float)$coupon['minimum_order']) {
            $minFormatted = number_format((float)$coupon['minimum_order'], 2, ',', '.') . ' Kz';
            return ['valid' => false, 'message' => "Pedido mínimo de {$minFormatted} necessário para aplicar este cupom."];
        }

        // Check customer usage limit
        $redemptionsStmt = $this->db->prepare("
            SELECT COUNT(*) FROM coupon_redemptions WHERE coupon_id = :cid AND customer_id = :cust_id
        ");
        $redemptionsStmt->execute([':cid' => $coupon['id'], ':cust_id' => $customerId]);
        $customerUses = (int)$redemptionsStmt->fetchColumn();

        if ($customerUses >= (int)$coupon['usage_per_customer']) {
            return ['valid' => false, 'message' => 'Você já atingiu o limite de utilizações deste cupom.'];
        }

        // Calculate discount
        $discount = 0.0;
        if ($coupon['type'] === 'PERCENTAGE') {
            $discount = round(($subtotal * (float)$coupon['value']) / 100, 2);
            if (!empty($coupon['maximum_discount']) && $discount > (float)$coupon['maximum_discount']) {
                $discount = (float)$coupon['maximum_discount'];
            }
        } elseif ($coupon['type'] === 'FIXED') {
            $discount = min($subtotal, (float)$coupon['value']);
        }

        return [
            'valid' => true,
            'coupon_id' => (int)$coupon['id'],
            'code' => $coupon['code'],
            'discount' => $discount,
            'message' => 'Cupom aplicado com sucesso!'
        ];
    }

    /**
     * Process Loyalty Points on order completion (Rule 24, 62)
     */
    private function processLoyaltyPointsOnCompletion(int $restaurantId, int $customerId, int $orderId, float $totalSpent): void {
        // Find active loyalty program
        $lpStmt = $this->db->prepare("SELECT id, type, rules FROM loyalty_programs WHERE restaurant_id = :rid AND active = 1 LIMIT 1");
        $lpStmt->execute([':rid' => $restaurantId]);
        $lp = $lpStmt->fetch();

        // 1.000 Kz = 10 pontos (1 ponto a cada 100 Kz)
        $earnedPoints = (int)floor($totalSpent / 100);
        if ($earnedPoints > 0) {
            $lt = $this->db->prepare("
                INSERT INTO loyalty_transactions (customer_id, restaurant_id, order_id, type, points, description, created_at)
                VALUES (:cid, :rid, :oid, 'EARN', :pts, :descr, NOW())
            ");
            $lt->execute([
                ':cid' => $customerId,
                ':rid' => $restaurantId,
                ':oid' => $orderId,
                ':pts' => $earnedPoints,
                ':descr' => "Pontos ganhos no Pedido #{$orderId}"
            ]);
        }
    }
}
