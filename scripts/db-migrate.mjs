import { spawnSync } from "node:child_process"
import { mkdirSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const dbPath = process.env.SQLITE_DATABASE_PATH
  ? resolve(process.env.SQLITE_DATABASE_PATH)
  : join(root, "data", "scanzapp-prisma.db")

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

CREATE TABLE IF NOT EXISTS "rate_limit_buckets" (
  "key" TEXT NOT NULL PRIMARY KEY,
  "count" INTEGER NOT NULL,
  "reset_at" DATETIME NOT NULL,
  "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
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
  "meal_category" TEXT,
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

CREATE TABLE IF NOT EXISTS "meal_suggestion_cache" (
  "user_id" TEXT NOT NULL PRIMARY KEY,
  "suggestions_json" TEXT NOT NULL,
  "generated_at" DATETIME NOT NULL,
  "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "meal_suggestion_cache_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "saved_meal_suggestions" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "user_id" TEXT NOT NULL,
  "normalized_name" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "calories" REAL NOT NULL,
  "protein" REAL NOT NULL,
  "carbs" REAL NOT NULL,
  "fat" REAL NOT NULL,
  "reason" TEXT,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "saved_meal_suggestions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "conversations" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "user_id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT,
  "pinned" BOOLEAN NOT NULL DEFAULT false,
  "archived_at" DATETIME,
  "deleted_at" DATETIME,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "messages" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "conversation_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "parent_message_id" TEXT,
  "client_request_id" TEXT,
  "model" TEXT,
  "finish_reason" TEXT,
  "input_tokens" INTEGER,
  "output_tokens" INTEGER,
  "estimated_cost_usd" REAL,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "messages_parent_message_id_fkey" FOREIGN KEY ("parent_message_id") REFERENCES "messages" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "chat_consents" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "user_id" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "policy_version" TEXT NOT NULL,
  "granted_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revoked_at" DATETIME,
  "ui_version" TEXT,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "chat_consents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "chat_usages" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "user_id" TEXT NOT NULL,
  "conversation_id" TEXT NOT NULL,
  "message_id" TEXT,
  "request_id" TEXT,
  "model" TEXT NOT NULL,
  "outcome" TEXT NOT NULL,
  "latency_ms" INTEGER,
  "input_tokens" INTEGER,
  "output_tokens" INTEGER,
  "estimated_cost_usd" REAL,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "chat_usages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "chat_usages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "chat_usages_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "meals_user_id_date_idx" ON "meals"("user_id", "date");
CREATE INDEX IF NOT EXISTS "water_logs_user_id_date_idx" ON "water_logs"("user_id", "date");
CREATE INDEX IF NOT EXISTS "rate_limit_buckets_reset_at_idx" ON "rate_limit_buckets"("reset_at");
CREATE INDEX IF NOT EXISTS "scan_results_created_at_idx" ON "scan_results"("created_at");
CREATE INDEX IF NOT EXISTS "scan_results_user_id_created_at_idx" ON "scan_results"("user_id", "created_at");
CREATE UNIQUE INDEX IF NOT EXISTS "saved_meal_suggestions_user_id_normalized_name_key" ON "saved_meal_suggestions"("user_id", "normalized_name");
CREATE INDEX IF NOT EXISTS "saved_meal_suggestions_user_id_created_at_idx" ON "saved_meal_suggestions"("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "conversations_user_id_updated_at_idx" ON "conversations"("user_id", "updated_at");
CREATE INDEX IF NOT EXISTS "conversations_user_id_archived_at_updated_at_idx" ON "conversations"("user_id", "archived_at", "updated_at");
CREATE INDEX IF NOT EXISTS "conversations_user_id_pinned_updated_at_idx" ON "conversations"("user_id", "pinned", "updated_at");
CREATE INDEX IF NOT EXISTS "messages_conversation_id_created_at_idx" ON "messages"("conversation_id", "created_at");
CREATE INDEX IF NOT EXISTS "messages_user_id_created_at_idx" ON "messages"("user_id", "created_at");
CREATE UNIQUE INDEX IF NOT EXISTS "messages_user_id_client_request_id_key" ON "messages"("user_id", "client_request_id");
CREATE INDEX IF NOT EXISTS "chat_consents_user_id_scope_policy_version_revoked_at_idx" ON "chat_consents"("user_id", "scope", "policy_version", "revoked_at");
CREATE INDEX IF NOT EXISTS "chat_consents_user_id_scope_granted_at_idx" ON "chat_consents"("user_id", "scope", "granted_at");
CREATE INDEX IF NOT EXISTS "chat_usages_user_id_created_at_idx" ON "chat_usages"("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "chat_usages_conversation_id_created_at_idx" ON "chat_usages"("conversation_id", "created_at");
CREATE INDEX IF NOT EXISTS "chat_usages_request_id_idx" ON "chat_usages"("request_id");
`

const result = spawnSync("sqlite3", [dbPath], {
  input: sql,
  stdio: ["pipe", "inherit", "inherit"],
})

if (result.status !== 0) {
  throw new Error(`sqlite3 exited with status ${result.status}`)
}

const mealColumns = spawnSync("sqlite3", [dbPath, "PRAGMA table_info('meals');"], {
  encoding: "utf8",
})

if (mealColumns.status !== 0) {
  throw new Error(`sqlite3 table inspection exited with status ${mealColumns.status}`)
}

if (!mealColumns.stdout.split("\n").some((line) => line.split("|")[1] === "meal_category")) {
  const alterResult = spawnSync("sqlite3", [dbPath, 'ALTER TABLE "meals" ADD COLUMN "meal_category" TEXT;'], {
    stdio: "inherit",
  })
  if (alterResult.status !== 0) {
    throw new Error(`sqlite3 alter table exited with status ${alterResult.status}`)
  }
}

console.log(`Database ready at ${dbPath}`)
