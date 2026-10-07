<?php
/**
 * Database Migration Script
 */
require_once __DIR__ . '/config/database.php';

try {
    $db = Database::getConnection();
    $sql = file_get_contents(__DIR__ . '/database/schema.sql');
    
    // Execute schema commands
    $db->exec($sql);
    
    echo "SUCCESS: Schema migrated successfully!\n";
    
    // Verify tables
    $tables = $db->query("SHOW TABLES")->fetchAll(PDO::FETCH_COLUMN);
    echo "Total tables created: " . count($tables) . "\n";
    foreach ($tables as $t) {
        echo " - " . $t . "\n";
    }
} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
}
