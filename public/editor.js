(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var state = { status: 'open', role: null };
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

  $('open').onclick = function () { setKey($('key').value.trim()); load(); };
  $('key').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('open').click(); });
  load();
})();
