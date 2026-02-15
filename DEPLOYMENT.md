# 🚢 BridgeTalk 生产部署指南

本文档详细说明如何将 BridgeTalk 部署到生产环境。

---

## 📋 部署架构

```
                     ┌─────────────────┐
                     │   Nginx (80)    │
                     │  反向代理服务器  │
                     └────────┬────────┘
                              │
                 ┌────────────┴────────────┐
                 │                         │
         ┌───────▼────────┐       ┌───────▼────────┐
         │ 静态文件服务    │       │  后端 API       │
         │  (前端 dist)   │       │  (Node.js)     │
         │                │       │  :3001         │
         └────────────────┘       └───────┬────────┘
                                          │
                                  ┌───────▼────────┐
                                  │ OpenClaw GW    │
                                  │  :18789        │
                                  └────────────────┘
```

---

## 🔧 环境准备

### 服务器要求

- **操作系统**：Ubuntu 20.04+ / CentOS 8+ / Debian 11+
- **CPU**：2 核心或更多
- **内存**：2GB RAM 或更多
- **磁盘**：10GB 可用空间

### 软件依赖

```bash
# 1. 安装 Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 2. 安装 pnpm
npm install -g pnpm

# 3. 安装 Nginx
sudo apt-get install -y nginx

# 4. 安装 PM2（进程管理器）
npm install -g pm2
```

---

## 📦 构建应用

### 1. 克隆代码

```bash
# 创建应用目录
sudo mkdir -p /var/www
cd /var/www

# 克隆仓库
sudo git clone https://github.com/zhuamber370/bridgetalk.git
cd bridgetalk

# 设置权限
sudo chown -R $USER:$USER /var/www/bridgetalk
```

### 2. 安装依赖

```bash
pnpm install
```

### 3. 配置环境变量

```bash
# 创建生产环境配置
cp .env.example .env

# 编辑配置
nano .env
```

**生产环境配置示例**：

```env
# OpenClaw Gateway 配置
OPENCLAW_GATEWAY_URL=ws://127.0.0.1:18789
OPENCLAW_GATEWAY_TOKEN=your-production-token-here

# 如果 Gateway 在其他服务器，使用 wss:// 协议
# OPENCLAW_GATEWAY_URL=wss://gateway.example.com
# OPENCLAW_GATEWAY_TOKEN=your-token

# 可选：超时设置
# OPENCLAW_GATEWAY_TIMEOUT=300000
```

### 4. 构建前端和后端

```bash
# 构建所有包
pnpm build

# 验证构建结果
ls -la packages/client/dist
ls -la packages/server/dist
```

---

## 🔐 配置 Nginx

### 1. 复制配置文件

```bash
# 复制示例配置
sudo cp nginx.conf.example /etc/nginx/sites-available/bridgetalk

# 编辑配置
sudo nano /etc/nginx/sites-available/bridgetalk
```

### 2. 修改配置

修改以下内容：

```nginx
# 1. 修改域名
server_name your-domain.com;  # 改为你的域名

# 2. 修改前端路径
root /var/www/bridgetalk/packages/client/dist;

# 3. 修改后端地址（如果后端在其他服务器）
proxy_pass http://127.0.0.1:3001;
```

### 3. 启用配置

```bash
# 创建软链接
sudo ln -s /etc/nginx/sites-available/bridgetalk /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重启 Nginx
sudo systemctl restart nginx
```

### 4. 开机自启

```bash
sudo systemctl enable nginx
```

---

## 🚀 启动后端服务

### 使用 PM2 管理进程（推荐）

```bash
cd /var/www/bridgetalk/packages/server

# 启动后端
pm2 start dist/index.js --name bridgetalk-server

# 查看状态
pm2 status

# 查看日志
pm2 logs bridgetalk-server

# 开机自启
pm2 startup
pm2 save
```

### PM2 常用命令

```bash
# 重启服务
pm2 restart bridgetalk-server

# 停止服务
pm2 stop bridgetalk-server

# 删除服务
pm2 delete bridgetalk-server

# 实时日志
pm2 logs bridgetalk-server --lines 100

# 监控
pm2 monit
```

---

## 🔒 HTTPS 配置（推荐）

### 使用 Let's Encrypt（免费证书）

```bash
# 安装 certbot
sudo apt-get install -y certbot python3-certbot-nginx

# 获取证书（会自动修改 Nginx 配置）
sudo certbot --nginx -d your-domain.com

# 自动续期测试
sudo certbot renew --dry-run
```

### 手动配置 HTTPS

如果你已有证书，在 Nginx 配置中添加：

```nginx
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/your/cert.pem;
    ssl_certificate_key /path/to/your/key.pem;

    # SSL 优化
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # ... 其他配置 ...
}

# HTTP 自动跳转 HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}
```

---

## 📊 监控和日志

### 后端日志

```bash
# PM2 日志
pm2 logs bridgetalk-server

# 日志文件位置
~/.pm2/logs/bridgetalk-server-out.log
~/.pm2/logs/bridgetalk-server-error.log
```

### Nginx 日志

```bash
# 访问日志
sudo tail -f /var/log/nginx/bridgetalk_access.log

# 错误日志
sudo tail -f /var/log/nginx/bridgetalk_error.log
```

### 系统监控

```bash
# CPU 和内存使用
pm2 monit

# 磁盘使用
df -h

# 数据库大小
du -h /var/www/bridgetalk/packages/server/agent_channel_v2.db
```

---

## 🔄 更新部署

### 标准更新流程

```bash
cd /var/www/bridgetalk

# 1. 拉取最新代码
git pull origin main

# 2. 安装依赖（如果有更新）
pnpm install

# 3. 重新构建
pnpm build

# 4. 重启后端
pm2 restart bridgetalk-server

# 5. 重启 Nginx（如果有配置变更）
sudo systemctl restart nginx
```

### 零停机更新（使用 PM2 Reload）

```bash
# PM2 reload 会逐个重启进程，避免服务中断
pm2 reload bridgetalk-server
```

---

## 🛡️ 安全加固

### 1. 防火墙配置

```bash
# 启用 UFW
sudo ufw enable

# 允许 SSH
sudo ufw allow 22/tcp

# 允许 HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# 查看状态
sudo ufw status
```

### 2. 限制后端端口访问

确保后端端口 3001 **不对外开放**：

```bash
# 确认 3001 端口只监听 localhost
netstat -tuln | grep 3001
# 应该显示：127.0.0.1:3001
```

### 3. 数据库文件权限

```bash
# 限制数据库文件权限
chmod 600 /var/www/bridgetalk/packages/server/*.db
```

### 4. 定期更新

```bash
# 更新系统
sudo apt-get update && sudo apt-get upgrade -y

# 更新 Node.js 依赖
cd /var/www/bridgetalk
pnpm update

# 重建并重启
pnpm build
pm2 restart bridgetalk-server
```

---

## 💾 数据备份

### 自动备份脚本

创建备份脚本 `/var/www/bridgetalk/backup.sh`：

```bash
#!/bin/bash

BACKUP_DIR="/var/backups/bridgetalk"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"

# 备份数据库
cp /var/www/bridgetalk/packages/server/agent_channel_v2.db \
   "$BACKUP_DIR/db_$DATE.db"

# 备份 Agent 配置
cp /var/www/bridgetalk/packages/server/openclaw.json \
   "$BACKUP_DIR/config_$DATE.json"

# 删除 30 天前的备份
find "$BACKUP_DIR" -name "*.db" -mtime +30 -delete
find "$BACKUP_DIR" -name "*.json" -mtime +30 -delete

echo "Backup completed: $DATE"
```

### 设置定时备份

```bash
# 添加执行权限
chmod +x /var/www/bridgetalk/backup.sh

# 设置 cron 任务（每天凌晨 2 点备份）
crontab -e

# 添加以下行：
0 2 * * * /var/www/bridgetalk/backup.sh >> /var/log/bridgetalk_backup.log 2>&1
```

---

## 🐛 故障排查

### 问题 1：Nginx 502 Bad Gateway

**原因**：后端服务未启动或无法访问

**解决**：
```bash
# 检查后端是否运行
pm2 status

# 检查端口监听
netstat -tuln | grep 3001

# 重启后端
pm2 restart bridgetalk-server

# 查看后端日志
pm2 logs bridgetalk-server
```

### 问题 2：前端访问白屏

**原因**：构建文件缺失或路径错误

**解决**：
```bash
# 检查构建文件是否存在
ls -la /var/www/bridgetalk/packages/client/dist

# 重新构建前端
cd /var/www/bridgetalk
pnpm --filter @bridgetalk/client build

# 检查 Nginx 配置的 root 路径
sudo nginx -T | grep root
```

### 问题 3：SSE 连接断开

**原因**：Nginx 缓冲或超时设置

**解决**：检查 Nginx 配置中的 SSE 部分：
```nginx
location /api/v1/events {
    proxy_buffering off;  # 必须禁用
    proxy_cache off;
    proxy_read_timeout 86400s;  # 增加超时时间
}
```

### 问题 4：无法连接 OpenClaw Gateway

**原因**：Token 错误或 Gateway 未启动

**解决**：
```bash
# 检查 .env 配置
cat /var/www/bridgetalk/.env

# 测试 Gateway 连接
curl -v ws://127.0.0.1:18789

# 查看后端日志
pm2 logs bridgetalk-server | grep -i "gateway\|connection"
```

---

## 📈 性能优化

### 1. Nginx Gzip 压缩

在 Nginx 配置中添加：

```nginx
http {
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
}
```

### 2. 静态资源缓存

已在 `nginx.conf.example` 中配置：

```nginx
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

### 3. 数据库优化

```bash
# 定期执行 VACUUM 清理碎片
sqlite3 /var/www/bridgetalk/packages/server/agent_channel_v2.db "VACUUM;"
```

---

## 📞 支持

如果遇到部署问题，请：
1. 查看 [FAQ](./README.md#常见问题)
2. 搜索 [GitHub Issues](https://github.com/zhuamber370/bridgetalk/issues)
3. 提交新的 Issue 并附上日志

---

<div align="center">
  <p>部署愉快！ 🚀</p>
</div>
