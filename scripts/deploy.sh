#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Deploy the WorldCup predictor to the Aliyun server, served at a sub-path
# (e.g. https://bianlianfangjiwen.top/worldcup).
#
#   Build locally (Next.js standalone)  →  rsync bundle to server
#   →  (re)start via PM2  →  ensure nginx proxies BASE_PATH to the app.
#
# All secrets/config are read from .env.deploy (gitignored). Copy
# .env.deploy.example → .env.deploy and fill it in before running.
#
# Usage:  bash scripts/deploy.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# ── Load config ──────────────────────────────────────────────────────────────
if [ ! -f .env.deploy ]; then
  echo "❌ .env.deploy not found. Copy .env.deploy.example → .env.deploy and fill it in."
  exit 1
fi
set -a; . ./.env.deploy; set +a

: "${SERVER_HOST:?SERVER_HOST required in .env.deploy}"
SERVER_USER="${SERVER_USER:-root}"
APP_PORT="${APP_PORT:-3001}"
BASE_PATH="${BASE_PATH:-/worldcup}"
DEPLOY_DIR="${DEPLOY_DIR:-/var/www/worldcup}"
NGINX_CONF="${NGINX_CONF:-}"          # optional explicit path to the domain's nginx conf
PM2_NAME="${PM2_NAME:-worldcup}"

# ── SSH/SCP helpers (password via sshpass, or key-based) ─────────────────────
SSH_OPTS="-o StrictHostKeyChecking=accept-new -o ConnectTimeout=15"
if [ -n "${SERVER_SSH_KEY:-}" ]; then
  SSH_BASE="ssh $SSH_OPTS -i $SERVER_SSH_KEY"
  RSYNC_SSH="ssh $SSH_OPTS -i $SERVER_SSH_KEY"
elif [ -n "${SERVER_PASSWORD:-}" ]; then
  command -v sshpass >/dev/null 2>&1 || { echo "❌ sshpass needed for password auth. Install: brew install hudochenkov/sshpass/sshpass"; exit 1; }
  SSH_BASE="sshpass -p $SERVER_PASSWORD ssh $SSH_OPTS"
  RSYNC_SSH="sshpass -p $SERVER_PASSWORD ssh $SSH_OPTS"
else
  echo "❌ Set SERVER_SSH_KEY (recommended) or SERVER_PASSWORD in .env.deploy"
  exit 1
fi

run_remote() { $SSH_BASE "${SERVER_USER}@${SERVER_HOST}" "$1"; }

echo "▶ 1/6  Build (standalone, basePath=${BASE_PATH})"
NEXT_PUBLIC_BASE_PATH="$BASE_PATH" npm run build

echo "▶ 2/6  Assemble standalone bundle"
cp -r public .next/standalone/ 2>/dev/null || true
mkdir -p .next/standalone/.next
cp -r .next/static .next/standalone/.next/

# Server-side runtime env (never leaves the bundle → server).
cat > .next/standalone/.env <<EOF
PORT=${APP_PORT}
HOSTNAME=127.0.0.1
NODE_ENV=production
NEXT_PUBLIC_BASE_PATH=${BASE_PATH}
QWEN_API_KEY=${QWEN_API_KEY:-}
QWEN_MODEL=${QWEN_MODEL:-qwen-plus}
QWEN_BASE_URL=${QWEN_BASE_URL:-https://dashscope.aliyuncs.com/compatible-mode/v1}
FOOTBALL_DATA_API_KEY=${FOOTBALL_DATA_API_KEY:-}
DB_HOST=${DB_HOST:-}
DB_PORT=${DB_PORT:-3306}
DB_USER=${DB_USER:-}
DB_PASSWORD=${DB_PASSWORD:-}
DB_NAME=${DB_NAME:-}
EOF

echo "▶ 3/6  Sync bundle → ${SERVER_USER}@${SERVER_HOST}:${DEPLOY_DIR}"
run_remote "mkdir -p ${DEPLOY_DIR} && rm -rf ${DEPLOY_DIR:?}/*"
# tar-over-ssh (rsync not guaranteed on the server)
tar -C .next/standalone -czf - . | $SSH_BASE "${SERVER_USER}@${SERVER_HOST}" "tar -C ${DEPLOY_DIR} -xzf -"

echo "▶ 4/6  Ensure Node + PM2 on server, then (re)start '${PM2_NAME}'"
run_remote "command -v node >/dev/null 2>&1 || { curl -fsSL https://rpm.nodesource.com/setup_20.x | bash - && yum install -y nodejs || (apt-get update && apt-get install -y nodejs); }"
run_remote "command -v pm2 >/dev/null 2>&1 || npm install -g pm2"
# Source the bundle .env so PORT/HOSTNAME (read before Next loads .env) and all
# runtime secrets become real env vars, then (re)start cleanly.
run_remote "cd ${DEPLOY_DIR} && set -a; . ./.env; set +a; pm2 delete ${PM2_NAME} 2>/dev/null; pm2 start server.js --name ${PM2_NAME} --update-env && pm2 save"

echo "▶ 5/6  Ensure nginx proxies ${BASE_PATH} → 127.0.0.1:${APP_PORT}"
bash scripts/nginx-setup.sh
run_remote "nginx -t && (systemctl reload nginx || nginx -s reload)"

echo "▶ 6/6  Health check"
run_remote "curl -fsS -o /dev/null -w 'app: HTTP %{http_code}\n' http://127.0.0.1:${APP_PORT}${BASE_PATH} || echo 'app not responding on ${APP_PORT}'"

echo "✅ Deployed. Visit: https://bianlianfangjiwen.top${BASE_PATH}"
