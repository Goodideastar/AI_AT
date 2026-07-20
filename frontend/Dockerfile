# =====================================================================
# AI_AT 前端 Dockerfile（多阶段构建）
# 第一阶段：构建 React 静态资源
# 第二阶段：Nginx 提供静态文件服务并反向代理 API
# =====================================================================

# ── 第一阶段：构建 ──
FROM node:20-alpine AS builder

WORKDIR /app

# 复制依赖清单
COPY package.json package-lock.json* ./

# 安装依赖
RUN npm config set registry https://registry.npmmirror.com \
    && npm ci || npm install

# 复制源代码
COPY . .

# 构建生产版本
RUN npm run build

# ── 第二阶段：运行 ──
FROM nginx:alpine

# 设置时区
ENV TZ=Asia/Shanghai
RUN apk add --no-cache tzdata \
    && ln -snf /usr/share/zoneinfo/$TZ /etc/localtime \
    && echo $TZ > /etc/timezone

# 复制自定义 Nginx 配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 从构建阶段复制静态资源
COPY --from=builder /app/dist /usr/share/nginx/html

# 暴露端口
EXPOSE 80

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD wget -q --spider http://localhost/ || exit 1

# 启动 Nginx
CMD ["nginx", "-g", "daemon off;"]
