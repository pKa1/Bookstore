// Фронтенд‑логика страниц: книги, клиенты, работники, заказы, пользователи, корзина
// - ajaxJSON — обёртка над fetch для JSON API
// - Каждая страница — модуль с состоянием и обработчиками
// - Используются Bootstrap 5, Select2 и ванильный JS
window.toast = function(message, type = 'success') {
  const el = document.createElement('div');
  el.className = `alert alert-${type} position-fixed top-0 start-50 translate-middle-x mt-3 shadow`;
  el.style.zIndex = 1080;
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2500);
};

function ajaxJSON(url, options = {}) {
  const method = options.method || 'GET';
  const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
  const body = options.body ? JSON.stringify(options.body) : undefined;
  return fetch(url, { method, headers, body }).then(async res => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  });
}

function setupPager(pagerEl, state, onChange) {
  pagerEl.innerHTML = '';
  const ul = pagerEl;
  const create = (page, label, active = false) => {
    const li = document.createElement('li');
    li.className = `page-item ${active ? 'active' : ''}`;
    const a = document.createElement('a');
    a.className = 'page-link';
    a.href = '#';
    a.textContent = label;
    a.addEventListener('click', e => { e.preventDefault(); state.page = page; onChange(); });
    li.appendChild(a);
    ul.appendChild(li);
  };
  const totalPages = Math.max(1, Math.ceil((state.total || 0) / state.pageSize));
  const cur = state.page;
  create(Math.max(1, cur - 1), '‹');
  for (let p = Math.max(1, cur - 2); p <= Math.min(totalPages, cur + 2); p++) create(p, String(p), p === cur);
  create(Math.min(totalPages, cur + 1), '›');
}

window.BookPage = (function() {
  const state = { page: 1, pageSize: 10, total: 0, q: '' };
  const tBody = () => document.querySelector('#tblBooks tbody');
  const pager = () => document.querySelector('#booksPager');
  const modalEl = () => document.getElementById('modalBook');
  let modal;

  function load() {
    const params = new URLSearchParams({ page: state.page, pageSize: state.pageSize, q: state.q });
    ajaxJSON(`/api/books?${params}`).then(res => {
      const rows = res.data || [];
      state.total = rows.length < state.pageSize && state.page === 1 ? rows.length : (state.page * state.pageSize + (rows.length === state.pageSize ? state.pageSize : 0));
      tBody().innerHTML = rows.map(r => `
        <tr>
          <td>${r.id}</td>
          <td>${r.title}</td>
          <td>${r.author || ''}</td>
          <td>${r.price}</td>
          <td>${r.quantity <= 0 ? '0' : r.quantity}</td>
          <td class="text-end">
            ${window.currentUserRole && ['admin','worker'].includes(window.currentUserRole) ? `<button class="btn btn-sm btn-outline-primary me-2" data-edit='${JSON.stringify(r)}'>Редактировать</button><button class="btn btn-sm btn-outline-danger" data-del='${r.id}'>Удалить</button>`:''}
            ${window.currentUserRole === 'client' ? `<button class=\"btn btn-sm btn-primary\" data-add='${r.id}' ${r.quantity <= 0 ? 'disabled' : ''}>В корзину</button>`:''}
          </td>
        </tr>`).join('');
      setupPager(pager(), state, load);
    }).catch(err => toast(err.message, 'danger'));
  }

  function openModal(data) {
    const form = document.getElementById('formBook');
    form.reset();
    form.id.value = data?.id || '';
    form.title.value = data?.title || '';
    form.author.value = data?.author || '';
    form.price.value = data?.price || '';
    form.quantity.value = data?.quantity || '';
    modal = new bootstrap.Modal(modalEl());
    modal.show();
  }

  function save() {
    const form = document.getElementById('formBook');
    const id = form.id.value;
    const payload = {
      title: form.title.value,
      author: form.author.value,
      price: parseFloat(form.price.value),
      quantity: parseInt(form.quantity.value, 10)
    };
    const req = id ? ajaxJSON(`/api/books/${id}`, { method: 'PUT', body: payload }) : ajaxJSON('/api/books', { method: 'POST', body: payload });
    req.then(() => { toast('Сохранено'); modal.hide(); load(); }).catch(err => toast(err.message, 'danger'));
  }

  function bind() {
    document.getElementById('btnAddBook')?.addEventListener('click', () => openModal());
    document.getElementById('btnSaveBook')?.addEventListener('click', save);
    document.getElementById('searchBooks')?.addEventListener('input', (e) => { state.q = e.target.value; state.page = 1; load(); });
    tBody().addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      if (btn.dataset.edit) openModal(JSON.parse(btn.dataset.edit));
      if (btn.dataset.del) ajaxJSON(`/api/books/${btn.dataset.del}`, { method: 'DELETE' }).then(() => { toast('Удалено'); load(); }).catch(err => toast(err.message, 'danger'));
      if (btn.dataset.add) ajaxJSON('/api/cart', { method: 'POST', body: { book_id: Number(btn.dataset.add), quantity: 1 } }).then(() => { toast('Добавлено в корзину'); }).catch(err => toast(err.message, 'danger'));
    });
  }

  return { init() { bind(); load(); } };
})();

window.ClientPage = (function() {
  const state = { page: 1, pageSize: 10, total: 0 };
  const tBody = () => document.querySelector('#tblClients tbody');
  const pager = () => document.querySelector('#clientsPager');
  const modalEl = () => document.getElementById('modalClient');
  let modal;

  function load() {
    const params = new URLSearchParams({ page: state.page, pageSize: state.pageSize });
    ajaxJSON(`/api/clients?${params}`).then(res => {
      const rows = res.data || [];
      tBody().innerHTML = rows.map(r => `
        <tr>
          <td>${r.id}</td>
          <td>${r.full_name}</td>
          <td>${r.contact || ''}</td>
          <td>${r.notes || ''}</td>
          <td class="text-end">
            <button class="btn btn-sm btn-outline-primary me-2" data-edit='${JSON.stringify(r)}'>Редактировать</button>
            <button class="btn btn-sm btn-outline-danger" data-del='${r.id}'>Удалить</button>
          </td>
        </tr>`).join('');
      setupPager(pager(), state, load);
    }).catch(err => toast(err.message, 'danger'));
  }

  function openModal(data) {
    const form = document.getElementById('formClient');
    form.reset();
    form.id.value = data?.id || '';
    form.full_name.value = data?.full_name || '';
    form.contact.value = data?.contact || '';
    form.notes.value = data?.notes || '';
    modal = new bootstrap.Modal(modalEl());
    modal.show();
  }

  function save() {
    const form = document.getElementById('formClient');
    const id = form.id.value;
    const payload = { full_name: form.full_name.value, contact: form.contact.value, notes: form.notes.value };
    const req = id ? ajaxJSON(`/api/clients/${id}`, { method: 'PUT', body: payload }) : ajaxJSON('/api/clients', { method: 'POST', body: payload });
    req.then(() => { toast('Сохранено'); modal.hide(); load(); }).catch(err => toast(err.message, 'danger'));
  }

  function bind() {
    document.getElementById('btnAddClient')?.addEventListener('click', () => openModal());
    document.getElementById('btnSaveClient')?.addEventListener('click', save);
    tBody().addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      if (btn.dataset.edit) openModal(JSON.parse(btn.dataset.edit));
      if (btn.dataset.del) ajaxJSON(`/api/clients/${btn.dataset.del}`, { method: 'DELETE' }).then(() => { toast('Удалено'); load(); }).catch(err => toast(err.message, 'danger'));
    });
  }

  return { init() { bind(); load(); } };
})();

window.EmployeePage = (function() {
  const state = { page: 1, pageSize: 10, total: 0 };
  const tBody = () => document.querySelector('#tblEmployees tbody');
  const pager = () => document.querySelector('#employeesPager');
  const modalEl = () => document.getElementById('modalEmployee');
  let modal;

  function load() {
    const params = new URLSearchParams({ page: state.page, pageSize: state.pageSize });
    ajaxJSON(`/api/employees?${params}`).then(res => {
      const rows = res.data || [];
      tBody().innerHTML = rows.map(r => `
        <tr>
          <td>${r.id}</td>
          <td>${r.full_name}</td>
          <td>${r.position || ''}</td>
          <td>${r.contact || ''}</td>
          <td class="text-end">
            <button class="btn btn-sm btn-outline-primary me-2" data-edit='${JSON.stringify(r)}'>Редактировать</button>
            <button class="btn btn-sm btn-outline-danger" data-del='${r.id}'>Удалить</button>
          </td>
        </tr>`).join('');
      setupPager(pager(), state, load);
    }).catch(err => toast(err.message, 'danger'));
  }

  function openModal(data) {
    const form = document.getElementById('formEmployee');
    form.reset();
    form.id.value = data?.id || '';
    form.full_name.value = data?.full_name || '';
    form.position.value = data?.position || '';
    form.contact.value = data?.contact || '';
    modal = new bootstrap.Modal(modalEl());
    modal.show();
  }

  function save() {
    const form = document.getElementById('formEmployee');
    const id = form.id.value;
    const payload = { full_name: form.full_name.value, position: form.position.value, contact: form.contact.value };
    const req = id ? ajaxJSON(`/api/employees/${id}`, { method: 'PUT', body: payload }) : ajaxJSON('/api/employees', { method: 'POST', body: payload });
    req.then(() => { toast('Сохранено'); modal.hide(); load(); }).catch(err => toast(err.message, 'danger'));
  }

  function bind() {
    document.getElementById('btnAddEmployee')?.addEventListener('click', () => openModal());
    document.getElementById('btnSaveEmployee')?.addEventListener('click', save);
    tBody().addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      if (btn.dataset.edit) openModal(JSON.parse(btn.dataset.edit));
      if (btn.dataset.del) ajaxJSON(`/api/employees/${btn.dataset.del}`, { method: 'DELETE' }).then(() => { toast('Удалено'); load(); }).catch(err => toast(err.message, 'danger'));
    });
  }

  return { init() { bind(); load(); } };
})();

window.OrderPage = (function() {
  const state = { page: 1, pageSize: 10 };
  const tBody = () => document.querySelector('#tblOrders tbody');
  const pager = () => document.querySelector('#ordersPager');
  const modalEl = () => document.getElementById('modalOrder');
  let modal;

  function cleanupModalArtifacts() {
    document.querySelectorAll('.modal-backdrop').forEach(b => b.remove());
    document.body.classList.remove('modal-open');
    document.body.style.removeProperty('padding-right');
  }

  function load() {
    const params = new URLSearchParams({ page: state.page, pageSize: state.pageSize });
    ajaxJSON(`/api/orders?${params}`).then(res => {
      const rows = res.data || [];
      const ru = { new: 'Новый', paid: 'Оплачен', shipped: 'Отгружен', cancelled: 'Отменён' };
      tBody().innerHTML = rows.map(r => `
        <tr>
          <td>${r.id}</td>
          <td>${r.client_name}</td>
          <td>${r.created_at}</td>
          <td>${ru[r.status] || r.status}</td>
          <td>${r.total || 0}</td>
          <td class="text-end">
            <button class="btn btn-sm btn-outline-primary me-2" data-view='${r.id}'>Позиции</button>
          </td>
        </tr>`).join('');
      setupPager(pager(), state, load);
    }).catch(err => toast(err.message, 'danger'));
  }

  function openModal() {
    modal = new bootstrap.Modal(modalEl());
    // load clients and prepare rows
    ajaxJSON('/api/clients?page=1&pageSize=100').then(res => {
      const sel = document.querySelector('#formOrder select[name="client_id"]');
      sel.innerHTML = res.data.map(c => `<option value="${c.id}">${c.full_name}</option>`).join('');
      $(sel).select2({ theme: 'bootstrap4', dropdownParent: $(modalEl()) });
    });
    // init status select with RU labels
    (function initStatusSelect(){
      const ru = { new: 'Новый', paid: 'Оплачен', shipped: 'Отгружен', cancelled: 'Отменён' };
      const statusEl = document.querySelector('#formOrder select[name="status"]');
      if (!statusEl) return;
      $(statusEl).select2({
        theme: 'bootstrap4',
        dropdownParent: $(modalEl()),
        minimumResultsForSearch: Infinity,
        templateSelection: function (data) { const k = data.id || data.text; return ru[k] || data.text; },
        templateResult: function (data) { const k = data.id || data.text; return ru[k] || data.text; }
      });
      $(statusEl).val(statusEl.value || 'new').trigger('change');
    })();
    const tbody = document.querySelector('#tblOrderItems tbody');
    tbody.innerHTML = '';
    addItemRow();
    updateTotal();
    modal.show();
  }

  function addItemRow() {
    const tbody = document.querySelector('#tblOrderItems tbody');
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><select class="form-select select2 book"></select></td>
      <td><input type="number" class="form-control price" step="0.01" value="0"></td>
      <td><input type="number" class="form-control qty" value="1"></td>
      <td class="sum">0</td>
      <td><button class="btn btn-sm btn-outline-danger rm">x</button></td>`;
    tbody.appendChild(tr);
    const bookSelect = tr.querySelector('select.book');
    ajaxJSON('/api/books?page=1&pageSize=100').then(res => {
      bookSelect.innerHTML = res.data.map(b => `<option value="${b.id}" data-price="${b.price}">${b.title}</option>`).join('');
      $(bookSelect).select2({ theme: 'bootstrap4', dropdownParent: $(modalEl()) });
      const priceInput = tr.querySelector('input.price');
      priceInput.value = Number(bookSelect.selectedOptions[0].dataset.price || 0);
      recomputeRow(tr);
      updateTotal();
    });
    tr.addEventListener('input', () => { recomputeRow(tr); updateTotal(); });
    tr.querySelector('button.rm').addEventListener('click', () => { tr.remove(); updateTotal(); });
    tr.querySelector('select.book').addEventListener('change', (e) => {
      const price = Number(e.target.selectedOptions[0].dataset.price || 0);
      tr.querySelector('input.price').value = price;
      recomputeRow(tr); updateTotal();
    });
  }

  function recomputeRow(tr) {
    const price = Number(tr.querySelector('input.price').value || 0);
    const qty = Number(tr.querySelector('input.qty').value || 0);
    tr.querySelector('.sum').textContent = (price * qty).toFixed(2);
  }

  function updateTotal() {
    const tbody = document.querySelector('#tblOrderItems tbody');
    let total = 0;
    for (const tr of tbody.querySelectorAll('tr')) {
      total += Number(tr.querySelector('.sum').textContent || 0);
    }
    document.getElementById('orderTotal').textContent = total.toFixed(2);
  }

  function save() {
    const form = document.getElementById('formOrder');
    const items = [];
    for (const tr of document.querySelectorAll('#tblOrderItems tbody tr')) {
      items.push({
        book_id: Number(tr.querySelector('select.book').value),
        quantity: Number(tr.querySelector('input.qty').value),
        price: Number(tr.querySelector('input.price').value)
      });
    }
    ajaxJSON('/api/orders', { method: 'POST', body: { client_id: Number(form.client_id.value), status: form.status.value, items } })
      .then(() => { toast('Заказ создан'); modal.hide(); load(); })
      .catch(err => toast(err.message, 'danger'));
  }

  function bind() {
    document.getElementById('btnAddOrder')?.addEventListener('click', openModal);
    document.getElementById('btnAddItem')?.addEventListener('click', addItemRow);
    document.getElementById('btnSaveOrder')?.addEventListener('click', save);
    const ordersTable = document.getElementById('tblOrders');
    ordersTable?.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      if (btn.dataset.view) {
        const orderId = Number(btn.dataset.view);
        const modalEl = document.getElementById('modalOrderItems');
        // Close any other open modals and clean backdrops before showing
        document.querySelectorAll('.modal.show').forEach(el => {
          const inst = bootstrap.Modal.getInstance(el);
          if (inst) inst.hide();
        });
        cleanupModalArtifacts();
        const modal = new bootstrap.Modal(modalEl, { backdrop: true, keyboard: true });
        document.getElementById('orderItemsId').textContent = String(orderId);
        const tbody = document.querySelector('#tblOrderViewItems tbody');
        tbody.innerHTML = `<tr><td colspan="4">Загрузка...</td></tr>`;
        modal.show();
        ajaxJSON(`/api/orders/${orderId}/items`).then(res => {
          const rows = res.data || [];
          tbody.innerHTML = rows.length ? rows.map(r => `
            <tr>
              <td>${r.title}</td>
              <td>${r.quantity}</td>
              <td>${r.price}</td>
              <td>${(r.price * r.quantity).toFixed(2)}</td>
            </tr>`).join('') : `<tr><td colspan="4">Пусто</td></tr>`;
        }).catch(err => { tbody.innerHTML = `<tr><td colspan="4" class="text-danger">${err.message}</td></tr>`; });
        modalEl.addEventListener('hidden.bs.modal', () => {
          cleanupModalArtifacts();
        }, { once: true });
      }
    });
  }

  return { init() { bind(); load(); } };
})();

window.UserPage = (function() {
  const state = { page: 1, pageSize: 10 };
  const tBody = () => document.querySelector('#tblUsers tbody');
  const pager = () => document.querySelector('#usersPager');
  const modalEl = () => document.getElementById('modalUser');
  let modal;

  function load() {
    const params = new URLSearchParams({ page: state.page, pageSize: state.pageSize });
    ajaxJSON(`/api/users?${params}`).then(res => {
      const rows = res.data || [];
      tBody().innerHTML = rows.map(r => `
        <tr>
          <td>${r.id}</td>
          <td>${r.login}</td>
          <td>${r.role}</td>
          <td>${r.created_at}</td>
          <td class="text-end">
            <button class="btn btn-sm btn-outline-primary me-2" data-edit='${JSON.stringify(r)}'>Редактировать</button>
            <button class="btn btn-sm btn-outline-danger" data-del='${r.id}'>Удалить</button>
          </td>
        </tr>`).join('');
      setupPager(pager(), state, load);
    }).catch(err => toast(err.message, 'danger'));
  }

  function openModal(data) {
    const form = document.getElementById('formUser');
    form.reset();
    form.id.value = data?.id || '';
    form.login.value = data?.login || '';
    form.role.value = data?.role || 'client';
    modal = new bootstrap.Modal(modalEl());
    modal.show();
  }

  function save() {
    const form = document.getElementById('formUser');
    const id = form.id.value;
    const payload = { login: form.login.value, password: form.password.value, role: form.role.value };
    const req = id ? ajaxJSON(`/api/users/${id}`, { method: 'PUT', body: payload }) : ajaxJSON('/api/users', { method: 'POST', body: payload });
    req.then(() => { toast('Сохранено'); modal.hide(); load(); }).catch(err => toast(err.message, 'danger'));
  }

  function bind() {
    document.getElementById('btnAddUser')?.addEventListener('click', () => openModal());
    document.getElementById('btnSaveUser')?.addEventListener('click', save);
    tBody().addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      if (btn.dataset.edit) openModal(JSON.parse(btn.dataset.edit));
      if (btn.dataset.del) ajaxJSON(`/api/users/${btn.dataset.del}`, { method: 'DELETE' }).then(() => { toast('Удалено'); load(); }).catch(err => toast(err.message, 'danger'));
    });
  }

  return { init() { bind(); load(); } };
})();

window.CartPage = (function() {
  function load() {
    ajaxJSON('/api/cart').then(res => {
      const rows = res.data || [];
      const tbody = document.querySelector('#tblCart tbody');
      tbody.innerHTML = rows.map(r => `
        <tr>
          <td>${r.title}</td>
          <td>${r.price}</td>
          <td>${r.quantity}</td>
          <td>${(r.price * r.quantity).toFixed(2)}</td>
          <td class="text-end"><button class="btn btn-sm btn-outline-danger" data-del='${r.book_id}'>Удалить</button></td>
        </tr>`).join('');
      const total = rows.reduce((s, r) => s + r.price * r.quantity, 0);
      document.getElementById('cartTotal').textContent = total.toFixed(2);
    });
  }
  function bind() {
    document.querySelector('#tblCart tbody').addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (btn?.dataset.del) ajaxJSON(`/api/cart/${btn.dataset.del}`, { method: 'DELETE' }).then(() => { toast('Удалено'); load(); });
    });
    document.getElementById('btnCheckout')?.addEventListener('click', () => {
      ajaxJSON('/api/cart/checkout', { method: 'POST', body: {} })
        .then((data) => {
          toast(`Заказ #${data.id} оформлен`, 'success');
          setTimeout(() => { window.location.href = '/books'; }, 800);
        })
        .catch(err => toast(err.message, 'danger'));
    });
  }
  return { init() { bind(); load(); } };
})();

// Expose role for conditional controls
window.currentUserRole = (function() {
  const el = document.querySelector('span.navbar-text');
  if (!el) return null;
  const text = el.textContent || '';
  const m = text.match(/\((admin|worker|client)\)/);
  return m ? m[1] : null;
})();

