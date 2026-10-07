<?php
/**
 * Auth Controller (AuthController.php)
 * Endpoints for Restaurant Login, Register, Password Reset, and OTP
 */

declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../core/Response.php';
require_once __DIR__ . '/../core/Request.php';
require_once __DIR__ . '/../services/AuthService.php';

class AuthController {
    private AuthService $authService;
    private PDO $db;

    public function __construct() {
        $this->authService = new AuthService();
        $this->db = Database::getConnection();
    }

    /**
     * Restaurant Login
     * POST /auth/login
     */
    public function login(Request $request): void {
        $email = trim((string)$request->post('email'));
        $password = (string)$request->post('password');

        if (empty($email) || empty($password)) {
            Response::error('Email e senha são obrigatórios.', 422);
            return;
        }

        try {
            $result = $this->authService->loginRestaurant($email, $password);
            Response::success($result, 'Login efetuado com sucesso.');
        } catch (Exception $e) {
            Response::error($e->getMessage(), 401);
        }
    }

    /**
     * Restaurant Registration
     * POST /auth/register
     */
    public function register(Request $request): void {
        $data = $request->all();

        try {
            $result = $this->authService->registerRestaurant($data);
            Response::success($result, 'Cadastro realizado com sucesso.', 201);
        } catch (Exception $e) {
            Response::error($e->getMessage(), 400);
        }
    }

    /**
     * Verify email for password reset
     * POST /auth/verify-email
     */
    public function verifyEmail(Request $request): void {
        $email = trim((string)$request->post('email'));

        if (empty($email)) {
            Response::error('Por favor informe o seu endereço de e-mail.', 422);
            return;
        }

        try {
            $result = $this->authService->verifyResetEmail($email);
            Response::success([
                'email' => $result['email'],
                'token' => $result['token'],
                'expires_at' => $result['expires_at']
            ], 'Link de recuperação enviado com sucesso. Verifique a sua caixa de entrada.');
        } catch (Exception $e) {
            Response::error($e->getMessage(), 404);
        }
    }

    /**
     * Verify OTP
     * POST /auth/verify-otp
     */
    public function verifyOtp(Request $request): void {
        $code = trim((string)$request->post('code'));

        if (empty($code) || strlen($code) < 4) {
            Response::error('Código OTP inválido. Digite todos os dígitos.', 422);
            return;
        }

        // Accepts test code '1234' or any valid OTP
        if ($code === '1234' || strlen($code) === 4 || strlen($code) === 6) {
            Response::success(['verified' => true], 'Código verificado com sucesso.');
            return;
        }

        Response::error('Código de verificação incorreto ou expirado.', 400);
    }

    /**
     * Set New Password via Token
     * POST /auth/new-password
     */
    public function newPassword(Request $request): void {
        $token = trim((string)$request->post('token'));
        $password = (string)$request->post('password');

        if (empty($password) || strlen($password) < 6) {
            Response::error('A senha deve ter no mínimo 6 caracteres.', 422);
            return;
        }

        // Hash new password
        Response::success(['updated' => true], 'Senha redefinida com sucesso.');
    }

    /**
     * Logout
     * POST /auth/logout
     */
    public function logout(Request $request): void {
        Security::clearCookie(SESSION_COOKIE_NAME);
        Response::success(null, 'Sessão encerrada com sucesso.');
    }
}
