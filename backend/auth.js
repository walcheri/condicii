import { randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { transaction } from "./database.js";
import { fail } from "./upgrades.js";

const scrypt = promisify(scryptCallback);
const lifetime = 30 * 86400000;
export function installAuth(app, db, { production, hash }) {
  const attempts = new Map();
  const cookieOptions = { httpOnly: true, sameSite: "lax", secure: production, path: "/" };
  function limit(req, res, next) {
    const now = Date.now();
    for (const [key, value] of attempts) if (value.until <= now) attempts.delete(key);
    const key = req.ip;
    const entry = attempts.get(key) || { count: 0, until: now + 15 * 60000 };
    if (++entry.count > 30 || attempts.size > 10000) {
      res.set("Retry-After", String(Math.ceil((entry.until - now) / 1000)));
      return res.status(429).json({ error: "Слишком много попыток. Попробуйте через 15 минут." });
    }
    attempts.set(key, entry);
    next();
  }
  function session(req, res, userId) {
    const previous = req.headers.cookie?.split(";").map(c => c.trim()).find(c => c.startsWith("pc_session="))?.slice(11);
    const token = randomBytes(32).toString("hex");
    transaction(db, () => {
      if (previous) db.prepare("DELETE FROM sessions WHERE token = ?").run(hash(previous));
      db.prepare("DELETE FROM sessions WHERE expires <= ?").run(Date.now());
      db.prepare("INSERT INTO sessions(token, user_id, expires) VALUES (?, ?, ?)").run(hash(token), userId, Date.now() + lifetime);
    });
    res.cookie("pc_session", token, { ...cookieOptions, maxAge: lifetime });
    res.json({ ok: true });
  }
  app.post("/api/auth/register", limit, async (req, res) => {
    const { username, password } = req.body || {};
    if (typeof username !== "string" || !/^[\p{L}\p{N}_-]{3,24}$/u.test(username.trim()))
      fail("Логин: от 3 до 24 букв, цифр, дефисов или подчёркиваний.");
    if (typeof password !== "string" || password.length < 8 || password.length > 128)
      fail("Пароль должен содержать от 8 до 128 символов.");
    const displayName = username.trim();
    const normalized = displayName.normalize("NFKC").toLowerCase();
    const salt = randomBytes(16).toString("hex");
    const passwordHash = (await scrypt(password, salt, 64)).toString("hex");
    const userId = randomUUID();
    transaction(db, () => {
      if (db.prepare("SELECT user_id FROM credentials WHERE username = ?").get(normalized)) fail("Этот логин уже занят.", 409);
      db.prepare("INSERT INTO users(id, balance) VALUES (?, 2500)").run(userId);
      db.prepare("INSERT INTO credentials(user_id, username, display_name, salt, password_hash) VALUES (?, ?, ?, ?, ?)").run(userId, normalized, displayName, salt, passwordHash);
      for (const itemId of ["watermelon", "pumpkin", "dumplings"])
        db.prepare("INSERT INTO inventory(id, user_id, skin_id) VALUES (?, ?, ?)").run(randomUUID(), userId, itemId);
    });
    session(req, res, userId);
  });
  app.post("/api/auth/login", limit, async (req, res) => {
    const { username, password } = req.body || {};
    if (typeof username !== "string" || username.length > 100 || typeof password !== "string" || password.length > 128)
      fail("Неверный логин или пароль.", 401);
    const account = db.prepare("SELECT * FROM credentials WHERE username = ?").get(username.trim().normalize("NFKC").toLowerCase());
    const derived = await scrypt(password, account?.salt || "invalid-account-salt", 64);
    if (!account || !timingSafeEqual(derived, Buffer.from(account.password_hash, "hex"))) fail("Неверный логин или пароль.", 401);
    session(req, res, account.user_id);
  });
  app.use("/api", (req, res, next) => {
    const token = req.headers.cookie?.split(";").map(c => c.trim()).find(c => c.startsWith("pc_session="))?.slice(11);
    const account = token && db.prepare("SELECT c.user_id, c.display_name FROM sessions s JOIN credentials c ON c.user_id = s.user_id WHERE s.token = ? AND s.expires > ?").get(hash(token), Date.now());
    if (!account) return res.status(401).json({ error: "Войдите в аккаунт, чтобы продолжить." });
    req.userId = account.user_id;
    req.username = account.display_name;
    next();
  });
  app.post("/api/auth/logout", (req, res) => {
    const token = req.headers.cookie?.split(";").map(c => c.trim()).find(c => c.startsWith("pc_session="))?.slice(11);
    if (token) db.prepare("DELETE FROM sessions WHERE token = ?").run(hash(token));
    res.clearCookie("pc_session", cookieOptions);
    res.json({ ok: true });
  });
}
