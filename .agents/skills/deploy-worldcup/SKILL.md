---
name: deploy-worldcup
description: Use to build and deploy the WorldCup predictor to the Aliyun server, served at https://bianlianfangjiwen.top/worldcup. Trigger on "deploy", "部署", "发布上线", "push 上线", "deploy to aliyun", after pushing code and wanting it live.
---

# Deploy WorldCup predictor → Aliyun (/worldcup)

Builds the Next.js app as a standalone bundle, rsyncs it to the Aliyun server,
(re)starts it under PM2, and ensures nginx proxies `/worldcup` to it. Serves at
**https://bianlianfangjiwen.top/worldcup** (mobile/H5 supported).

## Preconditions

1. `.env.deploy` exists (copy from `.env.deploy.example`, gitignored) with:
   - `SERVER_HOST`, `SERVER_USER`, and **either** `SERVER_SSH_KEY` (recommended)
     **or** `SERVER_PASSWORD`.
   - `BASE_PATH=/worldcup`, `APP_PORT`, `DEPLOY_DIR`, `PM2_NAME`.
   - Runtime secrets baked into the server bundle: `MINIMAX_API_KEY`,
     `QWEN_API_KEY`, and `DB_*`.
2. If using password auth, `sshpass` is installed locally
   (`brew install hudochenkov/sshpass/sshpass`). Key auth needs nothing extra.
3. Node.js is available locally to build. The script installs Node + PM2 on the
   server automatically if missing.

## Steps

1. Verify `.env.deploy` is present and populated. If not, create it from the
   example and ask the user for any missing secrets. Do **not** commit it.

2. Run the deploy:

   ```bash
   bash scripts/deploy.sh
   ```

   This performs: build (with `NEXT_PUBLIC_BASE_PATH=/worldcup`) → assemble
   standalone bundle (+ `public`, `.next/static`, server `.env`) → rsync to
   `DEPLOY_DIR` → PM2 restart/start → nginx location insert (backed up +
   `nginx -t` validated, auto-rollback on failure) → health check.

3. On success it prints `https://bianlianfangjiwen.top/worldcup`. Open it and
   verify the dashboard loads on both desktop and mobile widths.

## Safety notes

- The nginx step is **non-destructive**: it backs up the domain's conf, inserts
  a marker-delimited `location /worldcup` block, validates with `nginx -t`, and
  **restores the backup** if validation fails. Re-running replaces the managed
  block idempotently — it never duplicates or touches the site root.
- Deploying to the live domain is high blast-radius. Confirm with the user
  before the first deploy, and check the health-check output afterward.
- To wire "deploy on every push", add a git `pre-push` hook that runs
  `bash scripts/deploy.sh`, but prefer running this skill manually so pushes to
  work-in-progress branches don't hit production.

## First-time DB setup

Before the first deploy that saves predictions, create the table via the
`worldcup-db` skill (`node scripts/db.mjs migrate`).
