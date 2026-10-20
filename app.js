const STORAGE_KEY = 'moi-finansy.transactions.v1';
const SETTINGS_KEY = 'moi-finansy.settings.v1';
const CATEGORIES_KEY = 'moi-finansy.categories.v1';

const defaultCategories = {
  expense: [
    ['Продукты', '🛒'], ['Кафе и рестораны', '☕'], ['Транспорт', '🚌'], ['Жильё', '⌂'],
    ['Здоровье', '✚'], ['Одежда', '◈'], ['Развлечения', '◉'], ['Подписки', '◌'], ['Другое', '•']
  ],
  income: [['Зарплата', '▣'], ['Подработка', '⚡'], ['Подарок', '✦'], ['Инвестиции', '↗'], ['Другое', '•']]
};
const palette = ['#e96e45','#f2b84b','#4ca37e','#4d8cbc','#9b7bd4','#e78cb8','#8294a0','#c9c2b4','#6f7d9a'];
let transactions = loadTransactions();
let categories = loadCategories();
let selectedMonth = currentMonth();
let currentType = 'expense';

const $ = (selector) => document.querySelector(selector);
const monthSelect = $('#monthSelect');
const modal = $('#transactionModal');

monthSelect.value = selectedMonth;
$('#transactionDate').value = today();

function loadTransactions() {
  try { const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)); return Array.isArray(saved) ? saved : []; }
  catch { return []; }
}
function loadCategories() {
  try {
    const custom = JSON.parse(localStorage.getItem(CATEGORIES_KEY));
    return { expense: [...defaultCategories.expense, ...(Array.isArray(custom?.expense) ? custom.expense : [])], income: [...defaultCategories.income, ...(Array.isArray(custom?.income) ? custom.income : [])] };
  } catch { return { expense: [...defaultCategories.expense], income: [...defaultCategories.income] }; }
}
function saveCustomCategories() {
  localStorage.setItem(CATEGORIES_KEY, JSON.stringify({ expense: categories.expense.filter(([name]) => !defaultCategories.expense.some(([base]) => base === name)), income: categories.income.filter(([name]) => !defaultCategories.income.some(([base]) => base === name)) }));
}
function saveTransactions() { localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions)); }
function today() { return new Date().toISOString().slice(0, 10); }
function currentMonth() { return today().slice(0, 7); }
function rubles(value) { return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(value || 0) + ' ₽'; }
function friendlyDate(date) { return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(new Date(date + 'T12:00:00')); }
function monthName(value) { return new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' }).format(new Date(value + '-01T12:00:00')); }
function iconFor(type, category) { return (categories[type].find(([name]) => name === category) || ['','•'])[1]; }
function inSelectedMonth(item) { return item.date.startsWith(selectedMonth); }
function escapeHtml(text) { const div = document.createElement('div'); div.textContent = text || ''; return div.innerHTML; }

function populateCategories() {
  const select = $('#transactionCategory');
  select.innerHTML = categories[currentType].map(([name, icon]) => `<option value="${name}">${icon} ${name}</option>`).join('');
}
function filteredTransactions() {
  const type = $('#typeFilter').value;
  const category = $('#categoryFilter').value;
  const from = $('#dateFromFilter').value;
  const to = $('#dateToFilter').value;
  return transactions.filter(item => inSelectedMonth(item) && (!from || item.date >= from) && (!to || item.date <= to) && (type === 'all' || item.type === type) && (category === 'all' || item.category === category));
}
function renderSummary() {
  const monthly = transactions.filter(inSelectedMonth);
  const income = monthly.filter(x => x.type === 'income').reduce((sum, x) => sum + x.amount, 0);
  const expense = monthly.filter(x => x.type === 'expense').reduce((sum, x) => sum + x.amount, 0);
  $('#monthBalance').textContent = rubles(income - expense);
  $('#incomeTotal').textContent = rubles(income);
  $('#expenseTotal').textContent = rubles(expense);
  $('#incomeCount').textContent = countText(monthly.filter(x => x.type === 'income').length, 'доход');
  $('#expenseCount').textContent = countText(monthly.filter(x => x.type === 'expense').length, 'расход');
  $('#monthBalanceDetail').textContent = income || expense ? 'Доходы − расходы' : 'Добавьте первую операцию';
  $('#expensePeriodLabel').textContent = capitalize(monthName(selectedMonth));
}
function countText(count, noun) {
  if (!count) return 'Нет операций';
  const word = noun === 'доход' ? (count === 1 ? 'доход' : count < 5 ? 'дохода' : 'доходов') : (count === 1 ? 'расход' : count < 5 ? 'расхода' : 'расходов');
  return `${count} ${word}`;
}
function capitalize(value) { return value.charAt(0).toUpperCase() + value.slice(1); }
function renderChart() {
  const expenses = transactions.filter(x => inSelectedMonth(x) && x.type === 'expense');
  const grouped = expenses.reduce((result, item) => ({ ...result, [item.category]: (result[item.category] || 0) + item.amount }), {});
  const entries = Object.entries(grouped).sort((a,b) => b[1] - a[1]);
  const total = expenses.reduce((sum, x) => sum + x.amount, 0);
  $('#donutTotal').textContent = rubles(total);
  const chart = $('#donutChart');
  const legend = $('#categoryLegend');
  if (!entries.length) {
    chart.style.background = 'conic-gradient(#e9e7e0 0 100%)';
    legend.innerHTML = '<li class="muted">Здесь появится распределение расходов по категориям.</li>';
    return;
  }
  let cursor = 0;
  const segments = entries.map(([category, amount], index) => { const from = cursor; cursor += amount / total * 100; return `${palette[index % palette.length]} ${from}% ${cursor}%`; });
  chart.style.background = `conic-gradient(${segments.join(',')})`;
  legend.innerHTML = entries.slice(0, 6).map(([category, amount], index) => `<li><i class="legend-dot" style="background:${palette[index % palette.length]}"></i><span class="legend-name">${escapeHtml(category)}</span><span class="legend-value">${rubles(amount)}</span></li>`).join('');
}
function renderList(target, list, limit) {
  const container = $(target);
  const visible = [...list].sort((a,b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt).slice(0, limit || list.length);
  if (!visible.length) { container.innerHTML = '<div class="empty-state"><div><span>◌</span><br>Пока здесь пусто.<br>Добавьте первую операцию — и всё станет наглядно.</div></div>'; return; }
  const template = $('#transactionTemplate');
  container.replaceChildren(...visible.map(item => {
    const node = template.content.firstElementChild.cloneNode(true);
    node.querySelector('.transaction-icon').textContent = iconFor(item.type, item.category);
    node.querySelector('.transaction-icon').style.background = item.type === 'income' ? '#e6f7f1' : '#ffedef';
    node.querySelector('.transaction-category').textContent = item.category;
    node.querySelector('.transaction-note').textContent = item.note || (item.type === 'income' ? 'Доход' : 'Расход');
    node.querySelector('.transaction-date').textContent = friendlyDate(item.date);
    const amount = node.querySelector('.transaction-amount');
    amount.textContent = `${item.type === 'income' ? '+' : '−'} ${rubles(item.amount)}`;
    amount.classList.add(item.type);
    node.querySelector('.delete-button').addEventListener('click', () => deleteTransaction(item.id));
    return node;
  }));
}
function refreshCategoryFilter() {
  const filter = $('#categoryFilter'); const selected = filter.value;
  const used = [...new Set(transactions.filter(inSelectedMonth).map(x => x.category))].sort();
  filter.innerHTML = '<option value="all">Все категории</option>' + used.map(x => `<option value="${escapeHtml(x)}">${escapeHtml(x)}</option>`).join('');
  filter.value = used.includes(selected) ? selected : 'all';
}
function renderCustomCategories() {
  const custom = ['expense', 'income'].flatMap(type => categories[type].filter(([name]) => !defaultCategories[type].some(([base]) => base === name)).map(([name, icon]) => ({ type, name, icon })));
  const container = $('#customCategories');
  if (!custom.length) { container.innerHTML = '<p class="no-custom-categories">Пока нет своих категорий. Добавьте первую выше.</p>'; return; }
  container.innerHTML = custom.map(item => `<div class="custom-category"><span>${item.icon}</span><span>${escapeHtml(item.name)}</span><span class="category-badge">${item.type === 'expense' ? 'расход' : 'доход'}</span><button class="category-delete" type="button" data-type="${item.type}" data-name="${encodeURIComponent(item.name)}" title="Удалить категорию">×</button></div>`).join('');
}
function render() { renderSummary(); renderChart(); refreshCategoryFilter(); renderCustomCategories(); renderList('#recentTransactions', transactions.filter(inSelectedMonth), 5); renderList('#allTransactions', filteredTransactions()); }
function deleteTransaction(id) { transactions = transactions.filter(item => item.id !== id); saveTransactions(); render(); }

$('#openTransactionModal').addEventListener('click', () => { $('#transactionDate').value = today(); populateCategories(); modal.showModal(); });
$('#closeModal').addEventListener('click', () => modal.close());
$('.type-switch').addEventListener('click', (event) => {
  const button = event.target.closest('button[data-type]'); if (!button) return;
  currentType = button.dataset.type; $('#transactionType').value = currentType;
  document.querySelectorAll('.type-switch button').forEach(x => x.classList.toggle('active', x === button)); populateCategories();
});
$('#transactionForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget); const amount = Number(form.get('amount'));
  if (!Number.isFinite(amount) || amount <= 0) return;
  transactions.push({ id: crypto.randomUUID(), type: form.get('type'), amount, category: form.get('category'), date: form.get('date'), note: String(form.get('note')).trim(), createdAt: Date.now() });
  saveTransactions(); modal.close(); event.currentTarget.reset(); $('#transactionType').value = currentType; render();
});
monthSelect.addEventListener('change', () => { selectedMonth = monthSelect.value || currentMonth(); render(); });
$('#typeFilter').addEventListener('change', render); $('#categoryFilter').addEventListener('change', () => renderList('#allTransactions', filteredTransactions()));
$('#dateFromFilter').addEventListener('change', () => renderList('#allTransactions', filteredTransactions()));
$('#dateToFilter').addEventListener('change', () => renderList('#allTransactions', filteredTransactions()));
$('#clearFilters').addEventListener('click', () => { $('#typeFilter').value = 'all'; $('#categoryFilter').value = 'all'; $('#dateFromFilter').value = ''; $('#dateToFilter').value = ''; render(); });
$('#openCategoriesModal').addEventListener('click', () => { renderCustomCategories(); $('#categoryModal').showModal(); });
$('#closeCategoryModal').addEventListener('click', () => $('#categoryModal').close());
$('#categoryForm').addEventListener('submit', (event) => { event.preventDefault(); const type = $('#newCategoryType').value; const input = $('#newCategoryName'); const name = input.value.trim().replace(/\s+/g, ' '); if (!name) return; if (categories[type].some(([known]) => known.toLocaleLowerCase('ru') === name.toLocaleLowerCase('ru'))) { alert('Такая категория уже есть.'); return; } categories[type].push([name, '●']); saveCustomCategories(); input.value = ''; populateCategories(); render(); });
$('#customCategories').addEventListener('click', (event) => { const button = event.target.closest('.category-delete'); if (!button) return; const type = button.dataset.type; const name = decodeURIComponent(button.dataset.name); const linked = transactions.filter(item => item.type === type && item.category === name).length; if (linked && !confirm(`В этой категории ${linked} записей. Удалить категорию? Сами записи сохранятся.`)) return; categories[type] = categories[type].filter(([item]) => item !== name); saveCustomCategories(); populateCategories(); render(); });
$('#showAllButton').addEventListener('click', () => $('#transactionsSection').scrollIntoView({ behavior: 'smooth', block: 'start' }));
$('#themeToggle').addEventListener('click', () => { document.body.classList.toggle('dark'); localStorage.setItem(SETTINGS_KEY, JSON.stringify({ dark: document.body.classList.contains('dark') })); });
$('#exportButton').addEventListener('click', () => { const blob = new Blob([JSON.stringify({ app: 'Мои финансы', exportedAt: new Date().toISOString(), transactions }, null, 2)], { type: 'application/json' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `moi-finansy-${today()}.json`; link.click(); URL.revokeObjectURL(link.href); });
$('#importInput').addEventListener('change', async (event) => { const file = event.target.files[0]; if (!file) return; try { const data = JSON.parse(await file.text()); if (!Array.isArray(data.transactions)) throw new Error(); if (!confirm(`Заменить текущие записи резервной копией (${data.transactions.length} операций)?`)) return; transactions = data.transactions.filter(x => x && ['income','expense'].includes(x.type) && Number(x.amount) > 0 && x.date && x.category).map(x => ({ ...x, id: x.id || crypto.randomUUID(), amount: Number(x.amount), createdAt: x.createdAt || Date.now() })); saveTransactions(); render(); } catch { alert('Не удалось прочитать файл. Выберите резервную копию, созданную в этом приложении.'); } finally { event.target.value = ''; } });
try { if (JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}').dark) document.body.classList.add('dark'); } catch {}
populateCategories(); render();
