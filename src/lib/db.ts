import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const DB_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DB_DIR, "app.db");

function createDb(): Database.Database {
  fs.mkdirSync(DB_DIR, { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS courses (
      id INTEGER PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      folder_name TEXT NOT NULL,
      title TEXT NOT NULL,
      scanned_at TEXT
    );
    CREATE TABLE IF NOT EXISTS modules (
      id INTEGER PRIMARY KEY,
      course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      folder_name TEXT NOT NULL,
      title TEXT NOT NULL,
      order_index INTEGER NOT NULL,
      is_documents INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS lessons (
      id INTEGER PRIMARY KEY,
      module_id INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
      lesson_key TEXT NOT NULL UNIQUE,
      filename TEXT NOT NULL,
      title TEXT NOT NULL,
      tag TEXT,
      order_index INTEGER NOT NULL,
      file_size INTEGER
    );
    CREATE TABLE IF NOT EXISTS attachments (
      id INTEGER PRIMARY KEY,
      module_id INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
      attachment_key TEXT NOT NULL UNIQUE,
      filename TEXT NOT NULL,
      title TEXT NOT NULL,
      file_size INTEGER
    );
    CREATE TABLE IF NOT EXISTS progress (
      lesson_key TEXT PRIMARY KEY,
      watched INTEGER NOT NULL DEFAULT 0,
      position_seconds REAL NOT NULL DEFAULT 0,
      duration_seconds REAL,
      updated_at TEXT
    );
  `);
  return db;
}

const globalForDb = globalThis as unknown as { __localUdemyDb?: Database.Database };

export function getDb(): Database.Database {
  if (!globalForDb.__localUdemyDb) {
    globalForDb.__localUdemyDb = createDb();
  }
  return globalForDb.__localUdemyDb;
}
