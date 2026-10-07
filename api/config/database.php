<?php
/**
 * Database Configuration & Connection Management (database.php)
 * PDO with Strict Typing, UTF-8 MB4, Prepared Statements and Environment Variables
 */

declare(strict_types=1);

require_once __DIR__ . '/app.php';

class Database {
    private static ?PDO $instance = null;

    public static function getConnection(): PDO {
        if (self::$instance === null) {
            $host = (string)Env::get('DB_HOST', '127.0.0.1');
            $port = (string)Env::get('DB_PORT', '3306');
            $dbname = (string)Env::get('DB_NAME', 'liq_saas');
            $username = (string)Env::get('DB_USER', 'root');
            $password = (string)Env::get('DB_PASS', '');
            $charset = (string)Env::get('DB_CHARSET', 'utf8mb4');

            $dsn = sprintf(
                'mysql:host=%s;port=%s;dbname=%s;charset=%s',
                $host,
                $port,
                $dbname,
                $charset
            );

            $options = [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
                PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES {$charset} COLLATE {$charset}_unicode_ci"
            ];

            try {
                self::$instance = new PDO($dsn, $username, $password, $options);
            } catch (PDOException $e) {
                // In local dev, if database doesn't exist yet, attempt connecting to root server to initialize it
                if ($e->getCode() === 1049 && APP_ENV === 'development') {
                    $rootDsn = sprintf('mysql:host=%s;port=%s;charset=%s', $host, $port, $charset);
                    $rootPdo = new PDO($rootDsn, $username, $password, $options);
                    $rootPdo->exec("CREATE DATABASE IF NOT EXISTS `{$dbname}` CHARACTER SET {$charset} COLLATE {$charset}_unicode_ci");
                    self::$instance = new PDO($dsn, $username, $password, $options);
                } else {
                    throw $e;
                }
            }
        }

        return self::$instance;
    }
}
