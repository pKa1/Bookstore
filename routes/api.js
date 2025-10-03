// JSON REST API
// Сущности: пользователи, работники, клиенты, книги, заказы, корзина
// Доступ контролируется middleware ролей из auth.js
const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const { ensureAuthenticated, ensureRole, ROLES } = require('../auth');

function paginate(query, { page = 1, pageSize = 10 }) {
  const limit = Math.max(1, Math.min(100, Number(pageSize)));
  const offset = (Math.max(1, Number(page)) - 1) * limit;
  return `${query} LIMIT ${limit} OFFSET ${offset}`;
}

// Users (admin only)
router.get('/users', ensureRole([ROLES.ADMIN]), (req, res) => {
  const db = getDb();
  const rows = db.prepare(paginate('SELECT id, login, role, created_at FROM users', req.query)).all();
  res.json({ data: rows });
});

router.post('/users', ensureRole([ROLES.ADMIN]), (req, res) => {
  const db = getDb();
  const { login, password, role } = req.body;
  try {
    const bcrypt = require('bcryptjs');
    const hash = bcrypt.hashSync(password, 10);
    const info = db.prepare('INSERT INTO users (login, password_hash, role) VALUES (?,?,?)').run(login, hash, role);
    res.json({ id: info.lastInsertRowid });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.put('/users/:id', ensureRole([ROLES.ADMIN]), (req, res) => {
  const db = getDb();
  const { role, password } = req.body;
  const id = Number(req.params.id);
  try {
    if (password) {
      const bcrypt = require('bcryptjs');
      const hash = bcrypt.hashSync(password, 10);
      db.prepare('UPDATE users SET role = ?, password_hash = ? WHERE id = ?').run(role, hash, id);
    } else {
      db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id);
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.delete('/users/:id', ensureRole([ROLES.ADMIN]), (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Employees (admin, worker)
router.get('/employees', ensureRole([ROLES.ADMIN, ROLES.WORKER]), (req, res) => {
  const db = getDb();
  const rows = db.prepare(paginate('SELECT * FROM employees', req.query)).all();
  res.json({ data: rows });
});

router.post('/employees', ensureRole([ROLES.ADMIN, ROLES.WORKER]), (req, res) => {
  const db = getDb();
  const { full_name, position, contact } = req.body;
  const info = db.prepare('INSERT INTO employees (full_name, position, contact) VALUES (?,?,?)').run(full_name, position, contact);
  res.json({ id: info.lastInsertRowid });
});

router.put('/employees/:id', ensureRole([ROLES.ADMIN, ROLES.WORKER]), (req, res) => {
  const db = getDb();
  const { full_name, position, contact } = req.body;
  db.prepare('UPDATE employees SET full_name = ?, position = ?, contact = ? WHERE id = ?').run(full_name, position, contact, req.params.id);
  res.json({ ok: true });
});

router.delete('/employees/:id', ensureRole([ROLES.ADMIN]), (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM employees WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Clients (admin, worker)
router.get('/clients', ensureRole([ROLES.ADMIN, ROLES.WORKER]), (req, res) => {
  const db = getDb();
  const rows = db.prepare(paginate('SELECT * FROM clients', req.query)).all();
  res.json({ data: rows });
});

router.post('/clients', ensureRole([ROLES.ADMIN, ROLES.WORKER]), (req, res) => {
  const db = getDb();
  const { full_name, contact, notes } = req.body;
  const info = db.prepare('INSERT INTO clients (full_name, contact, notes) VALUES (?,?,?)').run(full_name, contact, notes);
  res.json({ id: info.lastInsertRowid });
});

router.put('/clients/:id', ensureRole([ROLES.ADMIN, ROLES.WORKER]), (req, res) => {
  const db = getDb();
  const { full_name, contact, notes } = req.body;
  db.prepare('UPDATE clients SET full_name = ?, contact = ?, notes = ? WHERE id = ?').run(full_name, contact, notes, req.params.id);
  res.json({ ok: true });
});

router.delete('/clients/:id', ensureRole([ROLES.ADMIN]), (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM clients WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Книги (все вошедшие могут смотреть; admin/worker — редактировать)
router.get('/books', ensureAuthenticated, (req, res) => {
  const db = getDb();
  const { q } = req.query;
  let sql = 'SELECT * FROM books';
  if (q) {
    sql += ` WHERE title LIKE '%' || @q || '%' OR author LIKE '%' || @q || '%'`;
  }
  const rows = db.prepare(paginate(sql, req.query)).all({ q });
  res.json({ data: rows });
});

router.post('/books', ensureRole([ROLES.ADMIN, ROLES.WORKER]), (req, res) => {
  const db = getDb();
  const { title, author, price, quantity } = req.body;
  const info = db.prepare('INSERT INTO books (title, author, price, quantity) VALUES (?,?,?,?)').run(title, author, price, quantity);
  res.json({ id: info.lastInsertRowid });
});

router.put('/books/:id', ensureRole([ROLES.ADMIN, ROLES.WORKER]), (req, res) => {
  const db = getDb();
  const { title, author, price, quantity } = req.body;
  db.prepare('UPDATE books SET title = ?, author = ?, price = ?, quantity = ? WHERE id = ?').run(title, author, price, quantity, req.params.id);
  res.json({ ok: true });
});

router.delete('/books/:id', ensureRole([ROLES.ADMIN]), (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM books WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Список заказов
router.get('/orders', ensureAuthenticated, (req, res) => {
  const db = getDb();
  let base = `
    SELECT o.id, o.client_id, c.full_name AS client_name, o.created_at, o.status,
           (SELECT SUM(quantity * price) FROM order_items WHERE order_id = o.id) AS total
    FROM orders o JOIN clients c ON c.id = o.client_id`;
  if (req.session.user.role === ROLES.CLIENT) {
    base += ` WHERE c.user_id = @uid`;
  }
  base += ` ORDER BY o.id DESC`;
  const rows = db.prepare(paginate(base, req.query)).all({ uid: req.session.user.id });
  res.json({ data: rows });
});

router.get('/orders/:id/items', ensureAuthenticated, (req, res) => {
  const db = getDb();
  const items = db.prepare(`
    SELECT oi.id, b.title, oi.quantity, oi.price
    FROM order_items oi JOIN books b ON b.id = oi.book_id
    WHERE oi.order_id = ?
  `).all(req.params.id);
  res.json({ data: items });
});

router.post('/orders', ensureRole([ROLES.ADMIN, ROLES.WORKER]), (req, res) => {
  const db = getDb();
  const { client_id, items, status = 'new' } = req.body;
  const tx = db.transaction(() => {
    const orderId = db.prepare('INSERT INTO orders (client_id, status) VALUES (?,?)').run(client_id, status).lastInsertRowid;
    const addItem = db.prepare('INSERT INTO order_items (order_id, book_id, quantity, price) VALUES (?,?,?,?)');
    const updateQty = db.prepare('UPDATE books SET quantity = quantity - ? WHERE id = ?');
    for (const it of items) {
      addItem.run(orderId, it.book_id, it.quantity, it.price);
      updateQty.run(it.quantity, it.book_id);
    }
    return orderId;
  });
  const id = tx();
  res.json({ id });
});

router.put('/orders/:id', ensureRole([ROLES.ADMIN, ROLES.WORKER]), (req, res) => {
  const db = getDb();
  const { status } = req.body;
  db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ ok: true });
});

router.delete('/orders/:id', ensureRole([ROLES.ADMIN]), (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM orders WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Корзина (сессия) — только для роли client
router.get('/cart', ensureRole([ROLES.CLIENT]), (req, res) => {
  const cart = req.session.cart || [];
  res.json({ data: cart });
});

router.post('/cart', ensureRole([ROLES.CLIENT]), (req, res) => {
  const { book_id, quantity } = req.body;
  if (!req.session.cart) req.session.cart = [];
  const db = getDb();
  const book = db.prepare('SELECT id, title, price, quantity AS stock FROM books WHERE id = ?').get(book_id);
  if (!book) return res.status(404).json({ error: 'Книга не найдена' });
  if (book.stock <= 0) return res.status(400).json({ error: 'Книга недоступна (нет в наличии)' });
  const qty = Math.max(1, Number(quantity));
  const existing = req.session.cart.find(x => x.book_id === book_id);
  const inCart = existing ? existing.quantity : 0;
  if (inCart + qty > book.stock) return res.status(400).json({ error: `Доступно только ${book.stock} шт.` });
  if (existing) existing.quantity += qty; else req.session.cart.push({ book_id, title: book.title, price: book.price, quantity: qty });
  res.json({ ok: true });
});

router.delete('/cart/:book_id', ensureRole([ROLES.CLIENT]), (req, res) => {
  const id = Number(req.params.book_id);
  req.session.cart = (req.session.cart || []).filter(x => x.book_id !== id);
  res.json({ ok: true });
});

router.post('/cart/checkout', ensureRole([ROLES.CLIENT]), (req, res) => {
  const db = getDb();
  const cart = req.session.cart || [];
  if (cart.length === 0) return res.status(400).json({ error: 'Корзина пуста' });
  // Resolve client by current user (create minimal profile if missing)
  let clientRow = db.prepare('SELECT id FROM clients WHERE user_id = ?').get(req.session.user.id);
  if (!clientRow) {
    const fullName = req.session.user.login;
    const info = db.prepare('INSERT INTO clients (full_name, contact, notes, user_id) VALUES (?,?,?,?)')
      .run(fullName, '', '', req.session.user.id);
    clientRow = { id: info.lastInsertRowid };
  }
  // Validate stock before creating order
  for (const it of cart) {
    const stockRow = db.prepare('SELECT quantity FROM books WHERE id = ?').get(it.book_id);
    if (!stockRow) return res.status(400).json({ error: 'Книга не найдена' });
    if (stockRow.quantity < it.quantity) return res.status(400).json({ error: `Недостаточно на складе для книги ID ${it.book_id}` });
  }
  const tx = db.transaction(() => {
    const orderId = db.prepare('INSERT INTO orders (client_id, status) VALUES (?,?)').run(clientRow.id, 'new').lastInsertRowid;
    const addItem = db.prepare('INSERT INTO order_items (order_id, book_id, quantity, price) VALUES (?,?,?,?)');
    const updateQty = db.prepare('UPDATE books SET quantity = quantity - ? WHERE id = ?');
    for (const it of cart) {
      addItem.run(orderId, it.book_id, it.quantity, it.price);
      updateQty.run(it.quantity, it.book_id);
    }
    return orderId;
  });
  const id = tx();
  req.session.cart = [];
  res.json({ id });
});

module.exports = router;

