#!/usr/bin/env bash
# ─────────────────────────────────────────────
#  setup-nginx.sh — Install & configure Nginx
#  Usage: bash nginx/setup-nginx.sh
#  Run as: a user with sudo access
# ─────────────────────────────────────────────

set -e

CONF_SRC="$(cd "$(dirname "$0")" && pwd)/nginx.conf"
CONF_DEST="/etc/nginx/sites-available/ai-task-platform"

GREEN='\033[0;32m'; RED='\033[0;31m'; NC='\033[0m'
ok()  { echo -e "${GREEN}  ✓${NC} $*"; }
die() { echo -e "${RED}  ✗ ERROR:${NC} $*"; exit 1; }

# ── 1. Install Nginx ──────────────────────────
echo -e "\n Installing Nginx..."
sudo apt update -qq
sudo apt install -y nginx
ok "Nginx installed ($(nginx -v 2>&1))"

# ── 2. Copy config ────────────────────────────
echo -e "\n Copying config..."
sudo cp "$CONF_SRC" "$CONF_DEST"
ok "Config copied to $CONF_DEST"

# ── 3. Enable the site ────────────────────────
echo -e "\n Enabling site..."
# Remove default site if it exists
sudo rm -f /etc/nginx/sites-enabled/default

# Create symlink to enable our site
sudo ln -sf "$CONF_DEST" /etc/nginx/sites-enabled/ai-task-platform
ok "Site enabled"

# ── 4. Test config ────────────────────────────
echo -e "\n Testing Nginx config..."
sudo nginx -t && ok "Config is valid"

# ── 5. Start / reload Nginx ───────────────────
echo -e "\n Starting Nginx..."
sudo systemctl enable nginx
sudo systemctl reload nginx || sudo systemctl start nginx
ok "Nginx is running"

# ── Done ──────────────────────────────────────
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  ✅  Nginx is configured and running!        ${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "  🌐  App URL     → http://$(hostname -I | awk '{print $1}')"
echo "  🔍  Health      → http://$(hostname -I | awk '{print $1}')/health"
echo ""
echo "  📋  Logs:"
echo "    sudo tail -f /var/log/nginx/ai-task-access.log"
echo "    sudo tail -f /var/log/nginx/ai-task-error.log"
echo ""
echo "  🔒  For HTTPS, run:"
echo "    sudo apt install -y certbot python3-certbot-nginx"
echo "    sudo certbot --nginx -d yourdomain.com"
echo ""
