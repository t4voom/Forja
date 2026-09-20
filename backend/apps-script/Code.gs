/**
 * FORJA — backend no Google Planilhas (Apps Script)
 *
 * Como usar: veja backend/LEIA-ME.md. Resumo:
 *   1. Crie uma planilha, abra Extensões › Apps Script e cole este arquivo.
 *   2. Rode a função setup() uma vez (cria as abas).
 *   3. Implantar › Nova implantação › App da Web (executar como: você; acesso: qualquer pessoa).
 *   4. Cole a URL /exec em js/config.js (sheetsUrl) e mude backend para 'sheets'.
 *
 * Abas:
 *   usuarios: id | email | nome | hash | salt | plano | criadoEm | planoAtualizadoEm
 *   sessoes:  token | userId | criadoEm | expiraEm
 *   dados:    userId | chave | parte | json | atualizadoEm
 *             (cada chave do app — treinos, sessões, peso... — é um JSON; textos grandes
 *              são divididos em partes, porque uma célula aceita no máximo 50 mil caracteres)
 *
 * Todas as chamadas são POST com corpo JSON: { action, ...campos }.
 * Respostas: { ok: true, ... } ou { ok: false, error: 'codigo' }.
 */

var SHEETS = {
  users: { name: 'usuarios', header: ['id', 'email', 'nome', 'hash', 'salt', 'plano', 'criadoEm', 'planoAtualizadoEm'] },
  sessions: { name: 'sessoes', header: ['token', 'userId', 'criadoEm', 'expiraEm'] },
  data: { name: 'dados', header: ['userId', 'chave', 'parte', 'json', 'atualizadoEm'] }
};
var SESSION_DAYS = 60;
var CHUNK = 45000;
// Chaves que o app pode gravar (qualquer outra é recusada)
var DATA_KEYS = ['meta', 'profile', 'settings', 'workouts', 'exercises', 'favorites', 'sessions', 'active', 'bodyweight', 'goals', 'program', 'reminders'];

/* ---------- Entrada ---------- */
function doGet() {
  return json_({ ok: true, app: 'FORJA', status: 'online' });
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    var req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var handler = ACTIONS[req.action];
    if (!handler) return json_({ ok: false, error: 'unknown_action' });
    return json_(handler(req));
  } catch (err) {
    if (err && err.code) return json_({ ok: false, error: err.code });
    console.error(err);
    return json_({ ok: false, error: 'server', message: String(err && err.message || err) });
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

var ACTIONS = {
  register: function (req) {
    var email = normEmail_(req.email);
    var name = String(req.name || '').trim().replace(/\s+/g, ' ').slice(0, 30);
    var password = String(req.password || '');
    if (!name) fail_('invalid_name');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) fail_('invalid_email');
    if (password.length < 6) fail_('weak_password');
    if (findUserBy_('email', email)) fail_('email_taken');
    var salt = Utilities.getUuid();
    var user = { id: 'u_' + Utilities.getUuid().replace(/-/g, '').slice(0, 16), email: email, name: name, plan: 'free', createdAt: now_() };
    sheet_('users').appendRow([user.id, user.email, user.name, hash_(salt, password), salt, user.plan, user.createdAt, '']);
    return { ok: true, token: newSession_(user.id), user: user };
  },

  login: function (req) {
    var row = findUserBy_('email', normEmail_(req.email));
    if (!row || hash_(row.salt, String(req.password || '')) !== row.hash) fail_('invalid_login');
    return { ok: true, token: newSession_(row.id), user: publicUser_(row) };
  },

  me: function (req) {
    return { ok: true, user: publicUser_(auth_(req.token)) };
  },

  logout: function (req) {
    var sh = sheet_('sessions');
    var values = sh.getDataRange().getValues();
    for (var i = values.length - 1; i >= 1; i--) if (values[i][0] === req.token) sh.deleteRow(i + 1);
    return { ok: true };
  },

  // PAGAMENTO SIMULADO: enquanto a propriedade ALLOW_PLAN_CHANGE for 'true', o próprio app troca o plano.
  // Quando o pagamento real existir, desligue (ALLOW_PLAN_CHANGE = false) e mude o plano pelo webhook do pagamento.
  setPlan: function (req) {
    var user = auth_(req.token);
    var allow = PropertiesService.getScriptProperties().getProperty('ALLOW_PLAN_CHANGE');
    if (allow === 'false') fail_('plan_locked');
    var plan = req.plan === 'premium' ? 'premium' : 'free';
    var sh = sheet_('users');
    sh.getRange(user._row, 6, 1, 1).setValue(plan);
    sh.getRange(user._row, 8, 1, 1).setValue(now_());
    user.plan = plan;
    return { ok: true, user: publicUser_(user) };
  },

  // Todos os dados da conta: { chave: valor }
  pull: function (req) {
    var user = auth_(req.token);
    var values = sheet_('data').getDataRange().getValues();
    var parts = {};
    for (var i = 1; i < values.length; i++) {
      if (values[i][0] !== user.id) continue;
      var key = values[i][1];
      (parts[key] = parts[key] || [])[values[i][2]] = values[i][3];
    }
    var data = {};
    Object.keys(parts).forEach(function (k) {
      try { data[k] = JSON.parse(parts[k].join('')); } catch (e) { /* chave corrompida: ignora */ }
    });
    return { ok: true, data: data };
  },

  // Grava as chaves enviadas: { data: { chave: valor } }
  push: function (req) {
    var user = auth_(req.token);
    var data = req.data || {};
    var keys = Object.keys(data).filter(function (k) { return DATA_KEYS.indexOf(k) >= 0; });
    if (!keys.length) return { ok: true, saved: 0 };
    removeRows_(user.id, keys);
    var rows = [];
    var stamp = now_();
    keys.forEach(function (k) {
      var text = JSON.stringify(data[k] === undefined ? null : data[k]);
      for (var p = 0, i = 0; i < text.length || p === 0; i += CHUNK, p++) rows.push([user.id, k, p, text.slice(i, i + CHUNK), stamp]);
    });
    var sh = sheet_('data');
    sh.getRange(sh.getLastRow() + 1, 1, rows.length, 5).setValues(rows);
    return { ok: true, saved: keys.length };
  },

  // "Apagar todos os dados" no app
  clear: function (req) {
    var user = auth_(req.token);
    removeRows_(user.id, null);
    return { ok: true };
  }
};

/* ---------- Configuração inicial (rode uma vez pelo editor) ---------- */
function setup() {
  var ss = ss_();
  Object.keys(SHEETS).forEach(function (k) {
    var def = SHEETS[k];
    var sh = ss.getSheetByName(def.name) || ss.insertSheet(def.name);
    if (sh.getLastRow() === 0) sh.appendRow(def.header);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, def.header.length).setFontWeight('bold');
  });
  // Coluna json como texto puro (evita a planilha converter números e datas)
  ss.getSheetByName(SHEETS.data.name).getRange('D:D').setNumberFormat('@');
  PropertiesService.getScriptProperties().setProperty('ALLOW_PLAN_CHANGE', 'true');
  var nomes = Object.keys(SHEETS).map(function (k) { return SHEETS[k].name; }).join(', ');
  Logger.log('FORJA: tudo pronto na planilha "' + ss.getName() + '". Abas: ' + nomes + '. Recarregue a planilha (F5) se elas ainda não aparecerem.');
  return 'Abas prontas em: ' + ss.getName();
}

/**
 * A planilha onde tudo é gravado.
 * Normalmente é a planilha dona do script (Extensões › Apps Script).
 * Se o script foi criado avulso (script.google.com), configure a propriedade
 * SPREADSHEET_ID em Configurações do projeto › Propriedades do script,
 * com o id que aparece na URL da planilha: .../spreadsheets/d/ESTE_PEDACO/edit
 */
function ss_() {
  var ss = SpreadsheetApp.getActive();
  if (ss) return ss;
  var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (id) {
    try { return SpreadsheetApp.openById(id); } catch (e) {
      throw new Error('Não consegui abrir a planilha do SPREADSHEET_ID. Confira se o id está certo e se a conta tem acesso.');
    }
  }
  throw new Error('Este script não está ligado a nenhuma planilha. Abra a planilha, vá em Extensões › Apps Script e cole o código lá; ou defina a propriedade SPREADSHEET_ID em Configurações do projeto.');
}

// Apaga sessões vencidas. Opcional: crie um acionador diário para esta função.
function cleanupSessions() {
  var sh = sheet_('sessions');
  var values = sh.getDataRange().getValues();
  var nowMs = Date.now();
  for (var i = values.length - 1; i >= 1; i--) if (new Date(values[i][3]).getTime() < nowMs) sh.deleteRow(i + 1);
}

/* ---------- Auxiliares ---------- */
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function fail_(code) { var e = new Error(code); e.code = code; throw e; }
function now_() { return new Date().toISOString(); }
function normEmail_(e) { return String(e || '').trim().toLowerCase(); }

function sheet_(which) {
  var def = SHEETS[which];
  var sh = ss_().getSheetByName(def.name);
  if (!sh) { setup(); sh = ss_().getSheetByName(def.name); }
  return sh;
}

function hash_(salt, password) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + ':' + password, Utilities.Charset.UTF_8);
  return bytes.map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}

function findUserBy_(field, value) {
  var col = { id: 0, email: 1 }[field];
  var values = sheet_('users').getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][col]) === value) {
      var r = values[i];
      return { _row: i + 1, id: r[0], email: r[1], name: r[2], hash: r[3], salt: r[4], plan: r[5] || 'free', createdAt: r[6] };
    }
  }
  return null;
}

function publicUser_(u) { return { id: u.id, email: u.email, name: u.name, plan: u.plan || 'free', createdAt: u.createdAt }; }

function newSession_(userId) {
  var token = Utilities.getUuid() + Utilities.getUuid().replace(/-/g, '');
  var expires = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString();
  sheet_('sessions').appendRow([token, userId, now_(), expires]);
  return token;
}

function auth_(token) {
  if (!token) fail_('invalid_session');
  var values = sheet_('sessions').getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (values[i][0] === token) {
      if (new Date(values[i][3]).getTime() < Date.now()) fail_('invalid_session');
      var user = findUserBy_('id', values[i][1]);
      if (!user) fail_('invalid_session');
      return user;
    }
  }
  fail_('invalid_session');
}

// Remove as linhas de dados da conta (todas, ou só das chaves indicadas), de baixo para cima
function removeRows_(userId, keys) {
  var sh = sheet_('data');
  var values = sh.getDataRange().getValues();
  var keep = [values[0]];
  var removed = 0;
  for (var i = 1; i < values.length; i++) {
    var match = values[i][0] === userId && (!keys || keys.indexOf(values[i][1]) >= 0);
    if (match) removed++; else keep.push(values[i]);
  }
  if (!removed) return;
  // Reescreve a aba de uma vez (bem mais rápido que apagar linha por linha)
  sh.getRange(1, 1, values.length, values[0].length).clearContent();
  sh.getRange(1, 1, keep.length, keep[0].length).setValues(keep);
}
