<?php
/**
 * REST Router (Router.php)
 * Flexible router supporting multi-subdomain prefixes (/app-api, /api, /liq/api)
 * Parameter extraction like /orders/{id}/status and middleware chaining
 */

declare(strict_types=1);

class Router {
    private array $routes = [];

    public function get(string $path, callable|array $handler, array $middlewares = []): void {
        $this->addRoute('GET', $path, $handler, $middlewares);
    }

    public function post(string $path, callable|array $handler, array $middlewares = []): void {
        $this->addRoute('POST', $path, $handler, $middlewares);
    }

    public function patch(string $path, callable|array $handler, array $middlewares = []): void {
        $this->addRoute('PATCH', $path, $handler, $middlewares);
    }

    public function put(string $path, callable|array $handler, array $middlewares = []): void {
        $this->addRoute('PUT', $path, $handler, $middlewares);
    }

    public function delete(string $path, callable|array $handler, array $middlewares = []): void {
        $this->addRoute('DELETE', $path, $handler, $middlewares);
    }

    public function options(string $path, callable|array $handler, array $middlewares = []): void {
        $this->addRoute('OPTIONS', $path, $handler, $middlewares);
    }

    /**
     * Normalize path to strip subfolder prefixes (/liq, /api, /app-api)
     */
    public static function normalizePath(string $path): string {
        $clean = '/' . ltrim($path, '/');

        // Strip local root folder /liq if present
        if (str_starts_with($clean, '/liq/')) {
            $clean = substr($clean, 4);
        } elseif ($clean === '/liq') {
            $clean = '/';
        }

        // Strip /app-api or /api prefix if present
        if (str_starts_with($clean, '/app-api/')) {
            $clean = substr($clean, 8);
        } elseif ($clean === '/app-api') {
            $clean = '/';
        } elseif (str_starts_with($clean, '/api/')) {
            $clean = substr($clean, 4);
        } elseif ($clean === '/api') {
            $clean = '/';
        }

        return '/' . ltrim($clean, '/');
    }

    private function addRoute(string $method, string $path, callable|array $handler, array $middlewares): void {
        $normalizedPath = self::normalizePath($path);

        // Convert route pattern {param} into regex (?P<param>[^/]+)
        $pattern = preg_replace('/\{([a-zA-Z0-9_]+)\}/', '(?P<$1>[^/]+)', $normalizedPath);
        $regex = '#^' . $pattern . '$#';

        $this->routes[] = [
            'method' => strtoupper($method),
            'originalPath' => $path,
            'normalizedPath' => $normalizedPath,
            'regex' => $regex,
            'handler' => $handler,
            'middlewares' => $middlewares
        ];
    }

    public function dispatch(Request $request): void {
        $reqMethod = $request->getMethod();
        $rawUri = $request->getUri();
        $normalizedUri = self::normalizePath($rawUri);

        // Handle pre-flight CORS OPTIONS requests immediately
        if ($reqMethod === 'OPTIONS') {
            http_response_code(204);
            exit;
        }

        foreach ($this->routes as $route) {
            if ($route['method'] !== $reqMethod) {
                continue;
            }

            if (preg_match($route['regex'], $normalizedUri, $matches)) {
                $params = [];
                foreach ($matches as $key => $value) {
                    if (is_string($key)) {
                        $params[$key] = $value;
                    }
                }

                // Execute middlewares
                foreach ($route['middlewares'] as $mw) {
                    if (is_callable($mw)) {
                        $proceed = $mw($request, $params);
                        if ($proceed === false) return;
                    }
                }

                // Execute handler
                $handler = $route['handler'];
                if (is_array($handler)) {
                    [$class, $action] = $handler;
                    $controller = new $class();
                    $controller->$action($request, $params);
                    return;
                }

                if (is_callable($handler)) {
                    $handler($request, $params);
                    return;
                }
            }
        }

        Response::error("Endpoint não encontrado: [{$reqMethod}] {$rawUri}", 404);
    }
}
