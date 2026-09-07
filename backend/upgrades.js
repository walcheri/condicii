import { randomInt, randomUUID } from "node:crypto";
import { findSkin } from "./catalog.js";
import { transaction } from "./database.js";
export function fail(message, status = 400) {
  throw Object.assign(new Error(message), { status });
}
export function quote(db, userId, input) {
  const target = findSkin(input.targetId);
  if (!target) fail("Выберите предмет из каталога.");
  let stake;
  let source = null;
  if (input.mode === "balance") {
    stake = input.amount;
    if (!Number.isSafeInteger(stake) || stake < 1)
      fail("Ставка должна быть целым числом от 1 Минетки.");
    const user = db
      .prepare("SELECT balance FROM users WHERE id = ?")
      .get(userId);
    if (stake > user.balance) fail("Недостаточно Минеток.");
  } else if (input.mode === "skin") {
    if (typeof input.inventoryId !== "string")
      fail("Выберите предмет из инвентаря.");
    const item = db
      .prepare("SELECT * FROM inventory WHERE id = ? AND user_id = ?")
      .get(input.inventoryId ?? "", userId);
    if (!item) fail("Этот предмет отсутствует в вашем инвентаре.");
    source = { ...findSkin(item.skin_id), inventoryId: item.id };
    stake = source.price;
  } else fail("Выберите ставку: скин или Минетки.");
  if (target.price <= stake) fail("Цель должна стоить дороже ставки.");
  const threshold = Math.floor((stake / target.price) * 1_000_000);
  return { target, source, stake, chance: threshold / 10_000, threshold };
}
export function performUpgrade(
  db,
  userId,
  input,
  draw = () => randomInt(1_000_000),
) {
  if (
    typeof input.requestId !== "string" ||
    !/^[a-zA-Z0-9-]{8,80}$/.test(input.requestId)
  )
    fail("Неверный идентификатор операции.");
  const payload = JSON.stringify([
    input.mode,
    input.targetId,
    input.mode === "skin" ? input.inventoryId : input.amount,
  ]);
  return transaction(db, () => {
    const previous = db
      .prepare("SELECT * FROM upgrades WHERE user_id = ? AND request_id = ?")
      .get(userId, input.requestId);
    if (previous) {
      if (previous.payload !== payload)
        fail("Этот идентификатор уже использован для другой ставки.", 409);
      return JSON.parse(previous.result);
    }
    const { target, source, stake, chance, threshold } = quote(
      db,
      userId,
      input,
    );
    const roll = draw();
    const won = roll < threshold;
    if (input.mode === "balance")
      db.prepare("UPDATE users SET balance = balance - ? WHERE id = ?").run(
        stake,
        userId,
      );
    else
      db.prepare("DELETE FROM inventory WHERE id = ? AND user_id = ?").run(
        source.inventoryId,
        userId,
      );
    let reward = null;
    if (won) {
      reward = { ...target, inventoryId: randomUUID() };
      db.prepare(
        "INSERT INTO inventory(id, user_id, skin_id) VALUES (?, ?, ?)",
      ).run(reward.inventoryId, userId, target.id);
    }
    const result = {
      id: randomUUID(),
      mode: input.mode,
      stake,
      source,
      target,
      chance,
      roll: roll / 10_000,
      won,
      reward,
      created: new Date().toISOString(),
    };
    db.prepare(
      "INSERT INTO upgrades(id, user_id, request_id, payload, result, created) VALUES (?, ?, ?, ?, ?, ?)",
    ).run(
      result.id,
      userId,
      input.requestId,
      payload,
      JSON.stringify(result),
      result.created,
    );
    return result;
  });
}
