<?php
/**
 * Dashboard Controller
 * Admin analytics and operations data (Rules 31-38, 52)
 */

declare(strict_types=1);

require_once __DIR__ . '/../core/Response.php';
require_once __DIR__ . '/../core/Request.php';
require_once __DIR__ . '/../services/DashboardService.php';

class DashboardController {
    private DashboardService $dashboardService;

    public function __construct() {
        $this->dashboardService = new DashboardService();
    }

    /**
     * Get Restaurant Dashboard Metrics
     * GET /api/dashboard
     */
    public function getDashboard(Request $request): void {
        $restaurantId = (int)($request->get('restaurant_id', 1));
        $metrics = $this->dashboardService->getRestaurantDashboardMetrics($restaurantId);
        Response::success($metrics);
    }
}
