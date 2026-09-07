const express = require('express');
const fs = require('fs/promises');
const path = require('path');

const app = express();
const PORT = Number(process.env.PORT) || 10000;
const HOST = '0.0.0.0';
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const NEWS_FILE = path.join(DATA_DIR, 'news.json');

const INITIAL_NEWS = [
  {
    date: '24.03.2026',
    author: 'Лев Тигр',
    title: 'Перезапуск сайта',
    text: ''
  }
];

app.disable('x-powered-by');
app.use(express.json({ limit: '16kb' }));

function normalizeText(value, maxLength) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function formatDateRU(value) {
  const date = value ? new Date(value) : new Date();
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;

  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow'
  }).format(safeDate);
}

async function ensureNewsFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });

  try {
    await fs.access(NEWS_FILE);
  } catch {
    await fs.writeFile(
      NEWS_FILE,
      JSON.stringify(INITIAL_NEWS, null, 2),
      'utf8'
    );
  }
}

async function readNews() {
  await ensureNewsFile();

  try {
    const raw = await fs.readFile(NEWS_FILE, 'utf8');
    const parsed = JSON.parse(raw);

    return Array.isArray(parsed)
      ? parsed
      : [...INITIAL_NEWS];
  } catch (error) {
    console.error('Failed to read news:', error);
    return [...INITIAL_NEWS];
  }
}

async function writeNews(news) {
  await fs.mkdir(DATA_DIR, { recursive: true });

  const tempFile = `${NEWS_FILE}.tmp`;

  await fs.writeFile(
    tempFile,
    JSON.stringify(news, null, 2),
    'utf8'
  );

  await fs.rename(tempFile, NEWS_FILE);
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

app.get('/api/news', async (req, res) => {
  try {
    const news = await readNews();

    res.json({ news });
  } catch (error) {
    console.error('GET /api/news failed:', error);

    res.status(500).json({
      error: 'Не удалось загрузить новости'
    });
  }
});

app.post('/api/news', async (req, res) => {
  try {
    const author = normalizeText(req.body?.author, 40);
    const title = normalizeText(req.body?.title, 100);
    const text = normalizeText(req.body?.text, 500);
    const date = formatDateRU(req.body?.date);

    if (!title || !text) {
      return res.status(400).json({
        error: 'Заголовок и текст обязательны'
      });
    }

    const item = {
      date,
      author: author || 'Аноним',
      title,
      text
    };

    const current = await readNews();

    const updated = [
      item,
      ...current
    ].slice(0, 100);

    await writeNews(updated);

    return res.status(201).json({
      ok: true,
      news: updated,
      item
    });
  } catch (error) {
    console.error('POST /api/news failed:', error);

    return res.status(500).json({
      error: 'Не удалось опубликовать новость'
    });
  }
});

app.get(['/', '/index.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/danek.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'danek.html'));
});

app.get('/news.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'news.js'));
});

app.use((req, res) => {
  res.status(404).send('404 — страница не найдена');
});

ensureNewsFile()
  .then(() => {
    app.listen(PORT, HOST, () => {
      console.log(`Server is running on http://${HOST}:${PORT}`);
      console.log(`News data file: ${NEWS_FILE}`);
    });
  })
  .catch((error) => {
    console.error(
      'Failed to initialize application:',
      error
    );

    process.exit(1);
  });