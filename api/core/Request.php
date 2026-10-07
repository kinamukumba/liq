<?php
/**
 * Request Handler (Request.php)
 * Parses JSON bodies, headers, parameters, client IP and cookies
 */

declare(strict_types=1);

class Request {
    private array $body = [];
    private array $query = [];
    private array $cookies = [];
    private array $headers = [];
    private string $method;
    private string $uri;
    private string $host;

    public function __construct() {
        $this->method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
        $this->uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
        $this->host = strtolower($_SERVER['HTTP_HOST'] ?? 'localhost');
        $this->query = $_GET;
        $this->cookies = $_COOKIE;

        if (function_exists('getallheaders')) {
            $this->headers = getallheaders() ?: [];
        } else {
            $this->headers = [];
            foreach ($_SERVER as $name => $value) {
                if (str_starts_with($name, 'HTTP_')) {
                    $header = str_replace(' ', '-', ucwords(strtolower(str_replace('_', ' ', substr($name, 5)))));
                    $this->headers[$header] = $value;
                }
            }
        }

        if (in_array($this->method, ['POST', 'PUT', 'PATCH', 'DELETE'], true)) {
            $rawInput = file_get_contents('php://input');
            $decoded = json_decode((string)$rawInput, true);
            if (is_array($decoded)) {
                $this->body = $decoded;
            } else {
                $this->body = $_POST;
            }
        }
    }

    public function getMethod(): string {
        return $this->method;
    }

    public function getUri(): string {
        return $this->uri;
    }

    public function getHost(): string {
        return $this->host;
    }

    public function get(string $key, mixed $default = null): mixed {
        return $this->query[$key] ?? $default;
    }

    public function post(string $key, mixed $default = null): mixed {
        return $this->body[$key] ?? $default;
    }

    public function all(): array {
        return $this->body;
    }

    public function cookie(string $name, ?string $default = null): ?string {
        return $this->cookies[$name] ?? $default;
    }

    public function header(string $name, ?string $default = null): ?string {
        foreach ($this->headers as $key => $value) {
            if (strcasecmp($key, $name) === 0) {
                return $value;
            }
        }
        return $default;
    }

    public function getClientIp(): string {
        return $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
    }

    public function getUserAgent(): string {
        return $_SERVER['HTTP_USER_AGENT'] ?? 'Unknown';
    }
}
