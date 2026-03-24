const { getStore } = require("@netlify/blobs");

const INITIAL_NEWS = [
  {
    date: "24.03.2026",
    author: "Данёк 52",
    title: "Сайт запущен",
    text: "Потенциальные кондиции обзавелись собственным сайтом. Теперь вся правда задокументирована."
  },
  {
    date: "23.03.2026",
    author: "Вован",
    title: "Вован снова перепутал лево и право",
    text: "Во время валоранта Вован повернул не туда и умер. Считает, что это баг игры. КМС по заявлениям подтверждает."
  },
  {
    date: "24.03.2026",
    author: "Солярис Аура",
    title: "52 потерялся",
    text: "52 не смог найти нужный кабинет. По дороге на пару завернул не в ту локацию."
  },
  {
    date: "24.03.2026",
    author: "Лев Тигр",
    title: "Цунами опоздал на полчаса",
    text: "Цунами снова опоздал. На этот раз объяснил это тем, что шёл другой дорогой. КМС по пиздобольству в деле."
  }
];

const store = getStore("site-news");
const KEY = "items";

function jsonResponse(statusCode, payload) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    },
    body: JSON.stringify(payload)
  };
}

function normalizeText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function formatDateRU(input) {
  const date = input ? new Date(input) : new Date();
  if (Number.isNaN(date.getTime())) {
    return new Date().toLocaleDateString("ru-RU");
  }
  return date.toLocaleDateString("ru-RU");
}

async function readNews() {
  const data = await store.get(KEY, { type: "json" });
  if (!Array.isArray(data) || data.length === 0) {
    return [...INITIAL_NEWS];
  }
  return data;
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return jsonResponse(204, {});
  }

  if (event.httpMethod === "GET") {
    const news = await readNews();
    return jsonResponse(200, { news });
  }

  if (event.httpMethod === "POST") {
    let payload;
    try {
      payload = JSON.parse(event.body || "{}");
    } catch {
      return jsonResponse(400, { error: "Invalid JSON body" });
    }

    const author = normalizeText(payload.author, 40);
    const title = normalizeText(payload.title, 100);
    const text = normalizeText(payload.text, 500);
    const date = formatDateRU(payload.date);

    if (!title || !text) {
      return jsonResponse(400, { error: "Title and text are required" });
    }

    const item = {
      date,
      author: author || "Аноним",
      title,
      text
    };

    const current = await readNews();
    const updated = [item, ...current].slice(0, 100);
    await store.setJSON(KEY, updated);
    return jsonResponse(201, { ok: true, news: updated, item });
  }

  return jsonResponse(405, { error: "Method not allowed" });
};
