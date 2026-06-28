import { spawnSync } from "node:child_process"
import { mkdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const dbPath = join(root, "data", "scanzapp-prisma.db")

mkdirSync(dirname(dbPath), { recursive: true })

const sql = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS "users" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL UNIQUE,
  "password_hash" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'user',
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "sessions" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "user_id" TEXT NOT NULL,
  "token_hash" TEXT NOT NULL UNIQUE,
  "expires_at" DATETIME NOT NULL,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "profiles" (
  "user_id" TEXT NOT NULL PRIMARY KEY,
  "selected_goal" TEXT,
  "form_json" TEXT NOT NULL DEFAULT '{}',
  "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "user_settings" (
  "user_id" TEXT NOT NULL PRIMARY KEY,
  "settings_json" TEXT NOT NULL,
  "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "meals" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "user_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "calories" REAL NOT NULL,
  "protein" REAL NOT NULL,
  "carbs" REAL NOT NULL,
  "fat" REAL NOT NULL,
  "time" TEXT NOT NULL,
  "date" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "confidence" REAL,
  "note" TEXT,
  "image_url" TEXT,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "meals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "water_logs" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "user_id" TEXT NOT NULL,
  "date" TEXT NOT NULL,
  "time" TEXT NOT NULL,
  "amount" REAL NOT NULL,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "water_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "scan_results" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "user_id" TEXT,
  "meal_id" TEXT,
  "model" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "is_food" BOOLEAN,
  "confidence" REAL,
  "latency_ms" INTEGER NOT NULL,
  "upstream_status" INTEGER,
  "error_message" TEXT,
  "raw_preview" TEXT,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "scan_results_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "scan_results_meal_id_fkey" FOREIGN KEY ("meal_id") REFERENCES "meals" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "meals_user_id_date_idx" ON "meals"("user_id", "date");
CREATE INDEX IF NOT EXISTS "water_logs_user_id_date_idx" ON "water_logs"("user_id", "date");
CREATE INDEX IF NOT EXISTS "scan_results_created_at_idx" ON "scan_results"("created_at");
CREATE INDEX IF NOT EXISTS "scan_results_user_id_created_at_idx" ON "scan_results"("user_id", "created_at");
`

const result = spawnSync("sqlite3", [dbPath], {
  input: sql,
  stdio: ["pipe", "inherit", "inherit"],
})

if (result.status !== 0) {
  throw new Error(`sqlite3 exited with status ${result.status}`)
}

console.log(`Database ready at ${dbPath}`)
