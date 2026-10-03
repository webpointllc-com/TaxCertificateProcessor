(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var state = { status: 'open', role: null, view: 'answers', lockStatus: 'pending' };
  var LABELS = { open: 'To review', flagged: 'Flagged', approved: 'Approved', edited: 'Fixed', rejected: 'Rejected' };

  function getKey() {
    try { return sessionStorage.getItem('wp_editor_key') || ''; } catch (e) { return ''; }
  }
  function setKey(v) {
    try { sessionStorage.setItem('wp_editor_key', v); } catch (e) { /* private mode */ }
  }
  function authToken() {
    try { return localStorage.getItem('wp_tcs_token') || ''; } catch (e) { return ''; }
  }
  function headers() {
    var h = { 'Content-Type': 'application/json' };
    var k = getKey();
    if (k) h['x-editor-key'] = k;
    var t = authToken();
    if (t) h.Authorization = 'Bearer ' + t;
    return h;
  }
  function toast(msg) {
    var el = $('toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toast.t);
    toast.t = setTimeout(function () { el.hidden = true; }, 2200);
  }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function renderStats(stats) {
    var box = $('stats');
    box.innerHTML = '';
    var counts = {
      open: (stats.pending || 0) + (stats.flagged || 0),
      flagged: stats.flagged || 0,
      approved: stats.approved || 0,
      edited: stats.edited || 0,
      rejected: stats.rejected || 0
    };
    Object.keys(LABELS).forEach(function (k) {
      var b = el('button', 'chip');
      b.type = 'button';
      b.setAttribute('aria-pressed', String(state.status === k));
      b.innerHTML = LABELS[k] + ' <b>' + counts[k] + '</b>';
      b.onclick = function () { state.status = k; load(); };
      box.appendChild(b);
    });
    var t = el('span', 'chip', null);
    t.innerHTML = 'Ready to train <b>' + (stats.trainable || 0) + '</b>';
    box.appendChild(t);
  }

  async function act(item, action, card) {
    var fix = card.querySelector('textarea.fix');
    var note = card.querySelector('textarea.note');
    var body = {
      example_id: item.id,
      action: action,
      corrected_reply: fix ? fix.value : undefined,
      note: note ? note.value : undefined
    };
    var res = await fetch('/v1/editor/review', { method: 'POST', headers: headers(), body: JSON.stringify(body) });
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) { toast(data.error || 'That did not save'); return; }
    toast({ approve: 'Approved', edit: 'Fix saved', reject: 'Rejected', flag: 'Flagged', reopen: 'Reopened' }[action]);
    load();
  }

  function renderItem(item) {
    var card = el('article', 'card');
    var meta = el('div', 'meta');
    meta.appendChild(el('span', 'tag ' + item.review_status, item.review_status));
    if (item.rating === -1) meta.appendChild(el('span', 'tag down', 'member: thumbs down'));
    if (item.rating === 1) meta.appendChild(el('span', 'tag up', 'member: thumbs up'));
    meta.appendChild(el('span', 'tag', item.route));
    if (item.jurisdiction_key) meta.appendChild(el('span', 'tag', item.jurisdiction_key));
    if (item.model) meta.appendChild(el('span', null, item.model));
    meta.appendChild(el('span', null, new Date(item.created_at).toLocaleString()));
    card.appendChild(meta);

    var qWrap = el('div');
    qWrap.appendChild(el('div', 'label', 'Member asked'));
    qWrap.appendChild(el('div', 'q', item.question || '(no question text)'));
    card.appendChild(qWrap);

    var aWrap = el('div');
    aWrap.appendChild(el('div', 'label', 'Model answered'));
    aWrap.appendChild(el('div', 'a', item.reply));
    card.appendChild(aWrap);

    if (item.corrected_reply || item.review_note) {
      var sWrap = el('div');
      sWrap.appendChild(el('div', 'label', item.review_status === 'edited' ? 'Fixed answer (trains)' : 'Suggested fix from ' + (item.reviewer || 'reviewer')));
      if (item.corrected_reply) sWrap.appendChild(el('div', 'suggest', item.corrected_reply));
      if (item.review_note) sWrap.appendChild(el('div', 'sub', 'Note: ' + item.review_note));
      card.appendChild(sWrap);
    }

    var ctx = el('details');
    ctx.appendChild(el('summary', null, 'Full prompt the model saw'));
    ctx.appendChild(el('pre', null, (item.messages || []).map(function (m) { return m.role.toUpperCase() + ':\n' + m.content; }).join('\n\n')));
    card.appendChild(ctx);

    var fixWrap = el('div');
    fixWrap.appendChild(el('div', 'label', 'Your fix (optional)'));
    var fix = el('textarea', 'fix');
    fix.value = item.corrected_reply || item.reply;
    fix.setAttribute('aria-label', 'Corrected answer');
    fixWrap.appendChild(fix);
    var note = el('textarea', 'note');
    note.placeholder = 'Why (optional)';
    note.setAttribute('aria-label', 'Review note');
    fixWrap.appendChild(note);
    card.appendChild(fixWrap);

    var actions = el('div', 'actions');
    function btn(label, cls, action) {
      var b = el('button', cls, label);
      b.type = 'button';
      b.onclick = function () { act(item, action, card); };
      actions.appendChild(b);
    }
    if (state.role === 'human') {
      btn('Approve', 'approve', 'approve');
      btn('Save fix', 'save', 'edit');
      btn('Reject', 'reject', 'reject');
      if (['approved', 'edited', 'rejected'].indexOf(item.review_status) >= 0) btn('Reopen', '', 'reopen');
    } else {
      btn('Flag with fix', 'flag', 'flag');
    }
    card.appendChild(actions);
    return card;
  }

  async function load() {
    var res = await fetch('/v1/editor/queue?status=' + encodeURIComponent(state.status) + '&limit=50', { headers: headers() });
    var data = await res.json().catch(function () { return {}; });
    var list = $('list');
    list.innerHTML = '';
    if (!res.ok) {
      $('gate').hidden = false;
      list.appendChild(el('div', 'empty', res.status === 403 ? 'Enter the editor key to open the queue.' : (data.error || 'Could not load the queue.')));
      return;
    }
    $('gate').hidden = true;
    state.role = data.role;
    $('who').textContent = data.role === 'human'
      ? 'Editor. Your approvals decide what the model learns.'
      : 'Claude reviewer. You can flag and suggest fixes.';
    renderStats(data.stats || {});
    if (!data.items.length) {
      list.appendChild(el('div', 'empty', state.status === 'open'
        ? 'Nothing waiting. New answers from members who allowed learning will show up here.'
        : 'Nothing in this list yet.'));
      return;
    }
    data.items.forEach(function (item) { list.appendChild(renderItem(item)); });
  }


  // ---------- Extractor locks ----------
  function renderLockStats(data) {
    var box = $('stats');
    box.innerHTML = '';
    var s = data.stats || {};
    ['pending', 'approved', 'rejected'].forEach(function (k) {
      var b = el('button', 'chip');
      b.type = 'button';
      b.setAttribute('aria-pressed', String(state.lockStatus === k));
      b.innerHTML = { pending: 'To review', approved: 'Locked', rejected: 'Rejected' }[k] + ' <b>' + (s[k] || 0) + '</b>';
      b.onclick = function () { state.lockStatus = k; loadLocks(); };
      box.appendChild(b);
    });
    var c = data.coverage || {};
    var t = el('span', 'chip');
    t.innerHTML = 'Verified counties <b>' + (c.verified || 0) + '</b> of ' + (c.total || 0);
    box.appendChild(t);
  }

  function renderLock(item) {
    var card = el('article', 'card');
    var meta = el('div', 'meta');
    meta.appendChild(el('span', 'tag ' + (item.status === 'approved' ? 'approved' : item.status === 'rejected' ? 'rejected' : 'pending'), item.status));
    meta.appendChild(el('span', 'tag', item.jurisdiction_key));
    if (item.verdict) meta.appendChild(el('span', 'tag', item.verdict));
    if (item.evidence && item.evidence.forced) meta.appendChild(el('span', 'tag flagged', 'needs judgment'));
    meta.appendChild(el('span', null, 'by ' + (item.proposer || '?')));
    meta.appendChild(el('span', null, new Date(item.created_at).toLocaleString()));
    card.appendChild(meta);

    var dl = el('dl', 'kv');
    function row(k, v, cls) {
      dl.appendChild(el('dt', null, k));
      var dd = el('dd', cls || null);
      if (v instanceof Node) dd.appendChild(v); else dd.textContent = v || '—';
      dl.appendChild(dd);
    }
    var a = el('a', 'url', item.url);
    a.href = item.url;
    a.target = '_blank';
    a.rel = 'noopener';
    row('Search page', a);
    row('Page title', item.evidence && item.evidence.title);
    row('Probe', (item.verdict || '') + (item.reason ? ' (' + item.reason + ')' : ''));
    row('Tax-bill columns seen', (item.dr_fields || []).join(', '));
    row('Search boxes', ((item.evidence && item.evidence.search_fields) || []).join(', '));
    if (item.evidence && item.evidence.note) row('Proposer note', item.evidence.note);
    if (item.review_note) row('Review note', item.review_note);
    card.appendChild(dl);

    if (state.role === 'human' && item.status === 'pending') {
      var note = el('textarea', 'note');
      note.placeholder = 'Why (optional)';
      note.setAttribute('aria-label', 'Review note');
      card.appendChild(note);
      var actions = el('div', 'actions');
      [['Lock this page', 'approve', 'approve'], ['Reject', 'reject', 'reject']].forEach(function (x) {
        var b = el('button', x[1], x[0]);
        b.type = 'button';
        b.onclick = async function () {
          var res = await fetch('/v1/editor/locks/decide', { method: 'POST', headers: headers(), body: JSON.stringify({ id: item.id, action: x[2], note: note.value }) });
          var data = await res.json().catch(function () { return {}; });
          if (!res.ok) { toast(data.error || 'That did not save'); return; }
          toast(x[2] === 'approve' ? 'Locked. Members get this link now.' : 'Rejected');
          loadLocks();
        };
        actions.appendChild(b);
      });
      card.appendChild(actions);
    }
    return card;
  }

  async function loadLocks() {
    var res = await fetch('/v1/editor/locks?status=' + state.lockStatus, { headers: headers() });
    var data = await res.json().catch(function () { return {}; });
    var list = $('list');
    list.innerHTML = '';
    if (!res.ok) {
      $('gate').hidden = false;
      list.appendChild(el('div', 'empty', res.status === 403 ? 'Enter the editor key to open the queue.' : (data.error || 'Could not load locks.')));
      return;
    }
    $('gate').hidden = true;
    state.role = data.role;
    renderLockStats(data);
    if (!data.items.length) {
      list.appendChild(el('div', 'empty', state.lockStatus === 'pending' ? 'No lock proposals waiting. Claude adds them here after a live probe passes.' : 'Nothing here yet.'));
      return;
    }
    data.items.forEach(function (item) { list.appendChild(renderLock(item)); });
  }

  function setView(v) {
    state.view = v;
    $('tab-answers').setAttribute('aria-selected', String(v === 'answers'));
    $('tab-locks').setAttribute('aria-selected', String(v === 'locks'));
    $('rules-answers').hidden = v !== 'answers';
    $('rules-locks').hidden = v !== 'locks';
    refresh();
  }

  function refresh() {
    return state.view === 'locks' ? loadLocks() : load();
  }

  $('tab-answers').onclick = function () { setView('answers'); };
  $('tab-locks').onclick = function () { setView('locks'); };

  $('open').onclick = function () { setKey($('key').value.trim()); refresh(); };
  $('key').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('open').click(); });
  load();
})();
