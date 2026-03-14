#!/usr/bin/env bash

# ── Colours ───────────────────────────────────
GREEN='\033[0;32m'; NC='\033[0m'

for svc in backend worker; do
  PID_FILE="/tmp/${svc}.pid"
  if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    kill "$PID" 2>/dev/null && echo -e "${GREEN}  ✓${NC} Stopped $svc (PID $PID)"
    rm -f "$PID_FILE"
  fi
done

# Clean up any orphaned processes
fuser -k 5000/tcp 2>/dev/null && echo -e "${GREEN}  ✓${NC} Freed port 5000"
pkill -f "worker.py" 2>/dev/null

echo -e "\n✅ Backend services stopped"
