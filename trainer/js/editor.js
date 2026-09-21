/* FORJA Trainer — editor de treino
   Dashboard → API (valida treinador, academia, vínculo, permissão e dados) → Google Planilhas → app do aluno.
   Formato salvo (o mesmo do app, ver js/workouts.js):
   { id, name, description, muscleGroup, color, exercises: [{ id, exerciseId, name, muscle, sets, repMin, repMax, loadKg, restSec, notes }] } */
(function (global) {
  'use strict';
  const { U, API, TUI } = global;
  const { esc, icon } = U;
  const { F } = TUI;

  const COLORS = ['#E8853D', '#E5B454', '#E5675A', '#5E9EFF', '#4CC38A', '#A78BFA', '#8E8E93'];
  const MAX_EXERCISES = 40;
  const GROUP_SUGGESTIONS = ['Peito + Tríceps', 'Costas + Bíceps', 'Pernas', 'Ombros + Abdômen', 'Superiores', 'Inferiores', 'Full Body', 'Push', 'Pull', 'Legs'];
  const defaultReps = (muscle) => (muscle === 'Panturrilha' || muscle === 'Abdômen' ? [12, 15] : [8, 12]);
  const tmpId = () => `wx_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const exName = (x) => (global.Exercises.get(x.exerciseId) || {}).name || x.name || x.exerciseId;
  const exMuscle = (x) => (global.Exercises.get(x.exerciseId) || {}).muscle || x.muscle || '';

  async function render(ctx, userId, workoutId) {
    ctx.setCrumbs([{ label: 'Alunos', href: 'alunos' }, { label: '…' }]);
    if (!API.can('treinos.editar')) return global.Views.error(ctx, new API.ApiError('forbidden'));
    global.Views.loading(ctx);
    let d;
    try { d = await ctx.cache.get(`student:${userId}`, () => API.student(userId), 15000); } catch (e) { return global.Views.error(ctx, e); }
    if (!ctx.alive()) return;
    global.Store.setCustomExercises(d.exerciciosPersonalizados);
    const isNew = workoutId === 'novo';
    const src = isNew ? null : d.treinos.find((w) => w.id === workoutId);
    if (!isNew && !src) return global.Views.error(ctx, new API.ApiError('workout_not_found'));
    const a = d.aluno;
    ctx.setCrumbs([{ label: 'Alunos', href: 'alunos' }, { label: a.nome, href: `alunos/${a.id}` }, { label: isNew ? 'Novo treino' : src.name }]);

    const draft = src ? {
      id: src.id, name: src.name || '', description: src.description || '', muscleGroup: src.muscleGroup || '',
      color: COLORS.includes(src.color) ? src.color : COLORS[0],
      exercises: (src.exercises || []).map((x) => ({
        id: x.id || tmpId(), exerciseId: x.exerciseId, name: exName(x), muscle: exMuscle(x),
        sets: x.sets, repMin: x.repMin, repMax: x.repMax,
        loadKg: x.loadKg != null ? x.loadKg : '', restSec: x.restSec != null ? x.restSec : '', notes: x.notes || ''
      }))
    } : { id: '', name: '', description: '', muscleGroup: '', color: COLORS[d.treinos.length % COLORS.length], exercises: [] };
    const openNotes = new Set(draft.exercises.filter((x) => x.notes).map((x) => x.id));
    const initial = JSON.stringify(draft);
    let saving = false;
    const dirty = () => JSON.stringify(draft) !== initial;
    ctx.setGuard((silent) => !dirty() || saving || (!silent && global.confirm('Sair sem salvar as alterações deste treino?')));

    ctx.el.innerHTML = `
      <div class="page-head">
        <div>
          <h1 class="page-title">${isNew ? 'Novo treino' : 'Editar treino'}</h1>
          <p class="page-sub">Para ${esc(a.nome)} · o treino aparece no app do aluno no próximo acesso.</p>
        </div>
        ${src && src.managed ? `<button type="button" class="btn btn-danger" data-delete>${icon('trash', { size: 16 })} Excluir treino</button>` : ''}
      </div>
      ${src && !src.managed ? `<div class="alert is-aviso" style="margin-bottom:16px">${icon('alert', { size: 16, stroke: 2 })}<div><strong>Este treino foi criado pelo aluno.</strong> Ao salvar, ele passa a ser gerenciado por você: o aluno continua treinando com ele, mas não consegue mais editá-lo no app. A alteração fica registrada no histórico.</div></div>` : ''}
      <div class="grid editor-grid">
        <section class="card">
          <div class="card-head"><h2 class="card-title">Informações</h2></div>
          <div class="card-body">
            <div class="form-row">
              <div><label class="label" for="w-name">Nome do treino</label><input class="field" id="w-name" maxlength="40" placeholder="Ex.: Treino A" value="${esc(draft.name)}" data-f="name"></div>
              <div><label class="label" for="w-group">Grupo muscular</label><input class="field" id="w-group" maxlength="60" list="w-groups" placeholder="Ex.: Peito + Tríceps" value="${esc(draft.muscleGroup)}" data-f="muscleGroup">
                <datalist id="w-groups">${GROUP_SUGGESTIONS.map((g) => `<option value="${esc(g)}">`).join('')}</datalist></div>
              <div><label class="label">Cor</label><div class="swatches" role="radiogroup" aria-label="Cor do treino" style="height:38px;align-items:center">${COLORS.map((c) => `<button type="button" class="swatch" role="radio" aria-checked="${c === draft.color}" data-color="${c}" style="--c:${c}" aria-label="Cor ${c}"></button>`).join('')}</div></div>
            </div>
            <div class="mt-4"><label class="label" for="w-desc">Descrição <span class="faint">· opcional</span></label><input class="field" id="w-desc" maxlength="120" placeholder="Ex.: Foco em força, cadência controlada" value="${esc(draft.description)}" data-f="description"></div>
          </div>
        </section>
        <section class="card">
          <div class="card-head">
            <div><h2 class="card-title">Exercícios <span class="faint" data-count></span></h2><p class="card-sub">Arraste pela alça ou use as setas para mudar a ordem.</p></div>
            <button type="button" class="btn btn-secondary" data-add>${icon('plus', { size: 16, stroke: 2 })} Adicionar exercício</button>
          </div>
          <div class="card-body" style="padding-top:8px"><div class="table-wrap" data-ex></div></div>
        </section>
      </div>
      <div class="savebar">
        <span class="savebar-status" data-status></span>
        <a class="btn btn-ghost" href="#/alunos/${esc(a.id)}">Cancelar</a>
        <button type="button" class="btn btn-primary" data-save>${icon('check', { size: 16, stroke: 2.2 })} Salvar treino</button>
      </div>`;

    const exHost = ctx.el.querySelector('[data-ex]');
    const status = ctx.el.querySelector('[data-status]');
    const saveBtn = ctx.el.querySelector('[data-save]');

    function paintStatus() {
      const d0 = dirty();
      status.classList.toggle('is-dirty', d0);
      status.innerHTML = d0 ? `${icon('edit', { size: 14, stroke: 2 })} Alterações não salvas` : (isNew ? 'Preencha o treino e salve.' : `${icon('check', { size: 14, stroke: 2 })} Tudo salvo`);
      ctx.el.querySelector('[data-count]').textContent = `· ${draft.exercises.length}`;
    }

    function paintExercises() {
      const n = draft.exercises.length;
      if (!n) {
        exHost.innerHTML = TUI.emptyHTML('dumbbell', 'Nenhum exercício ainda', 'Adicione os exercícios da biblioteca do FORJA.');
        paintStatus();
        return;
      }
      exHost.innerHTML = `
        <table class="ex-table">
          <thead><tr>
            <th class="col-order"></th><th>Exercício</th><th class="col-num">Séries</th><th class="col-reps">Repetições</th>
            <th class="col-num">Carga</th><th class="col-num">Descanso</th><th class="col-actions"></th>
          </tr></thead>
          <tbody>${draft.exercises.map((x, i) => `
            <tr class="ex-row" data-i="${i}">
              <td><span class="ex-order">
                <span class="ex-handle" data-handle title="Arrastar" aria-hidden="true">${icon('grip', { size: 16, stroke: 2 })}</span>
                <span class="ex-idx">${i + 1}</span>
              </span></td>
              <td><p class="ex-name">${esc(x.name)}</p><p class="ex-muscle">${esc(x.muscle || '—')}</p></td>
              <td><input class="field field-sm" type="number" min="1" max="10" step="1" inputmode="numeric" value="${esc(x.sets)}" data-k="sets" aria-label="Séries de ${esc(x.name)}"></td>
              <td><span class="reps"><input class="field field-sm" type="number" min="1" max="50" value="${esc(x.repMin)}" data-k="repMin" aria-label="Repetições mínimas">–<input class="field field-sm" type="number" min="1" max="60" value="${esc(x.repMax)}" data-k="repMax" aria-label="Repetições máximas"></span></td>
              <td><span class="input-suffix"><input class="field field-sm" type="number" min="0" max="500" step="0.5" inputmode="decimal" placeholder="—" value="${esc(x.loadKg)}" data-k="loadKg" aria-label="Carga em kg"><span>kg</span></span></td>
              <td><span class="input-suffix"><input class="field field-sm" type="number" min="0" max="900" step="5" inputmode="numeric" placeholder="—" value="${esc(x.restSec)}" data-k="restSec" aria-label="Descanso em segundos"><span>s</span></span></td>
              <td class="col-actions"><span class="ex-actions">
                <button type="button" class="icon-btn" data-move="-1" ${i === 0 ? 'disabled' : ''} title="Subir" aria-label="Subir">${icon('arrowUp', { size: 14, stroke: 2.2 })}</button>
                <button type="button" class="icon-btn" data-move="1" ${i === n - 1 ? 'disabled' : ''} title="Descer" aria-label="Descer">${icon('arrowDown', { size: 14, stroke: 2.2 })}</button>
                <button type="button" class="icon-btn" data-more title="Mais opções" aria-label="Mais opções">${icon('more', { size: 16 })}</button>
              </span></td>
            </tr>
            <tr class="ex-notes-row" data-notes-for="${i}" ${openNotes.has(x.id) ? '' : 'hidden'}>
              <td></td>
              <td colspan="6"><textarea class="field" rows="2" maxlength="200" placeholder="Observação para o aluno (execução, cadência, amplitude…)" data-k="notes">${esc(x.notes)}</textarea></td>
            </tr>`).join('')}
          </tbody>
        </table>`;
      paintStatus();
    }

    /* ---------- Edição ---------- */
    ctx.el.querySelectorAll('[data-f]').forEach((inp) => inp.addEventListener('input', () => { draft[inp.dataset.f] = inp.value; inp.classList.remove('is-invalid'); paintStatus(); }));
    ctx.el.querySelector('.swatches').addEventListener('click', (e) => {
      const s = e.target.closest('[data-color]');
      if (!s) return;
      draft.color = s.dataset.color;
      ctx.el.querySelectorAll('.swatch').forEach((x) => x.setAttribute('aria-checked', String(x === s)));
      paintStatus();
    });

    exHost.addEventListener('input', (e) => {
      const inp = e.target.closest('[data-k]');
      if (!inp) return;
      const row = inp.closest('[data-i], [data-notes-for]');
      const i = Number(row.dataset.i != null ? row.dataset.i : row.dataset.notesFor);
      const k = inp.dataset.k;
      const x = draft.exercises[i];
      if (k === 'notes') x.notes = inp.value;
      else if (k === 'loadKg' || k === 'restSec') x[k] = inp.value === '' ? '' : Number(inp.value);
      else x[k] = inp.value === '' ? '' : Number(inp.value);
      inp.classList.remove('is-invalid');
      paintStatus();
    });

    const moveTo = (from, to) => {
      if (to < 0 || to >= draft.exercises.length || from === to) return;
      const [item] = draft.exercises.splice(from, 1);
      draft.exercises.splice(to, 0, item);
      paintExercises();
    };

    exHost.addEventListener('click', (e) => {
      const row = e.target.closest('[data-i]');
      if (!row) return;
      const i = Number(row.dataset.i);
      const mv = e.target.closest('[data-move]');
      if (mv) return moveTo(i, i + Number(mv.dataset.move));
      if (e.target.closest('[data-more]')) openRowMenu(e.target.closest('[data-more]'), i);
    });

    function openRowMenu(anchor, i) {
      document.querySelectorAll('.menu').forEach((m) => m.remove());
      const x = draft.exercises[i];
      const menu = U.h(`
        <div class="menu" role="menu" style="top:calc(100% + 4px)">
          <button type="button" data-a="notes">${icon('note', { size: 16 })} ${openNotes.has(x.id) ? 'Ocultar observação' : x.notes ? 'Ver observação' : 'Adicionar observação'}</button>
          <button type="button" data-a="swap">${icon('swap', { size: 16 })} Trocar exercício</button>
          <button type="button" data-a="dup" ${draft.exercises.length >= MAX_EXERCISES ? 'disabled' : ''}>${icon('copy', { size: 16 })} Duplicar</button>
          <button type="button" data-a="remove" class="is-danger">${icon('trash', { size: 16 })} Remover</button>
        </div>`);
      const wrap = anchor.closest('.ex-actions');
      wrap.style.position = 'relative';
      wrap.appendChild(menu);
      const close = () => { menu.remove(); document.removeEventListener('mousedown', outside); };
      const outside = (ev) => { if (!menu.contains(ev.target)) close(); };
      setTimeout(() => document.addEventListener('mousedown', outside), 0);
      menu.addEventListener('click', (ev) => {
        const b = ev.target.closest('[data-a]');
        if (!b) return;
        close();
        if (b.dataset.a === 'notes') {
          if (openNotes.has(x.id)) openNotes.delete(x.id); else openNotes.add(x.id);
          paintExercises();
          const ta = exHost.querySelector(`[data-notes-for="${i}"] textarea`);
          if (ta && openNotes.has(x.id)) ta.focus();
        } else if (b.dataset.a === 'swap') {
          openPicker({ single: true, exclude: draft.exercises.map((e) => e.exerciseId), onPick: ([ex]) => {
            Object.assign(x, { exerciseId: ex.id, name: ex.name, muscle: ex.muscle });
            paintExercises();
          } });
        } else if (b.dataset.a === 'dup') {
          draft.exercises.splice(i + 1, 0, Object.assign({}, x, { id: tmpId() }));
          if (x.notes) openNotes.add(draft.exercises[i + 1].id);
          paintExercises();
        } else if (b.dataset.a === 'remove') {
          const removed = draft.exercises.splice(i, 1)[0];
          paintExercises();
          TUI.toast(`${removed.name} removido.`);
        }
      });
    }

    // Arrastar para reordenar (pela alça)
    let dragFrom = null;
    exHost.addEventListener('mousedown', (e) => {
      const h = e.target.closest('[data-handle]');
      if (h) h.closest('tr').setAttribute('draggable', 'true');
    });
    exHost.addEventListener('dragstart', (e) => {
      const tr = e.target.closest('tr[data-i]');
      if (!tr) return;
      dragFrom = Number(tr.dataset.i);
      tr.classList.add('is-dragging');
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', String(dragFrom)); } catch (_) {}
    });
    exHost.addEventListener('dragover', (e) => {
      if (dragFrom === null) return;
      const tr = e.target.closest('tr[data-i]');
      if (!tr) return;
      e.preventDefault();
      exHost.querySelectorAll('.is-drop-before').forEach((x) => x.classList.remove('is-drop-before'));
      tr.classList.add('is-drop-before');
    });
    exHost.addEventListener('drop', (e) => {
      const tr = e.target.closest('tr[data-i]');
      if (dragFrom === null || !tr) return;
      e.preventDefault();
      // Solta "antes" da linha alvo: descendo, o índice final é um a menos (o item saiu de cima)
      let to = Number(tr.dataset.i);
      if (to > dragFrom) to -= 1;
      const from = dragFrom;
      dragFrom = null;
      moveTo(from, to);
    });
    exHost.addEventListener('dragend', () => {
      dragFrom = null;
      exHost.querySelectorAll('tr[draggable]').forEach((x) => { x.removeAttribute('draggable'); x.classList.remove('is-dragging', 'is-drop-before'); });
    });

    ctx.el.querySelector('[data-add]').addEventListener('click', () => {
      if (draft.exercises.length >= MAX_EXERCISES) return TUI.toast(`Use até ${MAX_EXERCISES} exercícios por treino.`, { error: true });
      openPicker({
        exclude: draft.exercises.map((x) => x.exerciseId),
        onPick: (list) => {
          list.slice(0, MAX_EXERCISES - draft.exercises.length).forEach((ex) => {
            const [repMin, repMax] = defaultReps(ex.muscle);
            draft.exercises.push({ id: tmpId(), exerciseId: ex.id, name: ex.name, muscle: ex.muscle, sets: 3, repMin, repMax, loadKg: '', restSec: '', notes: '' });
          });
          paintExercises();
          TUI.toast(list.length === 1 ? `${list[0].name} adicionado.` : `${list.length} exercícios adicionados.`);
        }
      });
    });

    /* ---------- Validação (o servidor valida de novo) ---------- */
    function validate() {
      const errs = [];
      const nameInp = ctx.el.querySelector('#w-name');
      if (!draft.name.trim()) { errs.push('Dê um nome ao treino.'); nameInp.classList.add('is-invalid'); }
      draft.exercises.forEach((x, i) => {
        const row = exHost.querySelector(`tr[data-i="${i}"]`);
        const bad = (k) => { const inp = row && row.querySelector(`[data-k="${k}"]`); if (inp) inp.classList.add('is-invalid'); };
        const int = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
        if (!int(x.sets, 1, 10)) { bad('sets'); errs.push(`${x.name}: séries de 1 a 10.`); }
        if (!int(x.repMin, 1, 50)) { bad('repMin'); errs.push(`${x.name}: repetições mínimas de 1 a 50.`); }
        if (!int(x.repMax, 1, 60) || x.repMax < x.repMin) { bad('repMax'); errs.push(`${x.name}: repetições máximas entre o mínimo e 60.`); }
        if (x.loadKg !== '' && !(x.loadKg >= 0 && x.loadKg <= 500)) { bad('loadKg'); errs.push(`${x.name}: carga de 0 a 500 kg.`); }
        if (x.restSec !== '' && !int(x.restSec, 0, 900)) { bad('restSec'); errs.push(`${x.name}: descanso de 0 a 900 s.`); }
      });
      return errs;
    }

    async function save() {
      if (saving) return;
      const errs = validate();
      if (errs.length) { TUI.toast(errs[0], { error: true, duration: 4500 }); return; }
      saving = true;
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<span class="spinner"></span> Salvando…';
      const payload = {
        id: draft.id || undefined, name: draft.name.trim(), description: draft.description.trim(), muscleGroup: draft.muscleGroup.trim(), color: draft.color,
        exercises: draft.exercises.map((x) => ({
          id: x.id, exerciseId: x.exerciseId, name: x.name, muscle: x.muscle, sets: x.sets, repMin: x.repMin, repMax: x.repMax,
          loadKg: x.loadKg === '' ? null : x.loadKg, restSec: x.restSec === '' ? null : x.restSec, notes: x.notes.trim()
        }))
      };
      try {
        await API.saveWorkout(a.id, payload);
        ctx.cache.clear();
        TUI.toast(`Treino salvo. ${a.nome.split(' ')[0]} vê a nova versão no próximo acesso ao app.`, { duration: 4500 });
        ctx.go(`alunos/${a.id}`);
      } catch (e) {
        saving = false;
        saveBtn.disabled = false;
        saveBtn.innerHTML = `${icon('check', { size: 16, stroke: 2.2 })} Salvar treino`;
        TUI.toast(e.message, { error: true, duration: 5000 });
      }
    }
    saveBtn.addEventListener('click', save);
    const onKey = (e) => {
      if (!ctx.alive()) return document.removeEventListener('keydown', onKey);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); }
    };
    document.addEventListener('keydown', onKey);

    ctx.el.querySelector('[data-delete]')?.addEventListener('click', async () => {
      const ok = await TUI.confirm({ title: `Excluir ${src.name}?`, message: `O treino sai do app de ${a.nome} no próximo acesso. A exclusão fica registrada no histórico.`, confirmLabel: 'Excluir treino', danger: true });
      if (!ok) return;
      saving = true;
      try { await API.deleteWorkout(a.id, src.id); ctx.cache.clear(); TUI.toast('Treino excluído.'); ctx.go(`alunos/${a.id}`); } catch (e) { saving = false; TUI.toast(e.message, { error: true }); }
    });

    paintExercises();
    if (isNew) setTimeout(() => ctx.el.querySelector('#w-name').focus(), 50);
  }

  /* ---------- Biblioteca de exercícios (a mesma do app) ---------- */
  function openPicker({ single = false, exclude = [], onPick }) {
    const state = { q: '', muscle: 'all', selected: new Map() };
    const body = U.h(`
      <div>
        <label class="search"><span class="sr-only">Buscar exercício</span>${icon('search', { size: 16, stroke: 2 })}<input class="field" type="search" placeholder="Buscar por nome, grupo ou equipamento" data-q></label>
        <div class="chips" data-chips>
          ${[['all', 'Todos']].concat(global.Exercises.MUSCLES.map((m) => [m, m])).map(([v, l]) => `<button type="button" class="chip" data-m="${esc(v)}" aria-pressed="${v === 'all'}">${esc(l)}</button>`).join('')}
        </div>
        <div class="pick-list" data-list role="listbox" ${single ? '' : 'aria-multiselectable="true"'}></div>
      </div>`);
    const foot = U.h(`<div class="row-flex" style="width:100%"><span class="muted" data-sel>${single ? 'Escolha um exercício' : 'Nenhum selecionado'}</span><button type="button" class="btn btn-ghost" data-cancel>Cancelar</button>${single ? '' : '<button type="button" class="btn btn-primary" data-ok disabled>Adicionar</button>'}</div>`);
    const m = TUI.modal({ title: single ? 'Trocar exercício' : 'Adicionar exercícios', sub: 'Biblioteca do FORJA e exercícios personalizados do aluno', body, foot });
    const list = body.querySelector('[data-list]');
    const paint = () => {
      const items = global.Exercises.search(state.q, { filter: state.muscle }).slice(0, 120);
      list.innerHTML = items.length ? items.map((e) => {
        const used = exclude.includes(e.id);
        return `<button type="button" class="pick" role="option" data-id="${esc(e.id)}" aria-checked="${state.selected.has(e.id)}">
          ${single ? '' : `<span class="pick-check">${icon('check', { size: 13, stroke: 3 })}</span>`}
          <span><span class="pick-name block">${esc(e.name)}</span><span class="pick-sub">${esc([e.muscle, e.equipment].filter(Boolean).join(' · '))}${e.custom ? ' · personalizado do aluno' : ''}</span></span>
          ${used ? '<span class="pick-tag">no treino</span>' : ''}
        </button>`;
      }).join('') : TUI.emptyHTML('search', 'Nenhum exercício encontrado');
      const n = state.selected.size;
      if (!single) {
        foot.querySelector('[data-sel]').textContent = n ? `${n} ${n === 1 ? 'selecionado' : 'selecionados'}` : 'Nenhum selecionado';
        const ok = foot.querySelector('[data-ok]');
        ok.disabled = !n;
        ok.textContent = n ? `Adicionar ${n}` : 'Adicionar';
      }
    };
    const q = body.querySelector('[data-q]');
    q.addEventListener('input', U.debounce(() => { state.q = q.value; paint(); }, 80));
    body.querySelector('[data-chips]').addEventListener('click', (e) => {
      const c = e.target.closest('[data-m]');
      if (!c) return;
      state.muscle = c.dataset.m;
      body.querySelectorAll('[data-m]').forEach((x) => x.setAttribute('aria-pressed', String(x === c)));
      paint();
    });
    list.addEventListener('click', (e) => {
      const b = e.target.closest('[data-id]');
      if (!b) return;
      const ex = global.Exercises.get(b.dataset.id);
      if (single) { m.close(); onPick([ex]); return; }
      if (state.selected.has(ex.id)) state.selected.delete(ex.id); else state.selected.set(ex.id, ex);
      paint();
    });
    foot.querySelector('[data-cancel]').addEventListener('click', m.close);
    foot.querySelector('[data-ok]')?.addEventListener('click', () => { m.close(); onPick([...state.selected.values()]); });
    paint();
  }

  global.Editor = { render };
})(window);
