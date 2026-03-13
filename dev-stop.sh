#!/usr/bin/env bash
# ──────────────────────────────────────────────
#  AI Task Platform — Stop All Local Services
#  Usage: bash dev-stop.sh
# ──────────────────────────────────────────────

for svc in backend worker frontend; do
  PID_FILE="/tmp/${svc}.pid"
  if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    kill "$PID" 2>/dev/null && echo "  ✓ Stopped $svc (PID $PID)"
    rm -f "$PID_FILE"
  fi
done

# Clean up any orphaned processes
fuser -k 5000/tcp 2>/dev/null && echo "  ✓ Freed port 5000"
fuser -k 3000/tcp 2>/dev/null && echo "  ✓ Freed port 3000"
pkill -f "worker.py"   2>/dev/null

echo ""
echo "  ✅  All services stopped"
echo ""
