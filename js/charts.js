/**
 * charts.js – FinançasPro
 * Todos os gráficos com Chart.js
 */

/* ── Paleta ── */
const C = {
  income:   '#60f0a0',
  expense:  '#f05060',
  accent:   '#c8f060',
  accent2:  '#60d4f0',
  muted:    '#6b7180',
  surface2: '#1a1e28',
  text:     '#e8eaf0',
};

Chart.defaults.color          = C.muted;
Chart.defaults.font.family    = "'DM Sans', sans-serif";
Chart.defaults.borderColor    = 'rgba(255,255,255,0.06)';
Chart.defaults.plugins.legend.labels.boxWidth = 12;

/* ── Registros de instâncias (evita duplicatas) ── */
const charts = {};
function getOrCreate(id, config) {
  if (charts[id]) { charts[id].destroy(); }
  const ctx = document.getElementById(id);
  if (!ctx) return;
  charts[id] = new Chart(ctx, config);
  return charts[id];
}

/* ═══════════════════════════════════════
   BAR CHART – Receita × Despesa
═══════════════════════════════════════ */
function renderBarChart(income, expense) {
  getOrCreate('barChart', {
    type: 'bar',
    data: {
      labels: ['Receita', 'Despesa', 'Lucro'],
      datasets: [{
        data: [income, expense, Math.max(income - expense, 0)],
        backgroundColor: [
          'rgba(96,240,160,0.75)',
          'rgba(240,80,96,0.75)',
          'rgba(200,240,96,0.75)',
        ],
        borderRadius: 8,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false } },
        y: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { callback: v => 'R$' + v.toLocaleString('pt-BR') }
        }
      }
    }
  });
}
window.renderBarChart = renderBarChart;

/* ═══════════════════════════════════════
   PIE CHART – Despesas por Categoria
═══════════════════════════════════════ */
function renderPieChart(txs) {
  const expenses = txs.filter(t => t.type === 'expense');
  const byCategory = {};
  expenses.forEach(t => {
    byCategory[t.category] = (byCategory[t.category] || 0) + t.amount;
  });

  const labels = Object.keys(byCategory);
  const data   = Object.values(byCategory);
  const colors = [
    '#c8f060','#60d4f0','#f05060','#f0c060','#a060f0',
    '#60f0a0','#f06090','#60a0f0','#f0a060','#80f060'
  ];

  getOrCreate('pieChart', {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors.slice(0, labels.length),
        borderWidth: 2,
        borderColor: '#12151c',
        hoverOffset: 8,
      }]
    },
    options: {
      responsive: true,
      cutout: '62%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { padding: 14, color: C.text, font: { size: 12 } }
        },
        tooltip: {
          callbacks: {
            label: ctx => ` R$ ${ctx.parsed.toLocaleString('pt-BR', {minimumFractionDigits:2})}`
          }
        }
      }
    }
  });
}
window.renderPieChart = renderPieChart;

/* ═══════════════════════════════════════
   CASHFLOW CHART – Projeção 6 meses
═══════════════════════════════════════ */
function renderCashflowChart(txs) {
  const now = new Date();
  const months = [];
  const incomes  = [];
  const expenses = [];
  const balances = [];

  // Agrupa histórico por mês (últimos 3)
  for (let i = -2; i <= 0; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const key = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
    months.push(d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }));
    const inc = txs.filter(t => t.type === 'income'  && t.date.startsWith(key)).reduce((s,t) => s+t.amount, 0);
    const exp = txs.filter(t => t.type === 'expense' && t.date.startsWith(key)).reduce((s,t) => s+t.amount, 0);
    incomes.push(inc);
    expenses.push(exp);
    balances.push(inc - exp);
  }

  // Média para projeção (próximos 3 meses)
  const avgInc = incomes.reduce((s,v) => s+v, 0) / 3 || 0;
  const avgExp = expenses.reduce((s,v) => s+v, 0) / 3 || 0;
  let runningBal = balances[balances.length - 1] || 0;

  for (let i = 1; i <= 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    months.push(d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }) + ' *');
    incomes.push(avgInc);
    expenses.push(avgExp);
    runningBal += avgInc - avgExp;
    balances.push(runningBal);
  }

  getOrCreate('cashflowChart', {
    type: 'line',
    data: {
      labels: months,
      datasets: [
        {
          label: 'Receita',
          data: incomes,
          borderColor: C.income,
          backgroundColor: 'rgba(96,240,160,0.08)',
          fill: true,
          tension: 0.4,
          borderWidth: 2,
          pointBackgroundColor: C.income,
          pointRadius: 4,
        },
        {
          label: 'Despesa',
          data: expenses,
          borderColor: C.expense,
          backgroundColor: 'rgba(240,80,96,0.08)',
          fill: true,
          tension: 0.4,
          borderWidth: 2,
          pointBackgroundColor: C.expense,
          pointRadius: 4,
        },
        {
          label: 'Saldo',
          data: balances,
          borderColor: C.accent,
          borderDash: [6,3],
          tension: 0.4,
          borderWidth: 2,
          pointBackgroundColor: C.accent,
          pointRadius: 4,
        }
      ]
    },
    options: {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: R$ ${ctx.parsed.y.toLocaleString('pt-BR',{minimumFractionDigits:2})}`
          }
        }
      },
      scales: {
        x: { grid: { display: false } },
        y: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { callback: v => 'R$' + (v/1000).toFixed(1) + 'k' }
        }
      }
    }
  });
}
window.renderCashflowChart = renderCashflowChart;

/* ═══════════════════════════════════════
   COST TYPE CHART – Fixo × Variável
═══════════════════════════════════════ */
function renderCostTypeChart(fixedAmt, varAmt) {
  const total = fixedAmt + varAmt || 1;
  getOrCreate('costTypeChart', {
    type: 'bar',
    data: {
      labels: ['Custo Fixo', 'Custo Variável'],
      datasets: [{
        data: [fixedAmt, varAmt],
        backgroundColor: ['rgba(96,212,240,0.7)', 'rgba(240,192,96,0.7)'],
        borderRadius: 8,
        borderSkipped: false,
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` R$ ${ctx.parsed.x.toLocaleString('pt-BR',{minimumFractionDigits:2})} (${(ctx.parsed.x/total*100).toFixed(1)}%)`
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { callback: v => 'R$' + v.toLocaleString('pt-BR') }
        },
        y: { grid: { display: false } }
      }
    }
  });
}
window.renderCostTypeChart = renderCostTypeChart;
