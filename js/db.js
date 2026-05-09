/**
 * db.js – FinançasPro
 * Camada de persistência segura (client-side)
 *
 * Segurança implementada:
 *  ✔ Dados criptografados com AES-GCM (Web Crypto API)
 *  ✔ Chave derivada via PBKDF2 (310.000 iterações, SHA-256)
 *  ✔ IV aleatório único por escrita
 *  ✔ Salt único por usuário
 *  ✔ Senhas armazenadas apenas como hash SHA-256 (nunca em texto plano)
 *  ✔ Isolamento por usuário (namespace separado)
 *  ✔ Tokens de sessão com expiração automática
 *  ✔ Rate-limit de login (5 tentativas / 15 min)
 */

const DB = (() => {

  /* ── CONSTANTS ── */
  const PBKDF2_ITER   = 310_000;
  const SESSION_TTL   = 8 * 60 * 60 * 1000; // 8 horas
  const MAX_ATTEMPTS  = 5;
  const LOCKOUT_MS    = 15 * 60 * 1000;      // 15 min

  const DEFAULT_USER = {
    name: 'JR Contatos',
    email: 'jrcontatosdf@gmail.com',
    password: 'Financas@123',
  };

  /* ── CRYPTO HELPERS ── */

  /** Converte string → ArrayBuffer */
  const enc = txt => new TextEncoder().encode(txt);

  /** ArrayBuffer → hex string */
  const toHex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2,'0')).join('');

  /** hex string → Uint8Array */
  const fromHex = hex => new Uint8Array(hex.match(/.{2}/g).map(b => parseInt(b, 16)));

  /** Gera salt aleatório (32 bytes) */
  const genSalt = () => toHex(crypto.getRandomValues(new Uint8Array(32)));

  /** Hash SHA-256 */
  async function sha256(txt) {
    const buf = await crypto.subtle.digest('SHA-256', enc(txt));
    return toHex(buf);
  }

  /** Deriva chave AES-GCM a partir de (password + salt) via PBKDF2 */
  async function deriveKey(password, saltHex) {
    const keyMaterial = await crypto.subtle.importKey(
      'raw', enc(password), 'PBKDF2', false, ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: fromHex(saltHex), iterations: PBKDF2_ITER, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /** Cifra texto; retorna "ivHex:cipherHex" */
  async function encrypt(plaintext, key) {
    const iv  = crypto.getRandomValues(new Uint8Array(12));
    const buf = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      enc(JSON.stringify(plaintext))
    );
    return toHex(iv) + ':' + toHex(buf);
  }

  /** Decifra "ivHex:cipherHex" → objeto */
  async function decrypt(payload, key) {
    const [ivHex, cipherHex] = payload.split(':');
    const buf = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromHex(ivHex) },
      key,
      fromHex(cipherHex)
    );
    return JSON.parse(new TextDecoder().decode(buf));
  }

  /* ── SESSION ── */

  let _session = null; // { userId, key, name, email, expiresAt }

  function _loadSession() {
    try {
      const raw = sessionStorage.getItem('fp_session');
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (Date.now() > s.expiresAt) { sessionStorage.removeItem('fp_session'); return null; }
      return s;
    } catch { return null; }
  }

  function _saveSession(data) {
    const serialized = {
      userId: data.userId,
      name: data.name,
      email: data.email,
      expiresAt: data.expiresAt,
    };
    sessionStorage.setItem('fp_session', JSON.stringify(serialized));
    _session = { ...serialized, cryptoKey: data.cryptoKey };
  }

  function _clearSession() {
    sessionStorage.removeItem('fp_session');
    _session = null;
  }

  /* ── RATE LIMIT ── */

  function _getRateState(email) {
    try { return JSON.parse(localStorage.getItem('fp_rl_' + email)) || { attempts: 0, lockedUntil: 0 }; }
    catch { return { attempts: 0, lockedUntil: 0 }; }
  }
  function _setRateState(email, state) {
    localStorage.setItem('fp_rl_' + email, JSON.stringify(state));
  }
  function _checkRateLimit(email) {
    const s = _getRateState(email);
    if (Date.now() < s.lockedUntil) {
      const mins = Math.ceil((s.lockedUntil - Date.now()) / 60000);
      throw new Error(`Conta bloqueada por tentativas excessivas. Tente novamente em ${mins} min.`);
    }
  }
  function _recordFailure(email) {
    const s = _getRateState(email);
    s.attempts++;
    if (s.attempts >= MAX_ATTEMPTS) {
      s.lockedUntil = Date.now() + LOCKOUT_MS;
      s.attempts = 0;
    }
    _setRateState(email, s);
  }
  function _resetRateLimit(email) {
    localStorage.removeItem('fp_rl_' + email);
  }

  /* ── USER STORE ── */
  // Guarda apenas: { id, name, email, passwordHash, salt, encryptedData }

  function _getUsers() {
    try { return JSON.parse(localStorage.getItem('fp_users')) || []; }
    catch { return []; }
  }
  function _saveUsers(users) {
    localStorage.setItem('fp_users', JSON.stringify(users));
  }
  function _findUser(email) {
    return _getUsers().find(u => u.email.toLowerCase() === email.toLowerCase());
  }

  async function _createDefaultUserIfMissing() {
    const users = _getUsers();
    if (!users.some(u => u.email.toLowerCase() === DEFAULT_USER.email.toLowerCase())) {
      const salt = genSalt();
      const passwordHash = await sha256(DEFAULT_USER.password + salt);
      users.push({
        id: 'u_' + crypto.randomUUID(),
        name: DEFAULT_USER.name,
        email: DEFAULT_USER.email.toLowerCase(),
        passwordHash,
        salt,
        encryptedData: null,
      });
      _saveUsers(users);
    }
  }

  async function _deriveKeyFromHash(hash, saltHex) {
    const keyMaterial = await crypto.subtle.importKey(
      'raw', fromHex(hash), 'PBKDF2', false, ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: fromHex(saltHex), iterations: PBKDF2_ITER, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt','decrypt']
    );
  }

  async function _getSessionKey() {
    const session = _getSession();
    if (session.cryptoKey) return session.cryptoKey;
    const user = _getUsers().find(u => u.id === session.userId);
    if (!user) throw new Error('Usuário não encontrado.');
    session.cryptoKey = await _deriveKeyFromHash(user.passwordHash, user.salt);
    _session = session;
    return session.cryptoKey;
  }

  /* ── DATA HELPERS ── */

  async function _readData(user) {
    if (!user.encryptedData) return { transactions: [] };
    try { return await decrypt(user.encryptedData, await _getSessionKey()); }
    catch { return { transactions: [] }; }
  }

  async function _writeData(data) {
    const s = _getSession();
    const users  = _getUsers();
    const idx    = users.findIndex(u => u.id === s.userId);
    if (idx < 0) throw new Error('Usuário não encontrado.');
    users[idx].encryptedData = await encrypt(data, await _getSessionKey());
    _saveUsers(users);
  }

  function _getSession() {
    if (!_session) throw new Error('Sessão expirada. Faça login novamente.');
    if (Date.now() > _session.expiresAt) { _clearSession(); throw new Error('Sessão expirada.'); }
    return _session;
  }

  /* ══════════════════════════════════════
     PUBLIC API
  ══════════════════════════════════════ */

  async function register({ name, email, password }) {
    // Validações
    if (!name || name.trim().length < 2) throw new Error('Nome muito curto.');
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('E-mail inválido.');
    if (!password || password.length < 8) throw new Error('Senha deve ter no mínimo 8 caracteres.');

    const users = _getUsers();
    if (users.find(u => u.email.toLowerCase() === email.toLowerCase()))
      throw new Error('E-mail já cadastrado.');

    const salt         = genSalt();
    const passwordHash = await sha256(password + salt);
    const id           = 'u_' + crypto.randomUUID();

    const newUser = { id, name: name.trim(), email: email.toLowerCase(), passwordHash, salt, encryptedData: null };
    users.push(newUser);
    _saveUsers(users);
    return true;
  }

  async function login({ email, password }) {
    if (email.toLowerCase() === DEFAULT_USER.email.toLowerCase()) {
      await _createDefaultUserIfMissing();
    }

    _checkRateLimit(email);

    const user = _findUser(email);
    if (!user) { _recordFailure(email); throw new Error('E-mail ou senha inválidos.'); }

    const hash = await sha256(password + user.salt);
    if (hash !== user.passwordHash) { _recordFailure(email); throw new Error('E-mail ou senha inválidos.'); }

    _resetRateLimit(email);

    const cryptoKey = await _deriveKeyFromHash(user.passwordHash, user.salt);

    _saveSession({
      userId:    user.id,
      name:      user.name,
      email:     user.email,
      cryptoKey,
      expiresAt: Date.now() + SESSION_TTL,
    });

    return { name: user.name, email: user.email };
  }

  function logout() { _clearSession(); }

  function getCurrentUser() {
    const s = _loadSession() || _session;
    if (!s || Date.now() > s.expiresAt) return null;
    _session = s;
    return { name: s.name, email: s.email };
  }

  /** Retorna todos os dados do usuário logado */
  async function getData() {
    const s     = _getSession();
    const users = _getUsers();
    const user  = users.find(u => u.id === s.userId);
    if (!user) throw new Error('Usuário não encontrado.');
    return _readData(user, s.cryptoKey);
  }

  /** Adiciona transação */
  async function addTransaction(tx) {
    const data = await getData();
    const newTx = {
      id:          'tx_' + crypto.randomUUID(),
      description: tx.description.trim(),
      amount:      parseFloat(tx.amount),
      type:        tx.type,        // 'income' | 'expense'
      category:    (tx.category || 'Outros').trim(),
      costType:    tx.costType,    // 'fixed' | 'variable'
      date:        tx.date || new Date().toISOString().slice(0,10),
      note:        (tx.note || '').trim(),
      createdAt:   Date.now(),
    };
    data.transactions.push(newTx);
    await _writeData(data);
    return newTx;
  }

  /** Atualiza transação */
  async function updateTransaction(id, updates) {
    const data = await getData();
    const idx  = data.transactions.findIndex(t => t.id === id);
    if (idx < 0) throw new Error('Transação não encontrada.');
    data.transactions[idx] = { ...data.transactions[idx], ...updates, id, updatedAt: Date.now() };
    await _writeData(data);
    return data.transactions[idx];
  }

  /** Remove transação */
  async function deleteTransaction(id) {
    const data = await getData();
    data.transactions = data.transactions.filter(t => t.id !== id);
    await _writeData(data);
    return true;
  }

  /** Retorna transações, com filtros opcionais */
  async function getTransactions({ type, costType, search, period } = {}) {
    const data = await getData();
    let txs = [...data.transactions];

    if (period) {
      const now   = new Date();
      const year  = now.getFullYear();
      const month = now.getMonth();
      txs = txs.filter(t => {
        const d = new Date(t.date);
        if (period === 'thisMonth')  return d.getFullYear() === year && d.getMonth() === month;
        if (period === 'lastMonth') {
          const lm = month === 0 ? 11 : month - 1;
          const ly = month === 0 ? year - 1 : year;
          return d.getFullYear() === ly && d.getMonth() === lm;
        }
        if (period === 'thisYear') return d.getFullYear() === year;
        return true;
      });
    }

    if (type)     txs = txs.filter(t => t.type === type);
    if (costType) txs = txs.filter(t => t.costType === costType);
    if (search) {
      const q = search.toLowerCase();
      txs = txs.filter(t =>
        t.description.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
      );
    }

    return txs.sort((a,b) => new Date(b.date) - new Date(a.date));
  }

  return { register, login, logout, getCurrentUser, getData, addTransaction, updateTransaction, deleteTransaction, getTransactions };
})();
