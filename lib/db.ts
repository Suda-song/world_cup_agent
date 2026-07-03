import mysql from "mysql2/promise";

// Lazily-created shared MySQL pool. Reads connection config from env so no
// credentials are ever committed. See .env.example for the required keys.
let pool: mysql.Pool | null = null;

export function getPool(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0,
      charset: "utf8mb4",
    });
  }
  return pool;
}

// True only when all required DB env vars are present. Used by API routes to
// degrade gracefully (skip persistence) when the DB is not configured.
export function isDbConfigured(): boolean {
  return Boolean(
    process.env.DB_HOST &&
      process.env.DB_USER &&
      process.env.DB_PASSWORD &&
      process.env.DB_NAME
  );
}
