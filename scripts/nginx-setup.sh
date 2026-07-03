#!/usr/bin/env bash
# Idempotently insert a `location <BASE_PATH>` proxy block into the nginx config
# for bianlianfangjiwen.top on the remote server.
#
# Non-destructive: backs up the config, inserts/replaces a marker-delimited block,
# validates with `nginx -t`, and restores the backup if validation fails.
#
# Called by scripts/deploy.sh (env vars already exported). Do not run standalone.
set -euo pipefail

: "${SERVER_HOST:?}"
: "${SERVER_USER:?}"
: "${APP_PORT:?}"
: "${BASE_PATH:?}"

SSH_OPTS="-o StrictHostKeyChecking=accept-new -o ConnectTimeout=15"
if [ -n "${SERVER_SSH_KEY:-}" ]; then
  SSH_CMD="ssh $SSH_OPTS -i $SERVER_SSH_KEY"
  SCP_CMD="scp $SSH_OPTS -i $SERVER_SSH_KEY"
elif [ -n "${SERVER_PASSWORD:-}" ]; then
  SSH_CMD="sshpass -p $SERVER_PASSWORD ssh $SSH_OPTS"
  SCP_CMD="sshpass -p $SERVER_PASSWORD scp $SSH_OPTS"
else
  echo "❌ No SSH auth configured"; exit 1
fi

# Build the location block locally and ship it as a file (avoids quoting hell).
TMP_BLOCK="$(mktemp)"
cat > "$TMP_BLOCK" <<EOF
    # --- worldcup-managed-start ---
    location ${BASE_PATH} {
        proxy_pass          http://127.0.0.1:${APP_PORT};
        proxy_http_version  1.1;
        proxy_set_header    Upgrade \$http_upgrade;
        proxy_set_header    Connection "upgrade";
        proxy_set_header    Host \$host;
        proxy_set_header    X-Real-IP \$remote_addr;
        proxy_set_header    X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header    X-Forwarded-Proto \$scheme;
        proxy_cache_bypass  \$http_upgrade;
    }
    # --- worldcup-managed-end ---
EOF

$SCP_CMD "$TMP_BLOCK" "${SERVER_USER}@${SERVER_HOST}:/tmp/worldcup.location"
rm -f "$TMP_BLOCK"

$SSH_CMD "${SERVER_USER}@${SERVER_HOST}" "NGINX_CONF='${NGINX_CONF:-}' bash -s" <<'REMOTE'
set -euo pipefail

if [ -z "${NGINX_CONF:-}" ]; then
  NGINX_CONF=$(grep -rl 'bianlianfangjiwen.top' /etc/nginx/sites-enabled/ /etc/nginx/conf.d/ /etc/nginx/sites-available/ 2>/dev/null | head -1 || true)
fi
if [ -z "$NGINX_CONF" ]; then
  NGINX_CONF=$(ls /etc/nginx/sites-enabled/* 2>/dev/null | head -1 || ls /etc/nginx/conf.d/*.conf 2>/dev/null | head -1 || true)
fi
if [ -z "$NGINX_CONF" ] || [ ! -f "$NGINX_CONF" ]; then
  echo "⚠ Could not locate the nginx config for bianlianfangjiwen.top."
  echo "  Add the contents of /tmp/worldcup.location inside the server {} block manually."
  exit 0
fi
echo "  nginx config: $NGINX_CONF"

BACKUP="${NGINX_CONF}.bak-$(date +%s)"
cp "$NGINX_CONF" "$BACKUP"
echo "  backup: $BACKUP"

if grep -q 'worldcup-managed-start' "$NGINX_CONF"; then
  # Replace the existing managed block (delete old region, then insert fresh).
  awk '
    /# --- worldcup-managed-start ---/ {skip=1}
    skip==0 {print}
    /# --- worldcup-managed-end ---/ {skip=0; next}
  ' "$NGINX_CONF" > "${NGINX_CONF}.tmp"
  mv "${NGINX_CONF}.tmp" "$NGINX_CONF"
  echo "  removed stale managed block"
fi

# Insert the block before the closing `}` of the FIRST (HTTPS/443) server block.
# We find that line by tracking brace depth with awk: the first time depth goes
# back to 0 is the end of the outermost server {} block.
INSERT_LINE=$(awk '
BEGIN { depth=0; insert=0 }
{
  for (i=1; i<=length($0); i++) {
    c = substr($0,i,1)
    if (c=="{") depth++
    if (c=="}") { depth--; if (depth==0 && insert==0) { insert=NR; exit } }
  }
}
END { print insert }
' "$NGINX_CONF")
if [ -z "$INSERT_LINE" ] || [ "$INSERT_LINE" -lt 1 ]; then
  echo "❌ Could not find closing brace of HTTPS server block; aborting (backup kept)."
  exit 1
fi
head -n $((INSERT_LINE-1)) "$NGINX_CONF" >  "${NGINX_CONF}.new"
cat /tmp/worldcup.location                >> "${NGINX_CONF}.new"
tail -n +$INSERT_LINE "$NGINX_CONF"       >> "${NGINX_CONF}.new"
mv "${NGINX_CONF}.new" "$NGINX_CONF"
echo "  inserted worldcup location block before line $INSERT_LINE (HTTPS server block)"

if ! nginx -t 2>&1; then
  echo "❌ nginx -t failed — restoring backup"
  cp "$BACKUP" "$NGINX_CONF"
  exit 1
fi
echo "  ✅ nginx config valid"
REMOTE
