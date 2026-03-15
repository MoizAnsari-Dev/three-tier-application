# 🖥️ Three-Tier Application — Bare Metal Linux Server Deployment

> Deploy on a fresh **Linux** server without Docker
---
## 🎯 Architecture on the Server

```
Internet
    │
    ▼
 Nginx :80/:443
    │
    ├── /api/*  → Backend (Node.js) :5000
    │               │
    │               ├── MongoDB :27017
    │               └── Redis   :6379
    │
    └── /*      → Frontend (Next.js) :3000

                Python Worker
                    │
                    ├── Redis   :6379  (reads tasks)
                    └── MongoDB :27017 (writes results)
```
---

## 📋 Table of Contents

1.  [Server Requirements](#1-server-requirements)
2.  [Initial Server Setup](#2-initial-server-setup)
3.  [Install Node.js 20](#3-install-nodejs-20)
4.  [Install Python 3.12](#4-install-python-312)
5.  [Install & Secure MongoDB](#5-install--secure-mongodb)
6.  [Install & Secure Redis](#6-install--secure-redis)
7.  [Install Nginx](#7-install-nginx)
8.  [Install PM2 (Process Manager)](#8-install-pm2-process-manager)
9.  [Deploy the Application Code](#9-deploy-the-application-code)
10. [Configure Environment Variables](#10-configure-environment-variables)
11. [Build & Start the Backend](#11-build--start-the-backend)
12. [Build & Start the Frontend](#12-build--start-the-frontend)
13. [Start the Python Worker with systemd](#13-start-the-python-worker-with-systemd)
14. [Configure Nginx Reverse Proxy](#14-configure-nginx-reverse-proxy)
15. [Configure Firewall (UFW)](#15-configure-firewall-ufw)
16. [SSL Certificate (HTTPS)](#16-ssl-certificate-https)
17. [Verify Everything](#17-verify-everything)
18. [Maintenance Commands](#18-maintenance-commands)

---

## 1. Server Requirements

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| **CPU** | 2 vCPU | 4 vCPU |
| **RAM** | 2 GB | 4 GB |
| **Disk** | 20 GB SSD | 50 GB SSD |
| **OS** | Ubuntu 22.04 LTS | Ubuntu 24.04 LTS |
| **Open Ports** | 22, 80, 443 | 22, 80, 443 |

---

## 2. Initial Server Setup

SSH into your server as root, then create a deploy user:

```bash
# SSH into the server
ssh root@YOUR_SERVER_IP

# Create a non-root user for deployment
adduser deploy
usermod -aG sudo deploy

# Copy SSH key to the new user
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy

# Switch to deploy user
su - deploy

# Update the system
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git build-essential unzip
```

---

## 3. Install Node.js 20

```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc

# Install Node.js 20 LTS
nvm install 20
nvm use 20
nvm alias default 20

# Verify
node --version   # v20.x.x
npm --version    # 10.x.x
```

---

## 4. Install Python 3.12

```bash
sudo apt install -y python3.12 python3-pip python3.12-venv

# Verify
python3 --version   # Python 3.12.x
pip3 --version
```

---

## 5. Install & Secure MongoDB

```bash
# Import MongoDB 7 GPG key
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
  sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor

# Add MongoDB repository
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] \
  https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | \
  sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

sudo apt update
sudo apt install -y mongodb-org

# Start and enable MongoDB
sudo systemctl enable --now mongod

# Verify
mongosh --eval "db.adminCommand('ping')"
# Expected: { ok: 1 }
```

### Create a MongoDB user with a password (production security)

```bash
# Connect to MongoDB shell
mongosh

# Inside the shell — create admin user and app user
use admin
db.createUser({
  user: "admin",
  pwd: "CHANGE_THIS_STRONG_PASSWORD",
  roles: [ { role: "userAdminAnyDatabase", db: "admin" } ]
})

use three-tier-application
db.createUser({
  user: "taskapp",
  pwd: "CHANGE_THIS_APP_PASSWORD",
  roles: [ { role: "readWrite", db: "three-tier-application" } ]
})

exit
```

### Enable MongoDB authentication

```bash
sudo nano /etc/mongod.conf
```

Find `security:` section and set:

```yaml
security:
  authorization: enabled
```

```bash
# Restart MongoDB to apply
sudo systemctl restart mongod
```

Test with auth:

```bash
mongosh "mongodb://taskapp:CHANGE_THIS_APP_PASSWORD@localhost:27017/three-tier-application"
# Should connect without errors
```

---

## 6. Install & Secure Redis

```bash
sudo apt install -y redis-server

# Enable Redis to start on boot
sudo systemctl enable redis-server
```

### Set a Redis password

```bash
sudo nano /etc/redis/redis.conf
```

Find and update these lines:

```conf
# Bind to localhost only (no external access)
bind 127.0.0.1

# Set a strong password
requirepass CHANGE_THIS_REDIS_PASSWORD

# Disable dangerous commands
rename-command FLUSHDB ""
rename-command FLUSHALL ""
rename-command CONFIG ""
```

```bash
# Restart Redis
sudo systemctl restart redis-server

# Test
redis-cli -a CHANGE_THIS_REDIS_PASSWORD ping
# Expected: PONG
```

---

## 7. Install Nginx

```bash
sudo apt install -y nginx
sudo systemctl enable --now nginx

# Verify
curl http://localhost
# Expected: Nginx welcome page HTML
```

---

## 8. Install PM2 (Process Manager)

PM2 keeps your Node.js services alive and restarts them if they crash.

```bash
npm install -g pm2

# Set PM2 to auto-start on server reboot
pm2 startup systemd
# Copy-paste the command it outputs and run it, e.g.:
# sudo env PATH=$PATH:/home/deploy/.nvm/versions/node/v20.x.x/bin pm2 startup systemd -u deploy --hp /home/deploy
```

---

## 9. Deploy the Application Code

```bash
# Create the application directory
sudo mkdir -p /var/www/three-tier-application
sudo chown deploy:deploy /var/www/three-tier-application

# Clone the repo (replace with your actual GitHub URL)
git clone https://github.com/YOUR_USERNAME/three-tier-application.git /var/www/three-tier-application

cd /var/www/three-tier-application
ls
# backend/   worker/   frontend/   docker-compose.yml   README.md
```

---

## 10. Configure Environment Variables

### Backend `.env`

```bash
nano /var/www/three-tier-application/backend/.env
```

```env
NODE_ENV=production
PORT=5000

# MongoDB — use the app user you created
MONGO_URI=mongodb://taskapp:CHANGE_THIS_APP_PASSWORD@localhost:27017/three-tier-application

# Redis — use the password you set
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=CHANGE_THIS_REDIS_PASSWORD

# JWT — generate a strong random secret
JWT_SECRET=use_openssl_rand_base64_48_to_generate_this
JWT_EXPIRES_IN=7d

# CORS — your actual domain
CORS_ORIGIN=https://yourdomain.com

# Logging
LOG_LEVEL=info
```

> 💡 Generate a strong JWT secret: `openssl rand -base64 48`

### Worker `.env`

```bash
nano /var/www/three-tier-application/worker/.env
```

```env
MONGO_URI=mongodb://taskapp:CHANGE_THIS_APP_PASSWORD@localhost:27017/three-tier-application
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=CHANGE_THIS_REDIS_PASSWORD
LOG_LEVEL=INFO
```

### Frontend `.env.production`

```bash
nano /var/www/three-tier-application/frontend/.env.production
```

```env
NEXT_PUBLIC_API_URL=https://yourdomain.com
```

> ⚠️ Replace `yourdomain.com` with your actual domain. If you don't have a domain yet, use `http://YOUR_SERVER_IP`.

---

## 11. Build & Start the Backend

```bash
cd /var/www/three-tier-application/backend

# Install production dependencies only
npm ci --omit=dev

# Start with PM2
pm2 start src/index.js --name "backend" --env production

# Verify it's running
pm2 status
pm2 logs backend --lines 20
```

Expected output from `pm2 logs backend`:

```
[info]: MongoDB Connected: 127.0.0.1
[info]: Backend API running on port 5000 [production]
[info]: Redis connected
```

---

## 12. Build & Start the Frontend

```bash
cd /var/www/three-tier-application/frontend

# Install all dependencies
npm ci

# Build the production bundle
npm run build

# Start with PM2 (Next.js standalone server)
pm2 start npm --name "frontend" -- start

# OR if using standalone output:
pm2 start node --name "frontend" -- .next/standalone/server.js

# Verify
pm2 status
pm2 logs frontend --lines 10
```

---

## 13. Start the Python Worker with systemd

Using **systemd** for the Python worker gives it automatic restart and proper logging:

```bash
sudo nano /etc/systemd/system/three-tier-worker.service
```

Paste this content:

```ini
[Unit]
Description=Three-Tier Application Python Worker
After=network.target mongod.service redis-server.service

[Service]
Type=simple
User=deploy
WorkingDirectory=/var/www/three-tier-application/worker
EnvironmentFile=/var/www/three-tier-application/worker/.env
ExecStart=/usr/bin/python3 -u worker.py
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=three-tier-worker

[Install]
WantedBy=multi-user.target
```

```bash
# Enable and start the worker
sudo systemctl daemon-reload
sudo systemctl enable --now three-tier-worker

# Check worker status
sudo systemctl status three-tier-worker

# View worker logs
sudo journalctl -u three-tier-worker -f
```

---

## 14. Configure Nginx Reverse Proxy

Nginx will forward all traffic to the right service on the correct port.

```bash
sudo nano /etc/nginx/sites-available/three-tier-application
```

Paste this configuration:

```nginx
# ── Upstream services ─────────────────────────────
upstream backend_api {
    server 127.0.0.1:5000;
}

upstream frontend_app {
    server 127.0.0.1:3000;
}


server {
    listen 80;
    server_name _;

    # Frontend
    location / {
        proxy_pass http://frontend_app;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Frontend static files
    location /_next/ {
        proxy_pass http://frontend_app;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }

    # Backend API
    location /api/ {
        proxy_pass http://backend_api;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}

```

```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/three-tier-application /etc/nginx/sites-enabled/

# Remove the default Nginx site
sudo rm -f /etc/nginx/sites-enabled/default

# Test the config
sudo nginx -t
# Expected: configuration file ... syntax is ok

# Reload Nginx
sudo systemctl reload nginx
```
---

## 15. Configure Firewall (UFW)

```bash
# Allow SSH (important — do this first or you'll lock yourself out!)
sudo ufw allow 22/tcp

# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Block all other inbound connections
sudo ufw --force enable

# Verify
sudo ufw status
```

Expected output:
```
Status: active

To                         Action      From
--                         ------      ----
22/tcp                     ALLOW       Anywhere
80/tcp                     ALLOW       Anywhere
443/tcp                    ALLOW       Anywhere
```

> ✅ MongoDB (27017) and Redis (6379) are NOT in this list — good. They only listen on `127.0.0.1` and are never exposed to the internet.

---

## 16. SSL Certificate (HTTPS)

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get a free SSL certificate (replace with your domain)
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Follow the prompts — enter your email and agree to TOS
# Certbot will automatically update your Nginx config

# Test auto-renewal
sudo certbot renew --dry-run
```

After certbot runs, your Nginx config will be automatically updated with the SSL certificate paths.

---

## 17. Verify Everything

### Check all services are running

```bash
# PM2 services (backend + frontend)
pm2 status

# Python worker
sudo systemctl status three-tier-worker

# MongoDB
sudo systemctl status mongod

# Redis
sudo systemctl status redis-server

# Nginx
sudo systemctl status nginx
```

All should show **active (running)** or **online**.

### Test the API endpoint

```bash
# Health check
curl http://localhost:5000/health
# Expected: {"status":"ok","service":"backend-api"}

# Through Nginx (public URL)
curl https://yourdomain.com/health
# Expected: same JSON response
```

### Test user registration via API

```bash
curl -s -X POST https://yourdomain.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","password":"password123"}' \
  | python3 -m json.tool
```

Expected: `{"success": true, "token": "eyJ...", "user": {...}}`

### Open in Browser

Navigate to ` https://yourdomain.com or IP` — the TaskFlow login page should load.

---

## 18. Maintenance Commands

### View logs

```bash
# Backend logs (live)
pm2 logs backend

# Frontend logs (live)
pm2 logs frontend

# Worker logs (live)
sudo journalctl -u three-tier-worker -f

# Nginx access logs
sudo tail -f /var/log/nginx/access.log

# Nginx error logs
sudo tail -f /var/log/nginx/error.log
```

### Restart services

```bash
pm2 restart backend
pm2 restart frontend
sudo systemctl restart three-tier-worker
sudo systemctl reload nginx
```

### Deploy an update (pull latest code)

```bash
cd /var/www/three-tier-application

# Pull latest code
git pull origin main

# Rebuild backend
cd backend && npm ci --omit=dev && pm2 restart backend

# Rebuild frontend
cd ../frontend && npm ci && npm run build && pm2 restart frontend

# Restart worker (picks up Python changes automatically)
sudo systemctl restart three-tier-worker
```

### Save PM2 process list (survives reboots)

```bash
pm2 save
```

### Monitor resource usage

```bash
pm2 monit         # interactive PM2 monitor
htop              # system CPU/memory
df -h             # disk usage
```

---


> [!IMPORTANT]
> Always change the placeholder passwords (`CHANGE_THIS_*`) before going live. Never use the default values.

> [!TIP]
> Set up a cron job to auto-renew SSL: `sudo certbot renew` is automatically added to `/etc/cron.d/certbot` by Certbot.

> [!NOTE]
> After a server reboot, all services auto-start: PM2 (via systemd), MongoDB, Redis, nginx, and the Python worker are all set to `enable --now` which means they start on boot automatically.
