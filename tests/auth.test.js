import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../backend/app.js";
import { openDatabase } from "../backend/database.js";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

test("Регистрация, защита API, пароли, повторный вход и отзыв сессии", async (t) => {
  const { app, db } = createApp({ dataDir: ":memory:", production: false });
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  t.after(async () => { await new Promise(resolve => server.close(resolve)); db.close(); });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const post = (route, body, cookie, extra = {}) => fetch(base + route, { method: "POST", headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}), ...extra }, body: JSON.stringify(body) });
  for (const route of ["/me", "/news", "/catalog"])
    assert.equal((await fetch(base + route)).status, 401);
  assert.equal((await post("/upgrade", {})).status, 401);
  assert.equal((await fetch(base + "/health")).status, 200);
  assert.equal((await post("/auth/register", { username: "test", password: "short" })).status, 400);
  assert.equal((await post("/auth/register", { username: "test", password: "password-123" }, null, { origin: "https://foreign.example" })).status, 403);
  const registration = await post("/auth/register", { username: "Игрок", password: "password-123" });
  assert.equal(registration.status, 200);
  const cookie = registration.headers.get("set-cookie").split(";")[0];
  assert.match(registration.headers.get("set-cookie"), /HttpOnly/);
  assert.match(registration.headers.get("set-cookie"), /SameSite=Lax/);
  const me = await (await fetch(base + "/me", { headers: { cookie } })).json();
  assert.equal(me.username, "Игрок");
  assert.equal(me.balance, 2500);
  assert.deepEqual(me.inventory.map(i => i.id).sort(), ["dumplings", "pumpkin", "watermelon"]);
  const record = db.prepare("SELECT * FROM credentials").get();
  assert.notEqual(record.password_hash, "password-123");
  assert.equal(record.password_hash.length, 128);
  assert.equal((await post("/auth/register", { username: "ИГРОК", password: "password-123" })).status, 409);
  assert.equal((await post("/auth/login", { username: "Игрок", password: "bad-password" })).status, 401);
  await post("/inventory/sell", { inventoryId: me.inventory.find(i => i.id === "watermelon").inventoryId }, cookie);
  const published = await (await post("/news", { title: "Новость", text: "Текст", author: "Подмена" }, cookie)).json();
  assert.equal(published.news[0].author, "Игрок");
  assert.equal((await post("/auth/logout", {}, cookie)).status, 200);
  assert.equal((await fetch(base + "/me", { headers: { cookie } })).status, 401);
  const login = await post("/auth/login", { username: "игрок", password: "password-123" });
  assert.equal(login.status, 200);
  const newCookie = login.headers.get("set-cookie").split(";")[0];
  assert.notEqual(newCookie, cookie);
  const restored = await (await fetch(base + "/me", { headers: { cookie: newCookie } })).json();
  assert.equal(restored.balance, 2600);
  assert.equal(restored.inventory.length, 2);
  db.prepare("UPDATE sessions SET expires = 0").run();
  assert.equal((await fetch(base + "/me", { headers: { cookie: newCookie } })).status, 401);
});

test("Старые гостевые сессии больше не дают доступ", async (t) => {
  const { app, db } = createApp({ dataDir: ":memory:", production: false });
  db.prepare("INSERT INTO users VALUES ('guest', 2500)").run();
  const { createHash } = await import("node:crypto");
  db.prepare("INSERT INTO sessions VALUES (?, 'guest', ?)").run(createHash("sha256").update("old-token").digest("hex"), Date.now() + 60000);
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  t.after(async () => { await new Promise(resolve => server.close(resolve)); db.close(); });
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/me`, { headers: { cookie: "pc_session=old-token" } });
  assert.equal(response.status, 401);
});

test("Миграция предметов и истории сохраняет стоимость и баланс", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "condicii-items-"));
  let db;
  try {
    db = openDatabase(dir);
    db.prepare("INSERT INTO users VALUES ('old', 1234)").run();
    db.prepare("INSERT INTO inventory VALUES ('old-item', 'old', 'p250')").run();
    db.prepare("INSERT INTO upgrades VALUES (?, ?, ?, ?, ?, ?)").run("old-upgrade", "old", "old-request", JSON.stringify(["skin", "ak", "old-item"]), JSON.stringify({ source: { id: "p250", inventoryId: "old-item" }, target: { id: "ak" }, reward: null, stake: 100 }), "2026-01-01");
    db.close(); db = openDatabase(dir);
    assert.equal(db.prepare("SELECT skin_id FROM inventory").get().skin_id, "watermelon");
    assert.equal(db.prepare("SELECT balance FROM users").get().balance, 1234);
    const row = db.prepare("SELECT * FROM upgrades").get();
    assert.equal(JSON.parse(row.result).target.name, "Диск GTA VI");
    assert.equal(JSON.parse(row.result).source.inventoryId, "old-item");
    assert.equal(JSON.parse(row.payload)[1], "gta6");
  } finally { db?.close(); rmSync(dir, { recursive: true, force: true }); }
});
