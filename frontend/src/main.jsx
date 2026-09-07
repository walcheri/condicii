import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { api } from "./api.js";
import members from "./members.json";
import "./style.css";

const number = (value) =>
  new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 4 }).format(value);
const money = (value) => `${number(value)} М`;

function SkinArt({ skin }) {
  if (!skin) return <div className="skin-art empty-art">＋</div>;
  return (
    <div className="skin-art" style={{ "--skin-color": skin.color }}>
      <svg viewBox="0 0 260 110" aria-hidden="true">
        <defs>
          <linearGradient id={`skin-${skin.id}`} x2="1" y2="1">
            <stop stopColor={skin.color} />
            <stop offset="1" stopColor="#ddd" />
          </linearGradient>
        </defs>
        <g
          fill={`url(#skin-${skin.id})`}
          stroke="#11131a"
          strokeWidth="2"
          transform="rotate(-12 130 55)"
        >
          {skin.kind === "knife" ? (
            <>
              <path d="M30 62 Q80 10 210 30 Q180 67 110 65 L86 84 L72 65Z" />
              <path d="M30 62 L13 68 L26 84 L72 65 L61 55Z" />
            </>
          ) : skin.kind === "pistol" ? (
            <>
              <path d="M57 28 H193 V45 H137 L129 66 H99 L86 96 H59 L71 48 H57Z" />
              <path d="M137 45 H178 V53 H136Z" />
            </>
          ) : (
            <>
              <path d="M17 42 L65 37 H147 L164 44 H228 V53 H159 L140 64 H104 L91 89 H72 L83 59 H65 L32 76 L17 70Z" />
              <path d="M120 62 L132 92 H151 L146 60Z" />
              {skin.kind === "sniper" && (
                <>
                  <path d="M89 22 H146 V32 H89Z" />
                  <path d="M108 30 V40 H128 V30Z" />
                  <path d="M224 46 H253 V51 H224Z" />
                </>
              )}
            </>
          )}
        </g>
      </svg>
    </div>
  );
}

function ItemCard({ skin, selected, onSelect, disabled }) {
  return (
    <button
      className={`item-card ${selected ? "selected" : ""}`}
      onClick={onSelect}
      disabled={disabled}
      style={{ "--skin-color": skin.color }}
      aria-pressed={selected}
    >
      <span className="item-check">{selected ? "✓" : "+"}</span>
      <SkinArt skin={skin} />
      <span className="weapon">{skin.weapon}</span>
      <span className="skin-name">{skin.name}</span>
      <strong>{money(skin.price)}</strong>
    </button>
  );
}

function Upgrade({ account, setAccount, catalog, onLock }) {
  const [pending, setPending] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem("pc_pending_upgrade") || "null");
    } catch {
      return null;
    }
  });
  const [mode, setMode] = useState(pending?.mode || "skin");
  const [inventoryId, setInventoryId] = useState(
    pending?.inventoryId || account.inventory[0]?.inventoryId || "",
  );
  const [amount, setAmount] = useState(String(pending?.amount || 250));
  const [targetId, setTargetId] = useState(pending?.targetId || "ak");
  const [estimate, setEstimate] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [angle, setAngle] = useState(0);
  const [search, setSearch] = useState("");
  const lock = useRef(false);
  const source = account.inventory.find(
    (item) => item.inventoryId === inventoryId,
  );
  const target = catalog.find((item) => item.id === targetId);
  const stake = mode === "skin" ? source?.price || 0 : Number(amount);
  const selection = { mode, inventoryId, amount: Number(amount), targetId };
  const chance = result ? result.chance : estimate?.chance || 0;
  useEffect(() => {
    onLock(busy || !!pending);
  }, [busy, pending, onLock]);

  useEffect(() => {
    const controller = new AbortController();
    setEstimate(null);
    if (busy || pending || result) return () => controller.abort();
    if ((mode === "skin" && !inventoryId) || !targetId) {
      setError("Выберите ставку и цель.");
      return () => controller.abort();
    }
    const timer = setTimeout(
      () =>
        api(
          "/upgrade/quote",
          { mode, inventoryId, amount: Number(amount), targetId },
          controller.signal,
        )
          .then((data) => {
            setEstimate(data);
            setError("");
          })
          .catch((e) => {
            if (e.name !== "AbortError") setError(e.message);
          }),
      150,
    );
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [mode, inventoryId, amount, targetId, account, busy, pending, result]);

  function chooseMode(next) {
    setResult(null);
    setMode(next);
  }
  function chooseItem(id) {
    setResult(null);
    setMode("skin");
    setInventoryId(id);
  }
  function chooseTarget(id) {
    setResult(null);
    setTargetId(id);
  }

  async function spin(retry = false) {
    if (lock.current || (!retry && !estimate)) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setResult(null);
    const operation = retry
      ? pending
      : { ...selection, requestId: crypto.randomUUID() };
    if (!operation) {
      lock.current = false;
      setBusy(false);
      return;
    }
    sessionStorage.setItem("pc_pending_upgrade", JSON.stringify(operation));
    setPending(operation);
    try {
      const data = await api("/upgrade", operation);
      setEstimate({ chance: data.result.chance });
      setAngle(
        (previous) =>
          (Math.floor(previous / 360) + 5) * 360 + data.result.roll * 3.6,
      );
      await new Promise((resolve) =>
        setTimeout(
          resolve,
          matchMedia("(prefers-reduced-motion: reduce)").matches ? 50 : 3600,
        ),
      );
      setAccount({
        balance: data.balance,
        inventory: data.inventory,
        history: data.history,
      });
      setInventoryId("");
      setPending(null);
      sessionStorage.removeItem("pc_pending_upgrade");
      setResult(data.result);
    } catch (e) {
      if (e.status >= 400 && e.status < 500) {
        setPending(null);
        sessionStorage.removeItem("pc_pending_upgrade");
        setError(e.message);
        try {
          setAccount(await api("/me"));
        } catch {
          /* Следующий запрос обновит состояние. */
        }
      } else
        setError(
          `${e.message} Нажмите «Проверить операцию»: повторный запрос не спишет ставку второй раз.`,
        );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  // Результат остаётся на экране до изменения ставки или цели.
  const shownSource = busy ? source : result?.source || source;
  const shownTarget = result?.target || target;
  const targets = catalog.filter(
    (item) =>
      item.price > stake &&
      `${item.weapon} ${item.name}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">ИЗ МАЛОГО В БОЛЬШОЕ</span>
          <h1>
            Прокачай свои <span>кондиции.</span>
          </h1>
          <p>Выбери ставку, найди скин мечты и испытай удачу.</p>
        </div>
        <span className="mode-badge">
          <i /> АПГРЕЙД СКИНОВ
        </span>
      </div>
      <section className="upgrade-stage" aria-label="Рулетка апгрейда">
        <div className="selection-panel">
          <span className="eyebrow">01 / ТВОЯ СТАВКА</span>
          <SkinArt skin={mode === "skin" ? shownSource : null} />
          <h3>
            {mode === "skin"
              ? shownSource?.weapon || "Выбери предмет"
              : money(result?.stake ?? stake)}
          </h3>
          <p>
            {mode === "skin"
              ? shownSource?.name || "Из своего инвентаря ниже"
              : "Минетки с твоего баланса"}
          </p>
          <div className="segmented">
            <button
              disabled={busy || !!pending}
              className={mode === "skin" ? "active" : ""}
              onClick={() => chooseMode("skin")}
            >
              Скин
            </button>
            <button
              disabled={busy || !!pending}
              className={mode === "balance" ? "active" : ""}
              onClick={() => chooseMode("balance")}
            >
              Минетки
            </button>
          </div>
          {mode === "balance" && (
            <label className="amount-field">
              <span>Сумма ставки</span>
              <input
                aria-label="Сумма ставки в Минетках"
                type="number"
                min="1"
                max={account.balance}
                step="1"
                value={amount}
                disabled={busy || !!pending}
                onChange={(e) => {
                  setResult(null);
                  setAmount(e.target.value);
                }}
              />
              <small>Доступно: {money(account.balance)}</small>
            </label>
          )}
          {mode === "skin" && shownSource && (
            <strong className="stake-price">{money(shownSource.price)}</strong>
          )}
        </div>
        <div className="roulette-panel">
          <div
            className={`roulette ${busy ? "spinning" : ""}`}
            style={{ "--chance": `${chance * 3.6}deg` }}
          >
            <div className="roulette-track" />
            <div className="roulette-ticks" />
            <div
              className="pointer-orbit"
              style={{ transform: `rotate(${angle}deg)` }}
            >
              <span className="pointer" />
            </div>
            <div className="roulette-core">
              <span className="eyebrow">
                {busy ? "КРУТИМ…" : "ШАНС НА УСПЕХ"}
              </span>
              <strong>
                {number(chance)}
                <small>%</small>
              </strong>
              <span>
                {(result || estimate) && (result?.stake || stake) > 0
                  ? `×${number((shownTarget?.price || 0) / (result?.stake || stake))}`
                  : "Выбери свою цель"}
              </span>
            </div>
          </div>
          <button
            className="primary spin-button"
            disabled={busy || (!pending && !estimate && !result)}
            onClick={() => {
              if (result) {
                setResult(null);
                setInventoryId(account.inventory[0]?.inventoryId || "");
              } else spin(!!pending);
            }}
          >
            {busy
              ? "Рулетка вращается…"
              : pending
                ? "Проверить операцию"
                : result
                  ? "Новый апгрейд"
                  : "↑ Апгрейднуть"}
          </button>
          <span className="wheel-legend">
            <i /> Зелёный сектор — победа
          </span>
        </div>
        <div className="selection-panel target-panel">
          <span className="eyebrow">02 / ТВОЯ ЦЕЛЬ</span>
          <SkinArt skin={shownTarget} />
          <h3>{shownTarget?.weapon || "Выбери цель"}</h3>
          <p>{shownTarget?.name || "Из каталога ниже"}</p>
          <strong className="target-price">
            {shownTarget ? money(shownTarget.price) : "—"}
          </strong>
          <span className="target-note">
            Выигранный скин попадёт в инвентарь
          </span>
        </div>
      </section>
      <div className="feedback" aria-live="polite">
        {error && <p className="error">{error}</p>}
        {result && (
          <p className={result.won ? "success" : "loss"}>
            {result.won
              ? `Апгрейд удался! ${result.target.weapon} · ${result.target.name} уже в инвентаре.`
              : `Не повезло. ${result.mode === "skin" ? "Исходный скин" : `Ставка ${money(result.stake)}`} сгорел${result.mode === "skin" ? "" : "а"}.`}
          </p>
        )}
      </div>
      <div className="catalog-columns">
        <section className="catalog-panel">
          <div className="panel-title">
            <h2>
              Твой инвентарь <span>{account.inventory.length}</span>
            </h2>
            <span className="eyebrow">ВЫБЕРИ СТАВКУ</span>
          </div>
          <div className="items-grid">
            {account.inventory.map((item) => (
              <ItemCard
                key={item.inventoryId}
                skin={item}
                selected={mode === "skin" && inventoryId === item.inventoryId}
                disabled={busy || !!pending}
                onSelect={() => chooseItem(item.inventoryId)}
              />
            ))}
          </div>
          {!account.inventory.length && (
            <p className="empty-state">
              Пока пусто. Используй Минетки, чтобы выиграть новый скин.
            </p>
          )}
        </section>
        <section className="catalog-panel">
          <div className="panel-title">
            <h2>Предметы для апгрейда</h2>
          </div>
          <label className="search">
            <span>⌕</span>
            <input
              aria-label="Поиск предмета"
              placeholder="Найти свой скин…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              disabled={busy}
            />
          </label>
          <div className="items-grid">
            {targets.map((item) => (
              <ItemCard
                key={item.id}
                skin={item}
                selected={targetId === item.id}
                disabled={busy || !!pending}
                onSelect={() => chooseTarget(item.id)}
              />
            ))}
          </div>
          {!targets.length && (
            <p className="empty-state">
              Нет подходящих целей. Уменьши ставку или измени поиск.
            </p>
          )}
        </section>
      </div>
      <details className="rules">
        <summary>Как работает апгрейд?</summary>
        <p>
          Ставкой служит скин из инвентаря или целое число Минеток. Цель всегда
          дороже ставки. Шанс = стоимость ставки ÷ стоимость цели × 100%
          (округление вниз до 0,0001%). Например, 250 Минеток на предмет за 1
          500 дают 16,6666%.
        </p>
        <p>
          При победе цель добавляется в инвентарь. При проигрыше ставка сгорает.
          Зелёный сектор показывает выигрышные позиции; стрелка останавливается
          на результате операции.
        </p>
        <p>
          Скины и цены внутриигровые. Старт: 2 500 Минеток и три предмета.
          Инвентарь привязан к этому браузеру.
        </p>
      </details>
    </>
  );
}

function Inventory({ account, setAccount }) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  async function sell(item) {
    if (busy) return;
    setBusy(item.inventoryId);
    setError("");
    try {
      setAccount(
        await api("/inventory/sell", { inventoryId: item.inventoryId }),
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">ТВОЯ КОЛЛЕКЦИЯ</span>
          <h1>Инвентарь</h1>
          <p>Оставь скины для апгрейда или обменяй их на Минетки.</p>
        </div>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="inventory-grid">
        {account.inventory.map((item) => (
          <div className="inventory-item" key={item.inventoryId}>
            <ItemCard skin={item} disabled />
            <button
              className="secondary"
              disabled={!!busy}
              onClick={() => sell(item)}
            >
              {busy === item.inventoryId
                ? "Обмениваем…"
                : `Обменять за ${money(item.price)}`}
            </button>
          </div>
        ))}
      </div>
      {!account.inventory.length && (
        <p className="empty-state">
          Инвентарь пуст. Выигранные предметы появятся здесь.
        </p>
      )}
    </>
  );
}

function History({ history }) {
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">КАЖДАЯ ПОПЫТКА НА СЧЕТУ</span>
          <h1>История апгрейдов</h1>
          <p>Последние 20 операций.</p>
        </div>
      </div>
      <div className="history-list">
        {history.map((item) => (
          <article key={item.id} className="history-row">
            <span className={`result-icon ${item.won ? "success" : "loss"}`}>
              {item.won ? "✓" : "×"}
            </span>
            <div>
              <strong>
                {item.target.weapon} · {item.target.name}
              </strong>
              <small>{new Date(item.created).toLocaleString("ru-RU")}</small>
            </div>
            <span>
              {money(item.stake)} → {money(item.target.price)}
            </span>
            <span>{number(item.chance)}%</span>
            <strong className={item.won ? "success" : "loss"}>
              {item.won ? "Победа" : "Проигрыш"}
            </strong>
          </article>
        ))}
      </div>
      {!history.length && (
        <p className="empty-state">Ещё ни одной попытки. Начни с апгрейда.</p>
      )}
    </>
  );
}

function Community({ news, setNews }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function publish(event) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setMessage("");
    try {
      const data = await api("/news", Object.fromEntries(new FormData(form)));
      setNews(data.news);
      form.reset();
      setMessage("Новость опубликована.");
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">ЗАКРЫТОЕ СООБЩЕСТВО</span>
          <h1>Потенциальные кондиции</h1>
          <p>Элита. Легенды. Братва. Семь человек — одна судьба.</p>
        </div>
      </div>
      <h2>Актуальные кондиции</h2>
      <form className="news-form" onSubmit={publish}>
        <input
          name="author"
          maxLength="40"
          placeholder="Автор (необязательно)"
          aria-label="Автор"
        />
        <input
          name="title"
          maxLength="100"
          placeholder="Заголовок"
          aria-label="Заголовок"
          required
        />
        <textarea
          name="text"
          maxLength="500"
          placeholder="Текст новости"
          aria-label="Текст новости"
          required
        />
        <button className="primary" disabled={busy}>
          {busy ? "Публикуем…" : "Опубликовать новость"}
        </button>
        <span role="status">{message}</span>
      </form>
      <div className="news-list">
        {news.map((item) => (
          <article className="news-item" key={item.id}>
            <small>
              {item.date} · {item.author}
            </small>
            <h3>{item.title}</h3>
            <p>{item.text}</p>
          </article>
        ))}
      </div>
      <h2 className="roster-title">Состав группы</h2>
      <div className="roster-grid">
        {members.map((member) => (
          <article className="member" key={member.name}>
            <span style={{ color: member.color }}>{member.emoji}</span>
            <h3>{member.name}</h3>
            <p>{member.traits}</p>
          </article>
        ))}
      </div>
    </>
  );
}

function App() {
  const [tab, setTab] = useState("upgrade");
  const [account, setAccount] = useState(null);
  const [catalog, setCatalog] = useState([]);
  const [news, setNews] = useState([]);
  const [error, setError] = useState("");
  const [locked, setLocked] = useState(false);
  async function load() {
    setError("");
    try {
      const me = await api("/me");
      const [skins, feed] = await Promise.all([api("/catalog"), api("/news")]);
      setAccount(me);
      setCatalog(skins.catalog);
      setNews(feed.news);
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
  }, []);
  const tabs = [
    ["upgrade", "↗", "Апгрейд"],
    ["inventory", "◇", "Инвентарь"],
    ["history", "◷", "История"],
    ["community", "☰", "Сообщество"],
  ];
  return (
    <div className="app">
      <header>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setTab("upgrade");
          }}
        >
          <span className="brand-mark">
            ПК<span>↗</span>
          </span>
          <span>
            ПОТЕНЦИАЛЬНЫЕ
            <br />
            <b>КОНДИЦИИ</b>
          </span>
        </a>
        <nav aria-label="Основная навигация">
          {tabs.map(([key, icon, label]) => (
            <button
              key={key}
              disabled={locked && key !== "upgrade"}
              className={tab === key ? "active" : ""}
              onClick={() => setTab(key)}
            >
              <span>{icon}</span>
              {label}
            </button>
          ))}
        </nav>
        <div className="wallet">
          <span className="coin">М</span>
          <div>
            <small>ТВОЙ БАЛАНС</small>
            <strong>
              {account ? number(account.balance) : "…"} <span>Минетки</span>
            </strong>
          </div>
        </div>
      </header>
      <main>
        {error ? (
          <div className="load-state">
            <p className="error">{error}</p>
            <button className="primary" onClick={load}>
              Повторить загрузку
            </button>
          </div>
        ) : !account ? (
          <div className="load-state">Загружаем кондиции…</div>
        ) : (
          <>
            <div hidden={tab !== "upgrade"}>
              <Upgrade
                account={account}
                setAccount={setAccount}
                catalog={catalog}
                onLock={setLocked}
              />
            </div>
            {tab === "inventory" && (
              <Inventory account={account} setAccount={setAccount} />
            )}{" "}
            {tab === "history" && <History history={account.history} />}{" "}
            {tab === "community" && <Community news={news} setNews={setNews} />}
          </>
        )}
      </main>
      <footer>
        <span>
          ПК <b>Потенциальные кондиции</b>
        </span>
        <span>Внутриигровые скины · Валюта: Минетки</span>
      </footer>
    </div>
  );
}
createRoot(document.getElementById("root")).render(<App />);
