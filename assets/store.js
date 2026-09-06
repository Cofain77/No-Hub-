/* Persistenz für No hub.
 *
 * Zwei Ebenen, bewusst redundant:
 *   IndexedDB  → primärer Speicher, überlebt am längsten
 *   localStorage → Spiegel, greift wenn IndexedDB blockiert ist (Private Mode)
 *
 * Nichts in dieser Datei löscht jemals Impuls-Einträge von selbst.
 */
(function (global) {
  'use strict';

  var DB_NAME = 'nohub';
  var DB_VER = 1;
  var LS_IMPULSES = 'nohub.impulses.v1';
  var LS_STATE = 'nohub.state.v1';

  var dbPromise = null;

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve) {
      if (!global.indexedDB) return resolve(null);
      var req;
      try { req = global.indexedDB.open(DB_NAME, DB_VER); }
      catch (e) { return resolve(null); }
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains('impulses')) {
          var s = db.createObjectStore('impulses', { keyPath: 'id' });
          s.createIndex('ts', 'ts');
        }
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'key' });
        }
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { resolve(null); };
      req.onblocked = function () { resolve(null); };
    });
    return dbPromise;
  }

  function tx(storeName, mode, fn) {
    return openDB().then(function (db) {
      if (!db) return null;
      return new Promise(function (resolve, reject) {
        var t = db.transaction(storeName, mode);
        var out = fn(t.objectStore(storeName));
        t.oncomplete = function () { resolve(out && out.result !== undefined ? out.result : out); };
        t.onerror = function () { reject(t.error); };
        t.onabort = function () { reject(t.error); };
      });
    }).catch(function () { return null; });
  }

  /* ── localStorage helpers ─────────────────────────────── */
  function lsGet(key, fallback) {
    try {
      var raw = global.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function lsSet(key, val) {
    try { global.localStorage.setItem(key, JSON.stringify(val)); return true; }
    catch (e) { return false; }
  }

  /* ── State ────────────────────────────────────────────── */
  var DEFAULT_STATE = {
    startedAt: null,      // ISO-String, Beginn des laufenden Streaks; null = Shield aus
    shieldOn: false,
    bestStreakDays: 0,
    bankedDays: 0,        // abgeschlossene Streaks, in Tagen
    resets: [],           // [{startedAt, endedAt, days}]
    createdAt: new Date().toISOString(),
    lastCsvExportAt: null,
    version: 1
  };

  function loadState() {
    return tx('meta', 'readonly', function (s) { return s.get('state'); })
      .then(function (row) {
        var fromIdb = row && row.value;
        var fromLs = lsGet(LS_STATE, null);
        var st = fromIdb || fromLs || null;
        if (!st) st = JSON.parse(JSON.stringify(DEFAULT_STATE));
        // fehlende Felder nachziehen, falls das Schema wächst
        Object.keys(DEFAULT_STATE).forEach(function (k) {
          if (st[k] === undefined) st[k] = DEFAULT_STATE[k];
        });
        return st;
      });
  }

  function saveState(st) {
    lsSet(LS_STATE, st);
    return tx('meta', 'readwrite', function (s) { s.put({ key: 'state', value: st }); })
      .then(function () { return st; });
  }

  /* ── Impulse ──────────────────────────────────────────── */
  function newId() {
    if (global.crypto && global.crypto.randomUUID) return global.crypto.randomUUID();
    return 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }

  function allImpulses() {
    return tx('impulses', 'readonly', function (s) { return s.getAll(); })
      .then(function (rows) {
        var idb = rows || [];
        var ls = lsGet(LS_IMPULSES, []) || [];
        // Vereinigung beider Quellen; IndexedDB gewinnt bei gleicher id
        var byId = Object.create(null);
        ls.forEach(function (r) { byId[r.id] = r; });
        idb.forEach(function (r) { byId[r.id] = r; });
        var out = Object.keys(byId).map(function (k) { return byId[k]; });
        out.sort(function (a, b) { return a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0; });
        return out;
      });
  }

  function mirrorToLs(list) {
    // Spiegel begrenzen, damit localStorage nicht überläuft; IndexedDB hält alles.
    lsSet(LS_IMPULSES, list.slice(0, 800));
  }

  function addImpulse(entry) {
    var rec = {
      id: entry.id || newId(),
      ts: entry.ts,                                  // ISO-String des Ereignisses
      note: (entry.note || '').trim(),
      createdAt: entry.createdAt || new Date().toISOString(),
      exportedAt: entry.exportedAt || null
    };
    return tx('impulses', 'readwrite', function (s) { s.put(rec); })
      .then(allImpulses)
      .then(function (list) { mirrorToLs(list); return list; });
  }

  function addMany(entries) {
    return tx('impulses', 'readwrite', function (s) {
      entries.forEach(function (e) { s.put(e); });
    }).then(allImpulses).then(function (list) { mirrorToLs(list); return list; });
  }

  function removeImpulse(id) {
    return tx('impulses', 'readwrite', function (s) { s.delete(id); })
      .then(allImpulses)
      .then(function (list) { mirrorToLs(list); return list; });
  }

  /* Markiert Einträge als exportiert. Löscht ausdrücklich nichts. */
  function markExported(ids, stamp) {
    var when = stamp || new Date().toISOString();
    return allImpulses().then(function (list) {
      var set = Object.create(null);
      ids.forEach(function (id) { set[id] = true; });
      var touched = list.filter(function (r) { return set[r.id] && !r.exportedAt; });
      touched.forEach(function (r) { r.exportedAt = when; });
      if (!touched.length) return list;
      return addMany(touched);
    });
  }

  /* ── Speicher dauerhaft anfordern ─────────────────────── */
  function requestPersistence() {
    if (!navigator.storage || !navigator.storage.persist) return Promise.resolve(null);
    return navigator.storage.persisted()
      .then(function (already) { return already ? true : navigator.storage.persist(); })
      .catch(function () { return null; });
  }

  function estimate() {
    if (!navigator.storage || !navigator.storage.estimate) return Promise.resolve(null);
    return navigator.storage.estimate().catch(function () { return null; });
  }

  global.Store = {
    loadState: loadState,
    saveState: saveState,
    defaultState: function () { return JSON.parse(JSON.stringify(DEFAULT_STATE)); },
    allImpulses: allImpulses,
    addImpulse: addImpulse,
    addMany: addMany,
    removeImpulse: removeImpulse,
    markExported: markExported,
    requestPersistence: requestPersistence,
    estimate: estimate,
    newId: newId
  };
})(window);
