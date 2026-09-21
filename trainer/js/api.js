/* FORJA Trainer — cliente da API (o mesmo Apps Script do app, ações trainer*)
   · O Dashboard só PEDE. Quem autentica, confere permissões, academia e vínculo do aluno é o servidor.
   · Sessão local: forja.trainer.session = { token, trainer, academiaId }. É só a chave de acesso
     (vale 12 h); permissões e academias são recarregadas do servidor a cada abertura. */
(function (global) {
  'use strict';
  const CFG = global.FORJA_CONFIG || {};
  const KEY = 'forja.trainer.session';

  const MESSAGES = {
    invalid_login: 'E-mail ou senha incorretos.',
    invalid_session: 'Sua sessão expirou. Entre de novo.',
    trainer_inactive: 'Seu acesso de treinador está desativado. Fale com a academia.',
    password_change_required: 'Troque a senha provisória para continuar.',
    too_many_attempts: 'Muitas tentativas erradas. Espere 15 minutos e tente de novo.',
    wrong_password: 'A senha atual está incorreta.',
    weak_password: 'Use uma senha com pelo menos 8 caracteres.',
    forbidden: 'Você não tem permissão para esta ação.',
    academy_inactive: 'Esta academia não está ativa no FORJA.',
    student_not_found: 'Aluno não encontrado nesta academia.',
    workout_not_found: 'Treino não encontrado. Ele pode ter sido excluído.',
    invalid_workout: 'Confira os dados do treino.',
    network: 'Sem conexão com o servidor. Verifique a internet.',
    config: 'A URL do servidor (sheetsUrl em js/config.js) não foi configurada.',
    server: 'O servidor não respondeu como esperado. Tente de novo.'
  };

  class ApiError extends Error {
    constructor(code, message) { super(message || MESSAGES[code] || MESSAGES.server); this.code = code; }
  }

  const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } };
  const write = (v) => { try { v ? localStorage.setItem(KEY, JSON.stringify(v)) : localStorage.removeItem(KEY); } catch (e) {} };
  const listeners = new Set();

  // Content-Type text/plain evita o "preflight" de CORS, que o Apps Script não responde
  async function call(action, payload = {}) {
    if (!CFG.sheetsUrl || CFG.backend !== 'sheets') throw new ApiError('config');
    let res;
    try {
      res = await fetch(CFG.sheetsUrl, {
        method: 'POST',
        redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(Object.assign({ action }, payload))
      });
    } catch (e) { throw new ApiError('network'); }
    let out = null;
    try { out = await res.json(); } catch (e) { /* resposta que não é JSON */ }
    if (!out) throw new ApiError('server');
    if (!out.ok) {
      const err = new ApiError(out.error, out.message || MESSAGES[out.error]);
      if (out.error === 'invalid_session' || out.error === 'trainer_inactive') { write(null); listeners.forEach((fn) => fn(err)); }
      throw err;
    }
    return out;
  }

  // Chamadas autenticadas levam o token e a academia selecionada
  const authed = (action, extra = {}) => {
    const s = read();
    if (!s) throw new ApiError('invalid_session');
    return call(action, Object.assign({ token: s.token, academiaId: s.academiaId }, extra));
  };

  const API = {
    MESSAGES,
    ApiError,
    session: read,
    onLogout: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },

    async login(email, password) {
      const r = await call('trainerLogin', { email: String(email || '').trim().toLowerCase(), password });
      const prev = read();
      const first = (r.trainer.academias[0] || {}).id || null;
      const keep = prev && r.trainer.academias.some((a) => a.id === prev.academiaId) ? prev.academiaId : first;
      write({ token: r.token, trainer: r.trainer, academiaId: keep });
      return r.trainer;
    },

    async me() {
      const s = read();
      if (!s) throw new ApiError('invalid_session');
      const r = await call('trainerMe', { token: s.token });
      const academiaId = r.trainer.academias.some((a) => a.id === s.academiaId) ? s.academiaId : ((r.trainer.academias[0] || {}).id || null);
      write(Object.assign(s, { trainer: r.trainer, academiaId }));
      return r.trainer;
    },

    async logout() {
      const s = read();
      write(null);
      if (s) { try { await call('logout', { token: s.token }); } catch (e) { /* sai mesmo sem servidor */ } }
    },

    async changePassword(current, next) {
      const s = read();
      const r = await call('trainerChangePassword', { token: s.token, current, next });
      write(Object.assign(s, { trainer: r.trainer }));
      return r.trainer;
    },

    setAcademy(id) { const s = read(); if (s) write(Object.assign(s, { academiaId: id })); },
    academy() {
      const s = read();
      return s && s.trainer ? (s.trainer.academias.find((a) => a.id === s.academiaId) || null) : null;
    },
    can(perm) { const a = API.academy(); return !!a && (a.permissoes || []).includes(perm); },

    overview: () => authed('trainerOverview'),
    students: () => authed('trainerStudents'),
    student: (userId) => authed('trainerStudent', { userId }),
    workouts: () => authed('trainerWorkouts'),
    academyInfo: () => authed('trainerAcademy'),
    saveWorkout: (userId, workout) => authed('trainerSaveWorkout', { userId, workout }),
    deleteWorkout: (userId, workoutId) => authed('trainerDeleteWorkout', { userId, workoutId }),
    unlinkStudent: (userId) => authed('trainerUnlinkStudent', { userId })
  };

  global.API = API;
})(window);
