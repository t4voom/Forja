/* FORJA — planos Free e Premium
   · Plano da conta: Backend.user().plan ('free' | 'premium').
   · Plans.gate('chave', fn): roda fn no Premium; no Free, abre o paywall daquela função.
   · Qualquer elemento com data-paywall="chave" abre o paywall ao ser tocado.
   · O pagamento ainda é SIMULADO: "Assinar" só troca o plano (Backend.setPlan).
   Telas: escolha depois do cadastro (renderChoice) · #/profile/plan (render) */
(function (global) {
  'use strict';
  const { U, UI } = global;
  const { esc, icon } = U;
  const CFG = global.FORJA_CONFIG || {};
  const PRICE = Object.assign({ monthly: 9.9, yearly: 79.9 }, CFG.price);
  const FREE_WORKOUTS = (CFG.freeLimits || {}).workouts || 3;
  const Router = () => global.App.Router;

  const money = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
  const yearlyPerMonth = () => PRICE.yearly / 12;
  const yearlySaving = () => Math.round((1 - PRICE.yearly / (PRICE.monthly * 12)) * 100);

  /* ---------- O que cada plano tem ---------- */
  // free: true | false | texto · premium: true | texto
  const COMPARE = [
    { label: 'Registrar treinos, séries e cargas', free: true, premium: true },
    { label: 'Biblioteca de exercícios', free: true, premium: true },
    { label: 'Treinos personalizados', free: `Até ${FREE_WORKOUTS}`, premium: 'Ilimitados' },
    { label: 'Histórico e sequência', free: true, premium: true },
    { label: 'Gráficos de volume e frequência', free: true, premium: true },
    { label: 'Programas prontos com progressão', free: false, premium: true },
    { label: 'Coach: quando subir a carga', free: false, premium: true },
    { label: 'Equilíbrio muscular', free: false, premium: true },
    { label: 'Evolução por exercício e recordes', free: false, premium: true },
    { label: 'Metas e conquistas', free: false, premium: true },
    { label: 'Lembretes de treino e peso', free: false, premium: true },
    { label: 'Card para compartilhar o treino', free: false, premium: true }
  ];

  // Destaques do Premium (cartão do plano e paywall)
  const PERKS = [
    { icon: 'layers', text: '5 programas prontos com progressão de 8 semanas' },
    { icon: 'sparkle', text: 'Coach que diz quando subir a carga' },
    { icon: 'balance', text: 'Mapa de equilíbrio muscular' },
    { icon: 'chart', text: 'Evolução por exercício, recordes e metas' },
    { icon: 'bell', text: 'Lembretes de treino e de peso' },
    { icon: 'dumbbell', text: 'Treinos ilimitados' }
  ];

  // Texto do paywall para cada função bloqueada
  const GATES = {
    programs: { icon: 'layers', title: 'Programas prontos', text: 'Full Body, ABC, Upper/Lower, Push/Pull/Legs e ABCDE, com treinos que se ajustam sozinhos a cada semana.' },
    workouts: { icon: 'dumbbell', title: 'Treinos ilimitados', text: `No Free você pode ter até ${FREE_WORKOUTS} treinos. No Premium, quantos quiser.` },
    coach: { icon: 'sparkle', title: 'Coach de carga', text: 'O Coach analisa seus últimos treinos e diz quando subir a carga, quando manter e quando dar um passo atrás.' },
    balance: { icon: 'balance', title: 'Equilíbrio muscular', text: 'Veja no mapa do corpo quais músculos estão sendo treinados de menos e receba sugestões para equilibrar.' },
    analytics: { icon: 'chart', title: 'Evolução completa', text: 'Carga por exercício, recordes, calendário de consistência, metas e conquistas.' },
    reminders: { icon: 'bell', title: 'Lembretes', text: 'Aviso na hora do treino e no dia de se pesar, com notificações e integração com o calendário do celular.' },
    share: { icon: 'share', title: 'Compartilhar treino', text: 'Gere um card bonito com o resumo do treino para postar nos stories.' }
  };

  const user = () => (global.Backend && global.Backend.user()) || null;
  const plan = () => ((user() || {}).plan === 'premium' ? 'premium' : 'free');
  const isPremium = () => plan() === 'premium';

  /* ==========================================================================
     Bloqueios
     ========================================================================== */
  function gate(key, fn) {
    if (isPremium()) return fn();
    openPaywall(key);
  }

  // Treinos: o Free tem limite
  function canCreateWorkout() {
    return isPremium() || global.Workouts.all().length < FREE_WORKOUTS;
  }

  function openPaywall(key) {
    const g = GATES[key] || GATES.analytics;
    const others = PERKS.filter((p) => p.icon !== g.icon).slice(0, 4);
    const body = U.h(`
      <div class="pw">
        <span class="pw-icon">${icon(g.icon, { size: 28, stroke: 1.7 })}</span>
        <p class="t-eyebrow t-accent mt-5">FORJA Premium</p>
        <h2 class="pw-title">${esc(g.title)}</h2>
        <p class="t-callout mt-2">${esc(g.text)}</p>
        <ul class="pw-perks">
          ${others.map((p) => `<li>${icon('check', { size: 16, stroke: 2.4 })}<span>${esc(p.text)}</span></li>`).join('')}
        </ul>
        <p class="pw-price"><strong>${money(PRICE.monthly)}</strong>/mês · cancele quando quiser</p>
      </div>`);
    const footer = U.h(`
      <div class="grid gap-2">
        <button type="button" class="btn btn-primary btn-block" data-plans>Ver planos</button>
        <button type="button" class="btn btn-ghost is-muted btn-block" data-sheet-close>Agora não</button>
      </div>`);
    const sheet = UI.openSheet({ body, footer, closeButton: true });
    footer.querySelector('[data-sheet-close]').addEventListener('click', () => sheet.close('cancel'));
    footer.querySelector('[data-plans]').addEventListener('click', () => {
      sheet.close('plans');
      if (global.Sessions && global.Sessions.isOpen && global.Sessions.isOpen()) global.Sessions.minimize();
      UI.closeAllSheets();
      setTimeout(() => Router().go('profile/plan'), 120);
    });
  }

  // Cartão no lugar de uma seção bloqueada
  function lockedHTML(key, { title, text } = {}) {
    const g = GATES[key] || GATES.analytics;
    return `
      <section class="section">
        <div class="lock-card">
          <span class="lock-card-top">
            <span class="lock-card-icon">${icon(g.icon, { size: 22, stroke: 1.7 })}</span>
            <span class="premium-pill">${icon('lock', { size: 11, stroke: 2.4 })} Premium</span>
          </span>
          <p class="lock-card-title">${esc(title || g.title)}</p>
          <p class="t-callout mt-1">${esc(text || g.text)}</p>
          <button type="button" class="btn btn-primary btn-sm mt-5" data-paywall="${esc(key)}">Desbloquear</button>
        </div>
      </section>`;
  }

  // Tela inteira bloqueada (rotas como #/progress/balance)
  function renderLocked(root, key, backLabel) {
    const g = GATES[key] || GATES.analytics;
    root.innerHTML = `
      ${UI.navbarHTML(g.title, backLabel)}
      <section class="page has-navbar">
        <div class="locked-page">
          <span class="pw-icon is-large">${icon(g.icon, { size: 34, stroke: 1.6 })}</span>
          <span class="premium-pill mt-6">${icon('lock', { size: 11, stroke: 2.4 })} Premium</span>
          <h1 class="t-large-title mt-4">${esc(g.title)}</h1>
          <p class="t-sub mt-3">${esc(g.text)}</p>
          <button type="button" class="btn btn-primary btn-block mt-8" data-go-plans>Ver planos</button>
          <p class="t-footnote mt-4">A partir de ${money(yearlyPerMonth())}/mês no plano anual.</p>
        </div>
      </section>`;
    root.querySelector('[data-go-plans]').addEventListener('click', () => Router().go('profile/plan'));
  }

  // Selo "Premium" para linhas e cartões
  const pill = () => (isPremium() ? '' : `<span class="premium-pill">${icon('lock', { size: 11, stroke: 2.4 })} Premium</span>`);

  /* ==========================================================================
     Tela de planos
     ========================================================================== */
  const state = { billing: 'monthly' };

  function cell(v) {
    if (v === true) return `<span class="cmp-yes" aria-label="Incluído">${icon('check', { size: 16, stroke: 2.6 })}</span>`;
    if (v === false) return '<span class="cmp-no" aria-label="Não incluído">—</span>';
    return `<span class="cmp-text">${esc(v)}</span>`;
  }

  function pageHTML({ choosing }) {
    const premium = isPremium();
    const yearly = state.billing === 'yearly';
    return `
      <div class="plans">
        <div class="plans-billing" data-slot="billing"></div>

        <article class="plan-card is-premium ${premium ? 'is-current' : ''}">
          <span class="plan-card-head">
            <span class="plan-name">Premium</span>
            <span class="badge is-inline">${premium ? 'Seu plano' : 'Mais completo'}</span>
          </span>
          <p class="plan-price num">${money(yearly ? PRICE.yearly : PRICE.monthly)}<small>/${yearly ? 'ano' : 'mês'}</small></p>
          <p class="t-footnote plan-price-note">${yearly ? `Equivale a ${money(yearlyPerMonth())}/mês · economize ${yearlySaving()}%` : `ou ${money(PRICE.yearly)}/ano, economizando ${yearlySaving()}%`}</p>
          <ul class="plan-perks">
            ${PERKS.map((p) => `<li><span class="plan-perk-icon">${icon(p.icon, { size: 16, stroke: 1.9 })}</span><span>${esc(p.text)}</span></li>`).join('')}
          </ul>
          ${premium
            ? '<button type="button" class="btn btn-secondary btn-block mt-6" disabled>Você já é Premium</button>'
            : `<button type="button" class="btn btn-primary btn-block mt-6" data-subscribe>Assinar Premium</button>`}
        </article>

        <article class="plan-card ${premium ? '' : 'is-current'}">
          <span class="plan-card-head">
            <span class="plan-name">Free</span>
            ${premium ? '' : '<span class="badge is-inline is-muted">Seu plano</span>'}
          </span>
          <p class="plan-price num">${money(0)}<small>/sempre</small></p>
          <p class="t-footnote plan-price-note">O essencial para registrar seus treinos.</p>
          <ul class="plan-perks is-free">
            <li><span class="plan-perk-icon">${icon('check', { size: 16, stroke: 2.2 })}</span><span>Registrar treinos, séries e cargas</span></li>
            <li><span class="plan-perk-icon">${icon('check', { size: 16, stroke: 2.2 })}</span><span>Até ${FREE_WORKOUTS} treinos personalizados</span></li>
            <li><span class="plan-perk-icon">${icon('check', { size: 16, stroke: 2.2 })}</span><span>Histórico, sequência e gráficos básicos</span></li>
          </ul>
          ${choosing ? '<button type="button" class="btn btn-secondary btn-block mt-6" data-free>Continuar no Free</button>'
            : premium ? '<button type="button" class="btn btn-ghost is-muted btn-block mt-4" data-downgrade>Voltar para o Free</button>' : ''}
        </article>

        <section class="section">
          <p class="t-eyebrow group-label">Compare</p>
          <div class="cmp">
            <div class="cmp-row cmp-head"><span></span><span>Free</span><span>Premium</span></div>
            ${COMPARE.map((r) => `<div class="cmp-row"><span class="cmp-label">${esc(r.label)}</span>${cell(r.free)}${cell(r.premium)}</div>`).join('')}
          </div>
        </section>

        <p class="t-footnote text-center mt-8 plans-note">${icon('info', { size: 14, stroke: 2 })} Pagamento simulado: nenhuma cobrança é feita nesta versão.</p>
      </div>`;
  }

  function bindPage(root, { choosing, onDone }) {
    root.querySelector('[data-slot="billing"]').appendChild(UI.segmented(
      [{ value: 'monthly', label: 'Mensal' }, { value: 'yearly', label: `Anual · −${yearlySaving()}%` }],
      state.billing,
      (v) => { state.billing = v; setTimeout(() => repaint(), 180); },
      { label: 'Cobrança' }
    ));
    const repaint = () => {
      const host = root.querySelector('[data-plans-host]');
      host.innerHTML = pageHTML({ choosing });
      bindPage(root, { choosing, onDone });
    };
    root.querySelector('[data-subscribe]')?.addEventListener('click', () => openCheckout(() => { repaint(); if (onDone) onDone('premium'); }));
    root.querySelector('[data-free]')?.addEventListener('click', () => onDone && onDone('free'));
    root.querySelector('[data-downgrade]')?.addEventListener('click', () => UI.confirmSheet({
      title: 'Voltar para o Free?',
      message: 'Você perde o acesso aos recursos Premium. Seus dados continuam salvos e voltam se você assinar de novo.',
      confirmLabel: 'Voltar para o Free', destructive: true,
      onConfirm: () => setPlan('free').then(() => { repaint(); UI.toast('Você está no plano Free'); })
    }));
  }

  // Resumo da assinatura (simulada)
  function openCheckout(done) {
    const yearly = state.billing === 'yearly';
    const body = U.h(`
      <div>
        <div class="group">
          <div class="row"><span class="row-main row-title">FORJA Premium</span><span class="row-value">${yearly ? 'Anual' : 'Mensal'}</span></div>
          <div class="row"><span class="row-main row-title">Total</span><span class="row-value num"><strong class="t-body">${money(yearly ? PRICE.yearly : PRICE.monthly)}</strong>/${yearly ? 'ano' : 'mês'}</span></div>
        </div>
        <p class="t-footnote group-note">${icon('info', { size: 13, stroke: 2, cls: 'inline-icon' })} Simulação: nenhum pagamento é feito. O pagamento real (Pix e cartão) entra junto com o servidor.</p>
        <div class="sheet-actions">
          <button type="button" class="btn btn-primary btn-block" data-confirm>Confirmar assinatura</button>
        </div>
      </div>`);
    const sheet = UI.openSheet({ title: 'Assinar Premium', body });
    const btn = body.querySelector('[data-confirm]');
    btn.addEventListener('click', () => {
      btn.disabled = true;
      btn.textContent = 'Confirmando…';
      setPlan('premium').then(() => {
        sheet.close('done');
        U.haptic('success');
        celebrate();
        done();
      }).catch((e) => { btn.disabled = false; btn.textContent = 'Confirmar assinatura'; UI.toast(e.message, { iconName: 'info' }); });
    });
  }

  function setPlan(p) {
    return global.Backend.setPlan(p).then((u) => {
      document.documentElement.classList.toggle('is-premium', p === 'premium');
      return u;
    });
  }

  function celebrate() {
    const el = U.h(`
      <div class="pw-celebrate" role="status">
        <span class="pw-icon is-large">${icon('sparkle', { size: 34, stroke: 1.6 })}</span>
        <p class="pw-title mt-5">Bem-vindo ao Premium</p>
        <p class="t-callout mt-2">Tudo liberado. Bons treinos.</p>
      </div>`);
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('is-in'));
    const close = () => { el.classList.remove('is-in'); setTimeout(() => el.remove(), 320); };
    el.addEventListener('click', close);
    setTimeout(close, 1900);
  }

  // Rota #/profile/plan
  function render(root) {
    root.innerHTML = `
      ${UI.navbarHTML('Planos', 'Perfil')}
      <section class="page has-navbar">
        <header>
          <h1 class="t-large-title" data-large-title>${isPremium() ? 'Seu plano' : 'Seja Premium'}</h1>
          <p class="t-sub mt-2">${isPremium() ? 'Obrigado por apoiar o FORJA.' : 'Treine com um plano, saiba quando subir a carga e veja sua evolução completa.'}</p>
        </header>
        <div class="mt-8" data-plans-host>${pageHTML({ choosing: false })}</div>
      </section>`;
    bindPage(root, { choosing: false });
  }

  // Depois do cadastro, dentro da tela de entrada (sem barra de navegação)
  function renderChoice(container, onDone) {
    container.innerHTML = `
      <div class="auth-scroll">
        <div class="ob-frame is-scroll">
          <div class="step-in-next">
            <p class="wordmark t-accent">FORJA</p>
            <h1 class="t-large-title mt-6">Escolha seu plano</h1>
            <p class="t-sub mt-2">Comece grátis ou libere tudo agora. Dá para mudar quando quiser, no Perfil.</p>
            <div class="mt-8" data-plans-host>${pageHTML({ choosing: true })}</div>
          </div>
        </div>
      </div>`;
    bindPage(container, { choosing: true, onDone: (p) => setTimeout(() => onDone(p), p === 'premium' ? 1400 : 0) });
  }

  /* ---------- Toque em qualquer [data-paywall] ---------- */
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-paywall]');
    if (!b) return;
    e.preventDefault();
    e.stopPropagation();
    openPaywall(b.dataset.paywall);
  }, true);

  // Compartilhar é Premium (o botão aparece em vários lugares)
  if (global.Share && global.Share.open) {
    const open = global.Share.open;
    global.Share.open = (...args) => gate('share', () => open(...args));
  }

  global.Plans = {
    PRICE, FREE_WORKOUTS, COMPARE, GATES, money,
    plan, isPremium, gate, canCreateWorkout, openPaywall, lockedHTML, renderLocked, pill,
    render, renderChoice, setPlan
  };
})(window);
