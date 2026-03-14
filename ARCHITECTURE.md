# Architecture Document — Three-Tier Application

## 1. System Overview

This platform is a production-grade, cloud-native application built on the MERN stack (MongoDB, Express, React/Next.js, Node.js) extended with a Python worker for asynchronous task processing, Redis for queueing, Docker containerization, Kubernetes orchestration, and GitOps delivery via Argo CD.

```
┌─────────────────────────────────────────────────────────────┐
│                        Client (Browser)                      │
│                   Next.js Frontend (React)                   │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTPS / REST
┌────────────────────────▼────────────────────────────────────┐
│              Node.js + Express Backend API                    │
│   - JWT Auth  - Helmet  - Rate Limiting  - Validation        │
└──────┬─────────────────────────────────────┬────────────────┘
       │ Mongoose                             │ ioredis rpush
       ▼                                     ▼
┌─────────────┐                    ┌──────────────────┐
│   MongoDB   │                    │      Redis       │
│  (tasks,    │◄───────────────────│  (task_queue)    │
│   users)    │   PyMongo update   │                  │
└─────────────┘                    └────────┬─────────┘
                                            │ BLPOP
                              ┌─────────────▼──────────┐
                              │   Python Worker Pods    │
                              │ (1..N replicas via HPA) │
                              │  - uppercase            │
                              │  - lowercase            │
                              │  - reverse              │
                              │  - word_count           │
                              └────────────────────────┘
```

---

## 2. Worker Scaling Strategy

### Current Approach (HPA + CPU/Memory)
- Workers run as a Kubernetes `Deployment` with `HorizontalPodAutoscaler`
- **Min replicas: 2** (always available)
- **Max replicas: 20**
- Scales up when average CPU > 70% or Memory > 80%

### Recommended Approach (KEDA — Queue-Length Based)
For true queue-driven scaling, deploy **KEDA** (Kubernetes Event-Driven Autoscaling):

```yaml
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: worker-scaledobject
  namespace: three-tier-application
spec:
  scaleTargetRef:
    name: worker
  minReplicaCount: 1
  maxReplicaCount: 50
  triggers:
    - type: redis
      metadata:
        address: redis-service:6379
        listName: task_queue
        listLength: "10"   # 1 replica per 10 queued jobs
```

This means:
- 0 items in queue → 1 replica (min)
- 100 items → 10 replicas
- 500 items → 20 replicas (capped at max)

---

## 3. Handling 100,000 Tasks / Day

### Load Analysis
- 100,000 tasks/day = **~1.2 tasks/second** average
- Peak hours (assume 3× avg): **~3.5 tasks/second**
- Assumption: each task takes ~0.5s to process

### Architecture for 100k/day

| Component | Configuration | Throughput |
|-----------|--------------|------------|
| Redis     | Single node (or Cluster) | >100k ops/s (not a bottleneck) |
| Worker replicas  | 4 pods × 1 task/0.5s = 8 tasks/s | Handles 3× peak |
| MongoDB writes | Indexed `userId`, `status` fields | <5ms per write |
| Backend API | 2 replicas + load balancer | 1000s of RPM |

### Optimizations
1. **Batch processing**: Worker can pull multiple jobs at once using `LRANGE` + `LTRIM`
2. **Connection pooling**: PyMongo uses connection pooling (default 100 connections)
3. **MongoDB sharding**: Shard `tasks` collection on `userId` for horizontal scaling
4. **Redis Cluster**: Add 3 master + 3 replica Redis nodes for HA above 500k/day
5. **CDN for frontend**: Static Next.js assets served from CDN to reduce origin load

---

## 4. Database Indexing Strategy

### Indexes on `tasks` collection

```javascript
// 1. Primary query: user fetches their tasks sorted by date (most common)
db.tasks.createIndex({ userId: 1, createdAt: -1 })

// 2. Filter by status (dashboard filter tabs)
db.tasks.createIndex({ status: 1, createdAt: 1 })

// 3. Admin / monitoring: find stuck running tasks
db.tasks.createIndex({ status: 1, startedAt: 1 })

// 4. TTL index: auto-delete tasks older than 90 days (optional)
db.tasks.createIndex({ createdAt: 1 }, { expireAfterSeconds: 7776000 })
```

### Indexes on `users` collection

```javascript
// Unique email for login lookup
db.users.createIndex({ email: 1 }, { unique: true })
```

### Query Patterns
| Query | Index Used | Estimated Time |
|-------|-----------|---------------|
| List user tasks | `{ userId, createdAt }` | <2ms |
| Filter by status | `{ status, createdAt }` | <2ms |
| Login lookup | `{ email }` unique | <1ms |
| Task by ID | `_id` (default) | <1ms |

---

## 5. Handling Redis Failure

### Problem: Redis is a single point of failure for the task queue.

### Mitigation Strategy (Layered)

#### Layer 1: Redis Persistence
```
# In Redis config / K8s command args:
appendonly yes          # AOF persistence — every write logged
save 60 1000            # RDB snapshot every 60s if 1000+ changes
```
Prevents data loss on Redis restart.

#### Layer 2: Worker Retry Logic
The Python worker uses exponential backoff:
```python
retryStrategy: (times) => Math.min(times * 100, 3000)
```
Worker automatically reconnects after Redis recovers.

#### Layer 3: Fallback — MongoDB Polling
If Redis is unreachable for >30s, the worker falls back to polling MongoDB directly:
```python
# Fallback: find tasks with status='pending', sorted by createdAt
tasks = db.tasks.find({"status": "pending"}).sort("createdAt", 1).limit(10)
```

#### Layer 4: Redis Sentinel / Cluster (Production)
Deploy 3-node Redis Sentinel for automatic failover:
- 1 primary + 2 replicas
- Sentinel monitors and promotes replica if primary fails
- Failover happens in <30 seconds
- No data loss with AOF enabled

#### Layer 5: Dead Letter Queue
Failed jobs (3 retries) are moved to `task_queue_dead`:
```python
redis.rpush("task_queue_dead", job)
```
Allows manual inspection and reprocessing.

---

## 6. Staging vs Production Deployments

### Repository Strategy: Two Environments, One Infra Repo

```
three-tier-application-infra/
├── k8s/
│   ├── overlays/
│   │   ├── staging/
│   │   │   ├── kustomization.yaml
│   │   │   └── patches/  # lower replicas, staging domain
│   │   └── production/
│   │       ├── kustomization.yaml
│   │       └── patches/  # full replicas, prod domain
│   └── base/             # shared manifests
└── argocd/
    ├── app-staging.yaml
    └── app-production.yaml
```

### Two Argo CD Applications

| Setting | Staging | Production |
|---------|---------|-----------|
| Namespace | `three-tier-staging` | `three-tier-application` |
| Image tag | `sha-<commit>` (branch: staging) | `sha-<commit>` (branch: main) |
| Replicas (backend) | 1 | 2+ |
| Replicas (worker) | 1 | 2–20 (HPA) |
| Domain | `staging.taskflow.example.com` | `taskflow.example.com` |
| MongoDB | Separate staging DB | Production cluster |
| Auto-sync | Yes | Yes + manual approval gate |

### CI/CD Pipeline Flow
```
Developer push to staging branch
    → GitHub Actions: lint → build → push image:sha-abc123
    → Update infra/k8s/overlays/staging/deployment-patch.yaml
    → Argo CD detects change → deploys to staging ns in 30s

QA approval → merge to main
    → GitHub Actions: lint → build → push image:sha-def456
    → Update infra/k8s/overlays/production/deployment-patch.yaml
    → Argo CD auto-deploys to production (rolling update, 0 downtime)
```

---

## 7. Security Architecture

| Layer | Control |
|-------|---------|
| Passwords | bcrypt, cost factor 12 |
| API Auth | JWT, RS256 signing, 7-day expiry |
| HTTP headers | Helmet.js (CSP, HSTS, X-Frame-Options) |
| Rate limiting | 20 req/15min (auth), 100 req/min (API) |
| Input validation | express-validator on all endpoints |
| Container security | Non-root user, read-only FS, dropped Linux capabilities |
| Secrets | Kubernetes Secrets (use Sealed Secrets or Vault in prod) |
| Network | All services on ClusterIP — only frontend/backend exposed via Ingress |

---

## 8. Technology Stack Summary

| Layer | Technology | Reason |
|-------|-----------|--------|
| Frontend | Next.js 14 | SSR, file-based routing, standalone Docker output |
| Backend | Node.js + Express | Fast I/O, rich middleware ecosystem |
| Worker | Python 3.12 | Excellent text processing, async-friendly |
| Database | MongoDB 7 | Flexible schema for task logs |
| Queue | Redis 7 | Sub-millisecond pub/sub, BLPOP for blocking pop |
| Orchestration | Kubernetes (k3s) | Production-grade scaling |
| GitOps | Argo CD | Declarative, auditable deployments |
| CI/CD | GitHub Actions | Tightly integrated with code repo |
| Container | Docker (multi-stage) | Minimal image size, non-root |
