/* FORJA — evolução
   Fase 1: números gerais calculados do histórico real. Fases 4–5 adicionam PRs, gráficos,
   calendário, heatmap, metas, conquistas e insights. */
(function (global) {
  'use strict';
  const { U, Statistics } = global;

  function renderScreen(root) {
    const sessions = global.Sessions.all();
    const t = Statistics.calculateTotals(sessions);
    const time = U.durationParts(t.durationSec);
    const unit = U.currentUnit();
    const empty = t.count === 0;

    root.innerHTML = `
      <section class="page">
        <header class="page-header">
          <h1 class="t-large-title" data-large-title>Sua evolução.</h1>
        </header>

        <div class="mt-10 reveal ${empty ? 'metrics-empty' : ''}">
          <div class="metric" style="--i:0">
            <p class="t-eyebrow">Treinos</p>
            <p class="metric-value">${U.fmtNum(t.count)}</p>
          </div>
          <div class="metric" style="--i:1">
            <p class="t-eyebrow">Volume</p>
            <p class="metric-value">${U.fmtVolume(t.volume, { withUnit: false })}<small>${unit}</small></p>
          </div>
          <div class="metric" style="--i:2">
            <p class="t-eyebrow">Tempo</p>
            <p class="metric-value">${time.value}<small>${time.unit}</small></p>
          </div>
          <div class="metric" style="--i:3">
            <p class="t-eyebrow">Séries</p>
            <p class="metric-value">${U.fmtNum(t.sets)}</p>
          </div>
        </div>

        ${empty ? `<p class="t-callout mt-6">Seus números começam a aparecer depois do primeiro treino concluído.</p>` : ''}
      </section>`;
  }

  global.Progress = { renderScreen };
})(window);
