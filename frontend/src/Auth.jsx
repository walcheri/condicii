import React, { useState } from "react";
import { api } from "./api.js";
import Coast from "./Coast.jsx";

export default function Auth({ onSuccess }) {
  const [register, setRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const body = Object.fromEntries(new FormData(event.currentTarget));
    if (register && body.password !== body.confirm) { setError("Пароли не совпадают."); return; }
    setBusy(true); setError("");
    try {
      await api(`/auth/${register ? "register" : "login"}`, { username: body.username, password: body.password });
      await onSuccess();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  return <div className="auth-layout">
    <section className="auth-poster">
      <Coast />
      <div className="poster-copy"><span className="eyebrow">СВОИ ЛЮДИ. СВОЙ ГОРОД.</span><h1>Потенциальные<br/><span>кондиции.</span></h1><p>Закат, братва и немного безумия.<br/>Твоя история начинается здесь.</p><span className="poster-stamp">PC / AFTER HOURS</span></div>
    </section>
    <section className="auth-panel">
      <span className="eyebrow">ДОБРО ПОЖАЛОВАТЬ В КЛУБ</span>
      <h2>{register ? "Стань своим." : "С возвращением."}</h2>
      <p>{register ? "Создай аккаунт. Забери 2 500 Минеток и первые три предмета." : "Войди, чтобы читать новости, общаться и собирать предметы."}</p>
      <div className="segmented auth-tabs"><button type="button" className={!register ? "active" : ""} disabled={busy} onClick={()=>{setRegister(false);setError("");}}>Вход</button><button type="button" className={register ? "active" : ""} disabled={busy} onClick={()=>{setRegister(true);setError("");}}>Регистрация</button></div>
      <form onSubmit={submit} className="auth-form" key={register ? "register" : "login"}>
        <label>Логин<input name="username" autoComplete="username" minLength="3" maxLength="24" required disabled={busy} placeholder="Твой никнейм" /></label>
        <label>Пароль<input name="password" type="password" autoComplete={register ? "new-password" : "current-password"} minLength={register ? 8 : undefined} maxLength="128" required disabled={busy} placeholder={register ? "Не меньше 8 символов" : "Твой пароль"} /></label>
        {register && <label>Повтори пароль<input name="confirm" type="password" autoComplete="new-password" required disabled={busy} placeholder="Ещё раз, для верности"/></label>}
        {error && <p className="error" role="alert">{error}</p>}
        <button className="primary" disabled={busy}>{busy ? "Подожди…" : register ? "Создать аккаунт ↗" : "Войти в сообщество ↗"}</button>
      </form>
      <small className="auth-note">Твой баланс и коллекция сохраняются в аккаунте.</small>
    </section>
  </div>;
}
