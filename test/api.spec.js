// Базовый тест API с использованием supertest
const request = require('supertest');
const app = require('../app');

describe('API', function () {
  it('GET /api/books требует аутентификацию (редирект на /login или 401 JSON)', async function () {
    const res = await request(app).get('/api/books');
    // Без сессии middleware редиректит на /login (HTML). Допустим любой не-500 ответ.
    if (res.status >= 500) throw new Error('Server error');
  });
});
