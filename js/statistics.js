/* FORJA — cálculos puros (sem DOM, sem storage)
   Formato de sessão concluída:
   { id, workoutId, name, startedAt, endedAt, durationSec,
     exercises: [{ exerciseId, name, muscle, sets: [{ weightKg, reps, type: 'normal'|'warmup'|'drop', done }] }],
     rpe, mood, notes } */
(function (global) {
  'use strict';

  const DAY = 86400000;

  const isValidNumber = (n) => typeof n === 'number' && Number.isFinite(n) && n >= 0;

  // Volume = carga × repetições
  function calculateVolume(weightKg, reps) {
    if (!isValidNumber(weightKg) || !isValidNumber(reps)) return 0;
    return weightKg * reps;
  }

  // Epley: 1RM = peso × (1 + reps / 30). Uma repetição é o próprio peso.
  function calculateEstimated1RM(weightKg, reps) {
    if (!isValidNumber(weightKg) || !isValidNumber(reps) || reps < 1 || weightKg === 0) return 0;
    if (reps === 1) return weightKg;
    return weightKg * (1 + reps / 30);
  }

  // Séries de trabalho: concluídas e que não são aquecimento
  const isWorkingSet = (set) => !!set && set.done !== false && set.type !== 'warmup';

  function workingSets(session) {
    const out = [];
    (session.exercises || []).forEach((ex) => (ex.sets || []).forEach((s) => { if (isWorkingSet(s)) out.push(s); }));
    return out;
  }

  function sessionVolume(session) {
    return workingSets(session).reduce((sum, s) => sum + calculateVolume(s.weightKg, s.reps), 0);
  }

  function summarize(sessions) {
    let volume = 0, durationSec = 0, sets = 0, reps = 0;
    sessions.forEach((s) => {
      const ws = workingSets(s);
      sets += ws.length;
      ws.forEach((set) => { reps += set.reps || 0; volume += calculateVolume(set.weightKg, set.reps); });
      durationSec += s.durationSec || 0;
    });
    return { count: sessions.length, volume, durationSec, sets, reps };
  }

  const inRange = (sessions, from, to) =>
    sessions.filter((s) => { const t = new Date(s.startedAt).getTime(); return t >= from && t < to; });

  // Semana atual (segunda a domingo) comparada com a anterior
  function calculateWeeklyStats(sessions, ref = new Date()) {
    const start = global.U.startOfWeek(ref).getTime();
    const end = start + 7 * DAY;
    const current = summarize(inRange(sessions, start, end));
    const previous = summarize(inRange(sessions, start - 7 * DAY, start));
    const volumeChange = previous.volume > 0 ? (current.volume - previous.volume) / previous.volume : null;
    return Object.assign(current, { previous, volumeChange });
  }

  function calculateTotals(sessions) { return summarize(sessions); }

  // Dias consecutivos com treino, terminando hoje (ou ontem, se hoje ainda não treinou)
  function calculateStreak(sessions, ref = new Date()) {
    if (!sessions.length) return 0;
    const days = new Set(sessions.map((s) => global.U.dayKey(s.startedAt)));
    let cursor = global.U.startOfDay(ref);
    if (!days.has(global.U.dayKey(cursor))) cursor = global.U.addDays(cursor, -1);
    let streak = 0;
    while (days.has(global.U.dayKey(cursor))) { streak++; cursor = global.U.addDays(cursor, -1); }
    return streak;
  }

  // Progresso de uma meta, 0–1
  function calculateProgress(current, target, start = 0) {
    if (!isValidNumber(current) || !isValidNumber(target) || target === start) return 0;
    return Math.max(0, Math.min(1, (current - start) / (target - start)));
  }

  global.Statistics = {
    calculateVolume, calculateEstimated1RM, isWorkingSet, workingSets, sessionVolume,
    calculateWeeklyStats, calculateTotals, calculateStreak, calculateProgress
  };
})(window);
