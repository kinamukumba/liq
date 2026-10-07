<?php
/**
 * Security Utility Class
 * Token hashing, Secure Cookies, Device UUID generation, and Sanitization
 */

declare(strict_types=1);

class Security {
    /**
     * Generate secure random UUID v4 for device identification (Rule 16)
     */
    public static function generateUUID(): string {
        $data = random_bytes(16);
        $data[6] = chr(ord($data[6]) & 0x0f | 0x40); // Version 4
        $data[8] = chr(ord($data[8]) & 0x3f | 0x80); // IETF variant
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
    }

    /**
     * Generate crypto-secure token
     */
    public static function generateToken(int $length = 32): string {
        return bin2hex(random_bytes($length));
    }

    /**
     * Hash token for database storage (Rule 14 & 15)
     * Plain token is returned to client cookie; hashed version is stored in database.
     */
    public static function hashToken(string $token): string {
        return hash('sha256', $token);
    }

    /**
     * Set a persistent secure cookie (Rule 14 & 18)
     */
    public static function setSecureCookie(string $name, string $value, int $expirySeconds = 2592000): void {
        $isHttps = (
            (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ||
            (isset($_SERVER['SERVER_PORT']) && $_SERVER['SERVER_PORT'] == 443) ||
            (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https')
        );

        setcookie($name, $value, [
            'expires' => time() + $expirySeconds,
            'path' => '/',
            'domain' => '',
            'secure' => $isHttps,
            'httponly' => true,
            'samesite' => 'Lax'
        ]);
    }

    /**
     * Remove secure cookie
     */
    public static function clearCookie(string $name): void {
        setcookie($name, '', [
            'expires' => time() - 3600,
            'path' => '/',
            'httponly' => true,
            'samesite' => 'Lax'
        ]);
    }

    /**
     * Sanitize string input against XSS
     */
    public static function sanitizeString(string $input): string {
        return htmlspecialchars(trim($input), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    }
}
