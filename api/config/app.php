<?php
/**
 * Application Bootstrap & Configuration (app.php)
 * Central configuration for environment, CORS, and subdomains
 */

declare(strict_types=1);

require_once __DIR__ . '/../core/Env.php';

// Load environment file
Env::load(__DIR__ . '/../.env');

// Core Application Constants
define('APP_ENV', Env::get('APP_ENV', 'development'));
define('APP_DEBUG', (bool)Env::get('APP_DEBUG', false));
define('APP_NAME', Env::get('APP_NAME', 'LIQ SAAS'));
define('API_PREFIX', Env::get('API_PREFIX', '/app-api'));

// Domains
define('DOMAIN_LANDING', Env::get('DOMAIN_LANDING', 'liq.ao'));
define('DOMAIN_APP', Env::get('DOMAIN_APP', 'app.liq.ao'));
define('DOMAIN_API', Env::get('DOMAIN_API', 'api.liq.ao'));
define('DOMAIN_BACKOFFICE', Env::get('DOMAIN_BACKOFFICE', 'backoffice.liq.ao'));

// Security & Tokens
define('JWT_SECRET', Env::get('JWT_SECRET', 'liq_default_secret_key'));
define('TOKEN_EXPIRY_SECONDS', (int)Env::get('TOKEN_EXPIRY_SECONDS', 86400));
define('SESSION_COOKIE_NAME', Env::get('SESSION_COOKIE_NAME', 'liq_auth_sess'));
define('DEVICE_COOKIE_NAME', Env::get('DEVICE_COOKIE_NAME', 'liq_d_id'));

// CORS Origins
$corsString = Env::get('CORS_ALLOWED_ORIGINS', 'http://localhost,https://liq.ao,https://app.liq.ao,https://backoffice.liq.ao');
$allowedOrigins = array_map('trim', explode(',', (string)$corsString));
define('CORS_ALLOWED_ORIGINS', $allowedOrigins);
