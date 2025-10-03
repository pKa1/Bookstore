// Экспорт данных в Excel (.xlsx) через ExcelJS
// Листы: пользователи, книги, заказы + позиции заказов
const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const { getDb } = require('../db');
const { ensureRole, ROLES } = require('../auth');

async function exportToWorkbook(sheets) {
  const wb = new ExcelJS.Workbook();
  for (const sheet of sheets) {
    const ws = wb.addWorksheet(sheet.name);
    ws.columns = sheet.columns;
    ws.addRows(sheet.rows);
  }
  const buffer = await wb.xlsx.writeBuffer();
  return buffer;
}

router.get('/users.xlsx', ensureRole([ROLES.ADMIN]), async (req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT id, login, role, created_at FROM users').all();
  const buffer = await exportToWorkbook([
    {
      name: 'Users',
      columns: [
        { header: 'ID', key: 'id', width: 10 },
        { header: 'Login', key: 'login', width: 20 },
        { header: 'Role', key: 'role', width: 12 },
        { header: 'Created At', key: 'created_at', width: 24 }
      ],
      rows
    }
  ]);
  res.setHeader('Content-Disposition', 'attachment; filename="users.xlsx"');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(Buffer.from(buffer));
});

router.get('/books.xlsx', ensureRole([ROLES.ADMIN, ROLES.WORKER]), async (req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT id, title, author, price, quantity FROM books').all();
  const buffer = await exportToWorkbook([
    {
      name: 'Books',
      columns: [
        { header: 'ID', key: 'id', width: 10 },
        { header: 'Title', key: 'title', width: 32 },
        { header: 'Author', key: 'author', width: 24 },
        { header: 'Price', key: 'price', width: 12 },
        { header: 'Quantity', key: 'quantity', width: 12 }
      ],
      rows
    }
  ]);
  res.setHeader('Content-Disposition', 'attachment; filename="books.xlsx"');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(Buffer.from(buffer));
});

router.get('/orders.xlsx', ensureRole([ROLES.ADMIN, ROLES.WORKER]), async (req, res) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT o.id, c.full_name as client, o.created_at, o.status,
           (SELECT SUM(quantity * price) FROM order_items WHERE order_id = o.id) AS total
    FROM orders o JOIN clients c ON c.id = o.client_id
    ORDER BY o.id DESC
  `).all();
  const ru = { new: 'Новый', paid: 'Оплачен', shipped: 'Отгружен', cancelled: 'Отменён' };
  const localized = rows.map(r => ({ ...r, status: ru[r.status] || r.status }));
  const items = db.prepare(`
    SELECT oi.order_id, b.title AS book_title, oi.quantity, oi.price, (oi.quantity * oi.price) AS line_total
    FROM order_items oi
    JOIN books b ON b.id = oi.book_id
    ORDER BY oi.order_id ASC, oi.id ASC
  `).all();
  const buffer = await exportToWorkbook([
    {
      name: 'Заказы',
      columns: [
        { header: 'ID', key: 'id', width: 10 },
        { header: 'Клиент', key: 'client', width: 24 },
        { header: 'Дата', key: 'created_at', width: 24 },
        { header: 'Статус', key: 'status', width: 14 },
        { header: 'Сумма', key: 'total', width: 12 }
      ],
      rows: localized
    },
    {
      name: 'Позиции',
      columns: [
        { header: 'Заказ ID', key: 'order_id', width: 10 },
        { header: 'Книга', key: 'book_title', width: 32 },
        { header: 'Кол-во', key: 'quantity', width: 10 },
        { header: 'Цена', key: 'price', width: 12 },
        { header: 'Сумма', key: 'line_total', width: 12 }
      ],
      rows: items
    }
  ]);
  res.setHeader('Content-Disposition', 'attachment; filename="orders.xlsx"');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(Buffer.from(buffer));
});

module.exports = router;

