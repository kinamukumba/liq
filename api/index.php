<?php
/**
 * LIQ SAAS - Central API Front Controller (index.php)
 * Central REST Router Entrypoint for api.liq.ao/app-api and local environment
 */

declare(strict_types=1);

// Error handling: Catch errors and return JSON
error_reporting(E_ALL);
ini_set('display_errors', '0');

require_once __DIR__ . '/config/app.php';
require_once __DIR__ . '/middleware/CorsMiddleware.php';
require_once __DIR__ . '/core/Request.php';
require_once __DIR__ . '/core/Response.php';
require_once __DIR__ . '/core/Router.php';
require_once __DIR__ . '/core/Security.php';

// Handle CORS
CorsMiddleware::handle();

set_exception_handler(function (Throwable $e) {
    Response::error($e->getMessage(), 500);
});

// Load Controllers
require_once __DIR__ . '/controllers/AuthController.php';
require_once __DIR__ . '/controllers/MenuController.php';
require_once __DIR__ . '/controllers/OrderController.php';
require_once __DIR__ . '/controllers/CustomerController.php';
require_once __DIR__ . '/controllers/CouponController.php';
require_once __DIR__ . '/controllers/DashboardController.php';
require_once __DIR__ . '/controllers/BackofficeController.php';

$request = new Request();
$router = new Router();

// -----------------------------------------------------------
// Healthcheck Route (for load balancers and deployment probes)
// -----------------------------------------------------------
$router->get('/health', function (Request $req) {
    Response::success([
        'status' => 'UP',
        'app' => APP_NAME,
        'environment' => APP_ENV,
        'api_prefix' => API_PREFIX,
        'timestamp' => date('Y-m-d H:i:s')
    ], 'API operacional.');
});

// -----------------------------------------------------------
// Authentication & Restaurant Onboarding Routes (Auth Flow)
// -----------------------------------------------------------
$router->post('/auth/login', [AuthController::class, 'login']);
$router->post('/auth/register', [AuthController::class, 'register']);
$router->post('/auth/verify-email', [AuthController::class, 'verifyEmail']);
$router->post('/auth/verify-otp', [AuthController::class, 'verifyOtp']);
$router->post('/auth/new-password', [AuthController::class, 'newPassword']);
$router->post('/auth/logout', [AuthController::class, 'logout']);

// -----------------------------------------------------------
// Digital Menu & Table Resolution Routes
// -----------------------------------------------------------
$router->get('/menu', [MenuController::class, 'getMenu']);
$router->get('/menu/{slug}', [MenuController::class, 'getMenu']);

// -----------------------------------------------------------
// Customer Identification, Persistent Session & Wallet Routes
// -----------------------------------------------------------
$router->post('/customer/session', [CustomerController::class, 'getSession']);
$router->post('/customer/identify', [CustomerController::class, 'registerOrIdentify']);
$router->get('/customer/wallet', [CustomerController::class, 'getWallet']);

// -----------------------------------------------------------
// Orders & Real-time Kitchen (KDS) Routes
// -----------------------------------------------------------
$router->post('/orders', [OrderController::class, 'create']);
$router->get('/orders/kitchen', [OrderController::class, 'listKitchen']);
$router->get('/orders/{id}', [OrderController::class, 'get']);
$router->patch('/orders/{id}/status', [OrderController::class, 'updateStatus']);

// -----------------------------------------------------------
// Promotional Coupons Routes
// -----------------------------------------------------------
$router->post('/coupons/validate', [CouponController::class, 'validate']);

// -----------------------------------------------------------
// Restaurant Dashboard & Operational Analytics Routes
// -----------------------------------------------------------
$router->get('/dashboard', [DashboardController::class, 'getDashboard']);

// -----------------------------------------------------------
// Backoffice Super-Admin Routes (backoffice.liq.ao)
// -----------------------------------------------------------
$router->get('/backoffice/overview', [BackofficeController::class, 'getOverview']);
$router->get('/backoffice/restaurants', [BackofficeController::class, 'listRestaurants']);

// Dispatch Incoming Request
$router->dispatch($request);
