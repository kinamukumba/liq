<?php
/**
 * CORS Middleware (CorsMiddleware.php)
 * Handles Cross-Origin Resource Sharing for liq.ao subdomains and localhost
 */

declare(strict_types=1);

require_once __DIR__ . '/../config/app.php';

class CorsMiddleware {
    public static function handle(): void {
        $origin = $_SERVER['HTTP_ORIGIN'] ?? '';

        if (!empty($origin)) {
            $parsed = parse_url($origin);
            $host = $parsed['host'] ?? '';

            // Check if origin matches localhost, 127.0.0.1, or ends with liq.ao
            $isAllowed = false;
            if (
                $host === 'localhost' ||
                $host === '127.0.0.1' ||
                $host === 'liq.ao' ||
                str_ends_with($host, '.liq.ao') ||
                in_array($origin, CORS_ALLOWED_ORIGINS, true)
            ) {
                $isAllowed = true;
            }

            if ($isAllowed) {
                header("Access-Control-Allow-Origin: {$origin}");
                header('Access-Control-Allow-Credentials: true');
                header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
                header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, Accept, Origin');
                header('Access-Control-Max-Age: 86400');
            }
        } else {
            // Default permissive in development mode
            if (APP_ENV === 'development') {
                header('Access-Control-Allow-Origin: *');
                header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
                header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, Accept, Origin');
            }
        }

        // Fast-exit for OPTIONS preflight requests
        if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
            http_response_code(204);
            exit;
        }
    }
}
