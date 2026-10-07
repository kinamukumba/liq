-- ========================================================
-- PLATAFORMA SAAS DE ATENDIMENTO, PEDIDOS E FIDELIZAÇÃO
-- SCHEMA OFICIAL DE BANCO DE DADOS (MySQL / MariaDB)
-- Compatibilidade: MySQL 5.7+ / MariaDB 10.3+
-- Engine: InnoDB | Collation: utf8mb4_unicode_ci
-- ========================================================

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Tabela: restaurants
CREATE TABLE IF NOT EXISTS `restaurants` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(150) NOT NULL,
    `slug` VARCHAR(100) NOT NULL UNIQUE,
    `logo` VARCHAR(255) DEFAULT NULL,
    `description` TEXT DEFAULT NULL,
    `phone` VARCHAR(30) DEFAULT NULL,
    `email` VARCHAR(150) DEFAULT NULL,
    `address` VARCHAR(255) DEFAULT NULL,
    `currency` VARCHAR(10) DEFAULT 'Kz',
    `status` ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED') DEFAULT 'ACTIVE',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_restaurant_slug` (`slug`),
    INDEX `idx_restaurant_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Tabela: users (Staff, Gerentes, Restaurateurs, Super Admins)
CREATE TABLE IF NOT EXISTS `users` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(120) NOT NULL,
    `email` VARCHAR(150) NOT NULL UNIQUE,
    `password_hash` VARCHAR(255) NOT NULL,
    `role` ENUM('SUPER_ADMIN', 'RESTAURANT_OWNER', 'MANAGER', 'STAFF') NOT NULL DEFAULT 'STAFF',
    `status` ENUM('ACTIVE', 'INACTIVE') DEFAULT 'ACTIVE',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_users_role` (`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Tabela: restaurant_users (Vínculo Tenant x Usuário)
CREATE TABLE IF NOT EXISTS `restaurant_users` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `restaurant_id` INT UNSIGNED NOT NULL,
    `user_id` INT UNSIGNED NOT NULL,
    `role` ENUM('RESTAURANT_OWNER', 'MANAGER', 'STAFF') NOT NULL DEFAULT 'STAFF',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY `uk_restaurant_user` (`restaurant_id`, `user_id`),
    CONSTRAINT `fk_ru_restaurant` FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_ru_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Tabela: tables (Mesas)
CREATE TABLE IF NOT EXISTS `tables` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `restaurant_id` INT UNSIGNED NOT NULL,
    `number` VARCHAR(20) NOT NULL,
    `code` VARCHAR(50) NOT NULL,
    `qr_token` VARCHAR(64) NOT NULL,
    `nfc_token` VARCHAR(64) DEFAULT NULL,
    `status` ENUM('AVAILABLE', 'OCCUPIED', 'WAITING_ORDER', 'ORDERING', 'WAITING_PAYMENT', 'CLEANING', 'INACTIVE') NOT NULL DEFAULT 'AVAILABLE',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `uk_restaurant_table_code` (`restaurant_id`, `code`),
    UNIQUE KEY `uk_table_qr_token` (`qr_token`),
    INDEX `idx_tables_restaurant` (`restaurant_id`, `status`),
    CONSTRAINT `fk_tables_restaurant` FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Tabela: categories
CREATE TABLE IF NOT EXISTS `categories` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `restaurant_id` INT UNSIGNED NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `slug` VARCHAR(120) NOT NULL,
    `sort_order` INT NOT NULL DEFAULT 0,
    `is_active` TINYINT(1) NOT NULL DEFAULT 1,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_categories_restaurant` (`restaurant_id`, `is_active`, `sort_order`),
    CONSTRAINT `fk_categories_restaurant` FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Tabela: products (Itens do Cardápio)
CREATE TABLE IF NOT EXISTS `products` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `restaurant_id` INT UNSIGNED NOT NULL,
    `category_id` INT UNSIGNED NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `type` ENUM('DISH', 'PRODUCT') NOT NULL DEFAULT 'DISH',
    `description` TEXT DEFAULT NULL,
    `image` VARCHAR(255) DEFAULT NULL,
    `price` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    `is_available` TINYINT(1) NOT NULL DEFAULT 1,
    `is_featured` TINYINT(1) NOT NULL DEFAULT 0,
    `sort_order` INT NOT NULL DEFAULT 0,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_products_restaurant` (`restaurant_id`, `is_available`, `category_id`),
    INDEX `idx_products_featured` (`restaurant_id`, `is_featured`),
    CONSTRAINT `fk_products_restaurant` FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_products_category` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Tabela: customers (Clientes identificados/recorrentes)
CREATE TABLE IF NOT EXISTS `customers` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(120) NOT NULL,
    `phone` VARCHAR(30) NOT NULL,
    `email` VARCHAR(150) DEFAULT NULL,
    `status` ENUM('ACTIVE', 'BLOCKED') NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `last_order_at` DATETIME DEFAULT NULL,
    UNIQUE KEY `uk_customer_phone` (`phone`),
    INDEX `idx_customers_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Tabela: customer_sessions (Sessões persistentes de dispositivo)
CREATE TABLE IF NOT EXISTS `customer_sessions` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `customer_id` INT UNSIGNED NOT NULL,
    `restaurant_id` INT UNSIGNED NOT NULL,
    `device_id` VARCHAR(64) NOT NULL,
    `token_hash` VARCHAR(64) NOT NULL UNIQUE,
    `device_info` VARCHAR(150) DEFAULT NULL,
    `expires_at` DATETIME NOT NULL,
    `last_used_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `revoked_at` DATETIME DEFAULT NULL,
    INDEX `idx_cs_lookup` (`token_hash`, `revoked_at`, `expires_at`),
    INDEX `idx_cs_customer` (`customer_id`, `restaurant_id`),
    CONSTRAINT `fk_cs_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_cs_restaurant` FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Tabela: coupons (Cupons de desconto)
CREATE TABLE IF NOT EXISTS `coupons` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `restaurant_id` INT UNSIGNED NOT NULL,
    `code` VARCHAR(40) NOT NULL,
    `type` ENUM('PERCENTAGE', 'FIXED', 'FREE_PRODUCT', 'MIN_ORDER') NOT NULL DEFAULT 'PERCENTAGE',
    `value` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    `minimum_order` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    `maximum_discount` DECIMAL(12,2) DEFAULT NULL,
    `usage_limit` INT UNSIGNED DEFAULT NULL,
    `usage_per_customer` INT UNSIGNED NOT NULL DEFAULT 1,
    `starts_at` DATETIME NOT NULL,
    `expires_at` DATETIME NOT NULL,
    `active` TINYINT(1) NOT NULL DEFAULT 1,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY `uk_restaurant_coupon` (`restaurant_id`, `code`),
    INDEX `idx_coupon_validity` (`restaurant_id`, `active`, `starts_at`, `expires_at`),
    CONSTRAINT `fk_coupons_restaurant` FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. Tabela: orders (Pedidos)
CREATE TABLE IF NOT EXISTS `orders` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `restaurant_id` INT UNSIGNED NOT NULL,
    `customer_id` INT UNSIGNED NOT NULL,
    `table_id` INT UNSIGNED NOT NULL,
    `status` ENUM('PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'DELIVERING', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `subtotal` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    `discount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    `total` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    `coupon_id` INT UNSIGNED DEFAULT NULL,
    `notes` TEXT DEFAULT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `confirmed_at` DATETIME DEFAULT NULL,
    `preparing_at` DATETIME DEFAULT NULL,
    `ready_at` DATETIME DEFAULT NULL,
    `completed_at` DATETIME DEFAULT NULL,
    `cancelled_at` DATETIME DEFAULT NULL,
    INDEX `idx_orders_status` (`restaurant_id`, `status`, `created_at`),
    INDEX `idx_orders_customer` (`customer_id`, `created_at`),
    INDEX `idx_orders_table` (`table_id`, `status`),
    CONSTRAINT `fk_orders_restaurant` FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_orders_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE RESTRICT,
    CONSTRAINT `fk_orders_table` FOREIGN KEY (`table_id`) REFERENCES `tables` (`id`) ON DELETE RESTRICT,
    CONSTRAINT `fk_orders_coupon` FOREIGN KEY (`coupon_id`) REFERENCES `coupons` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. Tabela: order_items (Itens do Pedido com Snapshot imutável de preço)
CREATE TABLE IF NOT EXISTS `order_items` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `order_id` INT UNSIGNED NOT NULL,
    `product_id` INT UNSIGNED NOT NULL,
    `product_name_snapshot` VARCHAR(150) NOT NULL,
    `unit_price` DECIMAL(12,2) NOT NULL,
    `quantity` INT UNSIGNED NOT NULL DEFAULT 1,
    `subtotal` DECIMAL(12,2) NOT NULL,
    `notes` VARCHAR(255) DEFAULT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_oi_order` (`order_id`),
    INDEX `idx_oi_product` (`product_id`),
    CONSTRAINT `fk_oi_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_oi_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. Tabela: coupon_redemptions (Resgates de Cupom)
CREATE TABLE IF NOT EXISTS `coupon_redemptions` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `coupon_id` INT UNSIGNED NOT NULL,
    `customer_id` INT UNSIGNED NOT NULL,
    `order_id` INT UNSIGNED NOT NULL,
    `discount_applied` DECIMAL(12,2) NOT NULL,
    `redeemed_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_cr_lookup` (`coupon_id`, `customer_id`),
    CONSTRAINT `fk_cr_coupon` FOREIGN KEY (`coupon_id`) REFERENCES `coupons` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_cr_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_cr_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 13. Tabela: loyalty_programs (Configurações de Fidelidade do Restaurante)
CREATE TABLE IF NOT EXISTS `loyalty_programs` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `restaurant_id` INT UNSIGNED NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `type` ENUM('ORDERS_COUNT', 'POINTS_SPENT') NOT NULL DEFAULT 'ORDERS_COUNT',
    `rules` LONGTEXT NOT NULL COMMENT 'JSON com faixas de pedidos ou taxa de conversao de pontos',
    `active` TINYINT(1) NOT NULL DEFAULT 1,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_lp_restaurant` (`restaurant_id`, `active`),
    CONSTRAINT `fk_lp_restaurant` FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 14. Tabela: loyalty_transactions (Extrato de Fidelidade / Pontos)
CREATE TABLE IF NOT EXISTS `loyalty_transactions` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `customer_id` INT UNSIGNED NOT NULL,
    `restaurant_id` INT UNSIGNED NOT NULL,
    `order_id` INT UNSIGNED DEFAULT NULL,
    `type` ENUM('EARN', 'REDEEM', 'EXPIRE', 'ADJUST') NOT NULL,
    `points` INT NOT NULL,
    `description` VARCHAR(255) NOT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_lt_customer` (`customer_id`, `restaurant_id`, `created_at`),
    CONSTRAINT `fk_lt_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_lt_restaurant` FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_lt_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 15. Tabela: notifications (Notificações do Sistema)
CREATE TABLE IF NOT EXISTS `notifications` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `restaurant_id` INT UNSIGNED NOT NULL,
    `customer_id` INT UNSIGNED DEFAULT NULL,
    `user_id` INT UNSIGNED DEFAULT NULL,
    `channel` ENUM('IN_APP', 'EMAIL', 'WHATSAPP') NOT NULL DEFAULT 'IN_APP',
    `title` VARCHAR(150) NOT NULL,
    `message` TEXT NOT NULL,
    `is_read` TINYINT(1) NOT NULL DEFAULT 0,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_notif_target` (`restaurant_id`, `is_read`, `created_at`),
    CONSTRAINT `fk_notif_restaurant` FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 16. Tabela: audit_logs (Auditoria de Alterações Críticas - Regra 56)
CREATE TABLE IF NOT EXISTS `audit_logs` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `restaurant_id` INT UNSIGNED DEFAULT NULL,
    `user_id` INT UNSIGNED DEFAULT NULL,
    `action` VARCHAR(80) NOT NULL,
    `entity` VARCHAR(80) NOT NULL,
    `entity_id` INT UNSIGNED DEFAULT NULL,
    `old_values` LONGTEXT DEFAULT NULL,
    `new_values` LONGTEXT DEFAULT NULL,
    `ip_address` VARCHAR(45) DEFAULT NULL,
    `user_agent` VARCHAR(255) DEFAULT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_audit_restaurant` (`restaurant_id`, `created_at`),
    INDEX `idx_audit_user` (`user_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 17. Tabela: analytics_events (Rastreamento de Eventos - Regra 63)
CREATE TABLE IF NOT EXISTS `analytics_events` (
    `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `restaurant_id` INT UNSIGNED NOT NULL,
    `event_type` VARCHAR(60) NOT NULL,
    `customer_id` INT UNSIGNED DEFAULT NULL,
    `table_id` INT UNSIGNED DEFAULT NULL,
    `session_id` VARCHAR(64) DEFAULT NULL,
    `payload` LONGTEXT DEFAULT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_ae_reporting` (`restaurant_id`, `event_type`, `created_at`),
    CONSTRAINT `fk_ae_restaurant` FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- ========================================================
-- DADOS INICIAIS DE TESTE / DEMONSTRAÇÃO (Café Central)
-- ========================================================

-- Restaurante Demonstração
INSERT INTO `restaurants` (`id`, `name`, `slug`, `logo`, `description`, `phone`, `email`, `address`, `currency`, `status`)
VALUES (1, 'Café Central', 'cafe-central', 'cafe-central-logo.png', 'Restaurante & Cafetaria Premium - O autêntico sabor com rapidez e tecnologia.', '+244 923 000 111', 'contato@cafecentral.ao', 'Avenida 4 de Fevereiro, Luanda, Angola', 'Kz', 'ACTIVE')
ON DUPLICATE KEY UPDATE `name`=VALUES(`name`);

-- Usuário Administrador do Restaurante (Senha inicial: admin123)
-- Hash gerado via password_hash('admin123', PASSWORD_BCRYPT)
INSERT INTO `users` (`id`, `name`, `email`, `password_hash`, `role`, `status`)
VALUES (1, 'Gestor Central', 'admin@cafecentral.ao', '$2y$10$wO3P8B1lOq65V5Z2O2eJ6u1N.L63c7i1fK5.PzE5O6qC04L0zXGia', 'RESTAURANT_OWNER', 'ACTIVE')
ON DUPLICATE KEY UPDATE `name`=VALUES(`name`);

INSERT INTO `restaurant_users` (`id`, `restaurant_id`, `user_id`, `role`)
VALUES (1, 1, 1, 'RESTAURANT_OWNER')
ON DUPLICATE KEY UPDATE `role`=VALUES(`role`);

-- Usuário Funcionário (Senha inicial: staff123)
INSERT INTO `users` (`id`, `name`, `email`, `password_hash`, `role`, `status`)
VALUES (2, 'Atendente Manuel', 'staff@cafecentral.ao', '$2y$10$wO3P8B1lOq65V5Z2O2eJ6u1N.L63c7i1fK5.PzE5O6qC04L0zXGia', 'STAFF', 'ACTIVE')
ON DUPLICATE KEY UPDATE `name`=VALUES(`name`);

INSERT INTO `restaurant_users` (`id`, `restaurant_id`, `user_id`, `role`)
VALUES (2, 1, 2, 'STAFF')
ON DUPLICATE KEY UPDATE `role`=VALUES(`role`);

-- Mesas (Exemplo Mesa 07 da especificação)
INSERT INTO `tables` (`id`, `restaurant_id`, `number`, `code`, `qr_token`, `nfc_token`, `status`)
VALUES 
(1, 1, '01', 'T01', 'qr_token_central_01_a9b8c7', 'nfc_01_a9b8c7', 'AVAILABLE'),
(2, 1, '02', 'T02', 'qr_token_central_02_b8c7d6', 'nfc_02_b8c7d6', 'AVAILABLE'),
(3, 1, '03', 'T03', 'qr_token_central_03_c7d6e5', 'nfc_03_c7d6e5', 'AVAILABLE'),
(4, 1, '07', 'T07', 'qr_token_central_07_f4e3d2', 'nfc_07_f4e3d2', 'AVAILABLE')
ON DUPLICATE KEY UPDATE `number`=VALUES(`number`);

-- Categorias de Cardápio
INSERT INTO `categories` (`id`, `restaurant_id`, `name`, `slug`, `sort_order`, `is_active`)
VALUES 
(1, 1, 'Pratos Principais', 'pratos-principais', 1, 1),
(2, 1, 'Lanches & Fast Food', 'lanches-fast-food', 2, 1),
(3, 1, 'Sobremesas', 'sobremesas', 3, 1),
(4, 1, 'Bebidas & Sucos', 'bebidas-sucos', 4, 1)
ON DUPLICATE KEY UPDATE `name`=VALUES(`name`);

-- Produtos do Cardápio (conforme exemplos do documento técnico)
INSERT INTO `products` (`id`, `restaurant_id`, `category_id`, `name`, `type`, `description`, `image`, `price`, `is_available`, `is_featured`, `sort_order`)
VALUES
(1, 1, 1, 'Frango Grelhado', 'DISH', 'Frango grelhado suculento acompanhado de batatas rústicas e salada fresca da estação.', 'frango-grelhado.jpg', 5000.00, 1, 1, 1),
(2, 1, 2, 'Hambúrguer Artesanal', 'DISH', 'Pão brioche, 180g de carne angus, queijo cheddar derretido e molho especial da casa.', 'hamburguer.jpg', 4200.00, 1, 1, 2),
(3, 1, 2, 'Batata Frita Especial', 'DISH', 'Porção generosa de batatas crocantes com toque de alecrim e sal marinho.', 'batata-frita.jpg', 2000.00, 1, 0, 3),
(4, 1, 4, 'Coca-Cola 330ml', 'PRODUCT', 'Refrigerante gelado em lata de 330ml.', 'coca-cola.jpg', 800.00, 1, 0, 4),
(5, 1, 4, 'Água Mineral 500ml', 'PRODUCT', 'Água mineral natural sem gás.', 'agua.jpg', 500.00, 1, 0, 5),
(6, 1, 3, 'Pudim de Caramelo', 'DISH', 'Pudim artesanal tradicional com calda aveludada de caramelo dourado.', 'pudim.jpg', 1800.00, 1, 1, 6)
ON DUPLICATE KEY UPDATE `name`=VALUES(`name`);

-- Cupons de Teste (Exemplo: BEMVINDO10)
INSERT INTO `coupons` (`id`, `restaurant_id`, `code`, `type`, `value`, `minimum_order`, `maximum_discount`, `usage_limit`, `usage_per_customer`, `starts_at`, `expires_at`, `active`)
VALUES
(1, 1, 'BEMVINDO10', 'PERCENTAGE', 10.00, 2500.00, 1500.00, 500, 1, '2026-01-01 00:00:00', '2027-12-31 23:59:59', 1),
(2, 1, 'DESCONTO1000', 'FIXED', 1000.00, 5000.00, 1000.00, 100, 1, '2026-01-01 00:00:00', '2027-12-31 23:59:59', 1)
ON DUPLICATE KEY UPDATE `code`=VALUES(`code`);

-- Programa de Fidelidade Inicial
INSERT INTO `loyalty_programs` (`id`, `restaurant_id`, `name`, `type`, `rules`, `active`)
VALUES
(1, 1, 'Programa Fidelidade Café Central', 'ORDERS_COUNT', '{"tier_1":{"orders":5,"discount_percent":5},"tier_2":{"orders":10,"discount_percent":10},"tier_3":{"orders":20,"special_gift":"Refeição Especial Grátis"}}', 1)
ON DUPLICATE KEY UPDATE `name`=VALUES(`name`);
