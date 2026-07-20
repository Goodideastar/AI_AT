-- 用户表
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY COMMENT '用户ID',
    username VARCHAR(255) NOT NULL COMMENT '用户名',
    password VARCHAR(255) NOT NULL COMMENT '密码（bcrypt加密）',
    email VARCHAR(255) NOT NULL COMMENT '邮箱',
    ip_address VARCHAR(45) DEFAULT NULL COMMENT '注册IP地址（支持IPv6）',
    status TINYINT NOT NULL DEFAULT 1 COMMENT '状态：1-启用，0-禁用',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    
    -- 索引
    UNIQUE KEY idx_username (username),
    UNIQUE KEY idx_email (email),
    INDEX idx_id (id),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';
