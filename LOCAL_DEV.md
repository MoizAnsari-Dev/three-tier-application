# 🚀 Three-Tier Application — Complete Local Development Guide

> Run the entire platform on your local machine **without Docker or Docker Compose**

---

## 📋 Table of Contents

1. [System Requirements](#1-system-requirements)
2. [Install Prerequisites](#2-install-prerequisites)
3. [Clone / Navigate to the Project](#3-clone--navigate-to-the-project)
4. [Configure Environment Variables](#4-configure-environment-variables)
5. [Start Infrastructure (MongoDB + Redis)](#5-start-infrastructure-mongodb--redis)
6. [Run the Backend API](#6-run-the-backend-api)
7. [Run the Python Worker](#7-run-the-python-worker)
8. [Run the Frontend](#8-run-the-frontend)
9. [Verify Everything Works](#9-verify-everything-works)
10. [Using the Application](#10-using-the-application)
11. [Troubleshooting](#11-troubleshooting)
12. [Stop All Services](#12-stop-all-services)

---

## 1. System Requirements

| Tool | Minimum Version | Check Command |
|------|----------------|---------------|
| **Node.js** | v20+ | `node --version` |
| **npm** | v9+ | `npm --version` |
| **Python** | 3.10+ | `python3 --version` |
| **pip** | 21+ | `pip3 --version` |
| **MongoDB** | 6.0+ | `mongod --version` |
| **Redis** | 7.0+ | `redis-server --version` |
| **OS** | Ubuntu 20.04+ / Debian / macOS | — |

---

## 2. Install Prerequisites

### 2a. Node.js 20 (via nvm — recommended)

```bash
# Install nvm (Node Version Manager)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# Reload your shell
source ~/.bashrc   # or ~/.zshrc on Mac

# Install and use Node.js 20
nvm install 20
nvm use 20
nvm alias default 20

# Verify
node --version   # should print v20.x.x
npm --version    # should print 9.x or 10.x
```

### 2b. Python 3 + pip

```bash
# Ubuntu / Debian
sudo apt update
sudo apt install -y python3 python3-pip

# macOS
brew install python@3.12

# Verify
python3 --version   # Python 3.10+
pip3 --version
```

### 2c. MongoDB 7

```bash
# Ubuntu 22.04 / 24.04
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
  sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor

echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] \
  https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | \
  sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

sudo apt update
sudo apt install -y mongodb-org

# Start and enable MongoDB
sudo systemctl enable --now mongod

# Verify
mongosh --eval "db.adminCommand('ping')"
# Expected output: { ok: 1 }
```

### 2d. Redis 7

```bash
# Ubuntu / Debian
sudo apt install -y redis-server

# Start and enable Redis
sudo systemctl enable --now redis-server

# Verify
redis-cli ping
# Expected output: PONG
```

---

## 3. Clone / Navigate to the Project

```bash
# If you already have it:
cd /home/moiz/Music/three-tier-application

# If cloning fresh from GitHub:
git clone https://github.com/YOUR_USERNAME/three-tier-application.git
cd three-tier-application
```

Your directory structure should look like this:
```
three-tier-application/
├── backend/          ← Node.js + Express API
├── worker/           ← Python background worker
├── frontend/         ← Next.js 14 UI
├── dev-start.sh      ← One-command startup script
├── dev-stop.sh       ← One-command stop script
├── docker-compose.yml
└── README.md
```

---

## 4. Configure Environment Variables

You need `.env` files for each service. Run these commands:

### Backend `.env`

```bash
cd /home/moiz/Music/three-tier-application/backend
cp .env.example .env
```

Open `backend/.env` and set these exact values for local dev:

```env
# ── backend/.env ──────────────────────────────────
NODE_ENV=development
PORT=5000

# MongoDB — local instance (no auth)
MONGO_URI=mongodb://localhost:27017/three-tier-application

# Redis — local instance
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT Secret (use any long random string)
JWT_SECRET=supersecretjwt_changeme_in_prod_32chars
JWT_EXPIRES_IN=7d

# CORS — allow the Next.js dev server
CORS_ORIGIN=http://localhost:3000,http://localhost:3001

# Logging
LOG_LEVEL=info
```

### Worker `.env`

```bash
cd /home/moiz/Music/three-tier-application/worker
cp .env.example .env
```

Open `worker/.env` and set:

```env
# ── worker/.env ───────────────────────────────────
MONGO_URI=mongodb://localhost:27017/three-tier-application
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
LOG_LEVEL=INFO
```

### Frontend `.env.local`

```bash
cd /home/moiz/Music/three-tier-application/frontend
```

Create a new file `frontend/.env.local` with:

```env
# ── frontend/.env.local ───────────────────────────
NEXT_PUBLIC_API_URL=http://localhost:5000
```

> ⚠️ **Important**: In Next.js, `NEXT_PUBLIC_` variables are read at **build time**. `.env.local` works for `npm run dev` (development mode). No need to rebuild.

---

## 5. Start Infrastructure (MongoDB + Redis)

Open a terminal and run:

```bash
# Start MongoDB
sudo systemctl start mongod

# Check MongoDB is running
sudo systemctl status mongod
# Should show: Active: active (running)

# Start Redis
sudo systemctl start redis-server

# Check Redis is running
redis-cli ping
# Should print: PONG
```

**Verify both are working:**

```bash
# MongoDB test
mongosh --eval "db.adminCommand('ping')" --quiet
# Expected: { ok: 1 }

# Redis test
redis-cli ping
# Expected: PONG
```

> 💡 If `mongod` is not found, MongoDB is not installed. Go back to Step 2c.

---

## 6. Run the Backend API

Open a **new terminal window/tab**:

```bash
cd /home/moiz/Music/three-tier-application/backend

# Install dependencies (first time only)
npm install

# Start the backend in development mode (auto-restarts on changes)
npm run dev
```

**Expected output:**

```
[nodemon] starting `node src/index.js`
2026-03-13 [info]: MongoDB Connected: localhost
2026-03-13 [info]: Backend API running on port 5000 [development]
2026-03-13 [info]: Redis connected
```

**Quick test (in another terminal):**

```bash
curl http://localhost:5000/health
# Expected: {"status":"ok","timestamp":"...","service":"backend-api"}
```

> ✅ If you see the JSON response, the backend is working!

---

## 7. Run the Python Worker

Open a **new terminal window/tab**:

```bash
cd /home/moiz/Music/three-tier-application/worker

# Install Python dependencies (first time only)
pip3 install -r requirements.txt

# Start the worker
python3 -u worker.py
```

**Expected output:**

```
2026-03-13 INFO     Connecting to MongoDB...
2026-03-13 INFO     Connected to MongoDB
2026-03-13 INFO     Connecting to Redis...
2026-03-13 INFO     Connected to Redis
2026-03-13 INFO     Worker ready. Waiting for tasks on queue: task_queue ...
```

> ✅ The worker is now listening for tasks on the Redis queue

---

## 8. Run the Frontend

Open a **new terminal window/tab**:

```bash
cd /home/moiz/Music/three-tier-application/frontend

# Install dependencies (first time only)
npm install

# Start Next.js in development mode (hot-reload enabled)
npm run dev
```

**Expected output:**

```
▲ Next.js 14.2.3
- Local:        http://localhost:3000
- Environments: .env.local

✓ Ready in 2.4s
```

> ✅ Open your browser and visit **http://localhost:3000**

---

## 9. Verify Everything Works

With all 5 services running, test end-to-end:

### Test 1 — Backend Health

```bash
curl http://localhost:5000/health
```
Expected: `{"status":"ok", ...}`

### Test 2 — Register a User

```bash
curl -s -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","password":"password123"}' \
  | python3 -m json.tool
```
Expected: `{"success": true, "token": "eyJ...", "user": {...}}`

### Test 3 — Login

```bash
curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}' \
  | python3 -m json.tool
```
Expected: `{"success": true, "token": "eyJ...", "user": {...}}`

### Test 4 — Create a Task (replace TOKEN with the token from login)

```bash
export TOKEN="eyJhbGci..."   # paste your JWT token here

curl -s -X POST http://localhost:5000/api/tasks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"title":"My first task","inputText":"Hello World","operation":"uppercase"}' \
  | python3 -m json.tool
```
Expected: `{"success": true, "task": {"status": "pending", ...}}`

### Test 5 — Watch the Worker Process the Task

Check your **worker terminal** — you should see:

```
2026-03-13 INFO  Processing task abc123 (uppercase)
2026-03-13 INFO  Task abc123 completed successfully. Result: HELLO WORLD
```

### Test 6 — Check the Result

```bash
curl -s http://localhost:5000/api/tasks \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -m json.tool
```
Expected: task with `"status": "completed"` and `"result": "HELLO WORLD"`

---

## 10. Using the Application

Open **http://localhost:3000** in your browser.

| Page | URL | Description |
|------|-----|-------------|
| **Landing** | http://localhost:3000 | Home page with features |
| **Register** | http://localhost:3000/register | Create a new account |
| **Login** | http://localhost:3000/login | Sign in |
| **Dashboard** | http://localhost:3000/dashboard | View all your tasks |
| **Create Task** | http://localhost:3000/tasks/new | Submit a new task |
| **Task Detail** | http://localhost:3000/tasks/:id | View task result + logs |

**Available task operations:**

| Operation | What it does | Example |
|-----------|-------------|---------|
| `uppercase` | Converts text to UPPERCASE | `hello` → `HELLO` |
| `lowercase` | Converts text to lowercase | `HELLO` → `hello` |
| `reverse` | Reverses the text | `Hello` → `olleH` |
| `word_count` | Counts words in text | `"Hello World"` → `2 words` |

---

## 11. Troubleshooting

### ❌ `MongoDB not found` or `mongod: command not found`
```bash
# Install MongoDB
sudo apt install -y mongodb-org
# Or for older Ubuntu:
sudo apt install -y mongodb
sudo systemctl start mongodb
```

### ❌ `Redis connection refused`
```bash
# Start Redis manually
sudo service redis-server start
# Or:
redis-server &
```

### ❌ `EADDRINUSE: port 5000 already in use`
```bash
# Find and kill the process using port 5000
fuser -k 5000/tcp
# Then restart: npm run dev
```

### ❌ `EADDRINUSE: port 3000 already in use`
```bash
# Either kill the process:
fuser -k 3000/tcp
# Or run frontend on a different port:
PORT=3001 npm run dev
# Then update frontend/.env.local to match and restart backend
```

### ❌ `Module not found: Can't resolve '@/lib/api'`
```bash
# Make sure jsconfig.json exists in the frontend folder
ls /home/moiz/Music/three-tier-application/frontend/jsconfig.json
# If missing, create it:
echo '{"compilerOptions":{"baseUrl":".","paths":{"@/*":["./*"]}}}' > jsconfig.json
```

### ❌ `Registration failed` in the browser
This is usually a CORS issue. Make sure `backend/.env` has:
```env
CORS_ORIGIN=http://localhost:3000,http://localhost:3001
```
Then restart the backend (`Ctrl+C` then `npm run dev`).

### ❌ Worker not processing tasks
```bash
# Check if worker is connected to Redis
redis-cli llen task_queue    # shows number of pending tasks

# Restart the worker
Ctrl+C  →  python3 -u worker.py
```

### ❌ `pip3: command not found`
```bash
sudo apt install -y python3-pip
```

---

## 12. Stop All Services

Stop each service by pressing **Ctrl+C** in its terminal window.

Or use the stop script to kill everything at once:

```bash
bash /home/moiz/Music/three-tier-application/dev-stop.sh
```

Stop the infrastructure:

```bash
sudo systemctl stop mongod
sudo systemctl stop redis-server
```

---

## 🎯 Quick Reference — All Commands at a Glance

```bash
# ── Infrastructure ───────────────────────────────────────
sudo systemctl start mongod          # Start MongoDB
sudo systemctl start redis-server    # Start Redis

# ── Backend (Terminal 1) ─────────────────────────────────
cd /home/moiz/Music/three-tier-application/backend
npm install && npm run dev           # Runs on port 5000

# ── Python Worker (Terminal 2) ───────────────────────────
cd /home/moiz/Music/three-tier-application/worker
pip3 install -r requirements.txt
python3 -u worker.py

# ── Frontend (Terminal 3) ────────────────────────────────
cd /home/moiz/Music/three-tier-application/frontend
npm install && npm run dev           # Runs on port 3000

# ── OR use the one-command script ────────────────────────
bash /home/moiz/Music/three-tier-application/dev-start.sh

# ── Stop everything ──────────────────────────────────────
bash /home/moiz/Music/three-tier-application/dev-stop.sh
```

---

> [!NOTE]
> All `.env` files are git-ignored for security. Never commit real secrets to Git. The values above are safe defaults only for local development.

> [!TIP]
> The worker can be scaled: just open multiple terminals and run `python3 -u worker.py` in each. They all compete to pop from the same Redis queue.

> [!IMPORTANT]
> After any code change to the backend or worker, the server auto-restarts (nodemon for Node, manual Ctrl+C + restart for Python). The frontend (Next.js) hot-reloads automatically in dev mode — no restart needed.
