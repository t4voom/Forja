/* FORJA Trainer — aplicação: login, estrutura (menu lateral + topo), rotas e configurações
   Rotas: #/ · #/alunos · #/alunos/:id · #/alunos/:id/treinos/:treinoId|novo · #/treinos
          #/academia · #/treinadores · #/configuracoes */
(function (global) {
  'use strict';
  const { U, API, TUI } = global;
  const { esc, icon } = U;
  const { F } = TUI;
  const root = () => document.getElementById('root');

  const NAV = [
    { route: '', label: 'Dashboard', icon: 'grid' },
    { route: 'alunos', label: 'Alunos', icon: 'users' },
    { route: 'treinos', label: 'Treinos', icon: 'dumbbell' },
    { route: 'academia', label: 'Academia', icon: 'building' },
    { route: 'treinadores', label: 'Treinadores', icon: 'whistle' },
    { route: 'configuracoes', label: 'Configurações', icon: 'settings' }
  ];

  /* ---------- Cache curto em memória (o Apps Script leva 1–2 s por chamada) ---------- */
  const cache = (() => {
    const m = new Map();
    return {
      async get(key, fn, ttl = 30000) {
        const hit = m.get(key);
        if (hit && Date.now() - hit.at < ttl) return hit.value;
        const value = await fn();
        m.set(key, { value, at: Date.now() });
        return value;
      },
      clear() { m.clear(); }
    };
  })();

  /* ---------- Tema (preferência deste computador) ---------- */
  const THEME_KEY = 'forja.trainer.theme';
  const theme = () => { try { return localStorage.getItem(THEME_KEY) || 'dark'; } catch (e) { return 'dark'; } };
  function applyTheme(t = theme()) {
    try { localStorage.setItem(THEME_KEY, t); } catch (e) {}
    const resolved = t === 'system' ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : t;
    document.documentElement.setAttribute('data-theme', resolved);
  }

  /* ---------- Rotas ---------- */
  let guard = null;      // função que diz se pode sair da tela (editor com alterações)
  let renderId = 0;
  let current = null;

  function parse() {
    const raw = location.hash.replace(/^#\/?/, '');
    const [path, qs] = raw.split('?');
    const segs = path.split('/').filter(Boolean).map(decodeURIComponent);
    return { segs, route: segs[0] || '', query: Object.fromEntries(new URLSearchParams(qs || '')), raw };
  }

  function go(path) { location.hash = `#/${path}`; }

  function setGuard(fn) { guard = fn; }

  global.addEventListener('hashchange', (e) => {
    if (guard && !guard()) {
      const back = e.oldURL.split('#')[1] || '/';
      history.replaceState(null, '', `#${back}`);
      return;
    }
    guard = null;
    render();
  });
  global.addEventListener('beforeunload', (e) => { if (guard && !guard(true)) { e.preventDefault(); e.returnValue = ''; } });

  /* ---------- Login ---------- */
  function renderLogin(message = '') {
    guard = null;
    document.title = 'Entrar · FORJA Trainer';
    root().innerHTML = `
      <div class="auth">
        <aside class="auth-art">
          ${brandHTML(true)}
          <div>
            <h1>Seus alunos treinam no FORJA. <span>Você comanda o treino.</span></h1>
            <p>Monte e ajuste treinos, acompanhe peso e evolução, e veja tudo chegar ao celular do aluno.</p>
            <ul class="auth-points">
              <li>${icon('users', { size: 20 })} Alunos da sua academia em um só lugar</li>
              <li>${icon('dumbbell', { size: 20 })} Treinos editados aqui aparecem no app do aluno</li>
              <li>${icon('chart', { size: 20 })} Histórico de peso e atividade de cada aluno</li>
            </ul>
          </div>
          <p class="faint" style="position:relative;font-size:13px">FORJA · Treino, carga e evolução</p>
        </aside>
        <div class="auth-form-wrap">
          <form class="auth-form" novalidate>
            <div class="brand" style="margin-bottom:32px">${brandInner()}</div>
            <h2>Entrar</h2>
            <p class="muted mt-1">Acesso para treinadores e academias.</p>
            <div class="stack-sm mt-6">
              <div><label class="label" for="l-email">E-mail</label><input class="field" id="l-email" name="email" type="email" autocomplete="username" autocapitalize="none" spellcheck="false" required></div>
              <div>
                <label class="label" for="l-pass">Senha</label>
                <div class="pass-wrap">
                  <input class="field" id="l-pass" name="password" type="password" autocomplete="current-password" required>
                  <button type="button" class="icon-btn" data-eye aria-label="Mostrar senha">${icon('eye', { size: 18 })}</button>
                </div>
              </div>
            </div>
            <p class="form-error" aria-live="polite">${esc(message)}</p>
            <button class="btn btn-primary btn-lg btn-block mt-2" type="submit">Entrar</button>
            <p class="auth-note">Esqueceu a senha? Peça uma senha provisória ao administrador do FORJA.</p>
          </form>
        </div>
      </div>`;
    const form = root().querySelector('form');
    const err = form.querySelector('.form-error');
    const pass = form.querySelector('#l-pass');
    form.querySelector('[data-eye]').addEventListener('click', (e) => {
      const show = pass.type === 'password';
      pass.type = show ? 'text' : 'password';
      e.currentTarget.innerHTML = icon(show ? 'eyeOff' : 'eye', { size: 18 });
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = form.email.value.trim();
      if (!email || !pass.value) { err.textContent = 'Informe e-mail e senha.'; return; }
      const btn = form.querySelector('[type="submit"]');
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> Entrando…';
      try {
        await API.login(email, pass.value);
        cache.clear();
        start();
      } catch (ex) {
        err.textContent = ex.message;
        btn.disabled = false;
        btn.textContent = 'Entrar';
        pass.select();
      }
    });
    setTimeout(() => form.email.focus(), 50);
  }

  // Senha provisória: troca obrigatória antes de usar o Dashboard
  function renderForceChange() {
    document.title = 'Nova senha · FORJA Trainer';
    root().innerHTML = `
      <div class="auth" style="grid-template-columns:1fr">
        <div class="auth-form-wrap">
          <form class="auth-form" novalidate>
            <div class="brand" style="margin-bottom:32px">${brandInner()}</div>
            <h2>Crie sua senha</h2>
            <p class="muted mt-1">Você entrou com uma senha provisória. Escolha uma senha pessoal para continuar.</p>
            <div class="stack-sm mt-6">
              <div><label class="label" for="c-cur">Senha provisória</label><input class="field" id="c-cur" type="password" autocomplete="current-password"></div>
              <div><label class="label" for="c-new">Nova senha</label><input class="field" id="c-new" type="password" autocomplete="new-password" placeholder="Mínimo de 8 caracteres"></div>
              <div><label class="label" for="c-rep">Repita a nova senha</label><input class="field" id="c-rep" type="password" autocomplete="new-password"></div>
            </div>
            <p class="form-error" aria-live="polite"></p>
            <button class="btn btn-primary btn-lg btn-block mt-2" type="submit">Salvar e continuar</button>
            <button class="btn btn-ghost btn-block mt-2" type="button" data-out>Sair</button>
          </form>
        </div>
      </div>`;
    const form = root().querySelector('form');
    form.querySelector('[data-out]').addEventListener('click', logout);
    bindPasswordForm(form, () => { TUI.toast('Senha criada. Bem-vindo ao FORJA Trainer.'); start(); });
  }

  function bindPasswordForm(form, done) {
    const err = form.querySelector('.form-error');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const cur = form.querySelector('[autocomplete="current-password"]').value;
      const [nw, rep] = [...form.querySelectorAll('[autocomplete="new-password"]')].map((i) => i.value);
      if (nw.length < 8) { err.textContent = 'Use uma senha com pelo menos 8 caracteres.'; return; }
      if (nw !== rep) { err.textContent = 'As senhas não conferem.'; return; }
      const btn = form.querySelector('[type="submit"]');
      btn.disabled = true;
      try { await API.changePassword(cur, nw); form.reset(); err.textContent = ''; done(); } catch (ex) { err.textContent = ex.message; }
      btn.disabled = false;
    });
  }

  /* ---------- Estrutura ---------- */
  const brandInner = () => `
    <img class="brand-mark" src="../assets/icons/icon.svg" alt="">
    <span class="brand-text"><span class="brand-name block">FORJA</span><span class="brand-sub block">Trainer</span></span>`;
  const brandHTML = (onDark) => `<div class="brand" style="position:relative${onDark ? ';color:#F5F5F7' : ''}">${brandInner()}</div>`;

  function renderShell() {
    const s = API.session();
    const t = s.trainer;
    const ac = API.academy();
    root().innerHTML = `
      <div class="shell">
        <aside class="side" aria-label="Menu">
          <a href="#/" class="brand">${brandInner()}</a>
          <nav class="nav">
            <p class="nav-label">Academia</p>
            ${NAV.map((n) => `<a href="#/${n.route}" data-route="${n.route}" title="${n.label}">${icon(n.icon, { size: 18, stroke: 1.8 })}<span>${n.label}</span></a>`).join('')}
          </nav>
          <div class="side-foot">
            ${ac ? `
              <div class="side-card">
                <div class="between"><span class="card-sub">Alunos</span><span class="num" style="font-weight:600" data-side-count>${ac.alunos} / ${ac.limite}</span></div>
                ${TUI.meterHTML(ac.alunos, ac.limite)}
              </div>` : ''}
          </div>
        </aside>
        <div class="main">
          <header class="top">
            <nav class="crumbs" aria-label="Você está em" data-crumbs></nav>
            <div class="top-actions">
              ${ac ? `
                <div class="menu-wrap">
                  <button type="button" class="acad-chip" data-acad-menu aria-haspopup="menu" ${t.academias.length > 1 ? '' : 'disabled style="cursor:default"'}>
                    ${icon('building', { size: 16, stroke: 1.9 })}<span class="acad-chip-text truncate" style="max-width:220px">${esc(ac.nome)}</span>${t.academias.length > 1 ? icon('chevronDown', { size: 14, stroke: 2.2 }) : ''}
                  </button>
                </div>` : ''}
              <div class="menu-wrap">
                <button type="button" class="menu-trigger" data-user-menu aria-haspopup="menu">
                  <span class="avatar is-accent">${esc(F.initials(t.nome))}</span>
                  <span class="menu-trigger-text"><span class="menu-trigger-name block">${esc(t.nome)}</span><span class="menu-trigger-sub block">${ac ? (ac.papel === 'GESTOR' ? 'Gestor' : 'Treinador') : 'Sem academia'}</span></span>
                  ${icon('chevronDown', { size: 14, stroke: 2.2, cls: 'faint' })}
                </button>
              </div>
            </div>
          </header>
          <main class="page-host" id="page" tabindex="-1"></main>
        </div>
      </div>`;

    root().querySelector('[data-user-menu]').addEventListener('click', (e) => openMenu(e.currentTarget, `
      <div class="menu-head"><p style="font-weight:600">${esc(t.nome)}</p><p class="card-sub truncate">${esc(t.email)}</p></div>
      <a href="#/configuracoes" data-close>${icon('user', { size: 16 })} Perfil e senha</a>
      <a href="#/configuracoes" data-close>${icon('moon', { size: 16 })} Tema</a>
      <button type="button" class="is-danger" data-logout>${icon('logout', { size: 16 })} Sair</button>`));
    const acadBtn = root().querySelector('[data-acad-menu]');
    if (acadBtn && t.academias.length > 1) {
      acadBtn.addEventListener('click', (e) => openMenu(e.currentTarget, `
        <div class="menu-head"><p class="card-sub">Trocar de academia</p></div>
        ${t.academias.map((a) => `<button type="button" data-acad="${esc(a.id)}" class="${a.id === ac.id ? 'is-current' : ''}">${icon(a.id === ac.id ? 'check' : 'building', { size: 16 })} <span class="truncate">${esc(a.nome)}</span></button>`).join('')}`));
    }
  }

  function openMenu(anchor, html) {
    closeMenus();
    const menu = U.h(`<div class="menu" role="menu">${html}</div>`);
    anchor.parentElement.appendChild(menu);
    anchor.setAttribute('aria-expanded', 'true');
    menu.addEventListener('click', (e) => {
      const acad = e.target.closest('[data-acad]');
      if (acad) { API.setAcademy(acad.dataset.acad); cache.clear(); closeMenus(); renderShell(); render(); return; }
      if (e.target.closest('[data-logout]')) { closeMenus(); logout(); return; }
      if (e.target.closest('[data-close]')) closeMenus();
    });
    setTimeout(() => document.addEventListener('mousedown', outside), 0);
    function outside(e) { if (!menu.contains(e.target) && !anchor.contains(e.target)) { closeMenus(); } }
    menu._off = () => document.removeEventListener('mousedown', outside);
  }
  function closeMenus() {
    document.querySelectorAll('.menu').forEach((m) => { if (m._off) m._off(); m.remove(); });
    document.querySelectorAll('[aria-expanded="true"]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
  }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenus(); });

  function setCrumbs(items) {
    const el = document.querySelector('[data-crumbs]');
    if (!el) return;
    el.innerHTML = items.map((c, i) => {
      const last = i === items.length - 1;
      return `${i ? icon('chevronRight', { size: 14, stroke: 2 }) : ''}${last ? `<strong class="truncate">${esc(c.label)}</strong>` : `<a href="#/${c.href}" class="truncate">${esc(c.label)}</a>`}`;
    }).join('');
    document.title = `${items[items.length - 1].label} · FORJA Trainer`;
  }

  /* ---------- Render ---------- */
  function render() {
    const s = API.session();
    if (!s) return renderLogin();
    if (s.trainer.trocarSenha) return renderForceChange();
    if (!document.getElementById('page')) renderShell();
    const r = parse();
    current = r;
    const id = ++renderId;
    document.querySelectorAll('.nav a').forEach((a) => {
      if (a.dataset.route === r.route) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    const host = document.getElementById('page');
    const el = document.createElement('section');
    el.className = 'page';
    host.replaceChildren(el);
    global.scrollTo(0, 0);
    const ctx = {
      el, segs: r.segs, query: r.query, go, setCrumbs, setGuard, cache,
      alive: () => id === renderId && el.isConnected,
      refreshSide: updateSideCount
    };
    if (!API.academy() && r.route !== 'configuracoes') return renderNoAcademy(ctx);
    const V = global.Views;
    const E = global.Editor;
    try {
      if (r.route === '') return V.dashboard(ctx);
      if (r.route === 'alunos' && r.segs[2] === 'treinos' && r.segs[3]) return E.render(ctx, r.segs[1], r.segs[3]);
      if (r.route === 'alunos' && r.segs[1]) return V.student(ctx, r.segs[1]);
      if (r.route === 'alunos') return V.students(ctx);
      if (r.route === 'treinos') return V.workouts(ctx);
      if (r.route === 'academia') return V.academy(ctx);
      if (r.route === 'treinadores') return V.trainers(ctx);
      if (r.route === 'configuracoes') return renderSettings(ctx);
      go('');
    } catch (e) { V.error(ctx, e); }
  }

  function updateSideCount(alunos, limite) {
    const el = document.querySelector('[data-side-count]');
    if (!el) return;
    el.textContent = `${alunos} / ${limite}`;
    const meter = el.closest('.side-card').querySelector('.meter');
    if (meter) meter.outerHTML = TUI.meterHTML(alunos, limite);
  }

  function renderNoAcademy(ctx) {
    setCrumbs([{ label: 'FORJA Trainer' }]);
    ctx.el.innerHTML = `<div class="card error-state">${TUI.emptyHTML('building', 'Nenhuma academia ativa', 'Seu acesso ainda não está ligado a uma academia ativa. Fale com o administrador do FORJA.')}</div>`;
  }

  /* ---------- Configurações ---------- */
  function renderSettings(ctx) {
    const s = API.session();
    const t = s.trainer;
    const ac = API.academy();
    setCrumbs([{ label: 'Configurações' }]);
    ctx.el.innerHTML = `
      <div class="page-head"><div><h1 class="page-title">Configurações</h1><p class="page-sub">Seu perfil, sua senha e a aparência do Dashboard.</p></div></div>
      <div class="grid cols-2">
        <div class="stack">
          <section class="card">
            <div class="card-head"><h2 class="card-title">Perfil</h2></div>
            <div class="card-body">
              <div class="person"><span class="avatar is-lg is-accent">${esc(F.initials(t.nome))}</span><div><p class="page-title" style="font-size:20px">${esc(t.nome)}</p><p class="muted">${esc(t.email)}</p></div></div>
              <dl class="dl mt-4">
                <dt>Academia atual</dt><dd>${ac ? esc(ac.nome) : '—'}</dd>
                <dt>Papel</dt><dd>${ac ? (ac.papel === 'GESTOR' ? 'Gestor' : 'Treinador') : '—'}</dd>
                <dt>Academias com acesso</dt><dd>${t.academias.map((a) => esc(a.nome)).join(', ') || '—'}</dd>
              </dl>
              <p class="card-sub mt-4">Nome e e-mail são cadastrados pelo administrador do FORJA.</p>
            </div>
          </section>
          <section class="card">
            <div class="card-head"><h2 class="card-title">Aparência</h2></div>
            <div class="card-body between"><span>Tema</span><span data-theme-slot></span></div>
          </section>
        </div>
        <section class="card">
          <div class="card-head"><h2 class="card-title">Trocar senha</h2></div>
          <form class="card-body" novalidate>
            <div class="stack-sm">
              <div><label class="label" for="s-cur">Senha atual</label><input class="field" id="s-cur" type="password" autocomplete="current-password"></div>
              <div><label class="label" for="s-new">Nova senha</label><input class="field" id="s-new" type="password" autocomplete="new-password" placeholder="Mínimo de 8 caracteres"></div>
              <div><label class="label" for="s-rep">Repita a nova senha</label><input class="field" id="s-rep" type="password" autocomplete="new-password"></div>
            </div>
            <p class="form-error" aria-live="polite"></p>
            <div class="between"><button class="btn btn-ghost" type="button" data-out>${icon('logout', { size: 16 })} Sair da conta</button><button class="btn btn-primary" type="submit">Salvar nova senha</button></div>
          </form>
        </section>
      </div>`;
    ctx.el.querySelector('[data-theme-slot]').appendChild(TUI.segmented(
      [{ value: 'dark', label: 'Escuro' }, { value: 'light', label: 'Claro' }, { value: 'system', label: 'Sistema' }],
      theme(), (v) => applyTheme(v), 'Tema'));
    ctx.el.querySelector('[data-out]').addEventListener('click', logout);
    bindPasswordForm(ctx.el.querySelector('form'), () => TUI.toast('Senha alterada.'));
  }

  /* ---------- Sessão ---------- */
  async function logout() {
    await API.logout();
    cache.clear();
    history.replaceState(null, '', location.pathname);
    renderLogin();
  }

  API.onLogout((err) => { cache.clear(); renderLogin(err.message); });

  async function start() {
    applyTheme();
    if (!API.session()) return renderLogin();
    root().innerHTML = '<div class="error-state"><div class="skeleton sk-card"></div></div>';
    try {
      await API.me(); // permissões e academias sempre vêm do servidor
    } catch (e) {
      if (!API.session()) return renderLogin(e.code === 'invalid_session' ? '' : e.message);
      root().innerHTML = `<div class="card error-state">${TUI.emptyHTML('alert', 'Não foi possível conectar', e.message)}<div class="card-foot" style="text-align:center"><button class="btn btn-primary" data-retry>Tentar de novo</button></div></div>`;
      root().querySelector('[data-retry]').addEventListener('click', start);
      return;
    }
    root().innerHTML = '';
    render();
  }

  matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => { if (theme() === 'system') applyTheme('system'); });

  global.TrainerApp = { go, render, cache, setCrumbs };
  start();
})(window);
