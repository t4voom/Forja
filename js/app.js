/* FORJA — aplicação: tema, navegação, Home, Perfil e primeiro acesso */
(function (global) {
  'use strict';
  const { U, UI, Store, Statistics, Workouts, Sessions } = global;
  const { $, esc, icon } = U;

  /* ==========================================================================
     Opções e validações compartilhadas
     ========================================================================== */
  const GOALS = [
    { value: 'mass', label: 'Ganhar massa' },
    { value: 'strength', label: 'Aumentar força' },
    { value: 'fat', label: 'Perder gordura' },
    { value: 'conditioning', label: 'Condicionamento' },
    { value: 'other', label: 'Outro' }
  ];
  const EXPERIENCE = [
    { value: 'beginner', label: 'Iniciante' },
    { value: 'intermediate', label: 'Intermediário' },
    { value: 'advanced', label: 'Avançado' }
  ];
  const labelOf = (list, value) => (list.find((o) => o.value === value) || {}).label || '';

  const WEIGHT_KG = { min: 25, max: 350 };
  const HEIGHT_CM = { min: 100, max: 250 };

  const Validate = {
    name(input) {
      const v = String(input || '').trim().replace(/\s+/g, ' ');
      if (!v) return { ok: false, error: 'Digite seu nome.' };
      if (v.length > 30) return { ok: false, error: 'Use até 30 caracteres.' };
      if (!/\p{L}/u.test(v)) return { ok: false, error: 'O nome precisa ter letras.' };
      return { ok: true, value: v };
    },
    weight(input, unit = U.currentUnit()) {
      const n = U.parseDecimal(input);
      if (!Number.isFinite(n)) return { ok: false, error: 'Digite um número, como 72,5.' };
      const kg = U.fromUnit(n, unit);
      if (kg < WEIGHT_KG.min || kg > WEIGHT_KG.max) {
        const lo = U.fmtNum(Math.ceil(U.toUnit(WEIGHT_KG.min, unit)));
        const hi = U.fmtNum(Math.floor(U.toUnit(WEIGHT_KG.max, unit)));
        return { ok: false, error: `Informe um peso entre ${lo} e ${hi} ${unit}.` };
      }
      return { ok: true, value: U.round(kg, 2) };
    },
    height(input) {
      const n = U.parseDecimal(input);
      if (!Number.isFinite(n)) return { ok: false, error: 'Digite a altura em centímetros, como 175.' };
      if (n < HEIGHT_CM.min || n > HEIGHT_CM.max) return { ok: false, error: `Informe uma altura entre ${HEIGHT_CM.min} e ${HEIGHT_CM.max} cm.` };
      return { ok: true, value: Math.round(n) };
    }
  };

  // Peso do perfil também alimenta o histórico de peso corporal (um registro por dia)
  function logBodyweight(kg, date = new Date()) {
    const key = U.dayKey(date);
    Store.update('bodyweight', (list) => {
      const existing = list.find((e) => U.dayKey(e.date) === key);
      if (existing) existing.kg = kg;
      else list.push({ id: U.uid('bw_'), date: date.toISOString(), kg });
      list.sort((a, b) => new Date(a.date) - new Date(b.date));
    });
  }

  // Valor de peso para exibir em um campo editável (na unidade atual)
  const weightInputValue = (kg) => (kg ? U.fmtNum(U.round(U.toUnit(kg), 1), 1).replace(/\./g, '') : '');

  /* ==========================================================================
     Tema e preferências visuais
     ========================================================================== */
  const mqLight = global.matchMedia('(prefers-color-scheme: light)');

  function applyTheme() {
    const s = Store.get('settings');
    const resolved = s.theme === 'system' ? (mqLight.matches ? 'light' : 'dark') : s.theme;
    const root = document.documentElement;
    root.setAttribute('data-theme', resolved);
    root.classList.toggle('no-motion', s.animations === false);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', resolved === 'light' ? '#F5F5F7' : '#000000');
  }
  if (mqLight.addEventListener) {
    mqLight.addEventListener('change', () => { if (Store.get('settings').theme === 'system') applyTheme(); });
  }

  /* ==========================================================================
     Home
     ========================================================================== */
  const Home = {
    render(root) {
      const profile = Store.get('profile') || {};
      const name = U.firstName(profile.name);
      const workout = Workouts.next();
      const live = Sessions.active();
      const week = Statistics.calculateWeeklyStats(Sessions.all());
      const time = U.durationParts(week.durationSec);
      const now = new Date();

      root.innerHTML = `
        <section class="page home reveal">
          <div class="home-top" style="--i:0">
            <span class="wordmark">FORJA</span>
            <span class="t-eyebrow">${U.fmtWeekdayDate(now)}</span>
          </div>

          <header class="home-hello" style="--i:1">
            <h1 class="t-large-title" data-large-title>${U.greeting(now)}${name ? `, ${esc(name)}` : ''}.</h1>
            <p class="t-sub mt-2">${live ? 'Seu treino está em andamento.' : workout ? 'Seu treino está pronto.' : 'Vamos montar sua rotina.'}</p>
          </header>

          <div class="mt-12" style="--i:2">
            <p class="t-eyebrow mb-4">${live ? 'Treino em andamento' : workout ? 'Seu próximo treino' : 'Comece por aqui'}</p>
            ${live ? Home.heroLive(live) : workout ? Home.heroWorkout(workout) : Home.heroEmpty()}
          </div>

          <div class="section" style="--i:3">
            <div class="section-head"><p class="t-eyebrow">Esta semana</p></div>
            <div class="stats ${week.count ? '' : 'is-empty'}">
              <div class="stat">
                <span class="stat-value">${week.count}</span>
                <span class="stat-label">${week.count === 1 ? 'Treino' : 'Treinos'}</span>
              </div>
              <div class="stat">
                <span class="stat-value">${U.fmtVolume(week.volume, { withUnit: false })}</span>
                <span class="stat-label">${U.currentUnit()} de volume</span>
              </div>
              <div class="stat">
                <span class="stat-value">${time.value}<small>${time.unit}</small></span>
                <span class="stat-label">Treinando</span>
              </div>
            </div>
            ${week.count ? '' : '<p class="t-footnote mt-6">Sua semana começa no primeiro treino.</p>'}
          </div>
        </section>`;

      root.querySelectorAll('[data-action="create"]').forEach((b) => b.addEventListener('click', () => Workouts.openCreate()));
      root.querySelectorAll('[data-action="open"]').forEach((b) => b.addEventListener('click', () => Router.go(`workouts/${b.dataset.id}`)));
      root.querySelectorAll('[data-action="start"]').forEach((b) => b.addEventListener('click', () => Sessions.begin(b.dataset.id)));
      root.querySelectorAll('[data-action="resume"]').forEach((b) => b.addEventListener('click', () => Sessions.open()));
    },

    heroLive(a) {
      const done = a.exercises.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0);
      const total = a.exercises.reduce((n, e) => n + e.sets.length, 0);
      const elapsed = ((a.finishing ? new Date(a.finishing.endedAt) : Date.now()) - new Date(a.startedAt)) / 1000;
      return `
        <article class="hero" style="--tint:${esc(a.color || 'var(--accent)')}">
          <button type="button" class="hero-open" data-action="resume" aria-label="Continuar ${esc(a.name)}">
            <span class="badge"><span class="live-dot"></span>Em andamento</span>
            <span class="hero-name block">${esc(a.name)}</span>
            <span class="hero-clock block num" data-clock>${U.fmtClock(elapsed)}</span>
            <span class="t-callout block mt-1">${done} de ${total} séries</span>
          </button>
          <div class="hero-foot">
            <span class="t-footnote">${a.finishing ? 'Falta salvar' : 'Tempo total'}</span>
            <button class="btn btn-primary" data-action="resume">Continuar ${icon('arrowRight', { size: 18, stroke: 2 })}</button>
          </div>
        </article>`;
    },

    heroWorkout(w) {
      const last = Sessions.lastForWorkout(w.id);
      return `
        <article class="hero" style="--tint:${esc(w.color || 'var(--accent)')}">
          <button type="button" class="hero-open" data-action="open" data-id="${esc(w.id)}" aria-label="Ver ${esc(w.name)}">
            <span class="hero-name block">${esc(w.name)}</span>
            <span class="hero-meta block">${esc(Workouts.muscleSummary(w) || 'Sem exercícios ainda')}</span>
            <span class="t-callout block mt-1">${Workouts.exerciseCount(w)}</span>
          </button>
          <div class="hero-foot">
            <span class="t-footnote">${last ? `Último em ${U.fmtDayMonth(last.startedAt)}` : 'Primeira vez'}</span>
            <button class="btn btn-primary" data-action="start" data-id="${esc(w.id)}">Começar ${icon('arrowRight', { size: 18, stroke: 2 })}</button>
          </div>
        </article>`;
    },

    heroEmpty() {
      return `
        <article class="hero">
          <div class="hero-icon">${icon('dumbbell', { size: 26 })}</div>
          <h2 class="hero-name">Seu primeiro<br>treino.</h2>
          <p class="t-sub mt-4">Monte sua rotina uma vez. Depois é só abrir, treinar e registrar cada série.</p>
          <div class="hero-foot">
            <button class="btn btn-primary" data-action="create">Criar treino ${icon('arrowRight', { size: 18, stroke: 2 })}</button>
          </div>
        </article>`;
    }
  };

  /* ==========================================================================
     Perfil e configurações
     ========================================================================== */
  const Profile = {
    render(root) {
      const p = Store.get('profile') || {};
      const s = Store.get('settings');
      const t = Statistics.calculateTotals(Sessions.all());
      const vibrationSupported = typeof navigator.vibrate === 'function';

      const row = (key, label, value, iconName) => `
        <button class="row" data-edit="${key}">
          <span class="row-icon">${icon(iconName, { size: 20 })}</span>
          <span class="row-main row-title">${label}</span>
          <span class="row-value">${value || '<span class="t-faint">Definir</span>'}</span>
          ${icon('chevronRight', { size: 16, stroke: 2, cls: 'row-chevron' })}
        </button>`;

      const stat = (label, value) => `
        <div class="row">
          <span class="row-main row-title">${label}</span>
          <span class="row-value">${value}</span>
        </div>`;

      root.innerHTML = `
        <section class="page">
          <header class="page-header">
            <h1 class="t-large-title" data-large-title>Perfil</h1>
          </header>

          <div class="reveal">
            <button class="profile-id pressable" data-edit="name" style="--i:0">
              <span class="avatar">${esc(U.initial(p.name))}</span>
              <span class="min-w-0 text-left">
                <span class="t-title-2 block truncate">${esc(p.name || 'Sem nome')}</span>
                <span class="t-callout block mt-1">${esc(labelOf(GOALS, p.goal) || 'Defina seu objetivo')}</span>
              </span>
            </button>

            <div class="section" style="--i:1">
              <p class="t-eyebrow group-label">Você</p>
              <div class="group has-icons">
                ${row('weight', 'Peso', p.weightKg ? U.fmtWeight(p.weightKg) : '', 'scale')}
                ${row('height', 'Altura', p.heightCm ? `${p.heightCm} cm` : '', 'ruler')}
                ${row('goal', 'Objetivo', esc(labelOf(GOALS, p.goal)), 'target')}
                ${row('experience', 'Experiência', esc(labelOf(EXPERIENCE, p.experience)), 'bolt')}
              </div>
            </div>

            <div class="section" style="--i:2">
              <p class="t-eyebrow group-label">Estatísticas</p>
              <div class="group">
                ${stat('Treinos', U.fmtNum(t.count))}
                ${stat('Séries', U.fmtNum(t.sets))}
                ${stat('Repetições', U.fmtNum(t.reps))}
                ${stat('Volume total', U.fmtVolume(t.volume))}
                ${stat('Tempo treinando', U.fmtDuration(t.durationSec))}
              </div>
            </div>

            <div class="section" style="--i:3">
              <p class="t-eyebrow group-label">Preferências</p>
              <div class="group">
                <div class="row"><span class="row-main row-title">Tema</span><span class="row-control" data-slot="theme"></span></div>
                <div class="row"><span class="row-main row-title">Unidade</span><span class="row-control is-narrow" data-slot="unit"></span></div>
                <div class="row">
                  <span class="row-main">
                    <span class="row-title block">Vibração</span>
                    <span class="row-sub block">${vibrationSupported ? 'Ao concluir séries, recordes e treinos.' : 'Este navegador não oferece vibração.'}</span>
                  </span>
                  <span data-slot="haptics"></span>
                </div>
                <div class="row">
                  <span class="row-main row-title">Animações</span>
                  <span data-slot="animations"></span>
                </div>
              </div>
            </div>

            <div class="section" style="--i:4">
              <p class="t-eyebrow group-label">Dados</p>
              <div class="group">
                <button class="row is-danger" data-action="reset">
                  <span class="row-icon">${icon('trash', { size: 20 })}</span>
                  <span class="row-main row-title">Apagar todos os dados</span>
                </button>
              </div>
              <p class="t-footnote group-note">Tudo fica salvo apenas neste aparelho. Sem conta, sem nuvem.</p>
            </div>

            <p class="t-footnote text-center mt-14" style="--i:5"><span class="wordmark t-faint">FORJA</span></p>
          </div>
        </section>`;

      // Controles
      const slot = (name) => root.querySelector(`[data-slot="${name}"]`);
      slot('theme').appendChild(UI.segmented(
        [{ value: 'dark', label: 'Escuro' }, { value: 'light', label: 'Claro' }, { value: 'system', label: 'Sistema' }],
        s.theme,
        (v) => { Store.update('settings', (x) => { x.theme = v; }); applyTheme(); },
        { label: 'Tema' }
      ));
      slot('unit').appendChild(UI.segmented(
        [{ value: 'kg', label: 'kg' }, { value: 'lb', label: 'lb' }],
        s.unit,
        (v) => { Store.update('settings', (x) => { x.unit = v; }); setTimeout(() => Router.refresh(), 220); },
        { label: 'Unidade' }
      ));
      slot('haptics').appendChild(UI.toggle(s.haptics, (v) => {
        Store.update('settings', (x) => { x.haptics = v; });
        if (v) U.haptic('success');
      }, { label: 'Vibração' }));
      slot('animations').appendChild(UI.toggle(s.animations, (v) => {
        Store.update('settings', (x) => { x.animations = v; });
        applyTheme();
      }, { label: 'Animações' }));

      root.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => Profile.edit(b.dataset.edit)));
      root.querySelector('[data-action="reset"]').addEventListener('click', Profile.confirmReset);
    },

    save(patch) {
      Store.update('profile', (p) => Object.assign(p || {}, patch, { updatedAt: new Date().toISOString() }));
      Router.refresh();
      UI.toast('Salvo');
    },

    edit(field) {
      const p = Store.get('profile') || {};
      const unit = U.currentUnit();
      if (field === 'name') {
        UI.inputSheet({
          title: 'Seu nome', value: p.name || '', placeholder: 'Nome', maxlength: 30,
          validate: Validate.name, onSave: (name) => Profile.save({ name })
        });
      } else if (field === 'weight') {
        UI.inputSheet({
          title: 'Peso', subtitle: 'Também entra no seu histórico de peso corporal.',
          value: weightInputValue(p.weightKg), placeholder: '0,0', suffix: unit, inputmode: 'decimal', maxlength: 6,
          validate: (v) => Validate.weight(v, unit),
          onSave: (kg) => { logBodyweight(kg); Profile.save({ weightKg: kg }); }
        });
      } else if (field === 'height') {
        UI.inputSheet({
          title: 'Altura', value: p.heightCm || '', placeholder: '175', suffix: 'cm', inputmode: 'numeric', maxlength: 5,
          validate: Validate.height, onSave: (heightCm) => Profile.save({ heightCm })
        });
      } else if (field === 'goal') {
        UI.choiceSheet({ title: 'Objetivo', options: GOALS, value: p.goal, onSelect: (goal) => Profile.save({ goal }) });
      } else if (field === 'experience') {
        UI.choiceSheet({ title: 'Experiência', options: EXPERIENCE, value: p.experience, onSelect: (experience) => Profile.save({ experience }) });
      }
    },

    confirmReset() {
      UI.confirmSheet({
        title: 'Apagar todos os dados?',
        message: 'Treinos, histórico, recordes e perfil serão removidos deste aparelho. Essa ação não pode ser desfeita.',
        confirmLabel: 'Apagar tudo',
        destructive: true,
        onConfirm: () => {
          Store.clearAll();
          history.replaceState(null, '', location.pathname);
          location.reload();
        }
      });
    }
  };

  /* ==========================================================================
     Navegação
     ========================================================================== */
  const TABS = [
    { route: 'home', label: 'Início', icon: 'home', title: 'FORJA', render: (el) => Home.render(el) },
    { route: 'workouts', label: 'Treinos', icon: 'dumbbell', title: 'Treinos', render: (el, p) => Workouts.renderScreen(el, p) },
    { route: 'exercises', label: 'Exercícios', icon: 'list', title: 'Exercícios', render: (el) => global.Exercises.renderScreen(el) },
    { route: 'progress', label: 'Evolução', icon: 'chart', title: 'Evolução', render: (el) => global.Progress.renderScreen(el) },
    { route: 'profile', label: 'Perfil', icon: 'user', title: 'Perfil', render: (el) => Profile.render(el) }
  ];

  /* Rotas: #/aba ou #/aba/parâmetro (ex.: #/workouts/w_123).
     Entrar num nível mais fundo desliza da direita; voltar desliza da esquerda. */
  const Router = (() => {
    let current = null;       // { route, params, path }
    let observer = null;
    let pushed = 0;           // telas abertas com go() nesta sessão (para o "voltar" usar o histórico)
    const scrollMemory = {};

    function parse() {
      const segs = location.hash.replace(/^#\/?/, '').split('?')[0].split('/').filter(Boolean).map(decodeURIComponent);
      const route = TABS.some((t) => t.route === segs[0]) ? segs[0] : 'home';
      const params = route === segs[0] ? segs.slice(1) : [];
      return { route, params, path: [route].concat(params).join('/') };
    }

    function go(path) {
      const target = `#/${path}`;
      if (location.hash === target) return render();
      if (path.split('/').length > 1) pushed++;
      location.hash = target; // hashchange chama render()
    }

    // Volta pelo histórico quando possível; senão, vai direto para a raiz da aba
    function back(fallback) {
      const root = fallback || (current ? current.route : 'home');
      if (pushed > 0) { pushed--; history.back(); }
      else location.replace(`#/${root}`);
    }

    function render({ animate = true, keepScroll = false } = {}) {
      const next = parse();
      const tab = TABS.find((t) => t.route === next.route);
      const samePath = current && current.path === next.path;
      if (current && !samePath) scrollMemory[current.path] = global.scrollY;
      if (!next.params.length) pushed = 0;

      let motion = '';
      if (animate && !samePath) {
        const prevDepth = current ? current.params.length : 0;
        const sameTab = current && current.route === next.route;
        if (sameTab && next.params.length > prevDepth) motion = 'screen-push';
        else if (sameTab && next.params.length < prevDepth) motion = 'screen-pop';
        else motion = 'screen-enter';
      }

      const screen = document.createElement('div');
      screen.className = `screen ${motion}`.trim();
      screen.dataset.route = next.route;
      tab.render(screen, next.params);

      // Telas novas começam no topo; ao voltar, restaura a posição anterior
      let y = 0;
      if (keepScroll || samePath) y = global.scrollY;
      else if (motion !== 'screen-push') y = scrollMemory[next.path] || 0;
      $('#view').replaceChildren(screen);
      global.scrollTo(0, y);

      current = next;
      document.title = next.route === 'home' ? 'FORJA' : `${tab.label} · FORJA`;
      $('#topbar-title').textContent = tab.title;
      $$tabs().forEach((a) => {
        if (a.dataset.route === next.route) a.setAttribute('aria-current', 'page');
        else a.removeAttribute('aria-current');
      });
      observeLargeTitle(screen);
      Sessions.syncActiveBar();
    }

    const refresh = () => render({ animate: false, keepScroll: true });

    // Barra compacta: aparece quando o título grande sai da tela.
    // Telas com navbar própria (detalhe) usam a dela; as demais, a barra global.
    function observeLargeTitle(screen) {
      if (observer) observer.disconnect();
      const topbar = $('#topbar');
      const navbar = screen.querySelector('.navbar');
      const title = screen.querySelector('[data-large-title]');
      topbar.classList.remove('is-visible');
      if (!title || !('IntersectionObserver' in global)) return;
      const bar = navbar || topbar;
      const cls = navbar ? 'is-scrolled' : 'is-visible';
      observer = new IntersectionObserver(([entry]) => {
        bar.classList.toggle(cls, !entry.isIntersecting && entry.boundingClientRect.top < bar.offsetHeight);
      }, { rootMargin: `-${bar.offsetHeight}px 0px 0px 0px`, threshold: 0 });
      observer.observe(title);
    }

    const $$tabs = () => U.$$('#tabbar .tab');

    function buildTabbar() {
      const nav = $('#tabbar');
      nav.innerHTML = TABS.map((t) => `
        <a class="tab" href="#/${t.route}" data-route="${t.route}">
          ${icon(t.icon, { size: 25, stroke: 1.6 })}
          <span>${t.label}</span>
        </a>`).join('');
      // Tocar na aba atual: numa tela interna volta à raiz; na raiz, rola ao topo
      nav.addEventListener('click', (e) => {
        const a = e.target.closest('.tab');
        if (!a || !current || a.dataset.route !== current.route) return;
        e.preventDefault();
        if (current.params.length) { pushed = 0; location.hash = `#/${current.route}`; return; }
        const smooth = Store.get('settings').animations !== false;
        global.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' });
      });
    }

    // Deslizar da borda esquerda volta (telas internas); o botão "voltar" continua disponível
    function enableEdgeSwipe() {
      const view = $('#view');
      let s = null;
      view.addEventListener('touchstart', (e) => {
        if (!current || !current.params.length || e.touches.length !== 1) return;
        const t = e.touches[0];
        if (t.clientX > 24) return;
        s = { x: t.clientX, y: t.clientY, dx: 0, el: view.firstElementChild };
      }, { passive: true });
      view.addEventListener('touchmove', (e) => {
        if (!s) return;
        const t = e.touches[0];
        s.dx = Math.max(0, t.clientX - s.x);
        if (Math.abs(t.clientY - s.y) > 60 && s.dx < 30) { s.el.style.transform = ''; s = null; return; }
        s.el.style.transition = 'none';
        s.el.style.transform = `translate3d(${s.dx}px,0,0)`;
      }, { passive: true });
      view.addEventListener('touchend', () => {
        if (!s) return;
        const { el, dx } = s;
        s = null;
        el.style.transition = 'transform 220ms cubic-bezier(.22,1,.36,1)';
        if (dx > 90) { el.style.transform = 'translate3d(100%,0,0)'; setTimeout(() => back(), 160); }
        else el.style.transform = '';
      });
    }

    function start() {
      buildTabbar();
      global.addEventListener('hashchange', () => render());
      // Qualquer [data-back] dentro das telas volta
      $('#view').addEventListener('click', (e) => { if (e.target.closest('[data-back]')) back(); });
      enableEdgeSwipe();
      render();
    }

    return { go, back, render, refresh, start, current: () => current };
  })();

  /* ==========================================================================
     Primeiro acesso
     ========================================================================== */
  const Onboarding = (() => {
    const STEPS = ['welcome', 'name', 'weight', 'height', 'goal', 'done'];
    const QUESTIONS = 4; // name, weight, height, goal
    let index = 0;
    let draft = {};
    let lastProgress = 0;
    let onFinish = null;

    const root = () => $('#onboarding');

    function start(done) {
      onFinish = done;
      draft = Object.assign({}, Store.get('profile') || {});
      index = U.clamp(Store.get('meta').onboardingStep || 0, 0, STEPS.length - 1);
      root().hidden = false;
      $('#toast-host').classList.add('is-raised');
      trackViewport(true);
      render('fade');
    }

    // Cada passo é salvo: recarregar a página retoma de onde parou
    function persist() {
      Store.set('profile', draft);
      Store.update('meta', (m) => { m.onboardingStep = index; });
    }

    function goTo(i, dir) {
      index = U.clamp(i, 0, STEPS.length - 1);
      persist();
      render(dir);
    }

    const VIEWS = {
      welcome: () => `
        <div class="flex-1 flex flex-col justify-center">
          <p class="t-display">FORJA</p>
          <p class="t-title-2 t-muted mt-5">Sua evolução<br>começa aqui.</p>
        </div>
        <div class="ob-foot"><button class="btn btn-primary btn-block" type="submit">Começar</button></div>`,

      name: () => `
        <div class="ob-content">
          <h1 class="t-large-title">Como podemos<br>chamar você?</h1>
          <div class="mt-10">
            <input class="ob-input" name="value" type="text" autocomplete="given-name" autocapitalize="words"
                   spellcheck="false" enterkeyhint="next" maxlength="30" placeholder="Seu nome" value="${esc(draft.name || '')}">
          </div>
          <p class="field-error" aria-live="polite"></p>
        </div>
        <div class="ob-foot"><button class="btn btn-primary btn-block" type="submit">Continuar</button></div>`,

      weight: () => `
        <div class="ob-content">
          <h1 class="t-large-title">Qual seu peso?</h1>
          <p class="t-callout mt-3">O ponto de partida para acompanhar sua evolução.</p>
          <div class="mt-10 ob-input-wrap">
            <input class="ob-input num" name="value" inputmode="decimal" autocomplete="off" enterkeyhint="next"
                   maxlength="6" placeholder="0,0" value="${esc(weightInputValue(draft.weightKg))}">
            <span class="ob-unit" data-unit>${U.currentUnit()}</span>
          </div>
          <p class="field-error" aria-live="polite"></p>
          <div class="mt-2" style="width:132px" data-slot="unit"></div>
        </div>
        <div class="ob-foot"><button class="btn btn-primary btn-block" type="submit">Continuar</button></div>`,

      height: () => `
        <div class="ob-content">
          <h1 class="t-large-title">Qual sua altura?</h1>
          <p class="t-callout mt-3">Em centímetros.</p>
          <div class="mt-10 ob-input-wrap">
            <input class="ob-input num" name="value" inputmode="numeric" autocomplete="off" enterkeyhint="next"
                   maxlength="3" placeholder="175" value="${esc(draft.heightCm || '')}">
            <span class="ob-unit">cm</span>
          </div>
          <p class="field-error" aria-live="polite"></p>
        </div>
        <div class="ob-foot"><button class="btn btn-primary btn-block" type="submit">Continuar</button></div>`,

      goal: () => `
        <div class="ob-content">
          <h1 class="t-large-title">Qual seu objetivo?</h1>
          <div class="mt-8" role="radiogroup" aria-label="Objetivo">
            ${GOALS.map((g) => `
              <button type="button" class="option" role="radio" aria-checked="${draft.goal === g.value}" data-value="${g.value}">
                <span>${g.label}</span>
                <span class="option-check">${icon('check', { size: 14, stroke: 2.6 })}</span>
              </button>`).join('')}
          </div>
        </div>
        <div class="ob-foot"><button class="btn btn-primary btn-block" type="submit" ${draft.goal ? '' : 'disabled'}>Continuar</button></div>`,

      done: () => `
        <div class="flex-1 flex flex-col justify-center">
          <div class="ob-check">${icon('check', { size: 40, stroke: 2.4 })}</div>
          <h1 class="t-title" style="font-size:44px;letter-spacing:-0.04em">Tudo pronto.</h1>
          <p class="t-title-2 t-muted mt-4">Agora vamos criar<br>seu primeiro treino.</p>
        </div>
        <div class="ob-foot">
          <button class="btn btn-primary btn-block" type="button" data-finish="create">Criar meu treino</button>
          <button class="btn btn-ghost is-muted btn-block" type="button" data-finish="later">Fazer depois</button>
        </div>`
    };

    function render(dir) {
      const step = STEPS[index];
      const el = root();
      const q = STEPS.indexOf(step); // 1..4 são perguntas
      const isQuestion = q >= 1 && q <= QUESTIONS;
      const progress = isQuestion ? (q / QUESTIONS) * 100 : lastProgress;
      const skippable = step === 'weight' || step === 'height';

      el.dataset.step = step;
      el.innerHTML = `
        <div class="ob-frame">
          <div class="ob-nav" style="${isQuestion ? '' : 'visibility:hidden'}">
            <button class="icon-btn is-plain" type="button" data-back aria-label="Voltar">${icon('chevronLeft', { size: 22, stroke: 2 })}</button>
            <div class="ob-progress" role="progressbar" aria-valuemin="0" aria-valuemax="${QUESTIONS}" aria-valuenow="${isQuestion ? q : 0}">
              <span style="width:${lastProgress}%"></span>
            </div>
            <button class="btn btn-ghost is-muted btn-sm" type="button" data-skip style="${skippable ? '' : 'visibility:hidden'}">Pular</button>
          </div>
          <form class="ob-step step-in-${dir}" novalidate>${VIEWS[step]()}</form>
        </div>`;

      requestAnimationFrame(() => {
        const bar = el.querySelector('.ob-progress span');
        if (bar) bar.style.width = `${progress}%`;
      });
      lastProgress = progress;
      bind(step, el);
    }

    function showError(form, message) {
      const input = form.querySelector('input');
      const error = form.querySelector('.field-error');
      if (error) error.textContent = message;
      if (input) input.focus({ preventScroll: true });
      form.classList.remove('shake');
      void form.offsetWidth;
      form.classList.add('shake');
    }

    function bind(step, el) {
      const form = el.querySelector('form');
      const input = form.querySelector('input[name="value"]');

      el.querySelector('[data-back]').addEventListener('click', () => goTo(index - 1, 'prev'));
      el.querySelector('[data-skip]').addEventListener('click', () => {
        if (step === 'weight') delete draft.weightKg;
        if (step === 'height') delete draft.heightCm;
        goTo(index + 1, 'next');
      });

      if (input) {
        const wrap = input.closest('.ob-input-wrap');
        // Campos numéricos crescem com o valor, para a unidade ficar colada ao número
        const autosize = () => {
          if (!wrap) return;
          const len = Math.max(input.value.length || input.placeholder.length, 2);
          input.style.width = `${len + 0.5}ch`;
        };
        input.addEventListener('input', () => {
          const e = form.querySelector('.field-error');
          if (e) e.textContent = '';
          autosize();
        });
        if (wrap) wrap.addEventListener('click', () => input.focus());
        autosize();
        U.submitOnEnter(input, form);
        input.focus({ preventScroll: true });
      }

      if (step === 'weight') {
        form.querySelector('[data-slot="unit"]').appendChild(UI.segmented(
          [{ value: 'kg', label: 'kg' }, { value: 'lb', label: 'lb' }],
          U.currentUnit(),
          (unit) => {
            // Converte o que já foi digitado para a nova unidade
            const typed = U.parseDecimal(input.value);
            const prev = unit === 'kg' ? 'lb' : 'kg';
            Store.update('settings', (s) => { s.unit = unit; });
            if (Number.isFinite(typed)) input.value = U.fmtNum(U.round(U.toUnit(U.fromUnit(typed, prev), unit), 1), 1).replace(/\./g, '');
            form.querySelector('[data-unit]').textContent = unit;
            input.dispatchEvent(new Event('input'));
          },
          { label: 'Unidade' }
        ));
      }

      if (step === 'goal') {
        const submit = form.querySelector('[type="submit"]');
        form.addEventListener('click', (e) => {
          const opt = e.target.closest('.option');
          if (!opt) return;
          form.querySelectorAll('.option').forEach((o) => o.setAttribute('aria-checked', String(o === opt)));
          draft.goal = opt.dataset.value;
          submit.disabled = false;
          persist();
        });
      }

      el.querySelectorAll('[data-finish]').forEach((b) => b.addEventListener('click', () => finish(b.dataset.finish)));

      form.addEventListener('submit', (e) => {
        e.preventDefault();
        if (step === 'name') {
          const r = Validate.name(input.value);
          if (!r.ok) return showError(form, r.error);
          draft.name = r.value;
        } else if (step === 'weight') {
          if (!input.value.trim()) return showError(form, 'Digite seu peso ou toque em Pular.');
          const r = Validate.weight(input.value);
          if (!r.ok) return showError(form, r.error);
          draft.weightKg = r.value;
        } else if (step === 'height') {
          if (!input.value.trim()) return showError(form, 'Digite sua altura ou toque em Pular.');
          const r = Validate.height(input.value);
          if (!r.ok) return showError(form, r.error);
          draft.heightCm = r.value;
        } else if (step === 'goal' && !draft.goal) {
          return;
        }
        goTo(index + 1, step === 'welcome' ? 'next' : 'next');
      });
    }

    function finish(choice) {
      const now = new Date().toISOString();
      const profile = Object.assign({ experience: null }, draft, { createdAt: draft.createdAt || now, updatedAt: now });
      Store.set('profile', profile);
      if (profile.weightKg) logBodyweight(profile.weightKg);
      Store.update('meta', (m) => { m.onboarded = true; m.onboardingStep = 0; m.createdAt = m.createdAt || now; });

      onFinish(choice);
      const el = root();
      el.classList.add('fade-out');
      setTimeout(() => {
        el.hidden = true;
        el.classList.remove('fade-out');
        el.innerHTML = '';
        trackViewport(false);
        $('#toast-host').classList.remove('is-raised');
      }, 320);
    }

    // Mantém os botões inferiores acima do teclado virtual (iOS/Android)
    function syncViewport() {
      const vv = global.visualViewport;
      if (!vv) return;
      document.documentElement.style.setProperty('--vvh', `${vv.height}px`);
      root().style.transform = vv.offsetTop ? `translateY(${vv.offsetTop}px)` : '';
    }
    function trackViewport(on) {
      const vv = global.visualViewport;
      if (!vv) return;
      if (on) {
        vv.addEventListener('resize', syncViewport);
        vv.addEventListener('scroll', syncViewport);
        syncViewport();
      } else {
        vv.removeEventListener('resize', syncViewport);
        vv.removeEventListener('scroll', syncViewport);
        root().style.transform = '';
      }
    }

    return { start };
  })();

  /* ==========================================================================
     Inicialização
     ========================================================================== */
  let started = false;

  function startApp(choice) {
    if (started) return;
    started = true;
    if (choice === 'create') history.replaceState(null, '', '#/workouts');
    $('#app').hidden = false;
    $('#active-bar').addEventListener('click', () => Sessions.open());
    Router.start();
    Sessions.syncClock();
    if (choice === 'create') setTimeout(() => Workouts.openCreate(), 350);
    // Treino não finalizado (navegador fechado no meio): oferece continuar
    else if (Sessions.active()) setTimeout(() => Sessions.promptRecovery(), 450);
  }

  function init() {
    Store.checkAvailable();
    Store.migrate();
    applyTheme();

    // Habilita :active em toques no iOS
    document.addEventListener('touchstart', () => {}, { passive: true });

    Store.subscribe((evt) => {
      if (evt.type === 'error') UI.toast('Não foi possível salvar neste aparelho.', { iconName: 'info', duration: 4000 });
      if (evt.type === 'external' && started) { applyTheme(); Router.refresh(); }
    });

    if (!Store.isAvailable()) {
      UI.toast('Armazenamento indisponível: seus dados não serão salvos.', { iconName: 'info', duration: 6000 });
    }

    if (Store.get('meta').onboarded) startApp();
    else Onboarding.start(startApp);
  }

  global.App = { Router, Home, Profile, Validate, GOALS, EXPERIENCE, applyTheme, logBodyweight };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
