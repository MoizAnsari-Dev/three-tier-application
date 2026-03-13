# ⚡ AI Task Processing Platform

A production-grade full-stack platform built with the **MERN stack + Python worker**, containerized with Docker, orchestrated on Kubernetes, and deployed via GitOps with Argo CD.

## 📋 Features

- 🔐 **JWT Authentication** — register, login, protected routes
- ⚡ **Async Task Processing** — Redis queue + Python worker
- 📊 **Real-time Status Tracking** — pending → running → success/failed
- 📜 **Task Logs** — timestamped logs for every task
- 🔠 **4 Operations** — uppercase, lowercase, reverse, word_count
- 🛡️ **Security** — bcrypt, helmet, rate limiting, non-root containers
- ☸️ **Kubernetes Ready** — HPA, ingress, probes, namespaces
- 🔄 **GitOps** — Argo CD auto-sync on every commit

---

## 🏗️ Architecture

```
Browser → Next.js Frontend → Express API → MongoDB
                                      ↓
                                   Redis Queue
                                      ↓
                              Python Worker (1–20 pods)
                                      ↓
                                   MongoDB (update result)
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for full documentation.

---

## 📁 Repository Structure

```
ai-task-platform/           ← App repository (this repo)
├── backend/                ← Node.js + Express API
│   ├── src/
│   │   ├── config/         ← db.js, redis.js
│   │   ├── middleware/     ← auth.js, rateLimiter.js
│   │   ├── models/         ← User.js, Task.js
│   │   ├── routes/         ← auth.js, tasks.js
│   │   ├── utils/          ← logger.js
│   │   └── index.js
│   └── Dockerfile
├── worker/                 ← Python background worker
│   ├── worker.py
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/               ← Next.js 14 frontend
│   ├── app/                ← App Router pages
│   │   ├── page.js         ← Landing page
│   │   ├── login/          ← Login
│   │   ├── register/       ← Register
│   │   ├── dashboard/      ← Task dashboard
│   │   └── tasks/          ← Create + Detail pages
│   ├── lib/                ← api.js, auth.js
│   └── Dockerfile
├── docker-compose.yml      ← Local development
├── .github/workflows/      ← CI/CD pipelines
└── ARCHITECTURE.md         ← Architecture document

ai-task-platform-infra/     ← Infrastructure repository
├── k8s/
│   ├── namespace.yaml
│   ├── backend/
│   ├── worker/             ← Includes HPA
│   ├── frontend/
│   ├── mongodb/            ← Includes PVC
│   ├── redis/
│   ├── configmaps/
│   ├── secrets/
│   └── ingress/
└── argocd/
    └── application.yaml
```

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- Docker & Docker Compose
- Node.js 20+ (optional, for local dev without Docker)
- Python 3.12+ (optional)

### 1. Clone the repository
```bash
git clone https://github.com/YOUR_USERNAME/ai-task-platform.git
cd ai-task-platform
```

### 2. Configure environment variables
```bash
# Copy and edit the example env file
cp backend/.env.example backend/.env
# Edit JWT_SECRET to a strong random string (min 32 chars)
```

### 3. Start all services with Docker Compose
```bash
docker compose up --build -d
```

This starts:
| Service | Port | Description |
|---------|------|-------------|
| Frontend | http://localhost:3000 | Next.js UI |
| Backend API | http://localhost:5000 | Express REST API |
| Worker (×2) | — | Python background processors |
| MongoDB | localhost:27017 | Database |
| Redis | localhost:6379 | Task queue |

### 4. Check service health
```bash
docker compose ps
curl http://localhost:5000/health
```

### 5. Your app is running!
Open http://localhost:3000 → Register → Create a task → Watch it process!

---

## 🧪 API Reference

### Auth Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | ❌ | Register a new user |
| POST | `/api/auth/login` | ❌ | Login, returns JWT |
| GET | `/api/auth/me` | ✅ | Get current user |

### Task Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/tasks` | ✅ | Create & queue a task |
| GET | `/api/tasks` | ✅ | List user's tasks (paginated) |
| GET | `/api/tasks/:id` | ✅ | Get task detail + logs |
| DELETE | `/api/tasks/:id` | ✅ | Delete a task |

### Task Operations
| Operation | Description |
|-----------|-------------|
| `uppercase` | Convert text to UPPERCASE |
| `lowercase` | Convert text to lowercase |
| `reverse` | Reverse the string character by character |
| `word_count` | Count total words in the text |

---

## ☸️ Kubernetes Deployment

### Prerequisites
- kubectl configured for your cluster (k3s, EKS, GKE, etc.)
- Docker Hub account with built images

### 1. Update image names in manifests
```bash
# Replace YOUR_DOCKERHUB_USERNAME in all deployment files
find ai-task-platform-infra/k8s -name "deployment.yaml" \
  -exec sed -i 's/YOUR_DOCKERHUB_USERNAME/yourusername/g' {} \;
```

### 2. Create secrets
```bash
# Encode your JWT secret
echo -n "your-super-secret-jwt-key-32chars" | base64

# Edit the secrets file with real values
vim ai-task-platform-infra/k8s/secrets/app-secrets.yaml

# Apply secrets (do NOT commit real secret values to Git!)
kubectl apply -f ai-task-platform-infra/k8s/secrets/app-secrets.yaml
```

### 3. Deploy everything
```bash
# Apply all manifests in order
kubectl apply -f ai-task-platform-infra/k8s/namespace.yaml
kubectl apply -f ai-task-platform-infra/k8s/configmaps/
kubectl apply -f ai-task-platform-infra/k8s/secrets/
kubectl apply -f ai-task-platform-infra/k8s/mongodb/
kubectl apply -f ai-task-platform-infra/k8s/redis/
kubectl apply -f ai-task-platform-infra/k8s/backend/
kubectl apply -f ai-task-platform-infra/k8s/worker/
kubectl apply -f ai-task-platform-infra/k8s/frontend/
kubectl apply -f ai-task-platform-infra/k8s/ingress/
```

### 4. Verify deployment
```bash
kubectl get all -n ai-task-platform
kubectl get hpa -n ai-task-platform
kubectl logs -l app=worker -n ai-task-platform --tail=20
```

---

## 🔄 GitOps with Argo CD

### Install Argo CD
```bash
kubectl create namespace argocd
kubectl apply -n argocd \
  -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Get the initial admin password
kubectl -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath="{.data.password}" | base64 -d

# Port-forward to access the UI
kubectl port-forward svc/argocd-server -n argocd 8080:443
# Visit: https://localhost:8080 (admin / password above)
```

### Deploy the Application
```bash
# Update the repoURL in argocd/application.yaml first!
kubectl apply -f ai-task-platform-infra/argocd/application.yaml
```

Argo CD will now:
1. Watch the infra repository for changes
2. Auto-sync on every commit
3. Self-heal if someone manually changes the cluster

---

## 🔧 GitHub Actions CI/CD Setup

Add these secrets to your GitHub repository (`Settings → Secrets`):

| Secret | Description |
|--------|-------------|
| `DOCKERHUB_USERNAME` | Your Docker Hub username |
| `DOCKERHUB_TOKEN` | Docker Hub access token |
| `INFRA_REPO` | `YOUR_USERNAME/ai-task-platform-infra` |
| `INFRA_REPO_TOKEN` | GitHub PAT with repo write access |

### CI/CD Flow
```
Push to main branch
    ↓
GitHub Actions: Lint → Build Docker image → Push to Docker Hub
    ↓
Auto-update image tag in infra repo (via yq + git push)
    ↓
Argo CD detects infra repo change → Rolling deploy to cluster
```

---

## 🛡️ Security Notes

- **Never commit `.env` files** — use `.env.example` only
- **Rotate JWT_SECRET** regularly in production
- **Use Sealed Secrets** or Vault for K8s secrets in production
- All containers run as **non-root users**
- Rate limiting: 20 req/15min (auth), 100 req/min (API)

---

## 📊 Monitoring

```bash
# Watch worker autoscaling
kubectl get hpa worker-hpa -n ai-task-platform -w

# View worker logs
kubectl logs -l app=worker -n ai-task-platform -f

# Check Redis queue length
kubectl exec -it deploy/redis -n ai-task-platform -- redis-cli llen task_queue

# MongoDB task stats
kubectl exec -it deploy/mongodb -n ai-task-platform -- \
  mongosh ai-task-platform --eval \
  'db.tasks.aggregate([{$group:{_id:"$status",count:{$sum:1}}}])'
```

---

## 📧 Submission Checklist

- [x] Application repository (this repo)
- [x] Infrastructure repository (`ai-task-platform-infra`)
- [x] Multi-stage Dockerfiles (frontend, backend, worker)
- [x] docker-compose.yml for local development
- [x] Kubernetes manifests (namespace, deployments, services, ingress, HPA, ConfigMaps, Secrets)
- [x] Argo CD Application manifest
- [x] GitHub Actions CI/CD (lint → build → push → update infra)
- [x] Architecture document (ARCHITECTURE.md)
- [ ] Live deployed URL (deploy to your cluster)
- [ ] Argo CD dashboard screenshot (take after deployment)
