// Настройка SQLite и миграции
// - getDb(): единый экземпляр подключения
// - Создание таблиц при первом запуске
// - Заполнение демо‑данными для быстрого старта
// - Простая миграция: добавление clients.user_id
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, 'data', 'bookstore.sqlite');
let dbInstance = null;

function getDb() {
  if (!dbInstance) {
    dbInstance = new Database(dbPath);
    dbInstance.pragma('journal_mode = WAL');
    dbInstance.pragma('foreign_keys = ON');
  }
  return dbInstance;
}

function initDatabase() {
  const dataDir = path.dirname(dbPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const db = getDb();

  // Таблицы (идемпотентно)
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      login TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin','worker','client')),
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      position TEXT,
      contact TEXT
    );

    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      contact TEXT,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS books (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      author TEXT,
      price REAL NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      status TEXT NOT NULL DEFAULT 'new',
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      book_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      price REAL NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
    );
  `);

  seedIfEmpty(db);

  migrateClientsUserId(db);
}

function seedIfEmpty(db) {
  const userCount = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  if (userCount === 0) {
    // Создаём демо‑пользователей: admin, worker, client
    const bcrypt = require('bcryptjs');
    const hashAdmin = bcrypt.hashSync('admin123', 10);
    const hashWorker = bcrypt.hashSync('worker123', 10);
    const hashClient = bcrypt.hashSync('client123', 10);
    const insertUser = db.prepare('INSERT INTO users (login, password_hash, role) VALUES (?,?,?)');
    insertUser.run('admin', hashAdmin, 'admin');
    insertUser.run('worker', hashWorker, 'worker');
    insertUser.run('client', hashClient, 'client');

    const insertEmployee = db.prepare('INSERT INTO employees (full_name, position, contact) VALUES (?,?,?)');
    insertEmployee.run('Иван Петров', 'Менеджер', 'ivan@example.com');
    insertEmployee.run('Мария Сидорова', 'Кассир', 'maria@example.com');

    const insertClient = db.prepare('INSERT INTO clients (full_name, contact, notes) VALUES (?,?,?)');
    insertClient.run('Покупатель №1', '+7 900 000-00-01', 'Лояльный клиент');
    insertClient.run('Покупатель №2', '+7 900 000-00-02', 'Любит фантастику');

    const insertBook = db.prepare('INSERT INTO books (title, author, price, quantity) VALUES (?,?,?,?)');
    insertBook.run('Гарри Поттер и философский камень', 'Дж. К. Роулинг', 799.0, 12);
    insertBook.run('Мастер и Маргарита', 'Михаил Булгаков', 599.0, 8);
    insertBook.run('Три товарища', 'Эрих Мария Ремарк', 549.0, 5);

    // Пример заказа
    const client = db.prepare('SELECT id FROM clients LIMIT 1').get();
    if (client) {
      const orderStmt = db.prepare('INSERT INTO orders (client_id, status) VALUES (?, ?)');
      const orderId = orderStmt.run(client.id, 'new').lastInsertRowid;
      const book1 = db.prepare('SELECT id, price FROM books WHERE title = ?').get('Гарри Поттер и философский камень');
      const itemStmt = db.prepare('INSERT INTO order_items (order_id, book_id, quantity, price) VALUES (?,?,?,?)');
      itemStmt.run(orderId, book1.id, 1, book1.price);
    }
  }
}

function migrateClientsUserId(db) {
  // Добавляем clients.user_id при отсутствии; связь на users(id)
  const hasUserId = db.prepare("PRAGMA table_info(clients)").all().some(c => c.name === 'user_id');
  if (!hasUserId) {
    db.transaction(() => {
      db.exec(`
        CREATE TABLE clients_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          full_name TEXT NOT NULL,
          contact TEXT,
          notes TEXT,
          user_id INTEGER UNIQUE,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
        );
        INSERT INTO clients_new (id, full_name, contact, notes)
          SELECT id, full_name, contact, notes FROM clients;
        DROP TABLE clients;
        ALTER TABLE clients_new RENAME TO clients;
      `);
      // Attempt to link seeded 'client' user to first client
      const user = db.prepare('SELECT id FROM users WHERE login = ?').get('client');
      const clientRow = db.prepare('SELECT id FROM clients ORDER BY id ASC LIMIT 1').get();
      if (user && clientRow) {
        db.prepare('UPDATE clients SET user_id = ? WHERE id = ?').run(user.id, clientRow.id);
      }
    })();
  }
}

module.exports = {
  getDb,
  initDatabase
};

