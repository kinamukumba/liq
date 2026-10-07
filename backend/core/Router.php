<?php
/**
 * REST Router
 * Supports parameter matching like /api/orders/{id}/status and middleware chaining
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

    public function delete(string $path, callable|array $handler, array $middlewares = []): void {
        $this->addRoute('DELETE', $path, $handler, $middlewares);
    }

    private function addRoute(string $method, string $path, callable|array $handler, array $middlewares): void {
        // Convert route pattern {param} into regex (?P<param>[^/]+)
        $pattern = preg_replace('/\{([a-zA-Z0-9_]+)\}/', '(?P<$1>[^/]+)', $path);
        $regex = '#^' . $pattern . '$#';

        $this->routes[] = [
            'method' => $method,
            'path' => $path,
            'regex' => $regex,
            'handler' => $handler,
            'middlewares' => $middlewares
        ];
    }

    public function dispatch(Request $request): void {
        $reqMethod = $request->getMethod();
        $reqUri = $request->getUri();

        // Remove base directory prefix if hosted under subdirectory /liq
        $basePrefix = '/liq';
        if (str_starts_with($reqUri, $basePrefix)) {
            $reqUri = substr($reqUri, strlen($basePrefix));
            if ($reqUri === '') {
                $reqUri = '/';
            }
        }

        foreach ($this->routes as $route) {
            if ($route['method'] !== $reqMethod) {
                continue;
            }

            if (preg_match($route['regex'], $reqUri, $matches)) {
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

        Response::error('Endpoint não encontrado.', 404);
    }
}
