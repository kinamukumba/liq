<?php
/**
 * Database Migration Script (migrate.php)
 * Runs schema migrations using config/database.php
 */

declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';

try {
    $db = Database::getConnection();
    $sqlPath = __DIR__ . '/schema.sql';

    if (!file_exists($sqlPath)) {
        throw new RuntimeException("Arquivo de schema não encontrado: {$sqlPath}");
    }

    $sql = file_get_contents($sqlPath);
    $db->exec($sql);

    echo "SUCCESS: Schema migrado com sucesso!\n";

    $tables = $db->query("SHOW TABLES")->fetchAll(PDO::FETCH_COLUMN);
    echo "Total de tabelas no banco de dados (" . count($tables) . "):\n";
    foreach ($tables as $t) {
        echo " - " . $t . "\n";
    }
} catch (Exception $e) {
    echo "ERRO NA MIGRAÇÃO: " . $e->getMessage() . "\n";
    exit(1);
}
