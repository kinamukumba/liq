<?php
/**
 * Database Configuration & Connection Management
 * PDO with Strict Typing, UTF-8 MB4, and Prepared Statements
 */

declare(strict_types=1);

class Database {
    private static ?PDO $instance = null;

    private static string $host = '127.0.0.1';
    private static string $port = '3306';
    private static string $dbname = 'liq_saas';
    private static string $username = 'root';
    private static string $password = '';
    private static string $charset = 'utf8mb4';

    public static function getConnection(): PDO {
        if (self::$instance === null) {
            $dsn = sprintf(
                'mysql:host=%s;port=%s;dbname=%s;charset=%s',
                self::$host,
                self::$port,
                self::$dbname,
                self::$charset
            );

            $options = [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
                PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci"
            ];

            try {
                self::$instance = new PDO($dsn, self::$username, self::$password, $options);
            } catch (PDOException $e) {
                // If database doesn't exist yet, attempt connecting to root server to initialize it
                if ($e->getCode() === 1049) {
                    $rootDsn = sprintf('mysql:host=%s;port=%s;charset=%s', self::$host, self::$port, self::$charset);
                    $rootPdo = new PDO($rootDsn, self::$username, self::$password, $options);
                    $rootPdo->exec("CREATE DATABASE IF NOT EXISTS `" . self::$dbname . "` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
                    self::$instance = new PDO($dsn, self::$username, self::$password, $options);
                } else {
                    throw $e;
                }
            }
        }

        return self::$instance;
    }
}
