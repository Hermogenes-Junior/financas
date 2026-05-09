/**
 * dashboard.js – FinançasPro
 * Lógica principal do dashboard
 */

/* ── GUARD: redireciona se não logado ── */
const currentUser = DB.getCurrentUser();
if (!currentUser) { window.location.href = 'login.html'; }

/* ── USER INFO ── */
document.getElementById('user-name').textContent   = currentUser.name;
document.getElementById('user-avatar').textContent = currentUser.name[0].toUpperCase();

/* ── FORMAT ── */
const fmt = v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
const fmtDate = d => new Date(d + 'T00:00:00').toLocaleDateString('pt-BR');

/* ── LOGOUT ── */
function doLogout() { DB.logout(); window.location.href = 'login.html'; }
document.getElementById('logout-btn').addEventListener('click', doLogout);
document.getElementById('logout-btn-mobile').addEventListener('click', doLogout);

/* ── MOBILE SIDEBAR ── */
const sidebar  = document.getElementById('sidebar');
const overlay  = document.getElementById('overlay');
const hamburger = document.getElementById('hamburger');

hamburger.addEventListener('click', () => {
  sidebar.classList.toggle('open');
  overlay.classList.toggle('active');
});
overlay.addEventListener('click', () => {
  sidebar.classList.remove('open');
  overlay.classList.remove('active');
});

/* ── NAVIGATION ── */
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', e => {
    e.preventDefault();
    const view = item.dataset.view;
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    item.classList.add('active');
    showView(view);
    sidebar.classList.remove('open');
    overlay.classList.remove('active');
  });
});

function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active-view'));
  document.getElementById('view-' + name).classList.add('active-view');
  if (name === 'overview')      renderOverview();
  if (name === 'transactions')  renderTransactions();
  if (name === 'cashflow')      renderCashflow();
  if (name === 'reports')       renderReports();
}

/* ── MODAL ── */
const modal        = document.getElementById('modal-overlay');
const txForm       = document.getElementById('tx-form');
const modalTitle   = document.getElementById('modal-title');

function openModal(tx = null) {
  txForm.reset();
  document.getElementById('tx-id').value = '';
  document.getElementById('tx-date').value = new Date().toISOString().slice(0,10);

  if (tx) {
    modalTitle.textContent = 'Editar Transação';
    document.getElementById('tx-id').value          = tx.id;
    document.getElementById('tx-description').value = tx.description;
    document.getElementById('tx-amount').value       = tx.amount;
    document.getElementById('tx-type').value         = tx.type;
    document.getElementById('tx-category').value     = tx.category;
    document.getElementById('tx-costtype').value     = tx.costType;
    document.getElementById('tx-date').value         = tx.date;
    document.getElementById('tx-note').value         = tx.note || '';
  } else {
    modalTitle.textContent = 'Nova Transação';
  }
  modal.classList.add('open');
}
function closeModal() { modal.classList.remove('open'); }

document.getElementById('btn-open-modal').addEventListener('click', () => openModal());
document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('modal-cancel').addEventListener('click', closeModal);
modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

/* ── SAVE TRANSACTION ── */
txForm.addEventListener('submit', async e => {
  e.preventDefault();
  const id = document.getElementById('tx-id').value;
  const payload = {
    description: document.getElementById('tx-description').value,
    amount:      document.getElementById('tx-amount').value,
    type:        document.getElementById('tx-type').value,
    category:    document.getElementById('tx-category').value || 'Outros',
    costType:    document.getElementById('tx-costtype').value,
    date:        document.getElementById('tx-date').value,
    note:        document.getElementById('tx-note').value,
  };

  try {
    if (id) { await DB.updateTransaction(id, payload); }
    else    { await DB.addTransaction(payload); }
    closeModal();
    renderTransactions();
    renderOverview();
  } catch (err) {
    alert('Erro: ' + err.message);
  }
});

/* ── PERIOD FILTER ── */
let currentPeriod = 'thisMonth';
document.getElementById('period-filter').addEventListener('change', function() {
  currentPeriod = this.value;
  renderOverview();
});

/* ═══════════════════════════════════════
   RENDER: OVERVIEW
═══════════════════════════════════════ */
async function renderOverview() {
  const txs = await DB.getTransactions({ period: currentPeriod });

  const totalIncome  = txs.filter(t => t.type === 'income').reduce((s,t) => s + t.amount, 0);
  const totalExpense = txs.filter(t => t.type === 'expense').reduce((s,t) => s + t.amount, 0);
  const netProfit    = totalIncome - totalExpense;
  const fixedCost    = txs.filter(t => t.type === 'expense' && t.costType === 'fixed').reduce((s,t) => s + t.amount, 0);

  document.getElementById('total-income').textContent  = fmt(totalIncome);
  document.getElementById('total-expense').textContent = fmt(totalExpense);
  document.getElementById('net-profit').textContent    = fmt(netProfit);
  document.getElementById('fixed-cost').textContent    = fmt(fixedCost);
  document.getElementById('income-count').textContent  = txs.filter(t => t.type === 'income').length + ' entradas';
  document.getElementById('expense-count').textContent = txs.filter(t => t.type === 'expense').length + ' saídas';

  const badge = document.getElementById('profit-badge');
  const margin = totalIncome > 0 ? ((netProfit / totalIncome) * 100).toFixed(1) : '0.0';
  badge.textContent = margin + '% margem';
  badge.style.color = netProfit >= 0 ? 'var(--income)' : 'var(--danger)';

  renderBarChart(totalIncome, totalExpense);
  renderPieChart(txs);
}

/* ═══════════════════════════════════════
   RENDER: TRANSACTIONS
═══════════════════════════════════════ */
async function renderTransactions() {
  const type     = document.getElementById('filter-type').value;
  const costType = document.getElementById('filter-cost').value;
  const search   = document.getElementById('search-tx').value;

  const txs  = await DB.getTransactions({ type, costType, search });
  const list = document.getElementById('tx-list');

  if (txs.length === 0) {
    list.innerHTML = `<div class="empty-state">Nenhuma transação encontrada.<br/>Clique em <strong>+ Nova</strong> para começar.</div>`;
    return;
  }

  list.innerHTML = txs.map(t => `
    <div class="tx-item">
      <div class="tx-dot ${t.type}"></div>
      <div class="tx-info">
        <div class="tx-desc">${escHtml(t.description)}</div>
        <div class="tx-meta">${fmtDate(t.date)} · ${escHtml(t.category)}</div>
      </div>
      <span class="tx-tag ${t.costType === 'fixed' ? 'fixed' : ''}">${t.costType === 'fixed' ? 'Fixo' : 'Variável'}</span>
      <div class="tx-amount ${t.type}">${t.type === 'income' ? '+' : '-'}${fmt(t.amount)}</div>
      <div class="tx-actions">
        <button class="tx-btn" onclick="editTx('${t.id}')">✎</button>
        <button class="tx-btn del" onclick="delTx('${t.id}')">✕</button>
      </div>
    </div>
  `).join('');
}

/* search/filter triggers */
['search-tx','filter-type','filter-cost'].forEach(id => {
  document.getElementById(id).addEventListener('input', renderTransactions);
  document.getElementById(id).addEventListener('change', renderTransactions);
});

/* edit/delete exposed globally */
window.editTx = async (id) => {
  const txs = await DB.getTransactions();
  const tx  = txs.find(t => t.id === id);
  if (tx) openModal(tx);
};
window.delTx = async (id) => {
  if (!confirm('Excluir esta transação?')) return;
  await DB.deleteTransaction(id);
  renderTransactions();
  renderOverview();
};

/* ═══════════════════════════════════════
   RENDER: CASHFLOW
═══════════════════════════════════════ */
async function renderCashflow() {
  const txs = await DB.getTransactions();

  const totalInc = txs.filter(t => t.type === 'income').reduce((s,t) => s + t.amount, 0);
  const totalExp = txs.filter(t => t.type === 'expense').reduce((s,t) => s + t.amount, 0);
  const balance  = totalInc - totalExp;
  const fixedExp = txs.filter(t => t.type === 'expense' && t.costType === 'fixed').reduce((s,t) => s + t.amount, 0);
  const varExp   = txs.filter(t => t.type === 'expense' && t.costType === 'variable').reduce((s,t) => s + t.amount, 0);

  document.getElementById('cashflow-summary').innerHTML = `
    <div class="cf-item"><div class="cf-label">Total Entradas</div><div class="cf-val" style="color:var(--income)">${fmt(totalInc)}</div></div>
    <div class="cf-item"><div class="cf-label">Total Saídas</div><div class="cf-val" style="color:var(--danger)">${fmt(totalExp)}</div></div>
    <div class="cf-item"><div class="cf-label">Saldo</div><div class="cf-val" style="color:${balance>=0?'var(--accent)':'var(--danger)'}">${fmt(balance)}</div></div>
  `;

  renderCashflowChart(txs);
  renderCostTypeChart(fixedExp, varExp);
}

/* ═══════════════════════════════════════
   RENDER: REPORTS
═══════════════════════════════════════ */
async function renderReports() {
  const txs  = await DB.getTransactions();
  const tbody = document.getElementById('report-tbody');

  if (txs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--muted)">Sem transações registradas.</td></tr>`;
    return;
  }

  tbody.innerHTML = txs.map(t => `
    <tr>
      <td>${fmtDate(t.date)}</td>
      <td>${escHtml(t.description)}</td>
      <td>${escHtml(t.category)}</td>
      <td><span class="badge ${t.type}">${t.type === 'income' ? 'Receita' : 'Despesa'}</span></td>
      <td><span class="badge ${t.costType}">${t.costType === 'fixed' ? 'Fixo' : 'Variável'}</span></td>
      <td style="color:${t.type==='income'?'var(--income)':'var(--danger)'}">
        ${t.type==='income'?'+':'-'}${fmt(t.amount)}
      </td>
    </tr>
  `).join('');
}

/* ── EXPORT CSV ── */
document.getElementById('btn-export-csv').addEventListener('click', async () => {
  const txs = await DB.getTransactions();
  const rows = [['Data','Descrição','Categoria','Tipo','Custo','Valor']];
  txs.forEach(t => {
    rows.push([t.date, t.description, t.category, t.type === 'income' ? 'Receita' : 'Despesa',
      t.costType === 'fixed' ? 'Fixo' : 'Variável', t.amount.toFixed(2)]);
  });
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const a   = document.createElement('a');
  a.href    = 'data:text/csv;charset=utf-8,' + encodeURIComponent('\uFEFF' + csv);
  a.download = `financaspro_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
});

/* ── UTILS ── */
function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ── INITIAL RENDER ── */
renderOverview();
