<?php
/**
 * Customer Session & Identification Service (Rules 12-21)
 * Multi-layer identification: Secure persistent cookie + Device UUID + SHA-256 token hashing
 */

declare(strict_types=1);

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../core/Security.php';

class CustomerSessionService {
    private PDO $db;
    public const COOKIE_NAME = 'liq_c_sess';
    public const DEVICE_COOKIE = 'liq_d_id';

    public function __construct() {
        $this->db = Database::getConnection();
    }

    /**
     * Get or initialize device UUID
     */
    public function getOrCreateDeviceId(?string $existingDeviceId = null): string {
        if (!empty($existingDeviceId) && preg_match('/^[a-f0-9\-]{36}$/i', $existingDeviceId)) {
            return $existingDeviceId;
        }
        $newDeviceId = Security::generateUUID();
        Security::setSecureCookie(self::DEVICE_COOKIE, $newDeviceId, 31536000); // 1 year
        return $newDeviceId;
    }

    /**
     * Identify customer by persistent session token
     */
    public function authenticateCustomer(?string $rawToken, int $restaurantId): ?array {
        if (empty($rawToken)) {
            return null;
        }

        $tokenHash = Security::hashToken($rawToken);

        $sql = "SELECT cs.id AS session_id, cs.customer_id, cs.device_id,
                       c.name, c.phone, c.email, c.status
                FROM customer_sessions cs
                INNER JOIN customers c ON cs.customer_id = c.id
                WHERE cs.token_hash = :token_hash
                  AND cs.restaurant_id = :restaurant_id
                  AND cs.revoked_at IS NULL
                  AND cs.expires_at > NOW()
                  AND c.status = 'ACTIVE'
                LIMIT 1";

        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            ':token_hash' => $tokenHash,
            ':restaurant_id' => $restaurantId
        ]);

        $session = $stmt->fetch();
        if ($session) {
            // Update last_used_at
            $update = $this->db->prepare("UPDATE customer_sessions SET last_used_at = NOW() WHERE id = :id");
            $update->execute([':id' => $session['session_id']]);

            return [
                'session_id' => (int)$session['session_id'],
                'customer_id' => (int)$session['customer_id'],
                'name' => $session['name'],
                'phone' => $session['phone'],
                'email' => $session['email']
            ];
        }

        return null;
    }

    /**
     * Register or find customer and generate persistent session (Rule 14 & 20)
     */
    public function createCustomerAndSession(int $restaurantId, string $name, string $phone, ?string $email, string $deviceId, ?string $deviceInfo = null): array {
        // 1. Check if customer already exists by phone
        $stmt = $this->db->prepare("SELECT id, name, phone, email FROM customers WHERE phone = :phone LIMIT 1");
        $stmt->execute([':phone' => $phone]);
        $customer = $stmt->fetch();

        if (!$customer) {
            $insert = $this->db->prepare("INSERT INTO customers (name, phone, email, status, created_at) VALUES (:name, :phone, :email, 'ACTIVE', NOW())");
            $insert->execute([
                ':name' => Security::sanitizeString($name),
                ':phone' => Security::sanitizeString($phone),
                ':email' => !empty($email) ? Security::sanitizeString($email) : null
            ]);
            $customerId = (int)$this->db->lastInsertId();
        } else {
            $customerId = (int)$customer['id'];
            // Update name if changed
            $update = $this->db->prepare("UPDATE customers SET name = :name WHERE id = :id");
            $update->execute([':name' => Security::sanitizeString($name), ':id' => $customerId]);
        }

        // 2. Generate random crypto token and store its SHA-256 hash
        $rawToken = Security::generateToken(32);
        $tokenHash = Security::hashToken($rawToken);
        $expiresAt = date('Y-m-d H:i:s', time() + (30 * 86400)); // 30 days session

        $sessStmt = $this->db->prepare("
            INSERT INTO customer_sessions (customer_id, restaurant_id, device_id, token_hash, device_info, expires_at, created_at)
            VALUES (:customer_id, :restaurant_id, :device_id, :token_hash, :device_info, :expires_at, NOW())
        ");
        $sessStmt->execute([
            ':customer_id' => $customerId,
            ':restaurant_id' => $restaurantId,
            ':device_id' => $deviceId,
            ':token_hash' => $tokenHash,
            ':device_info' => $deviceInfo ?? 'Web Browser',
            ':expires_at' => $expiresAt
        ]);

        // 3. Set persistent secure cookie
        Security::setSecureCookie(self::COOKIE_NAME, $rawToken, 30 * 86400);

        return [
            'customer_id' => $customerId,
            'name' => $name,
            'phone' => $phone,
            'email' => $email,
            'token' => $rawToken // Sent once to write to cookie
        ];
    }
}
