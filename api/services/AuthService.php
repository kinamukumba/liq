<?php
/**
 * Restaurant Authentication & Onboarding Service (AuthService.php)
 * Multi-tenant authentication, OTP verification, Password resets (10-min tokens)
 */

declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../core/Security.php';

class AuthService {
    private PDO $db;

    public function __construct() {
        $this->db = Database::getConnection();
    }

    /**
     * Restaurant Login
     */
    public function loginRestaurant(string $email, string $password): array {
        $email = strtolower(trim($email));

        $stmt = $this->db->prepare("
            SELECT u.id, ru.restaurant_id, u.name, u.email, u.password_hash, u.role, u.status,
                   r.name as restaurant_name, r.slug as restaurant_slug
            FROM users u
            LEFT JOIN restaurant_users ru ON ru.user_id = u.id
            LEFT JOIN restaurants r ON ru.restaurant_id = r.id
            WHERE LOWER(u.email) = :email
            LIMIT 1
        ");
        $stmt->execute([':email' => $email]);
        $user = $stmt->fetch();

        if (!$user) {
            throw new RuntimeException('Credenciais inválidas. Verifique seu email e senha.');
        }

        if ($user['status'] !== 'ACTIVE') {
            throw new RuntimeException('Esta conta está inativa ou bloqueada.');
        }

        if (!Security::verifyPassword($password, $user['password_hash'])) {
            throw new RuntimeException('Credenciais inválidas. Verifique seu email e senha.');
        }

        // Generate session token
        $sessionToken = Security::generateToken(32);
        $tokenHash = Security::hashToken($sessionToken);

        // Store session or update last login
        $this->db->prepare("UPDATE users SET updated_at = NOW() WHERE id = :id")->execute([':id' => $user['id']]);

        // Set auth cookie
        Security::setSecureCookie(SESSION_COOKIE_NAME, $sessionToken, TOKEN_EXPIRY_SECONDS);

        return [
            'user_id' => (int)$user['id'],
            'restaurant_id' => (int)$user['restaurant_id'],
            'restaurant_name' => $user['restaurant_name'] ?? 'Meu Restaurante',
            'restaurant_slug' => $user['restaurant_slug'] ?? 'restaurante',
            'name' => $user['name'],
            'email' => $user['email'],
            'role' => $user['role'],
            'token' => $sessionToken
        ];
    }

    /**
     * Verify email for password reset (checks if email exists in DB)
     */
    public function verifyResetEmail(string $email): array {
        $email = strtolower(trim($email));

        $stmt = $this->db->prepare("SELECT id, name, email FROM users WHERE LOWER(email) = :email AND status = 'ACTIVE' LIMIT 1");
        $stmt->execute([':email' => $email]);
        $user = $stmt->fetch();

        if (!$user) {
            throw new RuntimeException('Nenhuma conta associada a este endereço de e-mail foi encontrada.');
        }

        // Generate 10-minute token
        $token = Security::generateToken(32);
        $expiresAt = date('Y-m-d H:i:s', time() + (10 * 60)); // 10 minutes strictly

        return [
            'user_id' => (int)$user['id'],
            'email' => $user['email'],
            'token' => $token,
            'expires_at' => $expiresAt
        ];
    }

    /**
     * Register Restaurant and User
     */
    public function registerRestaurant(array $data): array {
        $name = Security::sanitizeString($data['name'] ?? '');
        $email = strtolower(trim($data['email'] ?? ''));
        $phone = Security::sanitizeString($data['phone'] ?? '');
        $password = (string)($data['password'] ?? '');
        $location = Security::sanitizeString($data['location'] ?? 'Luanda, Angola');

        if (empty($name) || empty($email) || empty($password)) {
            throw new InvalidArgumentException('Preencha todos os campos obrigatórios.');
        }

        // Check if email already exists
        $check = $this->db->prepare("SELECT id FROM users WHERE LOWER(email) = :email LIMIT 1");
        $check->execute([':email' => $email]);
        if ($check->fetch()) {
            throw new RuntimeException('Este endereço de e-mail já está registrado na plataforma.');
        }

        $slug = preg_replace('/[^a-z0-9]+/i', '-', strtolower($name));
        $slug = trim($slug, '-');

        $this->db->beginTransaction();
        try {
            // Create Restaurant
            $restStmt = $this->db->prepare("
                INSERT INTO restaurants (name, slug, email, phone, address, status, currency, created_at)
                VALUES (:name, :slug, :email, :phone, :address, 'ACTIVE', 'Kz', NOW())
            ");
            $restStmt->execute([
                ':name' => $name,
                ':slug' => $slug,
                ':email' => $email,
                ':phone' => $phone,
                ':address' => $location
            ]);
            $restaurantId = (int)$this->db->lastInsertId();

            // Create User
            $passwordHash = Security::hashPassword($password);
            $userStmt = $this->db->prepare("
                INSERT INTO users (name, email, password_hash, role, status, created_at)
                VALUES (:name, :email, :pwd, 'RESTAURANT_OWNER', 'ACTIVE', NOW())
            ");
            $userStmt->execute([
                ':name' => $name,
                ':email' => $email,
                ':pwd' => $passwordHash
            ]);
            $userId = (int)$this->db->lastInsertId();

            // Link User to Restaurant
            $ruStmt = $this->db->prepare("
                INSERT INTO restaurant_users (restaurant_id, user_id, role, created_at)
                VALUES (:rid, :uid, 'RESTAURANT_OWNER', NOW())
            ");
            $ruStmt->execute([
                ':rid' => $restaurantId,
                ':uid' => $userId
            ]);

            $this->db->commit();

            return [
                'user_id' => $userId,
                'restaurant_id' => $restaurantId,
                'restaurant_slug' => $slug,
                'name' => $name,
                'email' => $email
            ];
        } catch (Exception $e) {
            $this->db->rollBack();
            throw $e;
        }
    }
}
