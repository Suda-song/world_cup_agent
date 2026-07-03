---
name: worldcup-db
description: Use to manage the WorldCup predictor's MySQL database — create/migrate the wc_predictions table, test the connection, or view saved prediction results and the champion leaderboard. Trigger on "migrate db", "check predictions", "db setup", "数据库", "看预测结果".
---

# WorldCup DB operations

The app persists each tournament simulation's champion to a MySQL table
`wc_predictions`. Connection credentials live in `.env.deploy` (gitignored) as
`DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME`.

The helper script `scripts/db.mjs` performs all operations. It reads the DB
config from the environment, so load `.env.deploy` first.

## Steps

1. **Confirm `.env.deploy` exists** with the `DB_*` keys. If it does not, ask the
   user for the MySQL host/user/password/db-name and create it (never commit it).

2. **Run the requested operation**, loading env from `.env.deploy`:

   ```bash
   set -a; . ./.env.deploy; set +a
   node scripts/db.mjs <command>
   ```

   Commands:
   - `ping` — verify connectivity
   - `migrate` — create the `wc_predictions` table (idempotent, `CREATE TABLE IF NOT EXISTS`)
   - `recent` — print the 20 most recent predictions
   - `leaderboard` — champion win counts + average probability

3. **First-time setup**: run `ping` then `migrate`.

## Table schema (`wc_predictions`)

| column | type | note |
|---|---|---|
| id | BIGINT PK auto | |
| champion_id | VARCHAR(16) | team id, e.g. `arg` |
| champion_name | VARCHAR(64) | e.g. 阿根廷 |
| probability | DECIMAL(6,3) | champion win % from Monte Carlo |
| runner_up_id / runner_up_name | VARCHAR | 2nd most likely |
| sim_count | INT | number of simulations |
| use_mood | TINYINT | whether mood modifier was on |
| created_at | TIMESTAMP | auto |

## Notes

- The API route `app/api/predictions` (POST save / GET list) uses `lib/db.ts`.
  If `DB_*` env vars are absent, the app runs normally and simply skips
  persistence — the DB is optional at runtime.
- The table is created inside the shared database `orba_refinement_analytics`
  with the `wc_` prefix, so it will not collide with other tables there.
