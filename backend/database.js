import { DatabaseSync } from "node:sqlite";
import { mkdirSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { legacyItems, findSkin } from "./catalog.js";
export function openDatabase(dataDir) {
  if (dataDir !== ":memory:") mkdirSync(dataDir, { recursive: true });
  const db = new DatabaseSync(
    dataDir === ":memory:" ? dataDir : path.join(dataDir, "site.sqlite"),
  );
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, balance INTEGER NOT NULL CHECK(balance >= 0));
    CREATE TABLE IF NOT EXISTS credentials (user_id TEXT PRIMARY KEY REFERENCES users(id), username TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL, salt TEXT NOT NULL, password_hash TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS inventory (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), skin_id TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS upgrades (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), request_id TEXT NOT NULL,
      payload TEXT NOT NULL, result TEXT NOT NULL, created TEXT NOT NULL, UNIQUE(user_id, request_id));
    CREATE TABLE IF NOT EXISTS news (id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL, author TEXT NOT NULL, title TEXT NOT NULL, text TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS inventory_user ON inventory(user_id);
    CREATE INDEX IF NOT EXISTS upgrades_user ON upgrades(user_id, created);
  `);
  transaction(db, () => {
    for (const [oldId, newId] of Object.entries(legacyItems))
      db.prepare("UPDATE inventory SET skin_id = ? WHERE skin_id = ?").run(newId, oldId);
    for (const row of db.prepare("SELECT id, payload, result FROM upgrades").all()) {
      const result = JSON.parse(row.result);
      let changed = false;
      for (const key of ["source", "target", "reward"]) {
        if (legacyItems[result[key]?.id]) {
          const previous = result[key];
          result[key] = { ...findSkin(legacyItems[previous.id]), ...(previous.inventoryId ? { inventoryId: previous.inventoryId } : {}) };
          changed = true;
        }
      }
      if (changed) {
        const payload = JSON.parse(row.payload);
        payload[1] = legacyItems[payload[1]] || payload[1];
        db.prepare("UPDATE upgrades SET payload = ?, result = ? WHERE id = ?").run(JSON.stringify(payload), JSON.stringify(result), row.id);
      }
    }
  });
  if (!db.prepare("SELECT id FROM news LIMIT 1").get()) {
    const oldFile = path.join(dataDir, "news.json");
    let news = [
      {
        date: "24.03.2026",
        author: "Лев Тигр",
        title: "Перезапуск сайта",
        text: "",
      },
    ];
    if (existsSync(oldFile)) {
      const oldNews = JSON.parse(readFileSync(oldFile, "utf8"));
      if (!Array.isArray(oldNews))
        throw new Error("news.json должен содержать массив");
      news = oldNews;
    }
    const insert = db.prepare(
      "INSERT INTO news(date, author, title, text) VALUES (?, ?, ?, ?)",
    );
    transaction(db, () => {
      for (const item of [...news].reverse())
        insert.run(
          item.date ?? "",
          item.author ?? "",
          item.title ?? "",
          item.text ?? "",
        );
    });
  }
  return db;
}
export function transaction(db, action) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = action();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
