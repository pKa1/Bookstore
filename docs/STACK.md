# Технологический стек и архитектура

## Цели и требования
- Простая в развёртывании CRM‑подобная система для книжного магазина
- Роли: Admin, Worker, Client с разграничением доступа
- Серверный рендеринг + компактный фронтенд без тяжелых SPA‑фреймворков
- Локальная БД без внешних зависимостей, экспорт в Excel

## Выбор технологий

### Backend: Node.js + Express
- Express — минималистичный, гибкий фреймворк HTTP‑серверов; быстрый старт и простые middleware
- Подходит для REST API и серверного рендеринга

### Шаблоны: Nunjucks (аналог Jinja2)
- Jinja2‑подобный синтаксис, серверный рендеринг, знакомый по Python‑стеку
- Лёгкая интеграция с Express; чистая структура `templates/*.html`

### UI: Bootstrap 5, Bootstrap Icons, jQuery, Select2
- Bootstrap 5 — адаптивные компоненты и сетка, быстрое прототипирование
- Select2 — продвинутые селекты (поиск, dropdownParent для модалок)
- jQuery — минимальная обвязка для Select2, AJAX и делегирования событий

### База данных: SQLite (better-sqlite3)
- Локальный файл, zero‑config, транзакционность
- `better-sqlite3` — быстрые синхронные запросы, удобно в небольших приложениях

### Сессии: express-session + connect-sqlite3
- Персистентные сессии в SQLite; работает из коробки без Redis

### Экспорт: ExcelJS
- Генерация .xlsx без Excel; несколько листов (заказы, позиции)

### Тестирование: Mocha + Supertest
- Интеграционные тесты REST API; быстрый прогон

## Архитектура
- `app.js` — инициализация приложения, шаблоны, сессии, маршруты, обработчики ошибок
- `routes/pages.js` — страницы (SSR): логин/регистрация, дашборд, сущности
- `routes/api.js` — REST API (CRUD для пользователей/клиентов/работников/книг/заказов, корзина)
- `routes/export.js` — экспорт Excel (пользователи, книги, заказы + позиции)
- `db.js` — создание схемы, сиды, простая миграция (clients.user_id)
- `auth.js` — bcrypt‑аутентификация и middleware ролей
- `templates/` — Nunjucks‑шаблоны, мобильные модалки (`modal-fullscreen-sm-down`)
- `static/js/app.js` — страничная логика, Select2, пагинация, модалки

## Модель данных
- users(id, login, password_hash, role, created_at)
- employees(id, full_name, position, contact)
- clients(id, full_name, contact, notes, user_id?)
- books(id, title, author, price, quantity)
- orders(id, client_id, created_at, status)
- order_items(id, order_id, book_id, quantity, price)

Связи: clients.user_id → users.id (клиент привязывается к пользователю‑клиенту); orders.client_id → clients.id; order_items → orders, books

## RBAC
- Admin: полный доступ
- Worker: клиенты/работники/книги/заказы (без управления пользователями)
- Client: «Книги», «Корзина», видит только свои заказы (фильтр по clients.user_id)

## UX‑решения
- Мобильные модалки (fullscreen на sm), Select2 в модалках через `dropdownParent`
- Таблицы с лёгкой пагинацией на клиенте (AJAX + серверные LIMIT/OFFSET)
- Уведомления `toast()` поверх Bootstrap (без зависимостей)

## Почему не SPA
- Требуется быстрое, понятное MVP без сборки фронтенда
- SSR проще в деплое и SEO не критичен

## Масштабирование и улучшения
- Перенести сессии в Redis при кластеризации
- Добавить CSRF‑защиту и rate limiting
- Валидацию на уровне API (celebrate/zod)
- Роли и права — вынести в таблицы/claims
- Нотификации (email/Telegram) при новых заказах

## Развёртывание
- Node 20 LTS, `npm ci` и `npm start`
- Для Docker: базовый node:20‑alpine, volume для `data/`


