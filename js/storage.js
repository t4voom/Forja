/* FORJA — persistência em localStorage
   Regras:
   · Cada coleção vive em sua própria chave (forja.<chave>), então salvar uma série
     não reescreve o histórico inteiro.
   · Toda escrita é síncrona e imediata (write-through). Não existe estado "só em memória".
   · O que get() devolve é congelado: para alterar, use set() ou update(), que persistem.
   · JSON corrompido nunca é descartado em silêncio — é copiado para forja.corrupt.* antes. */
(function (global) {
  'use strict';

  const PREFIX = 'forja.';
  const SCHEMA_VERSION = 1;

  const DEFAULTS = {
    meta: { schema: SCHEMA_VERSION, onboarded: false, onboardingStep: 0, createdAt: null },
    profile: null,          // { name, weightKg, heightCm, goal, experience, createdAt, updatedAt }
    settings: { theme: 'dark', unit: 'kg', haptics: true, animations: true },
    workouts: [],           // modelos de treino
    exercises: [],          // exercícios personalizados
    favorites: [],          // ids de exercícios favoritos
    sessions: [],           // treinos concluídos
    active: null,           // treino em andamento (autosave)
    bodyweight: [],         // { id, date, kg }
    goals: []               // metas
  };
  const KEYS = Object.keys(DEFAULTS);

  const cache = Object.create(null);
  const listeners = new Set();
  let available = true;

  const clone = (v) => (v === undefined || v === null ? v : JSON.parse(JSON.stringify(v)));

  function deepFreeze(o) {
    if (o && typeof o === 'object' && !Object.isFrozen(o)) {
      Object.freeze(o);
      Object.keys(o).forEach((k) => deepFreeze(o[k]));
    }
    return o;
  }

  function withDefaults(key, value) {
    const def = DEFAULTS[key];
    if (value === null || value === undefined) return clone(def);
    // Objetos de configuração ganham campos novos sem perder os existentes
    if (def && typeof def === 'object' && !Array.isArray(def) && typeof value === 'object' && !Array.isArray(value)) {
      return Object.assign(clone(def), value);
    }
    if (Array.isArray(def) && !Array.isArray(value)) return clone(def);
    return value;
  }

  function assertKey(key) {
    if (!KEYS.includes(key)) throw new Error(`[FORJA] chave de storage desconhecida: ${key}`);
  }

  function readRaw(key) {
    let raw = null;
    try { raw = localStorage.getItem(PREFIX + key); } catch (e) { available = false; }
    if (raw === null) return withDefaults(key, null);
    try {
      return withDefaults(key, JSON.parse(raw));
    } catch (e) {
      // Nunca perder dados: preserva o conteúdo ilegível antes de seguir com o padrão
      try { localStorage.setItem(`${PREFIX}corrupt.${key}.${Date.now()}`, raw); } catch (_) {}
      console.error(`[FORJA] dados corrompidos em ${key}; cópia preservada.`, e);
      return withDefaults(key, null);
    }
  }

  function get(key) {
    assertKey(key);
    if (!(key in cache)) cache[key] = deepFreeze(readRaw(key));
    return cache[key];
  }

  function set(key, value) {
    assertKey(key);
    const next = clone(value);
    let ok = true;
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(next));
    } catch (e) {
      ok = false;
      console.error(`[FORJA] falha ao salvar ${key}`, e);
      emit({ type: 'error', key, error: e });
    }
    cache[key] = deepFreeze(next);
    emit({ type: 'change', key });
    return ok;
  }

  // Recebe uma cópia editável; persiste o que a função devolver (ou o próprio rascunho)
  function update(key, fn) {
    const draft = clone(get(key));
    const result = fn(draft);
    return set(key, result === undefined ? draft : result);
  }

  function remove(key) {
    assertKey(key);
    try { localStorage.removeItem(PREFIX + key); } catch (e) {}
    delete cache[key];
    emit({ type: 'change', key });
  }

  function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
  function emit(evt) { listeners.forEach((fn) => { try { fn(evt); } catch (e) { console.error(e); } }); }

  // Outra aba alterou os dados: invalida o cache daquela chave
  global.addEventListener('storage', (e) => {
    if (!e.key || !e.key.startsWith(PREFIX)) return;
    const key = e.key.slice(PREFIX.length);
    if (KEYS.includes(key)) { delete cache[key]; emit({ type: 'external', key }); }
  });

  function checkAvailable() {
    try {
      const probe = PREFIX + '__probe';
      localStorage.setItem(probe, '1');
      localStorage.removeItem(probe);
      available = true;
    } catch (e) { available = false; }
    return available;
  }

  // Migrações futuras entram aqui, em ordem
  function migrate() {
    const meta = get('meta');
    if (meta.schema === SCHEMA_VERSION) return;
    update('meta', (m) => { m.schema = SCHEMA_VERSION; });
  }

  function snapshot() {
    const data = {};
    KEYS.forEach((k) => { data[k] = clone(get(k)); });
    return data;
  }

  function clearAll() {
    try {
      Object.keys(localStorage).filter((k) => k.startsWith(PREFIX)).forEach((k) => localStorage.removeItem(k));
    } catch (e) {}
    KEYS.forEach((k) => delete cache[k]);
    emit({ type: 'clear' });
  }

  function usageBytes() {
    let total = 0;
    try {
      Object.keys(localStorage).filter((k) => k.startsWith(PREFIX)).forEach((k) => {
        total += (k.length + (localStorage.getItem(k) || '').length) * 2;
      });
    } catch (e) {}
    return total;
  }

  global.Store = {
    SCHEMA_VERSION, KEYS, DEFAULTS,
    get, set, update, remove, subscribe,
    checkAvailable, isAvailable: () => available,
    migrate, snapshot, clearAll, usageBytes
  };
})(window);
