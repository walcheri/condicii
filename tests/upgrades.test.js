import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { openDatabase } from "../backend/database.js";
import { performUpgrade, quote } from "../backend/upgrades.js";
import { createApp } from "../backend/app.js";

function setup(t) {
  const db = openDatabase(":memory:");
  t.after(() => db.close());
  db.prepare("INSERT INTO users VALUES (?, ?)").run("alice", 2500);
  db.prepare("INSERT INTO users VALUES (?, ?)").run("bob", 2500);
  db.prepare("INSERT INTO inventory VALUES (?, ?, ?)").run(
    "item-alice",
    "alice",
    "watermelon",
  );
  return db;
}
const balanceInput = {
  mode: "balance",
  amount: 250,
  targetId: "gta6",
  requestId: "request-0001",
};
const skinInput = {
  mode: "skin",
  inventoryId: "item-alice",
  targetId: "pumpkin",
  requestId: "request-0002",
};

test("Шанс рассчитан по серверной цене цели и ставки", (t) => {
  const db = setup(t);
  assert.equal(quote(db, "alice", balanceInput).chance, 16.6666);
  assert.equal(quote(db, "alice", skinInput).chance, 40);
  assert.equal(
    quote(db, "alice", { ...balanceInput, price: 1, chance: 100 }).chance,
    16.6666,
  );
});
test("Победа списывает Минетки и выдаёт ровно один предмет", (t) => {
  const db = setup(t);
  const result = performUpgrade(db, "alice", balanceInput, () => 0);
  assert.equal(result.won, true);
  assert.equal(
    db.prepare("SELECT balance FROM users WHERE id = ?").get("alice").balance,
    2250,
  );
  assert.equal(
    db
      .prepare("SELECT COUNT(*) AS n FROM inventory WHERE user_id = ?")
      .get("alice").n,
    2,
  );
  assert.equal(result.reward.id, "gta6");
});
test("Проигрыш сжигает баланс без выдачи награды", (t) => {
  const db = setup(t);
  const result = performUpgrade(db, "alice", balanceInput, () => 999999);
  assert.equal(result.won, false);
  assert.equal(result.reward, null);
  assert.equal(
    db.prepare("SELECT balance FROM users WHERE id = ?").get("alice").balance,
    2250,
  );
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM inventory").get().n, 1);
});
test("Граница выигрышного сектора точная", (t) => {
  const db = setup(t);
  assert.equal(
    performUpgrade(
      db,
      "alice",
      { ...balanceInput, amount: 100, targetId: "pumpkin" },
      () => 399999,
    ).won,
    true,
  );
  assert.equal(
    performUpgrade(
      db,
      "alice",
      {
        ...balanceInput,
        amount: 100,
        targetId: "pumpkin",
        requestId: "boundary-002",
      },
      () => 400000,
    ).won,
    false,
  );
});
test("Скин при победе заменяется на цель, при проигрыше исчезает", (t) => {
  const db = setup(t);
  const win = performUpgrade(db, "alice", skinInput, () => 0);
  assert.equal(
    db.prepare("SELECT id FROM inventory WHERE id = ?").get("item-alice"),
    undefined,
  );
  assert.equal(win.reward.id, "pumpkin");
  performUpgrade(
    db,
    "alice",
    {
      ...skinInput,
      inventoryId: win.reward.inventoryId,
      targetId: "gta6",
      requestId: "skin-loss-003",
    },
    () => 999999,
  );
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM inventory").get().n, 0);
  assert.equal(
    db.prepare("SELECT balance FROM users WHERE id = ?").get("alice").balance,
    2500,
  );
});
test("Повтор запроса возвращает старый результат без нового списания", (t) => {
  const db = setup(t);
  const first = performUpgrade(db, "alice", skinInput, () => 0);
  const second = performUpgrade(db, "alice", skinInput, () => {
    throw new Error("Повторный розыгрыш недопустим");
  });
  assert.deepEqual(second, first);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM upgrades").get().n, 1);
  assert.throws(
    () => performUpgrade(db, "alice", { ...skinInput, targetId: "gta6" }),
    /другой ставки/,
  );
});
test("Нельзя ставить чужой предмет, отрицательную сумму или дешёвую цель", (t) => {
  const db = setup(t);
  assert.throws(() => performUpgrade(db, "bob", skinInput), /отсутствует/);
  for (const amount of [-1, 0, 1.5, "100", 2600, Infinity])
    assert.throws(() =>
      performUpgrade(db, "alice", { ...balanceInput, amount }),
    );
  assert.throws(
    () => quote(db, "alice", { ...balanceInput, targetId: "watermelon" }),
    /дороже/,
  );
  assert.throws(
    () => quote(db, "alice", { ...balanceInput, targetId: "unknown" }),
    /каталога/,
  );
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM upgrades").get().n, 0);
});
test("Ошибка выдачи откатывает списание и историю", (t) => {
  const db = setup(t);
  db.exec(
    "CREATE TRIGGER reject_reward BEFORE INSERT ON inventory BEGIN SELECT RAISE(ABORT, 'reward failed'); END",
  );
  assert.throws(
    () => performUpgrade(db, "alice", balanceInput, () => 0),
    /reward failed/,
  );
  assert.equal(
    db.prepare("SELECT balance FROM users WHERE id = ?").get("alice").balance,
    2500,
  );
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM upgrades").get().n, 0);
});
test("Баланс и операции переживают повторное открытие базы", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "condicii-test-"));
  let db;
  try {
    db = openDatabase(dir);
    db.prepare("INSERT INTO users VALUES (?, ?)").run("alice", 2500);
    const result = performUpgrade(db, "alice", balanceInput, () => 0);
    db.close();
    db = openDatabase(dir);
    assert.equal(db.prepare("SELECT balance FROM users").get().balance, 2250);
    assert.deepEqual(performUpgrade(db, "alice", balanceInput), result);
  } finally {
    db?.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
test("Старые новости переносятся в базу с сохранением порядка и исходного файла", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "condicii-migration-"));
  const file = path.join(dir, "news.json");
  const news = [
    { date: "05.10.2026", author: "Игрок", title: "Новая", text: "Текст" },
    { date: "24.03.2026", author: "Лев", title: "Старая", text: "" },
  ];
  writeFileSync(file, JSON.stringify(news));
  const db = openDatabase(dir);
  try {
    assert.deepEqual(
      db
        .prepare("SELECT title FROM news ORDER BY id DESC")
        .all()
        .map((item) => item.title),
      ["Новая", "Старая"],
    );
    assert.deepEqual(JSON.parse(readFileSync(file, "utf8")), news);
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
test("HTTP: отдельные сессии, продажа, новости, CSRF и повтор апгрейда", async (t) => {
  const { app, db } = createApp({ dataDir: ":memory:", production: false });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    db.close();
  });
  const url = `http://127.0.0.1:${server.address().port}/api`;
  const register = (username) => fetch(`${url}/auth/register`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, password: "test-password-123" }),
  });
  const first = await register("alice");
  const cookie = first.headers.get("set-cookie").split(";")[0];
  const me = await (await fetch(`${url}/me`, { headers: { cookie } })).json();
  assert.equal(me.balance, 2500);
  assert.equal(me.inventory.length, 3);
  assert.match(first.headers.get("set-cookie"), /HttpOnly/);
  const otherCookie = (await register("bob")).headers.get("set-cookie").split(";")[0];
  const other = await (await fetch(`${url}/me`, { headers: { cookie: otherCookie } })).json();
  assert.notEqual(other.inventory[0].inventoryId, me.inventory[0].inventoryId);
  const post = (route, body, extra = {}) =>
    fetch(`${url}${route}`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie, ...extra },
      body: JSON.stringify(body),
    });
  const foreign = await post("/upgrade", {
    ...skinInput,
    inventoryId: other.inventory[0].inventoryId,
  });
  assert.equal(foreign.status, 400);
  const sold = await (
    await post("/inventory/sell", { inventoryId: me.inventory[0].inventoryId })
  ).json();
  assert.equal(sold.inventory.length, 2);
  assert.equal(sold.balance, 2500 + me.inventory[0].price);
  assert.equal(
    (
      await post("/inventory/sell", {
        inventoryId: me.inventory[0].inventoryId,
      })
    ).status,
    400,
  );
  const spin = await (await post("/upgrade", balanceInput)).json();
  const repeat = await (await post("/upgrade", balanceInput)).json();
  assert.deepEqual(spin.result, repeat.result);
  assert.equal(spin.balance, repeat.balance);
  assert.equal(
    (await post("/upgrade", balanceInput, { origin: "https://other.example" }))
      .status,
    403,
  );
  const news = await post("/news", {
    title: "Тест",
    text: "<script>test</script>",
    author: "Игрок",
  });
  assert.equal(news.status, 201);
  assert.equal((await news.json()).news[0].title, "Тест");
  assert.equal((await fetch(`${url}/missing`, { headers: { cookie } })).status, 404);
  const parallel = await Promise.all([
    post("/upgrade", {
      ...balanceInput,
      amount: 2000,
      targetId: "zalma",
      requestId: "parallel-001",
    }),
    post("/upgrade", {
      ...balanceInput,
      amount: 2000,
      targetId: "zalma",
      requestId: "parallel-002",
    }),
  ]);
  assert.deepEqual(parallel.map((r) => r.status).sort(), [200, 400]);
  const latest = await (
    await fetch(`${url}/me`, { headers: { cookie } })
  ).json();
  assert.equal(latest.balance, spin.balance - 2000);
  assert.equal(latest.history.length, 2);
});
