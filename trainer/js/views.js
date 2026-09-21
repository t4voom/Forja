/* FORJA Trainer — telas: Dashboard, Alunos, Perfil do aluno, Treinos, Academia, Treinadores
   Todos os dados vêm da API (Google Planilhas). Nada aqui é fixo ou de exemplo. */
(function (global) {
  'use strict';
  const { U, API, TUI } = global;
  const { esc, icon } = U;
  const { F } = TUI;

  const TYPE_LABEL = { CRIAR: 'criou', EDITAR: 'alterou', ASSUMIR: 'assumiu', EXCLUIR: 'excluiu' };
  const TYPE_ICON = { CRIAR: 'plus', EDITAR: 'edit', ASSUMIR: 'user', EXCLUIR: 'trash', ENTRADA: 'login', SAIDA: 'logout', TREINO: 'dumbbell' };
  const TYPE_TONE = { CRIAR: 'is-accent', EDITAR: 'is-accent', ASSUMIR: 'is-accent', EXCLUIR: 'is-danger', ENTRADA: 'is-success', SAIDA: 'is-danger', TREINO: 'is-accent' };

  /* ---------- Estados comuns ---------- */
  function loading(ctx, kind = 'dashboard') {
    ctx.el.innerHTML = kind === 'table'
      ? `<div class="page-head"><div class="skeleton" style="width:220px;height:34px"></div></div><div class="card">${Array.from({ length: 8 }, () => '<div class="skeleton sk-row"></div>').join('')}</div>`
      : `<div class="page-head"><div class="skeleton" style="width:260px;height:34px"></div></div>
         <div class="grid kpis">${'<div class="skeleton sk-kpi"></div>'.repeat(4)}</div>
         <div class="grid cols-main mt-4"><div class="skeleton sk-card"></div><div class="skeleton sk-card"></div></div>`;
  }

  function error(ctx, e) {
    if (!ctx.alive()) return;
    ctx.el.innerHTML = `
      <div class="card error-state">
        ${TUI.emptyHTML(e.code === 'forbidden' ? 'lock' : 'alert', e.code === 'forbidden' ? 'Acesso negado' : 'Não foi possível carregar', e.message || 'Tente de novo.')}
        <div class="card-foot" style="text-align:center"><button class="btn btn-secondary" data-retry>${icon('refresh', { size: 16 })} Tentar de novo</button></div>
      </div>`;
    ctx.el.querySelector('[data-retry]').addEventListener('click', () => { ctx.cache.clear(); global.TrainerApp.render(); });
  }

  const personHTML = (name, sub) => `
    <span class="person">
      <span class="avatar">${esc(F.initials(name))}</span>
      <span class="min-w-0"><span class="person-name block truncate">${esc(name)}</span>${sub ? `<span class="person-sub block truncate">${esc(sub)}</span>` : ''}</span>
    </span>`;

  function logText(r, { withStudent = true } = {}) {
    return `<strong>${esc(r.treinador)}</strong> ${TYPE_LABEL[r.tipo] || 'alterou'} <strong>${esc(r.treino)}</strong>${withStudent && r.alunoNome ? ` de ${esc(r.alunoNome)}` : ''}`;
  }

  function timelineHTML(items, { withStudent = true } = {}) {
    if (!items.length) return TUI.emptyHTML('activity', 'Nada por aqui ainda', 'As alterações de treino aparecem aqui assim que forem salvas.');
    return `<ul class="timeline">${items.map((r) => `
      <li>
        <span class="timeline-dot ${TYPE_TONE[r.tipo] || ''}">${icon(TYPE_ICON[r.tipo] || 'edit', { size: 14, stroke: 2 })}</span>
        <div class="min-w-0">
          <p class="timeline-text">${logText(r, { withStudent })}</p>
          ${r.detalhes ? `<p class="timeline-detail">${esc(r.detalhes)}</p>` : ''}
          <p class="timeline-time">${esc(F.dateTime(r.data))}</p>
        </div>
      </li>`).join('')}</ul>`;
  }

  /* ==========================================================================
     Dashboard
     ========================================================================== */
  async function dashboard(ctx) {
    const ac = API.academy();
    ctx.setCrumbs([{ label: 'Dashboard' }]);
    loading(ctx);
    let d;
    try { d = await ctx.cache.get('overview', API.overview); } catch (e) { return error(ctx, e); }
    if (!ctx.alive()) return;
    ctx.refreshSide(d.cards.alunos, d.cards.limite);
    const c = d.cards;
    const hour = new Date().getHours();
    const hello = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
    const first = String((API.session().trainer || {}).nome || '').split(' ')[0];
    ctx.el.innerHTML = `
      <div class="page-head">
        <div><h1 class="page-title">${hello}${first ? `, ${esc(first)}` : ''}.</h1><p class="page-sub">Visão geral da ${esc(ac.nome)}.</p></div>
        <div class="row-flex">
          <button type="button" class="btn btn-ghost" data-refresh>${icon('refresh', { size: 16 })} Atualizar</button>
          <a class="btn btn-primary" href="#/alunos">${icon('users', { size: 16 })} Ver alunos</a>
        </div>
      </div>

      <div class="grid kpis">
        <article class="card kpi">
          <p class="kpi-label">${icon('users', { size: 15, stroke: 2 })} Alunos</p>
          <p class="kpi-value">${c.alunos}<small>/ ${c.limite}</small></p>
          ${TUI.meterHTML(c.alunos, c.limite)}
          <p class="kpi-foot">${c.limite - c.alunos > 0 ? `${c.limite - c.alunos} ${c.limite - c.alunos === 1 ? 'vaga disponível' : 'vagas disponíveis'}` : 'Limite atingido'}</p>
        </article>
        <article class="card kpi">
          <p class="kpi-label">${icon('dumbbell', { size: 15, stroke: 2 })} Treinos</p>
          <p class="kpi-value">${c.treinos}</p>
          <p class="kpi-foot">${c.treinosTreinador} ${c.treinosTreinador === 1 ? 'montado' : 'montados'} por treinadores</p>
        </article>
        <article class="card kpi">
          <p class="kpi-label">${icon('activity', { size: 15, stroke: 2 })} Ativos</p>
          <p class="kpi-value">${c.ativos}</p>
          <p class="kpi-foot">Usaram o app nos últimos 30 dias</p>
        </article>
        <article class="card kpi">
          <p class="kpi-label">${icon('moon', { size: 15, stroke: 2 })} Inativos</p>
          <p class="kpi-value">${c.inativos}</p>
          <p class="kpi-foot">${c.inativos ? '<a class="link" href="#/alunos?filtro=inativos">Ver quem sumiu</a>' : 'Todo mundo em dia'}</p>
        </article>
      </div>

      <div class="grid cols-main mt-4">
        <div class="stack">
          <section class="card">
            <div class="card-head"><div><h2 class="card-title">Evolução de peso</h2><p class="card-sub">Maiores variações entre as pesagens dos alunos</p></div></div>
            <div class="card-body is-flush">
              ${d.evolucaoPeso.length ? `<ul class="list">${d.evolucaoPeso.map((e) => `
                <li class="is-link" data-student="${esc(e.id)}">
                  <div class="list-main">${personHTML(e.nome, `${F.kg(e.pontos[0].pesoKg)} → ${F.kg(e.pontos[e.pontos.length - 1].pesoKg)} · desde ${F.date(e.pontos[0].data)}`)}</div>
                  ${TUI.sparkline(e.pontos)}
                  <span style="width:72px;text-align:right">${TUI.deltaHTML(e.variacao)}</span>
                </li>`).join('')}</ul>` : TUI.emptyHTML('chart', 'Sem evolução para mostrar', 'Quando os alunos registrarem o peso no app, a evolução aparece aqui.')}
            </div>
          </section>
          <section class="card">
            <div class="card-head"><div><h2 class="card-title">Últimas alterações de treino</h2><p class="card-sub">Registradas a cada salvamento</p></div><a class="link" href="#/treinos">Ver treinos</a></div>
            <div class="card-body">${timelineHTML(d.alteracoes)}</div>
          </section>
        </div>
        <div class="stack">
          <section class="card">
            <div class="card-head"><h2 class="card-title">Alertas</h2></div>
            <div class="card-body">
              ${d.alertas.length ? d.alertas.map((a) => `
                <div class="alert is-${esc(a.nivel)}">${icon(a.nivel === 'info' ? 'info' : 'alert', { size: 16, stroke: 2 })}
                  <div>${esc(a.texto)}${a.acao ? `<br><a class="link" href="#/${esc(a.acao)}">Ver alunos</a>` : ''}</div>
                </div>`).join('') : `<div class="alert">${icon('check', { size: 16, stroke: 2 })}<div>Nenhum alerta. Tudo em ordem.</div></div>`}
            </div>
          </section>
          <section class="card">
            <div class="card-head"><h2 class="card-title">Alunos recentes</h2><a class="link" href="#/alunos">Todos</a></div>
            <div class="card-body is-flush">
              ${d.alunosRecentes.length ? `<ul class="list">${d.alunosRecentes.map((s) => `
                <li class="is-link" data-student="${esc(s.id)}">
                  <div class="list-main">${personHTML(s.nome, s.treinoAtual ? `Treino atual: ${s.treinoAtual}` : 'Sem treino ainda')}</div>
                  <span class="list-meta">${esc(F.ago(s.dataEntrada))}</span>
                </li>`).join('')}</ul>` : TUI.emptyHTML('users', 'Nenhum aluno ainda', `Os alunos entram pelo app com o código ${ac.nome ? 'da academia' : ''}.`)}
            </div>
          </section>
          <section class="card">
            <div class="card-head"><h2 class="card-title">Atividades recentes</h2></div>
            <div class="card-body">
              ${d.atividades.length ? `<ul class="timeline">${d.atividades.map((a) => `
                <li${a.alunoId ? ` data-student="${esc(a.alunoId)}" style="cursor:pointer"` : ''}>
                  <span class="timeline-dot ${TYPE_TONE[a.tipo] || ''}">${icon(TYPE_ICON[a.tipo] || 'activity', { size: 14, stroke: 2 })}</span>
                  <div class="min-w-0"><p class="timeline-text">${esc(a.texto)}</p><p class="timeline-time">${esc(F.ago(a.data))}</p></div>
                </li>`).join('')}</ul>` : TUI.emptyHTML('activity', 'Sem atividades ainda')}
            </div>
          </section>
        </div>
      </div>`;
    ctx.el.querySelector('[data-refresh]').addEventListener('click', () => { ctx.cache.clear(); global.TrainerApp.render(); });
    ctx.el.querySelectorAll('[data-student]').forEach((x) => x.addEventListener('click', () => ctx.go(`alunos/${x.dataset.student}`)));
  }

  /* ==========================================================================
     Alunos
     ========================================================================== */
  const FILTERS = [
    { value: 'todos', label: 'Todos' },
    { value: 'ativos', label: 'Ativos' },
    { value: 'inativos', label: 'Inativos' },
    { value: 'sem-treino', label: 'Sem treino' },
    { value: 'sem-dados', label: 'Sem dados físicos' }
  ];
  const listState = { q: '', filter: 'todos', sort: 'nome', dir: 'asc', page: 1 };
  const PER_PAGE = 15;

  async function students(ctx) {
    ctx.setCrumbs([{ label: 'Alunos' }]);
    if (ctx.query.filtro && FILTERS.some((f) => f.value === ctx.query.filtro)) { listState.filter = ctx.query.filtro; listState.page = 1; }
    loading(ctx, 'table');
    let d;
    try { d = await ctx.cache.get('students', API.students); } catch (e) { return error(ctx, e); }
    if (!ctx.alive()) return;
    ctx.refreshSide(d.academia.alunos, d.academia.limite);
    const all = d.alunos;
    ctx.el.innerHTML = `
      <div class="page-head">
        <div><h1 class="page-title">Alunos</h1><p class="page-sub">${all.length} de ${d.academia.limite} vagas da ${esc(d.academia.nome)}. Só aparecem alunos vinculados a esta academia.</p></div>
      </div>
      <section class="card">
        <div class="toolbar">
          <label class="search"><span class="sr-only">Buscar aluno</span>${icon('search', { size: 16, stroke: 2 })}<input class="field" type="search" placeholder="Buscar por nome, e-mail ou treino" value="${esc(listState.q)}" data-q></label>
          <span data-filter></span>
        </div>
        <div class="table-wrap"><table class="table" data-table></table></div>
        <div data-pager></div>
      </section>`;
    ctx.el.querySelector('[data-filter]').appendChild(TUI.segmented(FILTERS, listState.filter, (v) => { listState.filter = v; listState.page = 1; paint(); }, 'Filtro'));
    const q = ctx.el.querySelector('[data-q]');
    q.addEventListener('input', U.debounce(() => { listState.q = q.value; listState.page = 1; paint(); }, 120));

    const cols = [
      { key: 'nome', label: 'Nome' }, { key: 'idade', label: 'Idade', num: true }, { key: 'pesoAtual', label: 'Peso', num: true },
      { key: 'altura', label: 'Altura', num: true }, { key: 'treinoAtual', label: 'Treino atual' }, { key: 'status', label: 'Status' },
      { key: 'ultimaAtualizacao', label: 'Última atualização' }
    ];

    function filtered() {
      const terms = U.normalize(listState.q).split(/\s+/).filter(Boolean);
      return all.filter((s) => {
        if (listState.filter === 'ativos' && s.status !== 'ATIVO') return false;
        if (listState.filter === 'inativos' && s.status !== 'INATIVO') return false;
        if (listState.filter === 'sem-treino' && s.treinosGerenciados) return false;
        if (listState.filter === 'sem-dados' && s.pesoAtual && s.altura) return false;
        const hay = U.normalize(`${s.nome} ${s.email} ${s.treinoAtual}`);
        return terms.every((t) => hay.includes(t));
      });
    }

    function paint() {
      const rows = TUI.sortRows(filtered(), listState.sort, listState.dir);
      const pages = Math.max(1, Math.ceil(rows.length / PER_PAGE));
      listState.page = Math.min(listState.page, pages);
      const slice = rows.slice((listState.page - 1) * PER_PAGE, listState.page * PER_PAGE);
      ctx.el.querySelector('[data-table]').innerHTML = `
        <thead><tr>${cols.map((c) => `<th data-sort="${c.key}" class="${c.num ? 'is-num' : ''}" ${listState.sort === c.key ? `aria-sort="${listState.dir === 'asc' ? 'ascending' : 'descending'}"` : ''}>${c.label}<span class="sort-ind">${listState.sort === c.key && listState.dir === 'desc' ? '↓' : '↑'}</span></th>`).join('')}</tr></thead>
        <tbody>${slice.length ? slice.map((s) => `
          <tr class="is-link" data-id="${esc(s.id)}" tabindex="0">
            <td>${personHTML(s.nome, s.email)}</td>
            <td class="is-num">${s.idade != null ? s.idade : '—'}</td>
            <td class="is-num">${F.kg(s.pesoAtual)}</td>
            <td class="is-num">${F.cm(s.altura)}</td>
            <td>${s.treinoAtual ? `<span class="cell-strong">${esc(s.treinoAtual)}</span>${s.treinos > 1 ? ` <span class="faint">+${s.treinos - 1}</span>` : ''}` : '<span class="faint">Sem treino</span>'}</td>
            <td>${TUI.statusPill(s.status)}</td>
            <td class="muted">${esc(F.ago(s.ultimaAtualizacao))}</td>
          </tr>`).join('') : `<tr><td colspan="${cols.length}">${TUI.emptyHTML('users', all.length ? 'Nenhum aluno encontrado' : 'Nenhum aluno vinculado ainda', all.length ? 'Tente outra busca ou filtro.' : 'Os alunos entram pelo app, em Perfil › Academia, com o código da academia.')}</td></tr>`}
        </tbody>`;
      ctx.el.querySelector('[data-pager]').innerHTML = TUI.pagerHTML(listState.page, pages, rows.length, PER_PAGE);
    }

    ctx.el.querySelector('[data-table]').addEventListener('click', (e) => {
      const th = e.target.closest('th[data-sort]');
      if (th) {
        const k = th.dataset.sort;
        listState.dir = listState.sort === k && listState.dir === 'asc' ? 'desc' : 'asc';
        listState.sort = k;
        return paint();
      }
      const tr = e.target.closest('tr[data-id]');
      if (tr) ctx.go(`alunos/${tr.dataset.id}`);
    });
    ctx.el.querySelector('[data-table]').addEventListener('keydown', (e) => {
      const tr = e.target.closest('tr[data-id]');
      if (tr && e.key === 'Enter') ctx.go(`alunos/${tr.dataset.id}`);
    });
    ctx.el.querySelector('[data-pager]').addEventListener('click', (e) => {
      const b = e.target.closest('[data-page]');
      if (b && !b.disabled) { listState.page = Number(b.dataset.page); paint(); ctx.el.scrollIntoView({ block: 'start' }); }
    });
    paint();
  }

  /* ==========================================================================
     Perfil do aluno
     ========================================================================== */
  const studentTab = { value: 'dados' };

  async function student(ctx, userId) {
    ctx.setCrumbs([{ label: 'Alunos', href: 'alunos' }, { label: 'Carregando…' }]);
    loading(ctx);
    let d;
    try { d = await ctx.cache.get(`student:${userId}`, () => API.student(userId), 15000); } catch (e) { return error(ctx, e); }
    if (!ctx.alive()) return;
    global.Store.setCustomExercises(d.exerciciosPersonalizados);
    const a = d.aluno;
    ctx.setCrumbs([{ label: 'Alunos', href: 'alunos' }, { label: a.nome }]);
    const canEdit = API.can('treinos.editar');
    const canUnlink = API.can('alunos.desvincular');
    const pesos = d.pesos || [];
    const first = pesos[0], last = pesos[pesos.length - 1];
    const variation = first && last && pesos.length > 1 ? Math.round((last.pesoKg - first.pesoKg) * 10) / 10 : null;

    ctx.el.innerHTML = `
      <div class="page-head">
        <div class="profile-head">
          <span class="avatar is-lg is-accent">${esc(F.initials(a.nome))}</span>
          <div>
            <h1 class="page-title">${esc(a.nome)}</h1>
            <div class="profile-meta">${TUI.statusPill(a.status)}<span>${esc(a.email)}</span><span>·</span><span>Aluno desde ${esc(F.date(a.dataEntrada))}</span><span>·</span><span>Último acesso ${esc(F.ago(a.ultimoAcesso))}</span></div>
          </div>
        </div>
        <div class="row-flex">
          ${canUnlink ? `<button type="button" class="btn btn-ghost" data-unlink>${icon('logout', { size: 16 })} Encerrar vínculo</button>` : ''}
          ${canEdit ? `<a class="btn btn-primary" href="#/alunos/${esc(a.id)}/treinos/novo">${icon('plus', { size: 16, stroke: 2 })} Novo treino</a>` : ''}
        </div>
      </div>
      <div class="tabs" role="tablist">
        ${[['dados', 'Dados'], ['evolucao', 'Evolução'], ['treinos', `Treinos · ${d.treinos.length}`], ['atividade', 'Atividade']].map(([v, l]) => `<button type="button" role="tab" data-tab="${v}" aria-selected="${studentTab.value === v}">${l}</button>`).join('')}
      </div>
      <div data-tab-body></div>`;

    const body = ctx.el.querySelector('[data-tab-body]');
    const statsHTML = `
      <div class="stats">
        <div class="stat"><p class="stat-label">Idade</p><p class="stat-value">${a.idade != null ? `${a.idade}<small>anos</small>` : '—'}</p></div>
        <div class="stat"><p class="stat-label">Peso</p><p class="stat-value">${a.pesoAtual != null ? `${F.num(a.pesoAtual)}<small>kg</small>` : '—'}</p>${last ? `<p class="stat-note">Pesagem de ${esc(F.date(last.data))}</p>` : ''}</div>
        <div class="stat"><p class="stat-label">Altura</p><p class="stat-value">${a.altura != null ? `${F.meters(a.altura)}<small>m</small>` : '—'}</p></div>
        <div class="stat"><p class="stat-label">IMC</p><p class="stat-value">${a.imc != null ? F.num(a.imc) : '—'}</p><p class="stat-note">${a.imc != null ? esc(F.bmiClass(a.imc)) : 'Precisa de peso e altura'}</p></div>
        <div class="stat"><p class="stat-label">Academia</p><p class="stat-value" style="font-size:16px">${esc(a.academia)}</p></div>
        <div class="stat"><p class="stat-label">Data de entrada</p><p class="stat-value" style="font-size:16px">${esc(F.date(a.dataEntrada))}</p></div>
      </div>`;

    const TABS = {
      dados: () => `
        <div class="grid cols-main">
          <section class="card"><div class="card-head"><h2 class="card-title">Dados físicos</h2><span class="card-sub">Informados pelo aluno no app</span></div><div class="card-body">${statsHTML}
            <p class="card-sub mt-4">O IMC é calculado na hora com o peso e a altura atuais; ele não fica gravado. ${a.dataNascimento ? `Idade calculada pela data de nascimento (${esc(F.date(a.dataNascimento + 'T12:00:00'))}).` : ''}</p></div></section>
          <div class="stack">
            <section class="card"><div class="card-head"><h2 class="card-title">Resumo</h2></div><div class="card-body">
              <dl class="dl">
                <dt>Treinos</dt><dd>${d.treinos.length} (${d.treinos.filter((w) => w.managed).length} do treinador)</dd>
                <dt>Treinos feitos</dt><dd>${d.sessoes.length ? `${d.sessoes.length >= 12 ? '12+' : d.sessoes.length} · último ${esc(F.ago(d.sessoes[0].data))}` : 'Nenhum registrado'}</dd>
                <dt>Variação de peso</dt><dd>${variation != null ? TUI.deltaHTML(variation) : '—'}</dd>
                <dt>Última atualização</dt><dd>${esc(F.ago(a.ultimaAtualizacao))}</dd>
              </dl></div></section>
          </div>
        </div>`,
      evolucao: () => `
        <div class="grid cols-main">
          <section class="card"><div class="card-head"><div><h2 class="card-title">Histórico de peso</h2><p class="card-sub">${pesos.length} ${pesos.length === 1 ? 'pesagem' : 'pesagens'}</p></div></div><div class="card-body" data-chart></div></section>
          <div class="stack">
            <section class="card"><div class="card-body">
              <div class="stats" style="grid-template-columns:1fr 1fr">
                <div class="stat"><p class="stat-label">Inicial</p><p class="stat-value">${first ? `${F.num(first.pesoKg)}<small>kg</small>` : '—'}</p><p class="stat-note">${first ? esc(F.date(first.data)) : ''}</p></div>
                <div class="stat"><p class="stat-label">Atual</p><p class="stat-value">${last ? `${F.num(last.pesoKg)}<small>kg</small>` : '—'}</p><p class="stat-note">${last ? esc(F.date(last.data)) : ''}</p></div>
                <div class="stat"><p class="stat-label">Variação</p><p class="stat-value">${variation != null ? TUI.deltaHTML(variation) : '—'}</p></div>
                <div class="stat"><p class="stat-label">Mín · Máx</p><p class="stat-value" style="font-size:16px">${pesos.length ? `${F.num(Math.min(...pesos.map((p) => p.pesoKg)))} · ${F.num(Math.max(...pesos.map((p) => p.pesoKg)))} kg` : '—'}</p></div>
              </div></div></section>
            <section class="card"><div class="card-head"><h2 class="card-title">Pesagens</h2></div><div class="card-body is-flush">
              ${pesos.length ? `<ul class="list">${pesos.slice().reverse().slice(0, 12).map((p, i, arr) => {
                const prev = arr[i + 1];
                return `<li><div class="list-main"><p class="list-title num">${F.kg(p.pesoKg)}</p><p class="list-sub">${esc(F.date(p.data))}</p></div>${prev ? TUI.deltaHTML(Math.round((p.pesoKg - prev.pesoKg) * 10) / 10) : ''}</li>`;
              }).join('')}</ul>` : TUI.emptyHTML('scale', 'Sem pesagens', 'O aluno registra o peso no app, em Evolução ou no Perfil.')}
            </div></section>
          </div>
        </div>`,
      treinos: () => workoutsTabHTML(d, canEdit),
      atividade: () => `
        <div class="grid cols-2">
          <section class="card"><div class="card-head"><div><h2 class="card-title">Alterações de treino</h2><p class="card-sub">Feitas por treinadores desta academia</p></div></div><div class="card-body">${timelineHTML(d.alteracoes, { withStudent: false })}</div></section>
          <section class="card"><div class="card-head"><div><h2 class="card-title">Treinos realizados</h2><p class="card-sub">Últimos registrados no app</p></div></div><div class="card-body is-flush">
            ${d.sessoes.length ? `<ul class="list">${d.sessoes.map((s) => `
              <li><span class="timeline-dot is-success">${icon('check', { size: 14, stroke: 2.2 })}</span><div class="list-main"><p class="list-title">${esc(s.treino || 'Treino')}</p><p class="list-sub">${s.exercicios} exercícios · ${s.series} séries${s.duracaoSeg ? ` · ${Math.round(s.duracaoSeg / 60)} min` : ''}</p></div><span class="list-meta">${esc(F.dateTime(s.data))}</span></li>`).join('')}</ul>`
              : TUI.emptyHTML('dumbbell', 'Nenhum treino registrado', 'Quando o aluno concluir um treino no app, ele aparece aqui.')}
          </div></section>
        </div>`
    };

    function paintTab() {
      body.innerHTML = TABS[studentTab.value]();
      const chart = body.querySelector('[data-chart]');
      if (chart) chart.appendChild(TUI.lineChart(pesos));
      bindWorkoutCards(body, ctx, d, a);
    }
    ctx.el.querySelector('.tabs').addEventListener('click', (e) => {
      const b = e.target.closest('[data-tab]');
      if (!b) return;
      studentTab.value = b.dataset.tab;
      ctx.el.querySelectorAll('[data-tab]').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
      paintTab();
    });
    ctx.el.querySelector('[data-unlink]')?.addEventListener('click', async () => {
      const ok = await TUI.confirm({ title: `Encerrar vínculo de ${a.nome}?`, message: 'O aluno sai da academia e perde o Premium Academia (a menos que tenha assinatura própria). Os treinos montados continuam com ele. O histórico do vínculo é mantido.', confirmLabel: 'Encerrar vínculo', danger: true });
      if (!ok) return;
      try { await API.unlinkStudent(a.id); ctx.cache.clear(); TUI.toast('Vínculo encerrado.'); ctx.go('alunos'); } catch (e) { TUI.toast(e.message, { error: true }); }
    });
    paintTab();
  }

  function workoutsTabHTML(d, canEdit) {
    if (!d.treinos.length) {
      return `<section class="card">${TUI.emptyHTML('dumbbell', 'Nenhum treino ainda', canEdit ? 'Monte o primeiro treino. Ele aparece no app do aluno no próximo acesso.' : '')}${canEdit ? `<div class="card-foot" style="text-align:center"><a class="btn btn-primary" href="#/alunos/${esc(d.aluno.id)}/treinos/novo">${icon('plus', { size: 16, stroke: 2 })} Novo treino</a></div>` : ''}</section>`;
    }
    const managed = d.treinos.filter((w) => w.managed);
    const own = d.treinos.filter((w) => !w.managed);
    const card = (w) => {
      const exs = w.exercises || [];
      return `
        <article class="wcard">
          <header class="wcard-head">
            <span class="wcard-swatch" style="--c:${esc(w.color || 'var(--accent)')}"></span>
            <div class="min-w-0" style="flex:1">
              <div class="between"><h3 class="wcard-title truncate">${esc(w.name)}</h3>${w.managed ? '<span class="pill is-accent no-dot">Treinador</span>' : '<span class="pill no-dot">Criado pelo aluno</span>'}</div>
              <p class="wcard-sub truncate">${esc(w.muscleGroup || w.description || [...new Set(exs.map((x) => x.muscle).filter(Boolean))].join(' · ') || '—')}</p>
            </div>
          </header>
          <div class="wcard-body">
            ${exs.length ? exs.slice(0, 8).map((x, i) => `
              <div class="wcard-ex"><span class="wcard-ex-i">${i + 1}</span><span class="wcard-ex-name">${esc((global.Exercises.get(x.exerciseId) || {}).name || x.name || x.exerciseId)}</span><span class="wcard-ex-rx">${F.scheme(x)}${x.loadKg != null ? ` · ${F.num(x.loadKg)} kg` : ''}</span></div>`).join('')
              + (exs.length > 8 ? `<div class="wcard-ex faint">+ ${exs.length - 8} exercícios</div>` : '') : '<p class="wcard-ex faint">Sem exercícios</p>'}
          </div>
          <footer class="wcard-foot">
            <span class="list-meta">${w.managed && w.managedBy ? `${esc(w.managedBy.trainerName)} · ` : ''}${esc(F.ago(w.updatedAt || w.createdAt))}</span>
            ${canEdit ? `
              <button type="button" class="icon-btn" data-dup="${esc(w.id)}" title="Duplicar treino" aria-label="Duplicar treino">${icon('copy', { size: 16 })}</button>
              ${w.managed ? `<button type="button" class="icon-btn is-danger" data-del="${esc(w.id)}" title="Excluir treino" aria-label="Excluir treino">${icon('trash', { size: 16 })}</button>` : ''}
              <a class="btn btn-secondary btn-sm" href="#/alunos/${esc(d.aluno.id)}/treinos/${esc(w.id)}">${w.managed ? `${icon('edit', { size: 14 })} Editar` : `${icon('user', { size: 14 })} Assumir`}</a>` : ''}
          </footer>
        </article>`;
    };
    return `
      <div class="stack">
        <div><p class="nav-label" style="margin-left:0">Treino atual e treinos do treinador</p>
          ${managed.length ? `<div class="workout-cards">${managed.map(card).join('')}</div>` : `<div class="card">${TUI.emptyHTML('dumbbell', 'Nenhum treino do treinador ainda', 'Crie um treino novo ou assuma um treino que o aluno montou.')}</div>`}</div>
        ${own.length ? `<div class="mt-4"><p class="nav-label" style="margin-left:0">Criados pelo aluno</p><p class="card-sub" style="margin:-2px 0 12px">Ao editar um treino do aluno, ele passa a ser gerenciado pelo treinador (o aluno não edita mais esse treino no app).</p><div class="workout-cards">${own.map(card).join('')}</div></div>` : ''}
      </div>`;
  }

  function bindWorkoutCards(body, ctx, d, a) {
    body.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
      const w = d.treinos.find((x) => x.id === b.dataset.del);
      const ok = await TUI.confirm({ title: `Excluir ${w.name}?`, message: `O treino sai do app de ${a.nome} no próximo acesso. A exclusão fica registrada no histórico.`, confirmLabel: 'Excluir treino', danger: true });
      if (!ok) return;
      b.disabled = true;
      try {
        await API.deleteWorkout(a.id, w.id);
        ctx.cache.clear();
        TUI.toast('Treino excluído.');
        global.TrainerApp.render();
      } catch (e) { b.disabled = false; TUI.toast(e.message, { error: true }); }
    }));
    body.querySelectorAll('[data-dup]').forEach((b) => b.addEventListener('click', async () => {
      const w = d.treinos.find((x) => x.id === b.dataset.dup);
      b.disabled = true;
      try {
        const copy = { name: `${w.name} (cópia)`.slice(0, 40), description: w.description || '', muscleGroup: w.muscleGroup || '', color: w.color, exercises: (w.exercises || []).map((x) => Object.assign({}, x, { id: '' })) };
        const r = await API.saveWorkout(a.id, copy);
        ctx.cache.clear();
        TUI.toast('Treino duplicado.');
        ctx.go(`alunos/${a.id}/treinos/${r.treino.id}`);
      } catch (e) { b.disabled = false; TUI.toast(e.message, { error: true }); }
    }));
  }

  /* ==========================================================================
     Treinos (todos os alunos da academia)
     ========================================================================== */
  const wState = { q: '', filter: 'todos', page: 1 };

  async function workouts(ctx) {
    ctx.setCrumbs([{ label: 'Treinos' }]);
    loading(ctx, 'table');
    let d;
    try { d = await ctx.cache.get('workouts', API.workouts); } catch (e) { return error(ctx, e); }
    if (!ctx.alive()) return;
    ctx.el.innerHTML = `
      <div class="page-head"><div><h1 class="page-title">Treinos</h1><p class="page-sub">${d.treinos.length} treinos dos alunos desta academia. Para criar um treino, abra o aluno.</p></div><a class="btn btn-primary" href="#/alunos">${icon('users', { size: 16 })} Escolher aluno</a></div>
      <div class="grid cols-main">
        <section class="card">
          <div class="toolbar">
            <label class="search"><span class="sr-only">Buscar treino</span>${icon('search', { size: 16, stroke: 2 })}<input class="field" type="search" placeholder="Buscar por treino, aluno ou grupo" value="${esc(wState.q)}" data-q></label>
            <span data-filter></span>
          </div>
          <div class="table-wrap"><table class="table" data-table></table></div>
          <div data-pager></div>
        </section>
        <section class="card"><div class="card-head"><h2 class="card-title">Histórico de alterações</h2></div><div class="card-body">${timelineHTML(d.alteracoes)}</div></section>
      </div>`;
    ctx.el.querySelector('[data-filter]').appendChild(TUI.segmented([{ value: 'todos', label: 'Todos' }, { value: 'treinador', label: 'Do treinador' }, { value: 'aluno', label: 'Do aluno' }], wState.filter, (v) => { wState.filter = v; wState.page = 1; paint(); }, 'Origem'));
    const q = ctx.el.querySelector('[data-q]');
    q.addEventListener('input', U.debounce(() => { wState.q = q.value; wState.page = 1; paint(); }, 120));
    function paint() {
      const terms = U.normalize(wState.q).split(/\s+/).filter(Boolean);
      const rows = d.treinos.filter((w) => {
        if (wState.filter === 'treinador' && !w.gerenciado) return false;
        if (wState.filter === 'aluno' && w.gerenciado) return false;
        const hay = U.normalize(`${w.nome} ${w.alunoNome} ${w.grupo}`);
        return terms.every((t) => hay.includes(t));
      });
      const pages = Math.max(1, Math.ceil(rows.length / PER_PAGE));
      wState.page = Math.min(wState.page, pages);
      const slice = rows.slice((wState.page - 1) * PER_PAGE, wState.page * PER_PAGE);
      ctx.el.querySelector('[data-table]').innerHTML = `
        <thead><tr><th>Treino</th><th>Aluno</th><th class="is-num">Exercícios</th><th class="is-num">Séries</th><th>Origem</th><th>Atualizado</th></tr></thead>
        <tbody>${slice.length ? slice.map((w) => `
          <tr class="is-link" data-href="alunos/${esc(w.alunoId)}${API.can('treinos.editar') ? `/treinos/${esc(w.id)}` : ''}">
            <td><span class="row-flex"><span class="wcard-swatch" style="--c:${esc(w.cor || 'var(--accent)')};height:28px"></span><span><span class="cell-strong block">${esc(w.nome)}</span><span class="person-sub">${esc(w.grupo || '—')}</span></span></span></td>
            <td>${esc(w.alunoNome)}</td>
            <td class="is-num">${w.exercicios}</td>
            <td class="is-num">${w.series}</td>
            <td>${w.gerenciado ? `<span class="pill is-accent no-dot">${esc(w.treinador || 'Treinador')}</span>` : '<span class="pill no-dot">Aluno</span>'}</td>
            <td class="muted">${esc(F.ago(w.atualizadoEm))}</td>
          </tr>`).join('') : `<tr><td colspan="6">${TUI.emptyHTML('dumbbell', d.treinos.length ? 'Nenhum treino encontrado' : 'Nenhum treino ainda', d.treinos.length ? 'Tente outra busca.' : 'Abra um aluno para montar o primeiro treino.')}</td></tr>`}</tbody>`;
      ctx.el.querySelector('[data-pager]').innerHTML = TUI.pagerHTML(wState.page, pages, rows.length, PER_PAGE);
    }
    ctx.el.querySelector('[data-table]').addEventListener('click', (e) => { const tr = e.target.closest('tr[data-href]'); if (tr) ctx.go(tr.dataset.href); });
    ctx.el.querySelector('[data-pager]').addEventListener('click', (e) => { const b = e.target.closest('[data-page]'); if (b && !b.disabled) { wState.page = Number(b.dataset.page); paint(); } });
    paint();
  }

  /* ==========================================================================
     Academia e Treinadores
     ========================================================================== */
  async function academy(ctx) {
    ctx.setCrumbs([{ label: 'Academia' }]);
    loading(ctx);
    let d;
    try { d = await ctx.cache.get('academy', API.academyInfo); } catch (e) { return error(ctx, e); }
    if (!ctx.alive()) return;
    const ac = d.academia;
    ctx.refreshSide(ac.alunos, ac.limite);
    const ct = ac.contrato;
    ctx.el.innerHTML = `
      <div class="page-head"><div><h1 class="page-title">${esc(ac.nome)}</h1><p class="page-sub">Dados da academia no FORJA.</p></div></div>
      <div class="grid cols-main">
        <section class="card">
          <div class="card-head"><h2 class="card-title">Informações</h2>${ac.status === 'ATIVA' ? '<span class="pill is-success">Ativa</span>' : `<span class="pill is-danger">${esc(ac.status)}</span>`}</div>
          <div class="card-body">
            <dl class="dl">
              <dt>ID</dt><dd class="num">${esc(ac.id)}</dd>
              <dt>Plano</dt><dd>${esc(ac.plano || '—')}</dd>
              <dt>Código para alunos</dt><dd><span class="code-box">${esc(ac.codigo)}<button type="button" class="icon-btn" data-copy title="Copiar código" aria-label="Copiar código">${icon('copy', { size: 15 })}</button></span></dd>
              <dt>Início do contrato</dt><dd>${esc(ct.inicio ? F.date(ct.inicio + 'T12:00:00') : '—')}</dd>
              <dt>Término do contrato</dt><dd>${esc(ct.fim ? F.date(ct.fim + 'T12:00:00') : 'Sem término definido')}${ct.diasRestantes != null && ct.diasRestantes >= 0 ? ` <span class="faint">· ${ct.diasRestantes} dias</span>` : ''}</dd>
              <dt>Situação do contrato</dt><dd>${ct.valido ? '<span class="pill is-success">Válido</span>' : '<span class="pill is-danger">Inválido ou vencido</span>'}</dd>
              <dt>Cliente desde</dt><dd>${esc(F.date(ac.criadoEm))}</dd>
            </dl>
          </div>
        </section>
        <div class="stack">
          <section class="card kpi">
            <p class="kpi-label">${icon('users', { size: 15, stroke: 2 })} Alunos</p>
            <p class="kpi-value">${ac.alunos}<small>/ ${ac.limite}</small></p>
            ${TUI.meterHTML(ac.alunos, ac.limite)}
            <p class="kpi-foot">Com ${ac.limite} de ${ac.limite}, novos alunos não conseguem entrar: o servidor recusa o código.</p>
          </section>
          <section class="card"><div class="card-body">
            <div class="alert">${icon('info', { size: 16, stroke: 2 })}<div>Como o aluno entra: no app FORJA, em <strong>Perfil › Academia</strong>, ele digita o código <strong>${esc(ac.codigo)}</strong> e passa a ter o Premium Academia.</div></div>
            <div class="alert">${icon('lock', { size: 16, stroke: 2 })}<div>Limite de alunos, plano e contrato são alterados pelo FORJA. Fale com a gente para contratar mais vagas.</div></div>
          </div></section>
        </div>
      </div>`;
    ctx.el.querySelector('[data-copy]').addEventListener('click', () => {
      (navigator.clipboard ? navigator.clipboard.writeText(ac.codigo) : Promise.reject()).then(() => TUI.toast('Código copiado.')).catch(() => TUI.toast(ac.codigo));
    });
  }

  async function trainers(ctx) {
    ctx.setCrumbs([{ label: 'Treinadores' }]);
    loading(ctx, 'table');
    let d;
    try { d = await ctx.cache.get('academy', API.academyInfo); } catch (e) { return error(ctx, e); }
    if (!ctx.alive()) return;
    const PERM_LABEL = {
      'alunos.ver': 'Ver e pesquisar alunos', 'alunos.dadosFisicos': 'Ver dados físicos', 'alunos.peso': 'Ver histórico de peso',
      'treinos.ver': 'Ver treinos', 'treinos.editar': 'Criar, editar e excluir treinos', 'treinadores.ver': 'Ver a equipe',
      'alunos.desvincular': 'Encerrar vínculo de alunos'
    };
    ctx.el.innerHTML = `
      <div class="page-head"><div><h1 class="page-title">Treinadores</h1><p class="page-sub">Equipe com acesso à ${esc(d.academia.nome)}.</p></div></div>
      <div class="grid cols-main">
        <section class="card">
          <div class="table-wrap"><table class="table">
            <thead><tr><th>Nome</th><th>Papel</th><th>Status</th><th>Último acesso</th></tr></thead>
            <tbody>${d.treinadores.length ? d.treinadores.map((t) => `
              <tr><td>${personHTML(t.nome + (t.voce ? ' (você)' : ''), t.email)}</td>
                <td><span class="pill no-dot ${t.papel === 'GESTOR' ? 'is-accent' : ''}">${t.papel === 'GESTOR' ? 'Gestor' : 'Treinador'}</span></td>
                <td>${t.status === 'ATIVO' ? '<span class="pill is-success">Ativo</span>' : '<span class="pill">Inativo</span>'}</td>
                <td class="muted">${esc(F.ago(t.ultimoAcesso))}</td></tr>`).join('') : `<tr><td colspan="4">${TUI.emptyHTML('whistle', 'Sem permissão para ver a equipe')}</td></tr>`}
            </tbody></table></div>
        </section>
        <section class="card">
          <div class="card-head"><h2 class="card-title">Suas permissões</h2><span class="pill is-accent no-dot">${d.papel === 'GESTOR' ? 'Gestor' : 'Treinador'}</span></div>
          <div class="card-body">
            <ul class="stack-sm">${d.permissoes.map((p) => `<li class="row-flex">${icon('check', { size: 16, stroke: 2.4, cls: 'accent' })} ${esc(PERM_LABEL[p] || p)}</li>`).join('')}</ul>
            <p class="card-sub mt-4">Ninguém no Dashboard altera assinaturas, limite de alunos ou códigos globais. Novos treinadores são cadastrados pelo administrador do FORJA.</p>
          </div>
        </section>
      </div>`;
  }

  global.Views = { dashboard, students, student, workouts, academy, trainers, error, loading };
})(window);
