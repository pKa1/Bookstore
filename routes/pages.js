// Маршруты серверного рендеринга страниц (SSR)
// - логин/регистрация, дашборд
// - страницы сущностей: книги, клиенты, работники, заказы, пользователи, корзина
const express = require('express');
const router = express.Router();
const { ensureAuthenticated, ensureRole, ROLES, loginUser, registerUser } = require('../auth');
const { getDb } = require('../db');

router.get('/', (req, res) => {
  if (!req.session.user) return res.render('index.html');
  return res.redirect('/dashboard');
});

router.get('/dashboard', ensureAuthenticated, (req, res) => {
  const db = getDb();
  // Простая сводка для карточек на дашборде
  const counts = {
    users: db.prepare('SELECT COUNT(*) as c FROM users').get().c,
    books: db.prepare('SELECT COUNT(*) as c FROM books').get().c,
    clients: db.prepare('SELECT COUNT(*) as c FROM clients').get().c,
    orders: db.prepare('SELECT COUNT(*) as c FROM orders').get().c
  };
  res.render('dashboard.html', { counts });
});

router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/dashboard');
  res.render('login.html');
});

router.post('/login', (req, res) => {
  const { login, password } = req.body;
  const user = loginUser(login, password);
  if (!user) return res.status(400).render('login.html', { error: 'Неверный логин или пароль' });
  req.session.user = user;
  res.redirect('/dashboard');
});

router.get('/register', (req, res) => {
  res.render('register.html');
});

router.post('/register', (req, res) => {
  try {
    const { login, password } = req.body;
    const user = registerUser(login, password, ROLES.CLIENT);
    req.session.user = user;
    res.redirect('/dashboard');
  } catch (e) {
    res.status(400).render('register.html', { error: e.message });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

// Страницы сущностей (рендерятся шаблонами)
router.get('/books', ensureAuthenticated, (req, res) => res.render('books.html'));
router.get('/clients', ensureRole([ROLES.ADMIN, ROLES.WORKER]), (req, res) => res.render('clients.html'));
router.get('/employees', ensureRole([ROLES.ADMIN, ROLES.WORKER]), (req, res) => res.render('employees.html'));
router.get('/orders', ensureAuthenticated, (req, res) => res.render('orders.html'));
router.get('/users', ensureRole([ROLES.ADMIN]), (req, res) => res.render('users.html'));
router.get('/cart', ensureRole([ROLES.CLIENT]), (req, res) => res.render('cart.html'));

module.exports = router;

