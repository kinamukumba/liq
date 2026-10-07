<?php
/**
 * Standard API Response Handler
 * Strictly filters out sensitive credentials (Rule 54)
 */

declare(strict_types=1);

class Response {
    private static array $blacklistKeys = [
        'password',
        'password_hash',
        'token_hash',
        'secret_key',
        'internal_credentials'
    ];

    public static function json(mixed $data, int $statusCode = 200): void {
        http_response_code($statusCode);
        header('Content-Type: application/json; charset=utf-8');
        header('X-Content-Type-Options: nosniff');
        header('X-Frame-Options: SAMEORIGIN');
        header('X-XSS-Protection: 1; mode=block');

        $sanitizedData = self::sanitizeOutput($data);
        echo json_encode($sanitizedData, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    public static function success(mixed $data = null, string $message = 'Operação realizada com sucesso.', int $statusCode = 200): void {
        self::json([
            'success' => true,
            'message' => $message,
            'data' => $data
        ], $statusCode);
    }

    public static function error(string $message, int $statusCode = 400, ?array $errors = null): void {
        self::json([
            'success' => false,
            'message' => $message,
            'errors' => $errors
        ], $statusCode);
    }

    private static function sanitizeOutput(mixed $data): mixed {
        if (!is_array($data)) {
            return $data;
        }

        $result = [];
        foreach ($data as $key => $value) {
            if (is_string($key) && in_array(strtolower($key), self::$blacklistKeys, true)) {
                continue; // Omit sensitive keys completely
            }
            $result[$key] = is_array($value) ? self::sanitizeOutput($value) : $value;
        }

        return $result;
    }
}
