#!/usr/bin/env bash

ROOT="$(cd "$(dirname "$0")" && pwd)"

# ── Colours ───────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
ok()   { echo -e "${GREEN}  ✓${NC} $*"; }
warn() { echo -e "${YELLOW}  !${NC} $*"; }
die()  { echo -e "${RED}  ✗ ERROR:${NC} $*"; exit 1; }

# ── 1. Check required tools ───────────────────
echo -e "\n  Checking requirements..."
command -v node    >/dev/null || die "Node.js not found  →  https://nodejs.org"
command -v python3 >/dev/null || die "Python3 not found  →  sudo apt install python3"
command -v mongod  >/dev/null || die "MongoDB not found  →  sudo apt install mongodb-org"
command -v redis-cli >/dev/null || die "Redis not found  →  sudo apt install redis-server"
ok "Node $(node -v) | Python $(python3 --version | cut -d' ' -f2)"

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
echo -e "\n Installing dependencies..."

cd "$ROOT/backend"
[ ! -f .env ] && cp .env.example .env && warn "Created backend/.env — please review it"
npm install --silent && ok "Backend packages installed"

cd "$ROOT/frontend"
[ ! -f .env.local ] && echo "NEXT_PUBLIC_API_URL=http://localhost:5000" > .env.local
npm install --silent && ok "Frontend packages installed"

cd "$ROOT/worker"
[ ! -f .env ] && cp .env.example .env && warn "Created worker/.env — please review it"
pip3 install -q -r requirements.txt && ok "Python packages installed"

# ── 5. Start services in the background ───────
echo -e "\n Starting services..."

cd "$ROOT/backend"
npm run dev > /tmp/backend.log 2>&1 &
echo $! > /tmp/backend.pid
ok "Backend  →  http://localhost:5000  (logs: /tmp/backend.log)"

cd "$ROOT/worker"
python3 -u worker.py > /tmp/worker.log 2>&1 &
echo $! > /tmp/worker.pid
ok "Worker   →  processing tasks in background  (logs: /tmp/worker.log)"
  
cd "$ROOT/frontend"
npm run dev > /tmp/frontend.log 2>&1 &
echo $! > /tmp/frontend.pid
ok "Frontend →  http://localhost:3000  (logs: /tmp/frontend.log)"

# ── 6. Done ───────────────────────────────────
echo -e "\n${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  ⚡  AI Task Platform is up and running!     ${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "    Open in browser  →  http://localhost:3000"
echo "    API health check →  http://localhost:5000/health"
echo ""
echo "    View logs:    tail -f /tmp/backend.log"
echo "  🛑  Stop services: bash dev-stop.sh"
echo ""

# Keep script alive — Ctrl+C will stop all services
trap "echo ''; echo 'Stopping...'; bash '$ROOT/dev-stop.sh'; exit 0" INT TERM
wait
