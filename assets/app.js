/* No hub — App-Logik */
(function () {
  'use strict';

  var DAY = 86400000;
  var PHRASE = 'I understand this will reset my progress';
  var TAPS_TO_END = 10;
  var TAP_TIMEOUT = 5000;

  /* Auslöser für die Impuls-Auswahl. Reihenfolge = Reihenfolge im Picker.
     Hier anpassen, wenn andere Kategorien besser passen. */
  var TRIGGERS = [
    'Langeweile', 'Stress', 'Müdigkeit', 'Allein', 'Social Media',
    'Nachts wach', 'Aufwachen', 'Frust', 'Einsamkeit', 'Sonstiges'
  ];

  var LEVELS = [
    { n: 1, name: 'Awakening',   start: 0,  range: 'Day 0',
      text: 'The decision is made. Nothing has changed yet, and that is fine. Getting through today is the entire task.' },
    { n: 2, name: 'Standing Up', start: 1,  range: 'Day 1',
      text: 'The first full day is behind you. Urges will come in waves rather than a constant pull. Ride them out.' },
    { n: 3, name: 'First Steps', start: 2,  range: 'Days 2–7',
      text: 'Cravings peak in the first week, often with irritability, poor sleep, or low mood. This is your brain adjusting. Each day gets you past the hardest part.' },
    { n: 4, name: 'Building',    start: 8,  range: 'Days 8–29',
      text: 'The sharpest edge is gone. Now the work is structural: routines, sleep, and what fills the hours you used to lose.' },
    { n: 5, name: 'Clarity',     start: 30, range: 'Days 30–89',
      text: 'Focus and mood stabilise. The risk shifts from craving to complacency — most relapses happen the moment this feels easy.' },
    { n: 6, name: 'Iron Will',   start: 90, range: 'Day 90+',
      text: 'The new baseline is yours. Protection is now maintenance, not struggle. Keep the record honest.' }
  ];

  var $ = function (id) { return document.getElementById(id); };
  var state = null;
  var IMPULSES = [];       // im Speicher gehalten, damit der Export ohne await auskommt
  var tapCount = 0;
  var tapTimer = null;
  var toastTimer = null;

  /* ── Zeit-Helfer (immer lokale Zeit, nie UTC) ─────────── */
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function dateVal(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function timeVal(d) { return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function fromInputs(dateStr, timeStr) {
    var dp = (dateStr || '').split('-');
    var tp = (timeStr || '00:00').split(':');
    if (dp.length !== 3) return null;
    var d = new Date(+dp[0], +dp[1] - 1, +dp[2], +tp[0] || 0, +tp[1] || 0, 0, 0);
    return isNaN(d.getTime()) ? null : d;
  }
  function fmtSince(d) {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  function fmtDateLabel(d) {
    var now = new Date();
    if (isSameDay(d, now)) return 'Heute';
    var y = new Date(now.getTime() - DAY);
    if (isSameDay(d, y)) return 'Gestern';
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
  }
  function fmtDayShort(d) {
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
  }
  function isSameDay(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  function currentDays() {
    if (!state.shieldOn || !state.startedAt) return 0;
    var diff = Date.now() - new Date(state.startedAt).getTime();
    return diff < 0 ? 0 : Math.floor(diff / DAY);
  }
  function levelFor(days) {
    var idx = 0;
    for (var i = 0; i < LEVELS.length; i++) if (days >= LEVELS[i].start) idx = i;
    return idx;
  }

  /* ── Rendering ────────────────────────────────────────── */
  function render() {
    var days = currentDays();
    var idx = levelFor(days);
    var lv = LEVELS[idx];
    var next = LEVELS[idx + 1] || null;

    // Kopfzeile
    $('shieldDot').classList.toggle('is-off', !state.shieldOn);
    $('shieldLabel').textContent = state.shieldOn ? 'Shield On' : 'Shield Off';

    // Zähler
    var counting = tapCount > 0;
    var cnt = $('dayCount');
    cnt.classList.toggle('is-counting', counting);
    cnt.classList.toggle('is-off', !counting && !state.shieldOn);
    if (counting) {
      cnt.textContent = String(TAPS_TO_END - tapCount);
      $('dayUnit').textContent = 'MORE TAPS';
      $('sinceLine').innerHTML = '&nbsp;';
    } else {
      cnt.textContent = String(days);
      $('dayUnit').textContent = days === 1 ? 'DAY' : 'DAYS';
      $('sinceLine').textContent = (state.shieldOn && state.startedAt)
        ? 'Since ' + fmtSince(new Date(state.startedAt))
        : 'Shield is off';
    }

    // Badge
    $('levelBadge').textContent = state.shieldOn
      ? ('LEVEL ' + lv.n + ' · ' + lv.name.toUpperCase())
      : 'SHIELD OFF';

    // Journey
    renderTrack(idx);

    // Levelkarte
    $('lvName').textContent = lv.name;
    $('lvRange').textContent = 'Level ' + lv.n + ' · ' + lv.range;
    $('lvText').textContent = lv.text;
    if (next) {
      var remaining = Math.max(0, next.start - days);
      $('lvNext').textContent = remaining + 'd';
      var span = next.start - lv.start;
      var prog = span > 0 ? (days - lv.start) / span : 1;
      $('lvBar').style.width = Math.min(100, Math.max(3, prog * 100)) + '%';
    } else {
      $('lvNext').textContent = '—';
      $('lvBar').style.width = '100%';
    }

    // Statistik
    $('statBest').textContent = String(Math.max(state.bestStreakDays, days));
    $('statShielded').textContent = String(state.bankedDays + days);

    // Shield-Knopf
    var btn = $('shieldBtn');
    btn.classList.toggle('is-counting', counting);
    btn.classList.toggle('is-off', !state.shieldOn && !counting);
    if (!state.shieldOn) {
      $('shieldBtnText').textContent = 'Start Shield';
      $('shieldHint').textContent = 'Tippen, um einen neuen Streak zu starten.';
    } else if (counting) {
      $('shieldBtnText').textContent = 'Tap ' + (TAPS_TO_END - tapCount) + ' more times';
      $('shieldHint').textContent = 'Loslassen und warten bricht ab.';
    } else {
      $('shieldBtnText').textContent = 'Shield Active';
      $('shieldHint').textContent = TAPS_TO_END + '× tippen, um die Recovery zu beenden.';
    }

    renderToday();
  }

  function renderTrack(currentIdx) {
    var wrap = $('trackNodes');
    var n = LEVELS.length;
    var left = function (i) { return 8 + (i * (84 / (n - 1))); };
    if (wrap.childElementCount !== n) {
      wrap.innerHTML = '';
      LEVELS.forEach(function (lv, i) {
        var el = document.createElement('div');
        var edge = i === 0 ? ' node--first' : i === n - 1 ? ' node--last' : '';
        el.className = 'node ' + (i % 2 === 0 ? 'node--up' : 'node--down') + edge;
        el.style.left = left(i) + '%';
        el.innerHTML = '<div class="node__dot"></div><div class="node__lbl">' + lv.name + '</div>';
        wrap.appendChild(el);
      });
    }
    var active = state.shieldOn ? currentIdx : -1;
    Array.prototype.forEach.call(wrap.children, function (el, i) {
      el.classList.toggle('is-done', i < active);
      el.classList.toggle('is-blue', i === active - 1);
      el.classList.toggle('is-current', i === active);
    });
    $('trackFill').style.width = active < 0 ? '0%' : ((left(active) - 8) / 84 * 100) + '%';
  }

  function entryRow(rec, withDate) {
    var d = new Date(rec.ts);
    var li = document.createElement('li');
    li.className = 'ientry';
    var html = '<span class="ientry__time">' + timeVal(d) + '</span>';
    if (withDate) html += '<span class="ientry__date">' + fmtDayShort(d) + '</span>';
    html += '<span class="ientry__trig"></span><span class="ientry__note"></span>' +
            '<button class="ientry__del" type="button" aria-label="Löschen">&times;</button>';
    li.innerHTML = html;
    li.querySelector('.ientry__trig').textContent = rec.trigger || '';
    li.querySelector('.ientry__note').textContent = rec.note || '';
    li.querySelector('.ientry__del').addEventListener('click', function () {
      if (!confirm('Diesen Impuls löschen?')) return;
      Store.removeImpulse(rec.id).then(function (list) {
        IMPULSES = list; renderToday(); renderAll();
      });
    });
    return li;
  }

  function renderToday() {
    var now = new Date();
    var today = IMPULSES.filter(function (r) { return isSameDay(new Date(r.ts), now); });
    var wrap = $('todayWrap');
    wrap.hidden = today.length === 0;
    $('todayCount').textContent = today.length ? '(' + today.length + ')' : '';
    var ul = $('todayList');
    ul.innerHTML = '';
    today.forEach(function (r) { ul.appendChild(entryRow(r, false)); });
  }

  function renderAll() {
    var ul = $('allList');
    ul.innerHTML = '';
    $('allCount').textContent = '(' + IMPULSES.length + ')';
    if (!IMPULSES.length) {
      var li = document.createElement('li');
      li.className = 'empty';
      li.textContent = 'Noch keine Einträge.';
      ul.appendChild(li);
      return;
    }
    IMPULSES.slice(0, 200).forEach(function (r) { ul.appendChild(entryRow(r, true)); });
    var notExported = IMPULSES.filter(function (r) { return !r.exportedAt; }).length;
    $('exportMeta').textContent =
      IMPULSES.length + ' Einträge gespeichert · ' + notExported + ' seit dem letzten Export neu' +
      (state.lastCsvExportAt ? ' · letzter CSV-Export ' + new Date(state.lastCsvExportAt).toLocaleString('de-DE') : '');
  }

  /* ── Toast ────────────────────────────────────────────── */
  function toast(msg) {
    var t = $('toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 2600);
  }

  function haptic(ms) {
    if (navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) {} }
  }

  /* ── Sheets ───────────────────────────────────────────── */
  function openSheet(sheetId, scrimId) {
    $('toast').hidden = true;          // sonst liegt der Toast über den Sheet-Knöpfen
    clearTimeout(toastTimer);
    $(scrimId).hidden = false;
    $(sheetId).hidden = false;
    document.body.style.overflow = 'hidden';
  }
  function closeSheet(sheetId, scrimId) {
    $(scrimId).hidden = true;
    $(sheetId).hidden = true;
    document.body.style.overflow = '';
  }

  function fillTriggerOptions() {
    var sel = $('impTrigger');
    if (sel.options.length) return;
    TRIGGERS.forEach(function (t) {
      var o = document.createElement('option');
      o.value = t; o.textContent = t;
      sel.appendChild(o);
    });
  }

  /* Die sichtbaren Boxen spiegeln nur, was in den unsichtbaren Feldern steht. */
  function syncPickerLabels() {
    var d = fromInputs($('impDate').value, $('impTime').value || '00:00');
    $('impDateLabel').textContent = d ? fmtDateLabel(d) : '—';
    $('impTimeLabel').textContent = $('impTime').value || '--:--';
    $('impTrigLabel').textContent = $('impTrigger').value || '—';
  }

  function openImpulseSheet() {
    var now = new Date();
    fillTriggerOptions();
    $('impDate').value = dateVal(now);
    $('impTime').value = timeVal(now);
    // zuletzt gewählter Auslöser — Impulse wiederholen sich meist
    $('impTrigger').value = (TRIGGERS.indexOf(state.lastTrigger) >= 0)
      ? state.lastTrigger : TRIGGERS[0];
    $('impNote').value = '';
    syncPickerLabels();
    openSheet('sheetImpulse', 'scrimImpulse');
  }

  function saveImpulse() {
    var when = fromInputs($('impDate').value, $('impTime').value);
    if (!when) { toast('Bitte Datum und Zeit prüfen.'); return; }
    var trigger = $('impTrigger').value || '';
    state.lastTrigger = trigger;
    Store.saveState(state);
    Store.addImpulse({ ts: when.toISOString(), trigger: trigger, note: $('impNote').value })
      .then(function (list) {
        IMPULSES = list;
        closeSheet('sheetImpulse', 'scrimImpulse');
        renderToday(); renderAll();
        toast('Impuls gespeichert.');
        haptic(12);
      });
  }

  function openEndSheet() {
    $('phraseInput').value = '';
    $('phraseInput').classList.remove('is-ok');
    $('endConfirm').disabled = true;
    openSheet('sheetEnd', 'scrimEnd');
  }

  function endRecovery() {
    var days = currentDays();
    if (state.startedAt) {
      state.resets.push({ startedAt: state.startedAt, endedAt: new Date().toISOString(), days: days });
      state.bankedDays += days;
      if (days > state.bestStreakDays) state.bestStreakDays = days;
    }
    state.startedAt = null;
    state.shieldOn = false;
    resetTaps();
    Store.saveState(state).then(function () {
      closeSheet('sheetEnd', 'scrimEnd');
      render();
      toast('Recovery beendet. Impulse bleiben gespeichert.');
    });
  }

  function startShield() {
    state.startedAt = new Date().toISOString();
    state.shieldOn = true;
    Store.saveState(state).then(function () { render(); toast('Shield aktiv.'); haptic(12); });
  }

  /* ── Tap-Zähler ───────────────────────────────────────── */
  function resetTaps() {
    tapCount = 0;
    clearTimeout(tapTimer);
    tapTimer = null;
  }

  function onShieldTap() {
    if (!state.shieldOn) { startShield(); return; }
    tapCount++;
    haptic(tapCount >= TAPS_TO_END ? 40 : 8);
    clearTimeout(tapTimer);
    if (tapCount >= TAPS_TO_END) {
      resetTaps();
      render();
      openEndSheet();
      return;
    }
    tapTimer = setTimeout(function () { resetTaps(); render(); }, TAP_TIMEOUT);
    render();
  }

  /* ── Export ───────────────────────────────────────────── */
  function csvCell(v) {
    var s = v === null || v === undefined ? '' : String(v);
    return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function buildCsv() {
    var head = ['id', 'date', 'time', 'iso_timestamp', 'weekday', 'weekday_num', 'hour', 'minute',
                'trigger', 'note', 'created_at', 'exported_at'];
    var rows = [head.join(',')];
    // aufsteigend nach Zeit — angenehmer für Zeitreihen-Auswertung
    var list = IMPULSES.slice().sort(function (a, b) { return a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0; });
    list.forEach(function (r) {
      var d = new Date(r.ts);
      rows.push([
        r.id, dateVal(d), timeVal(d), r.ts,
        d.toLocaleDateString('en-US', { weekday: 'long' }),
        (d.getDay() === 0 ? 7 : d.getDay()),
        d.getHours(), d.getMinutes(),
        r.trigger || '', r.note || '', r.createdAt || '', r.exportedAt || ''
      ].map(csvCell).join(','));
    });
    return rows.join('\r\n') + '\r\n';
  }

  function buildBackup() {
    return JSON.stringify({
      app: 'nohub', version: 1,
      exportedAt: new Date().toISOString(),
      state: state,
      impulses: IMPULSES
    }, null, 2);
  }

  function deliverFile(text, filename, mime) {
    var file = null;
    try { file = new File([text], filename, { type: mime }); } catch (e) { file = null; }

    // 1) iOS-Share-Sheet: legt die Datei in Dateien, iCloud oder verschickt sie
    if (file && navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
      navigator.share({ files: [file], title: filename })
        .then(function () { toast('Export geteilt. Daten bleiben in der App.'); })
        .catch(function () { downloadFallback(text, filename, mime); });
      return;
    }
    downloadFallback(text, filename, mime);
  }

  function downloadFallback(text, filename, mime) {
    var url = URL.createObjectURL(new Blob([text], { type: mime }));
    var a = document.createElement('a');
    a.href = url; a.download = filename; a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 4000);
    toast('Export erstellt. Daten bleiben in der App.');
  }

  function exportCsv() {
    if (!IMPULSES.length) { toast('Noch keine Impulse zum Exportieren.'); return; }
    var stamp = new Date();
    var text = buildCsv();                       // synchron — der Nutzer-Tap bleibt gültig
    var name = 'nohub-impulse-' + dateVal(stamp) + '.csv';
    deliverFile(text, name, 'text/csv;charset=utf-8');

    // Nur markieren, nie löschen.
    var ids = IMPULSES.map(function (r) { return r.id; });
    state.lastCsvExportAt = stamp.toISOString();
    Store.saveState(state);
    Store.markExported(ids, stamp.toISOString()).then(function (list) {
      IMPULSES = list; renderAll();
    });
  }

  function exportJson() {
    var name = 'nohub-backup-' + dateVal(new Date()) + '.json';
    deliverFile(buildBackup(), name, 'application/json');
  }

  function importBackup(file) {
    var reader = new FileReader();
    reader.onload = function () {
      var data;
      try { data = JSON.parse(String(reader.result)); }
      catch (e) { toast('Datei ist kein gültiges Backup.'); return; }
      if (!data || data.app !== 'nohub' || !Array.isArray(data.impulses)) {
        toast('Datei ist kein No-hub-Backup.'); return;
      }
      var known = Object.create(null);
      IMPULSES.forEach(function (r) { known[r.id] = true; });
      var fresh = data.impulses.filter(function (r) { return r && r.id && r.ts && !known[r.id]; });
      var applyState = Promise.resolve();
      if (data.state && (!state.startedAt || confirm('Auch Streak-Daten aus dem Backup übernehmen?'))) {
        Object.keys(Store.defaultState()).forEach(function (k) {
          if (data.state[k] !== undefined) state[k] = data.state[k];
        });
        applyState = Store.saveState(state);
      }
      applyState
        .then(function () { return fresh.length ? Store.addMany(fresh) : Store.allImpulses(); })
        .then(function (list) {
          IMPULSES = list;
          render(); renderAll();
          toast(fresh.length + ' neue Einträge übernommen.');
        });
    };
    reader.readAsText(file);
  }

  /* ── More-Screen ──────────────────────────────────────── */
  function showMore(on) {
    $('screenHome').hidden = on;
    $('screenMore').hidden = !on;
    $('btnMore').hidden = on;
    $('screenMore').scrollTop = 0;   // der Screen scrollt sich selbst, nicht das Dokument
    if (on) {
      renderAll();
      var d = state.startedAt ? new Date(state.startedAt) : new Date();
      $('editStartDate').value = dateVal(d);
      $('editStartTime').value = timeVal(d);
      Store.estimate().then(function (est) {
        var parts = [];
        if (est && est.usage != null) {
          parts.push('Belegt: ' + (est.usage / 1024).toFixed(1) + ' KB von ' +
                     (est.quota / 1048576).toFixed(0) + ' MB');
        }
        return Promise.resolve(
          navigator.storage && navigator.storage.persisted ? navigator.storage.persisted() : null
        ).then(function (p) {
          parts.push(p === true
            ? 'Dauerhafter Speicher: aktiv — iOS löscht die Daten nicht automatisch.'
            : 'Dauerhafter Speicher: nicht bestätigt. Lege die App auf den Home-Bildschirm und exportiere regelmäßig ein Backup.');
          $('storageMeta').innerHTML = parts.join('<br>');
        });
      });
    }
  }

  function saveStartDate() {
    var d = fromInputs($('editStartDate').value, $('editStartTime').value);
    if (!d) { toast('Bitte Datum und Zeit prüfen.'); return; }
    if (d.getTime() > Date.now()) { toast('Das Startdatum liegt in der Zukunft.'); return; }
    state.startedAt = d.toISOString();
    state.shieldOn = true;
    Store.saveState(state).then(function () { render(); toast('Startdatum gespeichert.'); });
  }

  /* ── Elastischer Zug-Effekt auf dem Hauptscreen ──────────
     Der Hauptscreen scrollt nie echt (overflow:hidden in app.css) — er ist
     fest zugeschnitten. Damit sich das nicht komplett starr anfühlt, gibt
     er beim Ziehen ein kleines Stück nach und federt beim Loslassen wie ein
     Gummiband in die Mitte zurück. Bewusst wenig empfindlich: eine Totzone
     fängt normale Taps ab, eine Dämpfung sorgt dafür, dass viel
     Fingerbewegung nur wenig sichtbare Bewegung ergibt, und eine feste
     Obergrenze verhindert, dass daraus doch ein echtes Scrollen wird. */
  function initRubberBand(el) {
    var DEAD_ZONE = 12;   // Bewegung darunter zählt als Tap, nicht als Ziehen
    var MAX_TRAVEL = 22;  // weiter geht die Verschiebung nie, egal wie stark man zieht
    var DIVISOR = 70;     // größer = spürbar unempfindlicher pro Fingerbewegung

    var startX = 0, startY = 0, dragging = false, active = false;

    function damp(px) {
      var sign = px < 0 ? -1 : 1;
      var d = Math.abs(px);
      return sign * MAX_TRAVEL * (1 - 1 / (1 + d / DIVISOR));
    }

    function setPos(px, springBack) {
      el.style.transition = springBack ? 'transform .42s cubic-bezier(.34,1.56,.64,1)' : 'none';
      el.style.transform = px ? 'translateY(' + px.toFixed(1) + 'px)' : '';
    }

    el.addEventListener('touchstart', function (e) {
      if (e.touches.length !== 1) return;
      // eigene Scrollbereiche (die Heute-Liste) unangetastet lassen
      if (e.target.closest('#todayList')) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      dragging = true;
      active = false;
      setPos(0, false); // eine laufende Rückfederung sofort und ohne Sprung stoppen
    }, { passive: true });

    el.addEventListener('touchmove', function (e) {
      if (!dragging) return;
      var dy = e.touches[0].clientY - startY;
      var dx = e.touches[0].clientX - startX;
      if (!active) {
        if (Math.abs(dy) < DEAD_ZONE || Math.abs(dx) > Math.abs(dy)) return;
        active = true;
      }
      var eff = dy - (dy > 0 ? DEAD_ZONE : -DEAD_ZONE);
      setPos(damp(eff), false);
      e.preventDefault();
    }, { passive: false });

    function release() {
      dragging = false;
      if (active) setPos(0, true);
      active = false;
    }
    el.addEventListener('touchend', release, { passive: true });
    el.addEventListener('touchcancel', release, { passive: true });
  }

  /* ── Verdrahtung ──────────────────────────────────────── */
  function wire() {
    initRubberBand($('screenHome'));

    $('shieldBtn').addEventListener('click', onShieldTap);
    $('shieldPill').addEventListener('click', function () { if (!state.shieldOn) startShield(); });

    $('btnAddImpulse').addEventListener('click', openImpulseSheet);
    $('impCancel').addEventListener('click', function () { closeSheet('sheetImpulse', 'scrimImpulse'); });
    $('scrimImpulse').addEventListener('click', function () { closeSheet('sheetImpulse', 'scrimImpulse'); });
    $('impSave').addEventListener('click', saveImpulse);
    ['impDate', 'impTime', 'impTrigger'].forEach(function (id) {
      $(id).addEventListener('change', syncPickerLabels);
      $(id).addEventListener('input', syncPickerLabels);
    });

    $('phraseInput').addEventListener('input', function () {
      var ok = this.value.trim() === PHRASE;
      this.classList.toggle('is-ok', ok);
      $('endConfirm').disabled = !ok;
    });
    $('endCancel').addEventListener('click', function () { closeSheet('sheetEnd', 'scrimEnd'); });
    $('scrimEnd').addEventListener('click', function () { closeSheet('sheetEnd', 'scrimEnd'); });
    $('endConfirm').addEventListener('click', endRecovery);

    $('btnMore').addEventListener('click', function () { showMore(true); });
    $('btnBack').addEventListener('click', function () { showMore(false); });
    $('btnCsv').addEventListener('click', exportCsv);
    $('btnJson').addEventListener('click', exportJson);
    $('btnSaveStart').addEventListener('click', saveStartDate);
    $('fileImport').addEventListener('change', function () {
      if (this.files && this.files[0]) importBackup(this.files[0]);
      this.value = '';
    });

    // Tag wechselt, während die App offen liegt
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) { resetTaps(); render(); }
    });
    setInterval(function () { if (!tapCount) render(); }, 60000);
  }

  /* ── Start ────────────────────────────────────────────── */
  function boot() {
    Store.requestPersistence();
    Promise.all([Store.loadState(), Store.allImpulses()]).then(function (res) {
      state = res[0];
      IMPULSES = res[1];
      // Erststart: Shield sofort aktiv, damit der Zähler ab jetzt läuft
      if (!state.startedAt && !state.resets.length && state.bankedDays === 0 && !state.shieldOn) {
        state.startedAt = new Date().toISOString();
        state.shieldOn = true;
        Store.saveState(state);
      }
      wire();
      render();
      renderAll();
    });

    if ('serviceWorker' in navigator) {
      window.addEventListener('load', function () {
        // updateViaCache:'none' erzwingt, dass sw.js selbst nie aus dem
        // HTTP-Cache kommt — sonst prüft der Browser unter Umständen eine
        // veraltete Kopie der Datei auf Änderungen und findet nie welche.
        navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' })
          .then(function (reg) {
            // Jedes Mal, wenn die App wieder in den Vordergrund kommt, aktiv
            // nach einer neueren Version fragen, statt auf den nächsten
            // Neustart zu warten — genau der Fall "Update erschienen, App
            // war die ganze Zeit als Icon offen".
            document.addEventListener('visibilitychange', function () {
              if (!document.hidden) reg.update().catch(function () {});
            });
          })
          .catch(function () {});

        // Sobald eine neue Version aktiv wird, einmalig neu laden, damit sie
        // sofort greift — kein manuelles Schließen/Neuöffnen des
        // Homescreen-Icons mehr nötig.
        var reloaded = false;
        navigator.serviceWorker.addEventListener('controllerchange', function () {
          if (reloaded) return;
          reloaded = true;
          window.location.reload();
        });
      });
    }
  }

  boot();
})();
