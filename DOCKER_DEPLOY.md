# 🐳 Three-Tier Application — Docker Compose Deployment Guide

This guide provides step-by-step instructions to deploy the **Three-Tier Application** using **Docker Compose** on a Linux server. This method uses an internal **Nginx Reverse Proxy** to manage traffic securely.

---

## 🏗️ Architecture in Docker

```text
       Internet (80/443)
             │
             ▼
    ┌────────────────────── Docker Compose Network ──────────────────────┐
    │                                                                    │
    │  ┌──────────────┐         ┌──────────────┐      ┌──────────────┐   │
    │  │    Nginx     │──┬─────▶│   Frontend   │      │   MongoDB    │   │
    │  │   (Proxy)    │  │      │   (Next.js)  │      │   (:27017)   │   │
    │  └──────────────┘  │      └──────────────┘      └──────────────┘   │
    │          ▲         │             │                      ▲          │
    │          │         │             ▼                      │          │
    │   (Users/API)      │      ┌──────────────┐              │          │
    │                    └─────▶│   Backend    │◀─────────────┘          │
    │                           │  (Node.js)   │                         │
    │                           └──────────────┘                         │
    │                                  │                                 │
    │                                  ▼                                 │
    │                           ┌──────────────┐                         │
    │                           │    Redis     │                         │
    │                           │   (:6379)    │                         │
    │                           └──────────────┘                         │
    │                                  ▲                                 │
    │                                  │                                 │
    │                           ┌──────────────┐                         │
    │                           │    Worker    │                         │
    │                           │   (Python)   │                         │
    │                           └──────────────┘                         │
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

### Install Docker (Ubuntu/Devian)

If Docker is not installed, run the following:

```bash
sudo apt-get update
sudo apt-get install -y docker.io docker-compose-v2
sudo usermod -aG docker $USER && newgrp docker
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

**Key variables for Server Deployment:**
- `NEXT_PUBLIC_API_URL`: Set to your server IP or domain (e.g., `http://1.2.3.4`). Do NOT include a port, as Nginx handles it on port 80.
- `CORS_ORIGIN`: Set to your server IP or domain (e.g., `http://1.2.3.4`).
- `JWT_SECRET`: Generate a random string (`openssl rand -base64 32`).
- `NODE_ENV`: set to `production`.

### 3. Build and Start
Since the Frontend needs to "bake in" the `NEXT_PUBLIC_API_URL` during the build process, you must use the `--build` flag.

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
| **Nginx (Proxy)** | `80` | **Primary Entry Point** |
| **Frontend** | — | Private (Accessible via Proxy) |
| **Backend** | — | Private (Accessible via Proxy) |
| **Worker** | — | Python Task Processor |
| **MongoDB** | — | Private Database |
| **Redis** | — | Private Message Queue |

---

## 🛠️ Management & Maintenance

### View Logs
To see live logs for all services:
```bash
docker compose logs -f
```

### Scale the Worker
If you have many background tasks, you can scale the number of Python worker instances:
```bash
docker compose up -d --scale worker=5
```

### Update the Application
When you pull new code, always rebuild to ensure the latest frontend bundle is generated:
```bash
git pull origin main
docker compose up -d --build
```

---

## 🔒 Security & Hardening

### 1. Firewall (UFW)
On a public server, you should only expose Ports 80 and 22.
```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw enable
```
*Note: Ports 3001, 5000, 27017, and 6379 are now internally secured by Docker and do not need to be open in your firewall.*

### 2. Adding SSL (HTTPS)
To enable HTTPS, the easiest way is to install **Certbot** on the host and point it to the Docker Nginx.

```bash
sudo apt install python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

---

## ❓ Troubleshooting

**Q: Registration failed error?**
- Ensure `NEXT_PUBLIC_API_URL` in `.env` is set to the correct Public IP.
- Ensure you ran `docker compose up -d --build` (the build step is required to update the IP in the JS files).

**Q: Cannot reach the site on port 80?**
- Check your Cloud Provider's (AWS/EC2) **Security Group**. You must allow **Inbound HTTP (Port 80)** traffic.

**Q: Database connection issues?**
- Check that `MONGO_URI` in `.env` uses `mongo` as the hostname (the internal service name).
