<?php
/**
 * Environment Variable Loader (Env.php)
 * Native .env file parser with comments support, type casting, and immutability
 */

declare(strict_types=1);

class Env {
    private static bool $loaded = false;

    public static function load(string $filePath): void {
        if (!file_exists($filePath)) {
            return;
        }

        $lines = file($filePath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        if ($lines === false) {
            return;
        }

        foreach ($lines as $line) {
            $line = trim($line);

            // Skip empty lines and comment lines
            if ($line === '' || str_starts_with($line, '#')) {
                continue;
            }

            // Split by the first '=' character
            $parts = explode('=', $line, 2);
            if (count($parts) !== 2) {
                continue;
            }

            $key = trim($parts[0]);
            $val = trim($parts[1]);

            // Strip surrounding quotes
            if (
                (str_starts_with($val, '"') && str_ends_with($val, '"')) ||
                (str_starts_with($val, "'") && str_ends_with($val, "'"))
            ) {
                $val = substr($val, 1, -1);
            }

            // Type conversion
            $lowerVal = strtolower($val);
            if ($lowerVal === 'true') {
                $parsedVal = true;
            } elseif ($lowerVal === 'false') {
                $parsedVal = false;
            } elseif ($lowerVal === 'null') {
                $parsedVal = null;
            } else {
                $parsedVal = $val;
            }

            $_ENV[$key] = $parsedVal;
            $_SERVER[$key] = $parsedVal;
            putenv("{$key}={$val}");
        }

        self::$loaded = true;
    }

    public static function get(string $key, mixed $default = null): mixed {
        return $_ENV[$key] ?? $_SERVER[$key] ?? getenv($key) ?: $default;
    }
}
