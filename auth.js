// Аутентификация и контроль доступа
// - loginUser: проверка учётных данных через bcrypt
// - registerUser: создание пользователя с хешированным паролем
// - ensureAuthenticated: защита маршрутов, требующих входа
// - ensureRole: ограничение доступа по роли(ям)
const bcrypt = require('bcryptjs');
const { getDb } = require('./db');

const ROLES = {
  ADMIN: 'admin',
  WORKER: 'worker',
  CLIENT: 'client'
};

function ensureAuthenticated(req, res, next) {
  if (req.session && req.session.user) return next();
  if (req.accepts('json')) return res.status(401).json({ error: 'Unauthorized' });
  return res.redirect('/login');
}

function ensureRole(roles) {
  return function (req, res, next) {
    if (!req.session || !req.session.user) {
      if (req.accepts('json')) return res.status(401).json({ error: 'Unauthorized' });
      return res.redirect('/login');
    }
    const userRole = req.session.user.role;
    if (Array.isArray(roles) ? roles.includes(userRole) : roles === userRole) {
      return next();
    }
    if (req.accepts('json')) return res.status(403).json({ error: 'Forbidden' });
    return res.status(403).render('403.html');
  };
}

function loginUser(login, password) {
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE login = ?').get(login);
  if (!user) return null;
  const ok = bcrypt.compareSync(password, user.password_hash);
  if (!ok) return null;
  return { id: user.id, login: user.login, role: user.role };
}

function registerUser(login, password, role) {
  const db = getDb();
  const exists = db.prepare('SELECT id FROM users WHERE login = ?').get(login);
  if (exists) throw new Error('Пользователь уже существует');
  const hash = bcrypt.hashSync(password, 10);
  const stmt = db.prepare('INSERT INTO users (login, password_hash, role) VALUES (?,?,?)');
  const info = stmt.run(login, hash, role);
  return { id: info.lastInsertRowid, login, role };
}

module.exports = {
  ROLES,
  ensureAuthenticated,
  ensureRole,
  loginUser,
  registerUser
};

