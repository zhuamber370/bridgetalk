# 🚢 BridgeTalk Production Deployment Guide

This document provides detailed instructions on how to deploy BridgeTalk to a production environment.

---

## 📋 Deployment Architecture

```
                     ┌─────────────────┐
                     │   Nginx (80)    │
                     │  Reverse Proxy  │
                     └────────┬────────┘
                              │
                 ┌────────────┴────────────┐
                 │                         │
         ┌───────▼────────┐       ┌───────▼────────┐
         │ Static Files   │       │  Backend API   │
         │  (Frontend)    │       │  (Node.js)     │
         │                │       │  :3001         │
         └────────────────┘       └───────┬────────┘
                                          │
                                  ┌───────▼────────┐
                                  │ OpenClaw GW    │
                                  │  :18789        │
                                  └────────────────┘
```

---

## 🔧 Environment Preparation

### Server Requirements

- **Operating System**: Ubuntu 20.04+ / CentOS 8+ / Debian 11+
- **CPU**: 2 cores or more
- **Memory**: 2GB RAM or more
- **Disk**: 10GB available space

### Software Dependencies

```bash
# 1. Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 2. Install pnpm
npm install -g pnpm

# 3. Install Nginx
sudo apt-get install -y nginx

# 4. Install PM2 (Process Manager)
npm install -g pm2
```

---

## 📦 Build Application

### 1. Clone Repository

```bash
# Create application directory
sudo mkdir -p /var/www
cd /var/www

# Clone repository
sudo git clone https://github.com/zhuamber370/bridgetalk.git
cd bridgetalk

# Set permissions
sudo chown -R $USER:$USER /var/www/bridgetalk
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Configure Environment Variables

```bash
# Create production environment configuration
cp .env.example .env

# Edit configuration
nano .env
```

**Production Environment Configuration Example**:

```env
# OpenClaw Gateway Configuration
OPENCLAW_GATEWAY_URL=ws://127.0.0.1:18789
OPENCLAW_GATEWAY_TOKEN=your-production-token-here

# If Gateway is on another server, use wss:// protocol
# OPENCLAW_GATEWAY_URL=wss://gateway.example.com
# OPENCLAW_GATEWAY_TOKEN=your-token

# Optional: Timeout settings
# OPENCLAW_GATEWAY_TIMEOUT=300000
```

### 4. Build Frontend and Backend

```bash
# Build all packages
pnpm build

# Verify build results
ls -la packages/client/dist
ls -la packages/server/dist
```

---

## 🔐 Configure Nginx

### 1. Copy Configuration File

```bash
# Copy example configuration
sudo cp nginx.conf.example /etc/nginx/sites-available/bridgetalk

# Edit configuration
sudo nano /etc/nginx/sites-available/bridgetalk
```

### 2. Modify Configuration

Modify the following:

```nginx
# 1. Change domain name
server_name your-domain.com;  # Change to your domain

# 2. Change frontend path
root /var/www/bridgetalk/packages/client/dist;

# 3. Change backend address (if backend is on another server)
proxy_pass http://127.0.0.1:3001;
```

### 3. Enable Configuration

```bash
# Create symbolic link
sudo ln -s /etc/nginx/sites-available/bridgetalk /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

### 4. Enable Auto-start

```bash
sudo systemctl enable nginx
```

---

## 🚀 Start Backend Service

### Using PM2 for Process Management (Recommended)

```bash
cd /var/www/bridgetalk/packages/server

# Start backend
pm2 start dist/index.js --name bridgetalk-server

# Check status
pm2 status

# View logs
pm2 logs bridgetalk-server

# Enable auto-start on boot
pm2 startup
pm2 save
```

### Common PM2 Commands

```bash
# Restart service
pm2 restart bridgetalk-server

# Stop service
pm2 stop bridgetalk-server

# Delete service
pm2 delete bridgetalk-server

# Real-time logs
pm2 logs bridgetalk-server --lines 100

# Monitor
pm2 monit
```

---

## 🔒 HTTPS Configuration (Recommended)

### Using Let's Encrypt (Free Certificate)

```bash
# Install certbot
sudo apt-get install -y certbot python3-certbot-nginx

# Obtain certificate (will automatically modify Nginx configuration)
sudo certbot --nginx -d your-domain.com

# Test auto-renewal
sudo certbot renew --dry-run
```

### Manual HTTPS Configuration

If you already have a certificate, add this to your Nginx configuration:

```nginx
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/your/cert.pem;
    ssl_certificate_key /path/to/your/key.pem;

    # SSL optimization
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # ... other configurations ...
}

# HTTP to HTTPS redirect
server {
    listen 80;
    listen [::]:80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}
```

---

## 📊 Monitoring and Logs

### Backend Logs

```bash
# PM2 logs
pm2 logs bridgetalk-server

# Log file locations
~/.pm2/logs/bridgetalk-server-out.log
~/.pm2/logs/bridgetalk-server-error.log
```

### Nginx Logs

```bash
# Access logs
sudo tail -f /var/log/nginx/bridgetalk_access.log

# Error logs
sudo tail -f /var/log/nginx/bridgetalk_error.log
```

### System Monitoring

```bash
# CPU and memory usage
pm2 monit

# Disk usage
df -h

# Database size
du -h /var/www/bridgetalk/packages/server/agent_channel_v2.db
```

---

## 🔄 Deployment Updates

### Standard Update Process

```bash
cd /var/www/bridgetalk

# 1. Pull latest code
git pull origin main

# 2. Install dependencies (if updated)
pnpm install

# 3. Rebuild
pnpm build

# 4. Restart backend
pm2 restart bridgetalk-server

# 5. Restart Nginx (if configuration changed)
sudo systemctl restart nginx
```

### Zero-downtime Update (Using PM2 Reload)

```bash
# PM2 reload will restart processes one by one, avoiding service interruption
pm2 reload bridgetalk-server
```

---

## 🛡️ Security Hardening

### 1. Firewall Configuration

```bash
# Enable UFW
sudo ufw enable

# Allow SSH
sudo ufw allow 22/tcp

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Check status
sudo ufw status
```

### 2. Restrict Backend Port Access

Ensure backend port 3001 is **not exposed publicly**:

```bash
# Confirm port 3001 only listens on localhost
netstat -tuln | grep 3001
# Should show: 127.0.0.1:3001
```

### 3. Database File Permissions

```bash
# Restrict database file permissions
chmod 600 /var/www/bridgetalk/packages/server/*.db
```

### 4. Regular Updates

```bash
# Update system
sudo apt-get update && sudo apt-get upgrade -y

# Update Node.js dependencies
cd /var/www/bridgetalk
pnpm update

# Rebuild and restart
pnpm build
pm2 restart bridgetalk-server
```

---

## 💾 Data Backup

### Automated Backup Script

Create backup script `/var/www/bridgetalk/backup.sh`:

```bash
#!/bin/bash

BACKUP_DIR="/var/backups/bridgetalk"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"

# Backup database
cp /var/www/bridgetalk/packages/server/agent_channel_v2.db \
   "$BACKUP_DIR/db_$DATE.db"

# Backup Agent configuration
cp /var/www/bridgetalk/packages/server/openclaw.json \
   "$BACKUP_DIR/config_$DATE.json"

# Delete backups older than 30 days
find "$BACKUP_DIR" -name "*.db" -mtime +30 -delete
find "$BACKUP_DIR" -name "*.json" -mtime +30 -delete

echo "Backup completed: $DATE"
```

### Set Up Scheduled Backups

```bash
# Add execute permission
chmod +x /var/www/bridgetalk/backup.sh

# Set up cron job (backup daily at 2 AM)
crontab -e

# Add the following line:
0 2 * * * /var/www/bridgetalk/backup.sh >> /var/log/bridgetalk_backup.log 2>&1
```

---

## 🐛 Troubleshooting

### Issue 1: Nginx 502 Bad Gateway

**Cause**: Backend service not started or inaccessible

**Solution**:
```bash
# Check if backend is running
pm2 status

# Check port listening
netstat -tuln | grep 3001

# Restart backend
pm2 restart bridgetalk-server

# View backend logs
pm2 logs bridgetalk-server
```

### Issue 2: Frontend White Screen

**Cause**: Build files missing or path error

**Solution**:
```bash
# Check if build files exist
ls -la /var/www/bridgetalk/packages/client/dist

# Rebuild frontend
cd /var/www/bridgetalk
pnpm --filter @bridgetalk/client build

# Check Nginx configuration root path
sudo nginx -T | grep root
```

### Issue 3: SSE Connection Dropped

**Cause**: Nginx buffering or timeout settings

**Solution**: Check SSE section in Nginx configuration:
```nginx
location /api/v1/events {
    proxy_buffering off;  # Must be disabled
    proxy_cache off;
    proxy_read_timeout 86400s;  # Increase timeout
}
```

### Issue 4: Cannot Connect to OpenClaw Gateway

**Cause**: Token error or Gateway not started

**Solution**:
```bash
# Check .env configuration
cat /var/www/bridgetalk/.env

# Test Gateway connection
curl -v ws://127.0.0.1:18789

# View backend logs
pm2 logs bridgetalk-server | grep -i "gateway\|connection"
```

---

## 📈 Performance Optimization

### 1. Nginx Gzip Compression

Add to Nginx configuration:

```nginx
http {
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
}
```

### 2. Static Resource Caching

Already configured in `nginx.conf.example`:

```nginx
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

### 3. Database Optimization

```bash
# Periodically execute VACUUM to clean up fragmentation
sqlite3 /var/www/bridgetalk/packages/server/agent_channel_v2.db "VACUUM;"
```

---

## 📞 Support

If you encounter deployment issues, please:
1. Check the [FAQ](./README.md#frequently-asked-questions)
2. Search [GitHub Issues](https://github.com/zhuamber370/bridgetalk/issues)
3. Submit a new Issue with logs attached

---

<div align="center">
  <p>Happy Deploying! 🚀</p>
</div>
