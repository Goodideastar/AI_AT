-- =====================================================================
-- AI_AT 量化交易平台 - 数据库 Schema
-- 数据库: MySQL 8.0+
-- 字符集: utf8mb4
-- 存储引擎: InnoDB
-- =====================================================================

-- 创建数据库（如不存在）
CREATE DATABASE IF NOT EXISTS ATDB
    DEFAULT CHARACTER SET utf8mb4
    DEFAULT COLLATE utf8mb4_unicode_ci;

USE ATDB;

-- =====================================================================
-- 1. 用户表
-- =====================================================================
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY COMMENT '用户ID',
    username VARCHAR(255) NOT NULL COMMENT '用户名',
    password VARCHAR(255) NOT NULL COMMENT '密码（bcrypt 加密，rounds=12）',
    email VARCHAR(255) NOT NULL COMMENT '邮箱',
    ip_address VARCHAR(45) DEFAULT NULL COMMENT '注册IP地址（支持 IPv6）',
    status TINYINT NOT NULL DEFAULT 1 COMMENT '状态：1-启用，0-禁用',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',

    UNIQUE KEY idx_username (username),
    UNIQUE KEY idx_email (email),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';


-- =====================================================================
-- 2. 实时行情快照表
-- =====================================================================
CREATE TABLE IF NOT EXISTS tickers (
    id INT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    symbol VARCHAR(20) NOT NULL COMMENT '交易对符号，如 BTCUSDT',
    exchange VARCHAR(20) NOT NULL COMMENT '交易所，如 binance/okx',
    last_price DECIMAL(20, 8) NOT NULL COMMENT '最新成交价',
    bid DECIMAL(20, 8) DEFAULT NULL COMMENT '买一价',
    ask DECIMAL(20, 8) DEFAULT NULL COMMENT '卖一价',
    volume_24h DECIMAL(30, 8) DEFAULT NULL COMMENT '24小时成交量',
    high_24h DECIMAL(20, 8) DEFAULT NULL COMMENT '24小时最高价',
    low_24h DECIMAL(20, 8) DEFAULT NULL COMMENT '24小时最低价',
    timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '行情时间戳',

    INDEX idx_symbol (symbol),
    INDEX idx_timestamp (timestamp),
    INDEX idx_symbol_exchange (symbol, exchange)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='实时行情快照表';


-- =====================================================================
-- 3. K 线数据表
-- =====================================================================
CREATE TABLE IF NOT EXISTS klines (
    id INT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    symbol VARCHAR(20) NOT NULL COMMENT '交易对符号',
    exchange VARCHAR(20) NOT NULL COMMENT '交易所',
    interval VARCHAR(5) NOT NULL COMMENT 'K线周期：1m/5m/15m/1h/4h/1d/1w',
    open_time DATETIME NOT NULL COMMENT '开盘时间',
    open DECIMAL(20, 8) NOT NULL COMMENT '开盘价',
    high DECIMAL(20, 8) NOT NULL COMMENT '最高价',
    low DECIMAL(20, 8) NOT NULL COMMENT '最低价',
    close DECIMAL(20, 8) NOT NULL COMMENT '收盘价',
    volume DECIMAL(30, 8) NOT NULL COMMENT '成交量',
    close_time DATETIME NOT NULL COMMENT '收盘时间',

    -- 同一交易所、同一交易对、同一周期、同一开盘时间唯一
    UNIQUE KEY idx_kline_lookup (symbol, exchange, interval, open_time),
    INDEX idx_symbol_interval (symbol, interval),
    INDEX idx_open_time (open_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='K线数据表';


-- =====================================================================
-- 4. 交易策略表
-- =====================================================================
CREATE TABLE IF NOT EXISTS strategies (
    id INT AUTO_INCREMENT PRIMARY KEY COMMENT '策略ID',
    user_id INT NOT NULL COMMENT '所属用户ID',
    name VARCHAR(100) NOT NULL COMMENT '策略名称',
    description VARCHAR(500) DEFAULT NULL COMMENT '策略描述',
    strategy_type VARCHAR(50) NOT NULL COMMENT '策略类型：ma_cross/intraday/rsi/bollinger/grid',
    parameters JSON NOT NULL COMMENT '策略参数，如 {"period": 20, "threshold": 70}',
    symbols JSON NOT NULL COMMENT '交易对列表，如 ["BTCUSDT", "ETHUSDT"]',
    exchange VARCHAR(20) NOT NULL COMMENT '交易所',
    is_active TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否启用：1-启用，0-停用',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',

    INDEX idx_user_id (user_id),
    INDEX idx_strategy_type (strategy_type),
    INDEX idx_is_active (is_active),
    CONSTRAINT fk_strategy_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='交易策略表';


-- =====================================================================
-- 5. 交易订单表
-- =====================================================================
CREATE TABLE IF NOT EXISTS orders (
    id INT AUTO_INCREMENT PRIMARY KEY COMMENT '订单ID',
    user_id INT NOT NULL COMMENT '用户ID',
    strategy_id INT DEFAULT NULL COMMENT '策略ID（手动下单时为空）',
    symbol VARCHAR(20) NOT NULL COMMENT '交易对',
    exchange VARCHAR(20) NOT NULL COMMENT '交易所',
    side ENUM('buy', 'sell') NOT NULL COMMENT '订单方向：buy-买入，sell-卖出',
    order_type ENUM('market', 'limit') NOT NULL COMMENT '订单类型：market-市价，limit-限价',
    price DECIMAL(20, 8) DEFAULT NULL COMMENT '委托价（市价单为空）',
    quantity DECIMAL(20, 8) NOT NULL COMMENT '委托数量',
    filled_quantity DECIMAL(20, 8) NOT NULL DEFAULT 0 COMMENT '已成交数量',
    filled_price DECIMAL(20, 8) DEFAULT NULL COMMENT '成交均价',
    status ENUM('pending', 'filled', 'partially_filled', 'cancelled') NOT NULL DEFAULT 'pending'
        COMMENT '订单状态：pending-待成交，filled-已成交，partially_filled-部分成交，cancelled-已取消',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',

    INDEX idx_user_id (user_id),
    INDEX idx_strategy_id (strategy_id),
    INDEX idx_symbol (symbol),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at),
    CONSTRAINT fk_order_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_order_strategy FOREIGN KEY (strategy_id) REFERENCES strategies(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='交易订单表';


-- =====================================================================
-- 6. 持仓表
-- =====================================================================
CREATE TABLE IF NOT EXISTS positions (
    id INT AUTO_INCREMENT PRIMARY KEY COMMENT '持仓ID',
    user_id INT NOT NULL COMMENT '用户ID',
    symbol VARCHAR(20) NOT NULL COMMENT '交易对',
    exchange VARCHAR(20) NOT NULL COMMENT '交易所',
    quantity DECIMAL(20, 8) NOT NULL COMMENT '持仓数量',
    avg_price DECIMAL(20, 8) NOT NULL COMMENT '平均持仓成本',
    unrealized_pnl DECIMAL(20, 8) NOT NULL DEFAULT 0 COMMENT '未实现盈亏',
    realized_pnl DECIMAL(20, 8) NOT NULL DEFAULT 0 COMMENT '已实现盈亏',
    opened_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '开仓时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',

    INDEX idx_user_id (user_id),
    INDEX idx_symbol (symbol),
    UNIQUE KEY idx_user_symbol_exchange (user_id, symbol, exchange),
    CONSTRAINT fk_position_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='持仓表';


-- =====================================================================
-- 7. 策略市场 - 分享表
-- =====================================================================
CREATE TABLE IF NOT EXISTS strategy_shares (
    id INT AUTO_INCREMENT PRIMARY KEY COMMENT '分享ID',
    user_id INT NOT NULL COMMENT '发布用户ID',
    strategy_id INT NOT NULL COMMENT '策略ID',
    title VARCHAR(200) NOT NULL COMMENT '分享标题',
    description VARCHAR(1000) DEFAULT NULL COMMENT '分享描述',
    is_public TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否公开：1-公开，0-私有',
    subscribe_count INT NOT NULL DEFAULT 0 COMMENT '订阅数',
    rating INT NOT NULL DEFAULT 0 COMMENT '评分（0-100）',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',

    INDEX idx_user_id (user_id),
    INDEX idx_strategy_id (strategy_id),
    INDEX idx_is_public (is_public),
    INDEX idx_created_at (created_at),
    INDEX idx_rating (rating),
    -- 同一用户对同一策略只能分享一次
    UNIQUE KEY uq_share_user_strategy (user_id, strategy_id),
    CONSTRAINT fk_share_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_share_strategy FOREIGN KEY (strategy_id) REFERENCES strategies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='策略市场分享表';


-- =====================================================================
-- 8. 策略市场 - 订阅表
-- =====================================================================
CREATE TABLE IF NOT EXISTS strategy_subscriptions (
    id INT AUTO_INCREMENT PRIMARY KEY COMMENT '订阅ID',
    user_id INT NOT NULL COMMENT '订阅用户ID',
    share_id INT NOT NULL COMMENT '分享ID',
    status TINYINT NOT NULL DEFAULT 1 COMMENT '状态：1-已订阅，0-已取消',
    subscribed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '订阅时间',

    INDEX idx_user_id (user_id),
    INDEX idx_share_id (share_id),
    INDEX idx_status (status),
    -- 同一用户对同一分享只能有一条有效订阅记录
    UNIQUE KEY idx_user_share (user_id, share_id),
    CONSTRAINT fk_subscription_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_subscription_share FOREIGN KEY (share_id) REFERENCES strategy_shares(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='策略订阅表';


-- =====================================================================
-- 完成提示
-- =====================================================================
-- 所有表创建完毕。可通过以下命令验证：
-- SHOW TABLES;
-- DESC users;
-- DESC tickers;
-- DESC klines;
-- DESC strategies;
-- DESC orders;
-- DESC positions;
-- DESC strategy_shares;
-- DESC strategy_subscriptions;
