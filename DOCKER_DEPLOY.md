# Three-Tier Application — Docker Compose Deployment Guide

This guide provides step-by-step instructions to deploy the **Three-Tier Application** using **Docker Compose** on a Linux server. Traffic is managed securely through an internal **Nginx Reverse Proxy** — no backend or frontend ports are exposed publicly.

---

## Architecture Overview

```text
       Internet (Port 80)
             │
             ▼
    ┌────────────────────── Docker Compose Network ──────────────────────┐
    │                                                                    │
    │  ┌──────────────┐         ┌──────────────┐      ┌──────────────┐   │
    │  │    Nginx     │──┬────▶│   Frontend   │      │   MongoDB    │   │
    │  │  (Port 80)   │  │      │   (Next.js)  │      │  (Private)   │   │
    │  └──────────────┘  │      └──────────────┘      └──────────────┘   │
    │         ▲          │                                    ▲          │
    │         │          │                                    │          │
    │   (User Traffic)   └─────▶┌──────────────┐             │          │
    │   /api/* routed            │   Backend    │─────────────┘          │
    │   to backend               │  (Node.js)   │                        │
    │                            └──────────────┘                        │
    │                                   │                                │
    │                           ┌──────────────┐                         │
    │                           │    Redis     │◀─────────────┐         │
    │                           │  (Private)   │               │         │
    │                           └──────────────┘               │         │
    │                                                   ┌──────────────┐ │
    │                                                   │    Worker    │ │
    │                                                   │   (Python)   │ │
    │                                                   └──────────────┘ │
    └────────────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

| Decision | Reason |
| :--- | :--- |
| **Nginx as sole entry point** | Only Port 80 is exposed publicly |
| **Relative API pathing** | Frontend calls `/api/...` — no hardcoded IPs needed |
| **Backend & Frontend ports closed** | Traffic only flows via Nginx internally |
| **MongoDB & Redis private** | Never accessible from outside the Docker network |

---

## Prerequisites

- **OS**: Ubuntu 22.04+ (or any modern Linux distro)
- **Resources**: 2 vCPU, 4GB RAM recommended
- **Docker Engine** installed

### Install Docker (Ubuntu)

```bash
sudo apt-get update
sudo curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker $USER
sudo chmod 666 /var/run/docker.sock
```

---

## Deployment Steps

### 1. Clone the Repository
```bash
git clone https://github.com/MoizAnsari-Dev/three-tier-application.git
cd three-tier-application
```

### 2. Configure Environment Variables

```bash
cp .env.example .env
nano .env
```

**Key variables to set:**

| Variable | Description | Example |
| :--- | :--- | :--- |
| `JWT_SECRET` | Secret key for auth tokens | `openssl rand -base64 32` |
| `NODE_ENV` | Application mode | `production` |
| `MONGO_URI` | MongoDB connection string | `mongodb://mongo:27017/three-tier-application` |

> [!IMPORTANT]
> There is **no** `NEXT_PUBLIC_API_URL` required. The frontend uses **relative paths** (`/api/...`) which Nginx automatically proxies to the backend. This keeps all server IPs private.

### 3. Build and Start

```bash
docker compose up -d --build
```

### 4. Verify Services

```bash
docker compose ps
```

| Service | Public Port | Description |
| :--- | :--- | :--- |
| **Nginx** | `80` | Only public entry point |
| **Frontend** | — | Private (via Nginx proxy) |
| **Backend** | — | Private (via Nginx proxy) |
| **MongoDB** | — | Private database |
| **Redis** | — | Private queue |
| **Worker** | — | Background task processor |

---

## Management & Maintenance

### View Logs
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend
```

### Update the Application
```bash
git pull origin main
docker compose up -d --build
```

### Scale the Worker
```bash
docker compose up -d --scale worker=5
```

### Stop Services
```bash
# Stop containers
docker compose stop

# Stop and remove containers
docker compose down

# Stop and remove containers AND volumes (DELETES DATABASE)
docker compose down -v
```

---

## Security & Hardening

### 1. Firewall (UFW)

Only expose SSH and HTTP. Everything else is handled privately by Docker.

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw enable
```

> [!NOTE]
> Ports 3000, 5000, 27017, and 6379 do **not** need to be open. They are secured inside the private Docker network.

### 2. AWS / Cloud Security Group

If deploying on EC2 or similar, ensure your **Inbound Rules** allow:

| Type | Port | Source |
| :--- | :--- | :--- |
| SSH | 22 | Your IP |
| HTTP | 80 | 0.0.0.0/0 |

### 3. Enable SSL / HTTPS with Certbot

```bash
sudo apt install python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

---

## Troubleshooting

**Q: "Login failed" or API not responding?**
- Check Nginx is running: `docker compose ps`
- Check backend logs: `docker compose logs -f backend`

**Q: Cannot reach the site on port 80?**
- Check your Cloud Security Group allows **Inbound HTTP (Port 80)**.

**Q: Database connection issues?**
- Ensure `MONGO_URI` uses `mongo` as the hostname (the internal Docker service name), not `localhost`.

**Q: Changes not reflected after code update?**
- Always run `docker compose up -d --build` after pulling new code. The `--build` flag is required to rebuild Docker images.
