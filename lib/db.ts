import { mkdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { createRequire } from "node:module"

type SqliteDatabase = {
  exec(sql: string): void
  prepare(sql: string): {
    all(...params: unknown[]): unknown[]
    get(...params: unknown[]): unknown
    run(...params: unknown[]): { changes: number; lastInsertRowid: number | bigint }
  }
}

const require = createRequire(import.meta.url)
const { DatabaseSync } = require("node:sqlite") as { DatabaseSync: new (path: string) => SqliteDatabase }

const dataDir = join(process.cwd(), "data")
const dbPath = process.env.DATABASE_URL?.startsWith("file:")
  ? process.env.DATABASE_URL.replace(/^file:/, "")
  : join(dataDir, "scanzapp.sqlite")

let database: SqliteDatabase | null = null

export function getDb() {
  if (database) return database

  mkdirSync(dirname(dbPath), { recursive: true })
  database = new DatabaseSync(dbPath)
  database.exec("PRAGMA foreign_keys = ON")
  database.exec("PRAGMA journal_mode = WAL")
  migrate(database)
  return database
}

function migrate(db: SqliteDatabase) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('user', 'admin')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS profiles (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      selected_goal TEXT,
      form_json TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_settings (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      settings_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS meals (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      calories REAL NOT NULL,
      protein REAL NOT NULL,
      carbs REAL NOT NULL,
      fat REAL NOT NULL,
      time TEXT NOT NULL,
      date TEXT NOT NULL,
      source TEXT NOT NULL CHECK (source IN ('scan', 'manual')),
      confidence REAL,
      note TEXT,
      image_url TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS meals_user_date_idx ON meals(user_id, date);

    CREATE TABLE IF NOT EXISTS water_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      amount REAL NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS water_logs_user_date_idx ON water_logs(user_id, date);
  `)
}

export function nowIso() {
  return new Date().toISOString()
}
