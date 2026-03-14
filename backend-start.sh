#!/usr/bin/env bash

ROOT="$(cd "$(dirname "$0")" && pwd)"

# ── Colours ───────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
ok()   { echo -e "${GREEN}  ✓${NC} $*"; }
warn() { echo -e "${YELLOW}  !${NC} $*"; }
die()  { echo -e "${RED}  ✗ ERROR:${NC} $*"; exit 1; }

# ── 1. Check required tools ───────────────────
echo -e "\n  Checking backend requirements..."
command -v node    >/dev/null || die "Node.js not found"
command -v python3 >/dev/null || die "Python3 not found"
command -v mongod  >/dev/null || die "MongoDB not found"
command -v redis-cli >/dev/null || die "Redis not found"

# ── 2. Start MongoDB ──────────────────────────
echo -e "\n Starting MongoDB..."
if mongosh --eval "db.adminCommand('ping')" --quiet >/dev/null 2>&1; then
  ok "MongoDB already running"
else
  sudo systemctl start mongod 2>/dev/null || sudo service mongod start 2>/dev/null
  sleep 2
  mongosh --eval "db.adminCommand('ping')" --quiet >/dev/null 2>&1 && ok "MongoDB started" || die "MongoDB failed to start"
fi

# ── 3. Start Redis ────────────────────────────
echo -e "\n🔴 Starting Redis..."
if redis-cli ping >/dev/null 2>&1; then
  ok "Redis already running"
else
  sudo systemctl start redis-server 2>/dev/null || sudo service redis start 2>/dev/null
  sleep 1
  redis-cli ping >/dev/null 2>&1 && ok "Redis started" || die "Redis failed to start"
fi

# ── 4. Install dependencies ───────────────────
echo -e "\n Installing backend & worker dependencies..."

cd "$ROOT/backend"
[ ! -f .env ] && cp .env.example .env && warn "Created backend/.env — please review it"
npm install --silent && ok "Backend packages installed"

cd "$ROOT/worker"
[ ! -f .env ] && cp .env.example .env && warn "Created worker/.env — please review it"
pip3 install -q -r requirements.txt && ok "Python packages installed"

# ── 5. Start services ─────────────────────────
echo -e "\n Starting backend & worker..."

cd "$ROOT/backend"
npm run dev > /tmp/backend.log 2>&1 &
echo $! > /tmp/backend.pid
ok "Backend  →  http://localhost:5000  (logs: /tmp/backend.log)"

cd "$ROOT/worker"
python3 -u worker.py > /tmp/worker.log 2>&1 &
echo $! > /tmp/worker.pid
ok "Worker   →  processing tasks in background  (logs: /tmp/worker.log)"

echo -e "\n${GREEN}⚡ Backend services are running!${NC}"
echo "   Logs: tail -f /tmp/backend.log"
echo "   Stop: bash backend-stop.sh"

# Wait for background processes
trap "echo ''; echo 'Stopping...'; bash '$ROOT/backend-stop.sh'; exit 0" INT TERM
wait
