# 🐳 Three-Tier Application — Docker Compose Deployment Guide

This guide provides step-by-step instructions to deploy the **Three-Tier Application** using **Docker Compose** on a Linux server. This method is recommended for consistent, reproducible, and isolated environments.

---

## 🏗️ Architecture in Docker

```text
       Internet (80/443)
             │
             ▼
      [ Host Nginx/SSL ] (Optional Reverse Proxy)
             │
             ▼
    ┌────────────────────── Docker Compose Network ──────────────────────┐
    │                                                                    │
    │  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐      │
    │  │   Frontend   │─────▶│   Backend    │─────▶│   MongoDB  │      │
    │  │   (Next.js)  │      │  (Node.js)   │      │   (:27017)   │      │
    │  └──────────────┘      └──────────────┘      └──────────────┘      │
    │          │                    ▲                      ▲             │
    │          │                    │                      │             │
    │          │             ┌──────────────┐              │             │
    │          └────────────▶│    Redis     │◀───────────┘             │
    │                        │   (:6379)    │                            │
    │                        └──────────────┘                            │
    │                               ▲                                    │
    │                               │                                    │
    │                        ┌──────────────┐                            │
    │                        │    Worker    │                            │
    │                        │   (Python)   │                            │
    │                        └──────────────┘                            │
    │                                                                    │
    └────────────────────────────────────────────────────────────────────┘
```

---

## 📋 Prerequisites

Ensure your server meets the following requirements:
- **OS**: Ubuntu 22.04+ (or any modern Linux distro)
- **Resources**: 2 vCPU, 4GB RAM recommended
- **Docker Engine** installed
- **Docker Compose V2** installed (standard with modern Docker)

### Install Docker (Ubuntu/Debian)

If Docker is not installed, run the following:

```bash
# Add Docker's official GPG key:
sudo apt-get update
sudo apt-get install ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

# Add the repository to Apt sources:
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update

# Install Docker packages:
sudo apt-get install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Add your user to the docker group so you don't need 'sudo':
sudo usermod -aG docker $USER
newgrp docker # Apply changes without logging out
```

---

## 🚀 Deployment Steps

### 1. Clone the Repository
```bash
git clone https://github.com/YOUR_USERNAME/three-tier-application.git
cd three-tier-application
```

### 2. Configure Environment Variables
Copy the template and update the values for production:

```bash
cp .env.example .env
nano .env
```

**Key variables to change:**
- `JWT_SECRET`: Generate a random string (`openssl rand -base64 32`)
- `NODE_ENV`: set to `production`
- `CORS_ORIGIN`: set to your domain (e.g., `https://example.com`)
- `NEXT_PUBLIC_API_URL`: set to your domain or server IP (e.g., `https://example.com` or `http://1.2.3.4:5000`)

> [!IMPORTANT]
> Since we are running inside Docker, the `MONGO_URI` and `REDIS_HOST` should use the service names defined in `docker-compose.yml` (e.g., `mongodb://mongo:27017` and `redis`).

### 3. Build and Start
```bash
# This will build images and start containers in the background
docker compose up -d --build
```

### 4. Verify Services
Check if all containers are running and healthy:

```bash
docker compose ps
```

| Service | Public Port | Description |
| :--- | :--- | :--- |
| **Frontend** | `3001` | React/Next.js Web App |
| **Backend** | `5000` | Node.js REST API |
| **Worker** | — | Python Task Processor |
| **MongoDB** | `27017` | Database |
| **Redis** | `6379` | Message Queue/Cache |

---

## 🛠️ Management & Maintenance

### View Logs
To see live logs for all services:
```bash
docker compose logs -f
```

To view logs for a specific service:
```bash
docker compose logs -f backend
```

### Update the Application
When you pull new code, rebuild and restart:
```bash
git pull origin main
docker compose up -d --build
```

### Scale the Worker
The backend handles API requests, while the Python worker processes background tasks. You can scale the number of worker instances:
```bash
docker compose up -d --scale worker=3
```

### Stop/Remove
```bash
# Stop containers
docker compose stop

# Stop and remove containers/networks
docker compose down

# Stop and remove containers/networks AND volumes (DELETES DATABASE!)
docker compose down -v
```

---

## 🔒 Production Hardening (Recommended)

### 1. Nginx Reverse Proxy (on Host)
It is recommended to use Nginx on the host machine to handle SSL/HTTPS and forward traffic to the Docker containers.

**Example Nginx Config (`/etc/nginx/sites-available/app`):**
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3001; # Frontend
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /api/ {
        proxy_pass http://localhost:5000; # Backend API
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 2. SSL with Certbot
```bash
sudo apt install python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

### 3. Firewall (UFW)
Only expose ports 80, 443, and 22.
```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

---

## ❓ Troubleshooting

**Q: Database connection failed?**
- Ensure `MONGO_URI` in `.env` uses `mongo` as the hostname, not `localhost`.

**Q: Frontend cannot talk to Backend?**
- Check the `NEXT_PUBLIC_API_URL` in your `.env`. It must be accessible from the **user's browser**, so use your public IP or domain.

**Q: Containers keep restarting?**
- Check logs: `docker compose logs [service_name]`. Usually a missing environment variable or port conflict.
