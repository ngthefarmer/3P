import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

export const db = new Database(path.join(dataDir, "teenpatti.sqlite"));
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    chip_balance INTEGER NOT NULL DEFAULT 1000,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

export interface UserRow {
  id: number;
  username: string;
  password_hash: string;
  chip_balance: number;
  created_at: string;
}

export const STARTING_BALANCE = 1000;
export const MIN_BALANCE_FLOOR = 200;

export function getUserByUsername(username: string): UserRow | undefined {
  return db.prepare("SELECT * FROM users WHERE username = ?").get(username) as UserRow | undefined;
}

export function getUserById(id: number): UserRow | undefined {
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined;
}

export function createUser(username: string, passwordHash: string): UserRow {
  const info = db
    .prepare("INSERT INTO users (username, password_hash, chip_balance) VALUES (?, ?, ?)")
    .run(username, passwordHash, STARTING_BALANCE);
  return getUserById(info.lastInsertRowid as number)!;
}

export function setChipBalance(userId: number, balance: number): void {
  db.prepare("UPDATE users SET chip_balance = ? WHERE id = ?").run(Math.max(0, Math.round(balance)), userId);
}

export function adjustChipBalance(userId: number, delta: number): number {
  const user = getUserById(userId);
  if (!user) throw new Error("User not found");
  const newBalance = Math.max(0, user.chip_balance + delta);
  setChipBalance(userId, newBalance);
  return newBalance;
}
