// WorldCup DB helper — migrate / query the prediction-results table.
//
// Usage:
//   node scripts/db.mjs migrate     # create the wc_predictions table
//   node scripts/db.mjs recent      # print 20 most recent predictions
//   node scripts/db.mjs leaderboard # champion win aggregate
//   node scripts/db.mjs ping        # test connection
//
// Reads DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME from the environment
// (load them from .env.deploy or export them before running).

import mysql from "mysql2/promise";

function requireEnv() {
  const { DB_HOST, DB_USER, DB_PASSWORD, DB_NAME } = process.env;
  if (!DB_HOST || !DB_USER || !DB_PASSWORD || !DB_NAME) {
    console.error(
      "❌ Missing DB env. Set DB_HOST, DB_USER, DB_PASSWORD, DB_NAME (and optional DB_PORT)."
    );
    process.exit(1);
  }
}

async function connect() {
  return mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    charset: "utf8mb4",
  });
}

const CREATE_SQL = `
CREATE TABLE IF NOT EXISTS wc_predictions (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  champion_id    VARCHAR(16)  NOT NULL,
  champion_name  VARCHAR(64)  NOT NULL,
  probability    DECIMAL(6,3) NOT NULL DEFAULT 0,
  runner_up_id   VARCHAR(16)  NULL,
  runner_up_name VARCHAR(64)  NULL,
  sim_count      INT UNSIGNED NOT NULL DEFAULT 0,
  use_mood       TINYINT(1)   NOT NULL DEFAULT 0,
  created_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_champion (champion_id),
  KEY idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='WorldCup 2026 prediction results';
`;

// 数据源配置中心：用户提交的观点（可影响模拟）
const CREATE_VIEWPOINTS_SQL = `
CREATE TABLE IF NOT EXISTS wc_viewpoints (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  scope      ENUM('team','general') NOT NULL DEFAULT 'team',
  team_id    VARCHAR(16)  NULL,
  category   ENUM('tactics','form','history','opinion') NOT NULL,
  stance     ENUM('positive','neutral','negative') NOT NULL DEFAULT 'neutral',
  weight     TINYINT UNSIGNED NOT NULL DEFAULT 3,
  content    VARCHAR(500) NOT NULL,
  link       VARCHAR(512) NULL,
  author     VARCHAR(64)  NULL,
  source     VARCHAR(32)  NOT NULL DEFAULT '其他',
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_team (team_id),
  KEY idx_category (category),
  KEY idx_source (source),
  KEY idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='WorldCup viewpoints / data sources';
`;

// DBA-tunable per-source weights that scale each platform's influence on the sim.
const CREATE_SOURCE_CONFIG_SQL = `
CREATE TABLE IF NOT EXISTS wc_source_config (
  source     VARCHAR(32)  NOT NULL,
  weight     DECIMAL(4,2) NOT NULL DEFAULT 1.00,
  enabled    TINYINT(1)   NOT NULL DEFAULT 1,
  updated_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (source)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='DBA source-platform weights that influence prediction';
`;

async function main() {
  const cmd = process.argv[2] || "migrate";
  requireEnv();
  const conn = await connect();
  try {
    if (cmd === "migrate") {
      await conn.query(CREATE_SQL);
      await conn.query(CREATE_VIEWPOINTS_SQL);
      await conn.query(CREATE_SOURCE_CONFIG_SQL);
      const defs = ["小红书", "微博", "抖音", "知乎", "Twitter/X", "其他"];
      for (const s of defs) {
        await conn.query("INSERT IGNORE INTO wc_source_config (source,weight,enabled) VALUES (?,1.00,1)", [s]);
      }
      console.log("✅ Tables wc_predictions, wc_viewpoints & wc_source_config are ready.");
    } else if (cmd === "ping") {
      const [rows] = await conn.query("SELECT 1 AS ok");
      console.log("✅ Connected:", rows);
    } else if (cmd === "recent") {
      const [rows] = await conn.query(
        "SELECT id, champion_name, probability, runner_up_name, sim_count, use_mood, created_at FROM wc_predictions ORDER BY created_at DESC LIMIT 20"
      );
      console.table(rows);
    } else if (cmd === "leaderboard") {
      const [rows] = await conn.query(
        "SELECT champion_name, COUNT(*) AS wins, ROUND(AVG(probability),2) AS avg_prob FROM wc_predictions GROUP BY champion_id, champion_name ORDER BY wins DESC LIMIT 10"
      );
      console.table(rows);
    } else {
      console.error(`Unknown command: ${cmd}. Use migrate|recent|leaderboard|ping`);
      process.exit(1);
    }
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error("❌", e.message);
  process.exit(1);
});
