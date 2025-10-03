const path = require('path');
const fs = require('fs');
const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const morgan = require('morgan');
const nunjucks = require('nunjucks');
const bodyParser = require('body-parser');

const { initDatabase } = require('./db');
const auth = require('./auth');

const app = express();

// Создаём директорию данных (для БД и сессий), если её нет
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Шаблонизатор Nunjucks (похоже на Jinja2): рендер .html из каталога templates/
const templatesDir = path.join(__dirname, 'templates');
nunjucks.configure(templatesDir, {
  autoescape: true,
  express: app,
  watch: false,
  noCache: true
});
app.set('views', templatesDir);
app.set('view engine', 'html');
app.engine('html', nunjucks.render);

// Логирование запросов, статика и парсинг JSON/форм
app.use(morgan('dev'));
app.use(express.static(path.join(__dirname, 'static')));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(
  session({
    store: new SQLiteStore({ db: 'sessions.sqlite', dir: dataDir }),
    secret: process.env.SESSION_SECRET || 'dev_secret_change_me',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 8 }
  })
);

// Делаем текущего пользователя и роли доступными во всех шаблонах
app.use((req, res, next) => {
  res.locals.currentUser = req.session.user || null;
  res.locals.roles = auth.ROLES;
  next();
});

// Инициализируем схему БД и наполняем демо‑данными при старте
initDatabase();

// Подключаем роутеры: страницы (SSR), API (JSON), экспорт (.xlsx)
const pageRoutes = require('./routes/pages');
const apiRoutes = require('./routes/api');
const exportRoutes = require('./routes/export');

app.use('/', pageRoutes);
app.use('/api', apiRoutes);
app.use('/export', exportRoutes);

// Обработчик 404 для HTML и JSON
app.use((req, res) => {
  if (req.accepts('json')) {
    return res.status(404).json({ error: 'Not Found' });
  }
  return res.status(404).render('404.html');
});

// Глобальный обработчик ошибок: логирование и корректный ответ HTML/JSON
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  if (req.accepts('json')) {
    return res.status(500).json({ error: 'Server error', details: err.message });
  }
  return res.status(500).render('500.html', { message: err.message });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Bookstore app listening on http://localhost:${PORT}`);
});

module.exports = app;

