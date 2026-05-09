/**
 * auth.js – FinançasPro
 * Gerencia login, registro e validação de formulários
 */

/* ── Redireciona se já logado ── */
if (DB.getCurrentUser()) {
  window.location.href = 'dashboard.html';
}

/* ── TABS ── */
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active-form'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab + '-form').classList.add('active-form');
    hideAlert();
  });
});

/* ── ALERT ── */
function showAlert(msg, type = 'error') {
  const box = document.getElementById('alert-box');
  box.textContent = msg;
  box.className   = `alert ${type}`;
  box.classList.remove('hidden');
}
function hideAlert() {
  document.getElementById('alert-box').classList.add('hidden');
}

/* ── TOGGLE PASSWORD ── */
function togglePass(id, btn) {
  const el = document.getElementById(id);
  el.type  = el.type === 'password' ? 'text' : 'password';
  btn.textContent = el.type === 'password' ? '👁' : '🙈';
}
window.togglePass = togglePass;

/* ── PASSWORD STRENGTH ── */
document.getElementById('reg-password')?.addEventListener('input', function() {
  const val  = this.value;
  const fill = document.querySelector('#strength-bar .fill');
  const lbl  = document.getElementById('strength-label');

  let score = 0;
  if (val.length >= 8)  score++;
  if (/[A-Z]/.test(val)) score++;
  if (/[0-9]/.test(val)) score++;
  if (/[^A-Za-z0-9]/.test(val)) score++;

  const levels = [
    { pct: '0%',   color: 'transparent', label: '' },
    { pct: '25%',  color: '#f05060',     label: 'Fraca' },
    { pct: '50%',  color: '#f0a060',     label: 'Razoável' },
    { pct: '75%',  color: '#f0e060',     label: 'Boa' },
    { pct: '100%', color: '#60f0a0',     label: 'Forte ✓' },
  ];

  const lvl = levels[score];
  fill.style.width      = lvl.pct;
  fill.style.background = lvl.color;
  lbl.textContent       = lvl.label;
  lbl.style.color       = lvl.color;
});

/* ── SET LOADING ── */
function setLoading(btn, loading) {
  const span    = btn.querySelector('span');
  const spinner = btn.querySelector('.spinner');
  btn.disabled  = loading;
  span.classList.toggle('hidden', loading);
  spinner.classList.toggle('hidden', !loading);
}

/* ── LOGIN ── */
document.getElementById('login-form').addEventListener('submit', async e => {
  e.preventDefault();
  hideAlert();
  const btn   = document.getElementById('login-btn');
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-password').value;

  setLoading(btn, true);
  try {
    await DB.login({ email, password: pass });
    window.location.href = 'dashboard.html';
  } catch (err) {
    showAlert(err.message);
  } finally {
    setLoading(btn, false);
  }
});

/* ── REGISTER ── */
document.getElementById('register-form').addEventListener('submit', async e => {
  e.preventDefault();
  hideAlert();
  const btn     = document.getElementById('register-btn');
  const name    = document.getElementById('reg-name').value.trim();
  const email   = document.getElementById('reg-email').value.trim();
  const pass    = document.getElementById('reg-password').value;
  const confirm = document.getElementById('reg-confirm').value;

  if (pass !== confirm) { showAlert('As senhas não coincidem.'); return; }
  if (pass.length < 8)  { showAlert('Senha deve ter no mínimo 8 caracteres.'); return; }

  setLoading(btn, true);
  try {
    await DB.register({ name, email, password: pass });
    showAlert('Conta criada com sucesso! Faça login.', 'success');
    document.querySelector('[data-tab="login"]').click();
    document.getElementById('login-email').value = email;
  } catch (err) {
    showAlert(err.message);
  } finally {
    setLoading(btn, false);
  }
});
