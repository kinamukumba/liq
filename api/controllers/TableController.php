<?php
/**
 * Table Controller (TableController.php)
 * Endpoints for Restaurant Table Management and QR Code Generation
 */

declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../core/Response.php';
require_once __DIR__ . '/../core/Request.php';
require_once __DIR__ . '/../core/Security.php';

class TableController {
    private PDO $db;

    public function __construct() {
        $this->db = Database::getConnection();
    }

    /**
     * List all tables for a restaurant with active orders
     * GET /tables
     */
    public function list(Request $request): void {
        $restaurantId = (int)($request->get('restaurant_id', 1));

        $stmt = $this->db->prepare("
            SELECT t.id, t.restaurant_id, t.number, t.code, t.status, t.qr_token, t.nfc_token,
                   o.id as active_order_id, o.status as active_order_status, o.total as active_order_total,
                   o.created_at as active_order_created_at
            FROM tables t
            LEFT JOIN orders o ON o.table_id = t.id AND o.restaurant_id = t.restaurant_id AND o.status IN ('PENDING', 'CONFIRMED', 'PREPARING', 'READY')
            WHERE t.restaurant_id = :rid
            ORDER BY CAST(t.number AS UNSIGNED) ASC, t.number ASC
        ");
        $stmt->execute([':rid' => $restaurantId]);
        $tables = $stmt->fetchAll();

        // Calculate summary stats
        $summary = [
            'total' => count($tables),
            'available' => 0,
            'occupied' => 0,
            'cleaning' => 0
        ];

        foreach ($tables as $t) {
            if ($t['status'] === 'AVAILABLE') $summary['available']++;
            elseif ($t['status'] === 'OCCUPIED') $summary['occupied']++;
            elseif ($t['status'] === 'CLEANING') $summary['cleaning']++;
        }

        Response::success([
            'tables' => $tables,
            'summary' => $summary
        ]);
    }

    /**
     * Create a new table
     * POST /tables
     */
    public function create(Request $request): void {
        $restaurantId = (int)($request->post('restaurant_id', 1));
        $number = trim((string)$request->post('number'));
        $code = trim((string)$request->post('code'));

        if (empty($number)) {
            Response::error('Número da mesa é obrigatório.', 422);
            return;
        }

        if (empty($code)) {
            $code = 'T' . str_pad($number, 2, '0', STR_PAD_LEFT);
        }

        // Check if table number already exists
        $check = $this->db->prepare("SELECT id FROM tables WHERE restaurant_id = :rid AND number = :num LIMIT 1");
        $check->execute([':rid' => $restaurantId, ':num' => $number]);
        if ($check->fetch()) {
            Response::error("A Mesa {$number} já está cadastrada.", 409);
            return;
        }

        // Generate unique QR token
        $qrToken = 'qr_token_' . strtolower(preg_replace('/[^a-z0-9]/i', '', $number)) . '_' . substr(Security::generateToken(8), 0, 8);

        $stmt = $this->db->prepare("
            INSERT INTO tables (restaurant_id, number, code, qr_token, status)
            VALUES (:rid, :num, :code, :qr, 'AVAILABLE')
        ");
        $stmt->execute([
            ':rid' => $restaurantId,
            ':num' => $number,
            ':code' => $code,
            ':qr' => $qrToken
        ]);
        $tableId = (int)$this->db->lastInsertId();

        Response::success([
            'id' => $tableId,
            'number' => $number,
            'code' => $code,
            'qr_token' => $qrToken,
            'status' => 'AVAILABLE'
        ], 'Mesa cadastrada com sucesso!', 201);
    }

    /**
     * Update table status
     * PATCH /tables/{id}/status
     */
    public function updateStatus(Request $request, array $params): void {
        $tableId = (int)($params['id'] ?? 0);
        $restaurantId = (int)($request->post('restaurant_id', 1));
        $newStatus = trim((string)$request->post('status'));

        $allowedStatuses = ['AVAILABLE', 'OCCUPIED', 'CLEANING'];
        if (!in_array($newStatus, $allowedStatuses, true)) {
            Response::error('Estado de mesa inválido.', 422);
            return;
        }

        $stmt = $this->db->prepare("UPDATE tables SET status = :status WHERE id = :id AND restaurant_id = :rid");
        $stmt->execute([':status' => $newStatus, ':id' => $tableId, ':rid' => $restaurantId]);

        Response::success([
            'table_id' => $tableId,
            'status' => $newStatus
        ], 'Estado da mesa atualizado com sucesso.');
    }
}
