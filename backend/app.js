import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { openDatabase, transaction } from "./database.js";
import { catalog, findSkin } from "./catalog.js";
import { quote, performUpgrade, fail } from "./upgrades.js";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const hash = (value) => createHash("sha256").update(value).digest("hex");
export function createApp({
  dataDir = process.env.DATA_DIR || path.join(root, "data"),
  production = process.env.NODE_ENV === "production",
} = {}) {
  const db = openDatabase(dataDir);
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use((req, res, next) => {
    res.set({
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "same-origin",
      "X-Frame-Options": "DENY",
    });
    if (req.path.startsWith("/api")) res.set("Cache-Control", "no-store");
    if (req.method === "POST") {
      const origin = req.get("origin");
      let crossOrigin = false;
      try {
        crossOrigin = !!origin && new URL(origin).host !== req.get("host");
      } catch {
        return res.status(400).json({ error: "Некорректный Origin." });
      }
      if (req.get("sec-fetch-site") === "cross-site" || crossOrigin)
        return res
          .status(403)
          .json({ error: "Запрос с другого сайта отклонён." });
      if (!req.is("application/json"))
        return res.status(415).json({ error: "Ожидается JSON." });
    }
    next();
  });
  app.use(express.json({ limit: "16kb" }));
  app.get("/api/health", (req, res) => {
    db.prepare("SELECT 1").get();
    res.json({ ok: true });
  });
  app.get("/api/catalog", (req, res) => res.json({ catalog }));
  app.get("/api/news", (req, res) =>
    res.json({
      news: db.prepare("SELECT * FROM news ORDER BY id DESC LIMIT 100").all(),
    }),
  );
  app.use("/api", (req, res, next) => {
    const cookie = req.headers.cookie
      ?.split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith("pc_session="))
      ?.slice(11);
    const session =
      cookie &&
      db
        .prepare("SELECT user_id FROM sessions WHERE token = ? AND expires > ?")
        .get(hash(cookie), Date.now());
    if (session) req.userId = session.user_id;
    else {
      const token = randomBytes(32).toString("hex");
      req.userId = randomUUID();
      transaction(db, () => {
        db.prepare("INSERT INTO users(id, balance) VALUES (?, 2500)").run(
          req.userId,
        );
        db.prepare(
          "INSERT INTO sessions(token, user_id, expires) VALUES (?, ?, ?)",
        ).run(hash(token), req.userId, Date.now() + 365 * 86400000);
        for (const skinId of ["p250", "glock", "mp9"])
          db.prepare(
            "INSERT INTO inventory(id, user_id, skin_id) VALUES (?, ?, ?)",
          ).run(randomUUID(), req.userId, skinId);
      });
      res.cookie("pc_session", token, {
        httpOnly: true,
        sameSite: "lax",
        secure: production,
        maxAge: 365 * 86400000,
        path: "/",
      });
    }
    next();
  });
  function state(userId) {
    return {
      balance: db.prepare("SELECT balance FROM users WHERE id = ?").get(userId)
        .balance,
      inventory: db
        .prepare(
          "SELECT * FROM inventory WHERE user_id = ? ORDER BY rowid DESC",
        )
        .all(userId)
        .map((i) => ({ ...findSkin(i.skin_id), inventoryId: i.id })),
      history: db
        .prepare(
          "SELECT result FROM upgrades WHERE user_id = ? ORDER BY rowid DESC LIMIT 20",
        )
        .all(userId)
        .map((r) => JSON.parse(r.result)),
    };
  }
  app.get("/api/me", (req, res) => res.json(state(req.userId)));
  app.post("/api/upgrade/quote", (req, res) => {
    const { threshold, ...result } = quote(db, req.userId, req.body ?? {});
    res.json(result);
  });
  app.post("/api/upgrade", (req, res) => {
    const result = performUpgrade(db, req.userId, req.body ?? {});
    res.json({ result, ...state(req.userId) });
  });
  app.post("/api/inventory/sell", (req, res) => {
    if (typeof req.body?.inventoryId !== "string")
      fail("Выберите предмет из инвентаря.");
    transaction(db, () => {
      const item = db
        .prepare("SELECT * FROM inventory WHERE id = ? AND user_id = ?")
        .get(req.body?.inventoryId ?? "", req.userId);
      if (!item) fail("Предмет уже продан или отсутствует.");
      db.prepare("DELETE FROM inventory WHERE id = ?").run(item.id);
      db.prepare("UPDATE users SET balance = balance + ? WHERE id = ?").run(
        findSkin(item.skin_id).price,
        req.userId,
      );
    });
    res.json(state(req.userId));
  });
  app.post("/api/news", (req, res) => {
    const clean = (value, max) =>
      typeof value === "string" ? value.trim().slice(0, max) : "";
    const author = clean(req.body?.author, 40) || "Аноним";
    const title = clean(req.body?.title, 100);
    const text = clean(req.body?.text, 500);
    if (!title || !text) fail("Заполните заголовок и текст.");
    const date = new Intl.DateTimeFormat("ru-RU", {
      timeZone: "Europe/Moscow",
    }).format(new Date());
    db.prepare(
      "INSERT INTO news(date, author, title, text) VALUES (?, ?, ?, ?)",
    ).run(date, author, title, text);
    res
      .status(201)
      .json({
        news: db.prepare("SELECT * FROM news ORDER BY id DESC LIMIT 100").all(),
      });
  });
  app.use("/api", (req, res) =>
    res.status(404).json({ error: "API не найден." }),
  );
  app.use(express.static(path.join(root, "dist")));
  app.get(["/", "/index.html"], (req, res) =>
    res.sendFile(path.join(root, "dist", "index.html")),
  );
  app.use((req, res) => res.status(404).send("Страница не найдена"));
  app.use((error, req, res, next) => {
    const status = error.status || 500;
    if (status >= 500) console.error(error);
    res
      .status(status)
      .json({
        error:
          status >= 500
            ? "Ошибка сервера. Попробуйте ещё раз."
            : error.type === "entity.parse.failed"
              ? "Некорректный JSON."
              : error.message,
      });
  });
  return { app, db };
}
