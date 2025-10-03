Книжный магазин (Express + Nunjucks + SQLite)

Полноценное клиент–сервер приложение с ролями Админ/Работник/Клиент, CRUD по сущностям и экспортом в Excel. UI на Bootstrap 5 с Select2, сервер — Express, база — SQLite.

Требования
- Node.js (рекомендуется LTS 20.x)
- npm 10+

Установка и запуск
macOS / Linux:
```bash
git clone <repo>
cd prog
npm install
npm run start
# Откройте http://localhost:3000
```

Windows (PowerShell):
```powershell
git clone <repo>
cd prog
npm install
npm run start
# Откройте http://localhost:3000
```

Примечания
- Если используете Node 23+, библиотеке `better-sqlite3` может потребоваться компиляция. Проще поставить Node 20 LTS (на macOS: `brew install node@20`).
- Сессионные файлы и БД хранятся в `data/`.

Демо-учётные записи
- admin / admin123 (admin)
- worker / worker123 (worker)
- client / client123 (client)

Скрипты npm
- `npm run start` — запуск сервера
- `npm run dev` — запуск с авто‑перезагрузкой (нужен nodemon)
- `npm test` — Mocha тесты

Структура проекта
- `app.js` — конфигурация сервера, сессии, шаблоны, маршруты
- `db.js` — инициализация SQLite, миграции, сиды
- `auth.js` — логин, регистрация, RBAC‑middleware
- `routes/` — `pages` (SSR), `api` (REST), `export` (Excel)
- `templates/` — Jinja2‑подобные шаблоны Nunjucks
- `static/` — CSS и JS (Bootstrap/Select2 интеграция)
- `test/` — примеры тестов

Как работать
1. Войти: `/login`
2. Роль Admin/Worker: управление пользователями/клиентами/работниками/книгами/заказами
3. Роль Client: каталог «Книги», «Корзина», оформление заказа

Траблшутинг
- EADDRINUSE: порт 3000 занят → завершите процесс на порту или установите переменную `PORT`
- Ошибки сборки `better-sqlite3`: используйте Node 20 LTS; на macOS можно `brew install node@20`
- Очистка сессий: удалите файл `data/sessions.sqlite`



