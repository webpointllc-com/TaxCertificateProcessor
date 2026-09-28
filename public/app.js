(function () {
  'use strict';

  var DESIGN_WIDTH = 1280;
  var DESIGN_HEIGHT = 800;
  var MAX_PARCELS = 10;
  var product = 'TCS';
  var sessionId = localStorage.getItem('wp_tcs_session') || (crypto.randomUUID && crypto.randomUUID()) || String(Date.now());
  localStorage.setItem('wp_tcs_session', sessionId);
  var memberKey = new URLSearchParams(location.search).get('k') || '';
  var lastLookup = null;
  var exportFormat = 'html';
  var lastQuery = '';
  var researchTaskId = '';
  var pendingQuery = sessionStorage.getItem('wp_pending_q') || '';
  var authToken = localStorage.getItem('wp_tcs_token') || '';
  var account = null;
  var accountBundle = { recents: [], messages: [], invites: [], updates: [] };

  var COPY = {
    TCS: {
      title: 'Tax Certification System',
      copy: 'Collector-current certificate drafts. First county: Chippewa, Wisconsin.'
    },
    TPA: {
      title: 'Targeted Portfolio Analysis',
      copy: 'Batch parcel tax status for the same closing. Offshore-search replacement.'
    },
    RDS: {
      title: 'Recorded Document Search',
      copy: 'Point at the county recorded-document portal and keep parcel context with the order.'
    },
    SPUL: {
      title: 'Search Page URL Locator',
      copy: 'Locked official tax-search URLs from the Search Spul jurisdiction database.'
    }
  };

  function scaleToFit() {
    var outer = document.getElementById('scale-outer');
    var canvas = document.getElementById('design-canvas');
    var width = document.documentElement.clientWidth || window.innerWidth;
    var scale = Math.min(1, width / DESIGN_WIDTH);
    outer.style.height = (DESIGN_HEIGHT * scale) + 'px';
    canvas.style.transform = 'scale(' + scale + ')';
    canvas.style.left = Math.max(0, (width - DESIGN_WIDTH * scale) / 2) + 'px';
  }

  window.addEventListener('resize', scaleToFit);
  scaleToFit();
  if (window.ResizeObserver) {
    new ResizeObserver(scaleToFit).observe(document.documentElement);
  }

  function headers(json) {
    var h = { 'X-Session-Id': sessionId };
    if (json) h['Content-Type'] = 'application/json';
    if (memberKey) h['X-Member-Key'] = memberKey;
    if (authToken) h['X-Auth-Token'] = authToken;
    return h;
  }

  function $(id) { return document.getElementById(id); }

  function setSignedIn(nextAccount, token) {
    account = nextAccount;
    if (token) {
      authToken = token;
      localStorage.setItem('wp_tcs_token', token);
    }
    var canvas = $('design-canvas');
    var gate = $('auth-gate');
    var chip = $('acct-open');
    var signin = $('acct-signin');
    canvas.classList.remove('signed-out');
    if (account) {
      if (gate) gate.hidden = true;
      chip.hidden = false;
      if (signin) signin.hidden = true;
      paintAccount();
      maybeAskConsent();
    } else {
      chip.hidden = true;
      if (signin) signin.hidden = false;
      $('account-overlay').hidden = true;
    }
  }

  function paintAccount() {
    if (!account) return;
    var initial = account.initial || (account.display_name || 'U').charAt(0).toUpperCase();
    ['acct-chip-ava', 'acct-avatar', 'acct-act-ava', 'prof-avatar', 'desk-avatar'].forEach(function (id) {
      var n = $(id);
      if (n) n.textContent = initial;
    });
    $('acct-chip-name').textContent = account.display_name;
    $('acct-name').textContent = account.display_name;
    $('prof-name').textContent = account.display_name;
    $('desk-name').textContent = account.display_name;
    $('prof-email').textContent = account.email;
    $('desk-email').textContent = account.email;
    $('prof-company').textContent = account.company || 'No company on file';
    $('set-name').value = account.display_name;
    $('set-company').value = account.company || '';
    $('set-activity').checked = account.activity_on !== false;
    if ($('set-learn')) $('set-learn').checked = account.learn_consent === true;
    $('acct-act-label').textContent = account.activity_on !== false ? 'On' : 'Turn on';
    $('prof-activity').textContent = account.activity_on !== false ? 'On' : 'Off';
    if (account.created_at) {
      var d = new Date(account.created_at);
      $('prof-since').textContent = isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
    }
  }

  function parkSearch(where) {
    var form = $('hero-form');
    var slot = $(where === 'header' ? 'header-search-slot' : 'home-search-slot');
    if (form && slot && form.parentNode !== slot) slot.appendChild(form);
  }

  function showHome() {
    parkSearch('home');
    $('view-home').hidden = false;
    $('view-results').hidden = true;
    $('mac-window').classList.add('home');
    $('mac-window').classList.remove('results');
    $('about-trigger').hidden = false;
    $('gen-pill').hidden = true;
    $('search-clear').hidden = true;
    if ($('search-error')) $('search-error').hidden = true;
  }

  function showResults() {
    parkSearch('header');
    $('view-home').hidden = true;
    $('view-results').hidden = false;
    $('mac-window').classList.remove('home');
    $('mac-window').classList.add('results');
    $('about-trigger').hidden = true;
    $('search-clear').hidden = !$('hero-input').value;
  }

  function maybeAskConsent() {
    if (account && account.is_member && account.learn_consent !== true) $('perm-overlay').hidden = false;
  }

  var pendingEmail = '';

  function showGatePanel(name) {
    $('gate-account').hidden = name !== 'account';
    $('confirm-panel').hidden = name !== 'confirm';
    $('member-form').hidden = name !== 'member';
  }

  function openGate(kind, title, copy, tab) {
    if (title) $('gate-title').textContent = title;
    if (copy) $('gate-copy').textContent = copy;
    setAuthError('');
    $('auth-gate').hidden = false;
    showGatePanel(kind || 'account');
    if ((kind || 'account') === 'account') showAuthTab(tab || 'signup');
  }

  function closeGate() {
    $('auth-gate').hidden = true;
  }

  function flushPendingSearch() {
    var q = pendingQuery || sessionStorage.getItem('wp_pending_q') || '';
    if (!q || !account) return;
    runHeroSearch(q);
  }

  function isMember() {
    return account && (account.is_member || account.plan === 'member');
  }

  function handleGate(data) {
    if (!data || data.ok) return false;
    if (data.gate === 'member') {
      if (!account) {
        openGate('account', 'Create a free account to continue', 'Then enter the member code from your shop lead, or skip and keep one free search.');
      } else {
        openGate('member');
      }
      return true;
    }
    if (data.gate === 'account' || data.status === 401) {
      if (lastQuery) sessionStorage.setItem('wp_pending_q', lastQuery);
      openGate('account', 'Sign in to search', 'Your question is saved. Sign in or create an account to run it.', 'login');
      return true;
    }
    if (data.gate === 'confirm') {
      openGate('confirm');
      return true;
    }
    return false;
  }

  function insightIcon(id) {
    var icons = {
      trend: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 16l5-5 4 3 7-8"/><path d="M14 6h6v6"/></svg>',
      payment: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8"/><path d="m8.5 12.5 2.4 2.4 4.6-5.2"/></svg>',
      zoning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 20V9l8-5 8 5v11"/><path d="M9 20v-6h6v6"/></svg>',
      comps: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 11l8-6 8 6v9H4v-9z"/><path d="M9 20v-6h6v6"/></svg>'
    };
    return icons[id] || '◆';
  }

  function paintInsights(list) {
    $('insights-list').innerHTML = (list || []).map(function (item) {
      return '<li><span class="insight-ico">' + insightIcon(item.id) + '</span><div><strong>' + escapeHtml(item.title) + '</strong><em>' +
        escapeHtml(item.value) + '</em><span>' + escapeHtml(item.detail || '') + '</span></div></li>';
    }).join('');
  }

  function paintResults(data) {
    var card = data.card || {};
    lastLookup = data.lookup;
    researchTaskId = data.task_id || researchTaskId || '';
    $('res-place').textContent = (card.county || '') + (card.state ? ' County, ' + card.state : '');
    $('res-summary').textContent = card.summary || '';
    var url = (data.lookup && (data.lookup.officialUrl || data.lookup.lockedUrl)) || card.collector_url || '';
    var link = $('res-collector');
    if (url) { link.href = url; link.hidden = false; } else { link.hidden = true; }
    var agent = data.agent || data.extractor || {};
    var bits = [];
    if (data.operator && data.operator.routed_to) bits.push('County agent ' + data.operator.routed_to);
    if (agent.parcel_format) bits.push('parcel pattern ' + agent.parcel_format);
    if (agent.version) bits.push('v' + agent.version);
    $('agent-note').textContent = bits.join(' · ');
    $('heal-status').textContent = agent.version
      ? ('Shared with every user of this county · extractor v' + agent.version)
      : '';
    $('heal-form').hidden = true;
    if (data.lookup && data.lookup.jurisdiction) {
      if ($('county')) $('county').value = data.lookup.jurisdiction.county || $('county').value;
      if (data.lookup.jurisdiction.state && $('state')) $('state').value = data.lookup.jurisdiction.state;
    }
    showResults();
  }

  function tickClock() {
    var n = $('acct-clock');
    if (!n) return;
    var d = new Date();
    var h = d.getHours() % 12;
    if (h === 0) h = 12;
    var m = d.getMinutes();
    n.textContent = h + ':' + (m < 10 ? '0' : '') + m;
  }

  function showAcctView(name) {
    document.querySelectorAll('.acct-view').forEach(function (v) {
      v.hidden = v.id !== 'view-' + name;
    });
    $('account-sheet').classList.toggle('is-wide', name === 'desktop' || name === 'profile');
  }

  function openAccount(view) {
    if (!account) return;
    $('account-overlay').hidden = false;
    showAcctView(view || 'menu');
    tickClock();
    refreshAccount();
  }

  function closeAccount() {
    $('account-overlay').hidden = true;
    showAcctView('menu');
  }

  function listOrEmpty(items, render, empty) {
    if (!items || !items.length) {
      return '<p class="acct-empty">' + escapeHtml(empty) + '</p>';
    }
    return items.map(render).join('');
  }

  function recentHtml(r) {
    return '<button type="button" class="acct-item" data-kind="' + escapeHtml(r.kind || '') + '" data-label="' + escapeHtml(r.label || '') + '">' +
      '<strong>' + escapeHtml(r.label || 'Recent') + '</strong>' +
      '<span>' + escapeHtml(r.detail || r.kind || '') + '</span></button>';
  }

  function orderHtml(o) {
    return '<article class="acct-item"><strong>' + escapeHtml((o.product || 'TCS') + ' · ' + (o.county || '') + ' ' + (o.state || '')) + '</strong>' +
      '<span>' + escapeHtml((o.status || '') + (o.file_number ? ' · ' + o.file_number : '')) + '</span></article>';
  }

  function messageHtml(m) {
    return '<article class="acct-item"><strong>' + escapeHtml(m.body || '') + '</strong><span>' + escapeHtml(m.created_at || '') + '</span></article>';
  }

  function inviteHtml(i) {
    return '<article class="acct-item"><strong>' + escapeHtml(i.email) + '</strong><span>Invited</span></article>';
  }

  function paintLists() {
    $('recents-list').innerHTML = listOrEmpty(accountBundle.recents, recentHtml, 'No recents yet. Search a county or process a batch.');
    $('desk-recents').innerHTML = listOrEmpty(accountBundle.recents.slice(0, 4), recentHtml, 'None yet');
    $('updates-list').innerHTML = listOrEmpty(accountBundle.updates, orderHtml, 'No certificate updates yet.');
    $('desk-updates').innerHTML = listOrEmpty(accountBundle.updates.slice(0, 4), orderHtml, 'None yet');
    $('messages-list').innerHTML = listOrEmpty(accountBundle.messages, messageHtml, 'No messages yet.');
    $('desk-messages').innerHTML = listOrEmpty(accountBundle.messages.slice(0, 4), messageHtml, 'None yet');
    $('invites-list').innerHTML = listOrEmpty(accountBundle.invites, inviteHtml, 'No invites sent.');
  }

  async function refreshAccount() {
    if (!authToken) return;
    try {
      var res = await fetch('/api/account', { headers: headers() });
      var data = await res.json();
      if (!data.ok) return;
      account = data.account;
      accountBundle = {
        recents: data.recents || [],
        messages: data.messages || [],
        invites: data.invites || [],
        updates: data.updates || []
      };
      paintAccount();
      paintLists();
    } catch (e) {}
  }

  async function loadUsage() {
    if (!account) return;
    if ($('usage-learn')) $('usage-learn').textContent = account.learn_consent ? 'On' : 'Off';
    if ($('usage-plan')) $('usage-plan').textContent = isMember() ? 'Members' : 'Free';
    try {
      var res = await fetch('/api/extractors/stats', { headers: headers() });
      var data = await res.json();
      var slots = data.slots || {};
      if ($('usage-catalog')) $('usage-catalog').textContent = String(slots.catalog || '—');
      if ($('usage-active')) $('usage-active').textContent = String(slots.active || 0);
      if ($('usage-extractors')) {
        $('usage-extractors').innerHTML = listOrEmpty(data.working || [], function (ex) {
          return '<article class="acct-item"><strong>' + escapeHtml((ex.county || '') + ' County, ' + (ex.state || '')) + '</strong><span>' +
            escapeHtml('v' + ex.version + ' · ' + (ex.entity || '')) + '</span></article>';
        }, 'No working extractors saved from sessions yet.');
      }
    } catch (e) {}
  }

  async function rememberRecent(kind, label, detail) {
    if (!authToken || !label) return;
    try {
      await fetch('/api/recents', {
        method: 'POST',
        headers: headers(true),
        body: JSON.stringify({ kind: kind, label: label, detail: detail || '' })
      });
    } catch (e) {}
  }

  async function signOut() {
    try { await fetch('/api/logout', { method: 'POST', headers: headers(true) }); } catch (e) {}
    authToken = '';
    localStorage.removeItem('wp_tcs_token');
    setAuthError('');
    account = null;
    accountBundle = { recents: [], messages: [], invites: [], updates: [] };
    setSignedIn(null);
  }

  function el(html) {
    var d = document.createElement('div');
    d.innerHTML = html.trim();
    return d.firstChild;
  }

  function escapeHtml(text) {
    return String(text || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function refreshAddBtn() {
    var wrap = document.getElementById('parcel-rows');
    var btn = document.getElementById('add-parcel');
    btn.disabled = wrap.children.length >= MAX_PARCELS;
    btn.textContent = wrap.children.length >= MAX_PARCELS ? 'Max 10 parcels' : 'Add parcel';
  }

  function addParcelRow(values) {
    var wrap = document.getElementById('parcel-rows');
    if (wrap.children.length >= MAX_PARCELS) return;
    var v = values || {};
    var row = el(
      '<div class="parcel-row">' +
        '<input placeholder="Parcel ID" data-f="parcel_id" value="' + escapeHtml(v.parcel_id || '') + '">' +
        '<input placeholder="Owner last, first" data-f="owner_name" value="' + escapeHtml(v.owner_name || '') + '">' +
        '<input placeholder="Address" data-f="address_line" value="' + escapeHtml(v.address_line || '') + '">' +
        '<button type="button" class="icon-btn" aria-label="Remove">×</button>' +
      '</div>'
    );
    row.querySelector('.icon-btn').addEventListener('click', function () {
      if (wrap.children.length > 1) row.remove();
      refreshAddBtn();
    });
    wrap.appendChild(row);
    refreshAddBtn();
  }

  document.getElementById('add-parcel').addEventListener('click', function () { addParcelRow(); });
  addParcelRow();

  document.querySelectorAll('.mod').forEach(function (btn) {
    btn.addEventListener('click', function () {
      product = btn.getAttribute('data-product');
      document.querySelectorAll('.mod').forEach(function (b) { b.classList.toggle('active', b === btn); });
      document.getElementById('panel-title').textContent = COPY[product].title;
      document.getElementById('panel-copy').textContent = COPY[product].copy;
      if (product === 'SPUL') {
        var hero = document.getElementById('hero-input');
        if (hero) hero.focus();
      }
    });
  });

  function collectParcels() {
    return Array.prototype.map.call(document.querySelectorAll('.parcel-row'), function (row) {
      var o = {};
      row.querySelectorAll('input').forEach(function (inp) { o[inp.getAttribute('data-f')] = inp.value.trim(); });
      if (!o.owner_name) o.owner_name = document.getElementById('owner-global').value.trim();
      return o;
    }).filter(function (p) { return p.parcel_id || p.owner_name || p.address_line; });
  }

  function setStatus(msg) {
    document.getElementById('order-status').textContent = msg || '';
  }

  function renderCerts(payload) {
    var box = document.getElementById('cert-list');
    box.innerHTML = '';
    (payload.certificates || []).forEach(function (c) {
      var card = el(
        '<article class="cert-card">' +
          '<strong>' + escapeHtml(c.parcel_id || 'Parcel') + ' · ' + escapeHtml(c.tax_status) + ' · as of ' + escapeHtml(c.as_of) + '</strong>' +
          '<p>' + escapeHtml(c.narrative) + '</p>' +
          (c.collector_url ? '<p><a href="' + encodeURI(c.collector_url) + '" target="_blank" rel="noopener">Open collector / search page</a></p>' : '') +
        '</article>'
      );
      box.appendChild(card);
    });
  }

  document.getElementById('run-order').addEventListener('click', async function () {
    var parcels = collectParcels();
    if (!parcels.length) { setStatus('Add a parcel, owner, or address first.'); return; }
    setStatus('Processing ' + parcels.length + ' parcel' + (parcels.length > 1 ? 's' : '') + '…');
    try {
      var res = await fetch('/api/orders', {
        method: 'POST',
        headers: headers(true),
        body: JSON.stringify({
          product: product === 'SPUL' ? 'TCS' : product,
          file_number: document.getElementById('file-number').value.trim(),
          client_name: document.getElementById('client-name').value.trim(),
          county: document.getElementById('county').value.trim(),
          state: document.getElementById('state').value.trim(),
          closing_date: document.getElementById('closing-date').value || null,
          parcels: parcels
        })
      });
      var data = await res.json();
      if (!data.ok) {
        if (handleGate(data)) { setStatus(data.error || ''); return; }
        setStatus(data.error || 'Order failed');
        return;
      }
      lastLookup = data.lookup;
      setStatus('Order ' + data.order.id.slice(0, 8) + ' · ' + (data.order.status || 'issued') + ' · ' + (data.lookup.entity || ''));
      renderCerts(data);
      if (data.lookup && officialUrlOf(data.lookup)) renderSpulFromLookup(data.lookup, 'Batch used locked collector URL.');
    } catch (e) {
      setStatus('Network error processing batch');
    }
  });

  function jurisdictionLabel(lookup) {
    if (lookup.entity) return lookup.entity;
    if (lookup.jurisdiction && lookup.jurisdiction.county) {
      return lookup.jurisdiction.county + ' County, ' + (lookup.jurisdiction.state || '');
    }
    return 'Property tax search';
  }

  function officialUrlOf(lookup) {
    if (!lookup) return '';
    if (lookup.officialUrl) return lookup.officialUrl;
    if (lookup.lockedUrl) return lookup.lockedUrl;
    if (lookup.urlLocked && lookup.url) return lookup.url;
    if (lookup.googleFallback) return '';
    if (lookup.confidence === 'not_found') return '';
    if (lookup.url && /google\.com\/search/i.test(lookup.url)) return '';
    if (lookup.url && lookup.confidence !== 'not_found') return lookup.url;
    return '';
  }

  document.getElementById('open-collector').addEventListener('click', async function () {
    var q = document.getElementById('county').value.trim() + ' County ' + document.getElementById('state').value.trim();
    var res = await fetch('/api/lookup?q=' + encodeURIComponent(q), { headers: headers() });
    var data = await res.json();
    lastLookup = data;
    var url = officialUrlOf(data);
    if (url) window.open(url, '_blank', 'noopener');
    else setStatus(data.error || data.source || 'No locked collector URL');
  });

  function renderSpulFromLookup(lookup, extra) {
    var url = officialUrlOf(lookup);
    var host = '';
    try { if (url) host = new URL(url).hostname.replace(/^www\./, ''); } catch (e) { host = url; }
    var empty = url
      ? ''
      : '<p class="empty-lock">No locked collector URL. Sheet county stays listed — we do not invent a link.</p>';
    var card = el(
      '<div class="spul-card">' +
        '<div class="entity"><span>' + escapeHtml(jurisdictionLabel(lookup)) + '</span>' +
        '<span class="conf conf-' + escapeHtml(lookup.confidence || 'not_found') + '">' + escapeHtml(lookup.confidence || '') + '</span></div>' +
        (url ? '<a href="' + encodeURI(url) + '" target="_blank" rel="noopener">Open official tax search page</a>' : empty) +
        (host ? '<div class="host">' + escapeHtml(host) + '</div>' : '') +
        '<p>' + escapeHtml(lookup.entityNote || lookup.source || extra || '') + '</p>' +
      '</div>'
    );
    document.getElementById('messages').appendChild(card);
    document.getElementById('messages').scrollTop = 99999;
  }

  var suggestTimer = 0;
  var suggestItems = [];
  var suggestIndex = -1;

  function hideSuggest() {
    var box = document.getElementById('hero-suggest');
    box.hidden = true;
    box.innerHTML = '';
    document.getElementById('hero-input').setAttribute('aria-expanded', 'false');
    suggestItems = [];
    suggestIndex = -1;
  }

  function paintSuggest(items) {
    var box = document.getElementById('hero-suggest');
    suggestItems = items || [];
    if (!suggestItems.length) { hideSuggest(); return; }
    box.innerHTML = '';
    suggestItems.forEach(function (item, i) {
      var btn = el(
        '<button type="button" class="suggest-item" role="option">' +
          '<span>' + escapeHtml(item.label) + '</span>' +
          '<span class="meta' + (item.urlLocked ? ' lock' : '') + '">' +
            escapeHtml(item.urlLocked ? 'locked' : (item.coverageStatus || item.confidence || '')) +
          '</span>' +
        '</button>'
      );
      btn.addEventListener('click', function () { pickSuggest(i); });
      box.appendChild(btn);
    });
    box.hidden = false;
    document.getElementById('hero-input').setAttribute('aria-expanded', 'true');
    suggestIndex = 0;
    markSuggest();
  }

  function markSuggest() {
    var nodes = document.querySelectorAll('#hero-suggest .suggest-item');
    nodes.forEach(function (n, i) { n.classList.toggle('active', i === suggestIndex); });
  }

  function pickSuggest(i) {
    var item = suggestItems[i];
    if (!item) return;
    document.getElementById('hero-input').value = item.label;
    hideSuggest();
    runHeroSearch(item.county + ' County ' + item.state);
  }

  async function runHeroSearch(q, opts) {
    q = (q || document.getElementById('hero-input').value || '').trim();
    if (!q) return;
    lastQuery = q;
    pendingQuery = q;
    sessionStorage.setItem('wp_pending_q', q);
    hideSuggest();
    $('hero-input').value = q;
    if ($('search-error')) { $('search-error').hidden = true; $('search-error').textContent = ''; }
    if (!account) {
      openGate('account', 'Sign in to search', 'Your question is saved. Sign in or create an account to run it.', 'login');
      return;
    }
    $('gen-pill').hidden = false;
    $('mac-window').classList.add('results');
    $('mac-window').classList.remove('home');
    parkSearch('header');
    try {
      var body = { q: q, format: exportFormat };
      if (opts && opts.taskId) body.task_id = opts.taskId;
      var res = await fetch('/api/intelligence', {
        method: 'POST',
        headers: headers(true),
        body: JSON.stringify(body)
      });
      var data = await res.json();
      $('gen-pill').hidden = true;
      if (!data.ok) {
        if (handleGate(data)) {
          parkSearch('home');
          showHome();
          $('hero-input').value = q;
          return;
        }
        var err = data.error || 'Search failed';
        if ($('search-error')) { $('search-error').hidden = false; $('search-error').textContent = err; }
        showHome();
        setStatus(err);
        return;
      }
      sessionStorage.removeItem('wp_pending_q');
      pendingQuery = '';
      paintResults(data);
    } catch (e) {
      $('gen-pill').hidden = true;
      showHome();
      if ($('search-error')) { $('search-error').hidden = false; $('search-error').textContent = 'Lookup unavailable'; }
      setStatus('Lookup unavailable');
    }
  }

  document.getElementById('hero-form').addEventListener('submit', function (e) {
    e.preventDefault();
    if (suggestIndex >= 0 && suggestItems[suggestIndex] && !document.getElementById('hero-suggest').hidden) {
      pickSuggest(suggestIndex);
      return;
    }
    runHeroSearch();
  });

  if ($('followup-form')) {
    $('followup-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var q = $('followup-input').value.trim();
      if (!q) return;
      $('followup-input').value = '';
      runHeroSearch(q, { taskId: researchTaskId });
    });
  }

  document.getElementById('hero-input').addEventListener('input', function () {
    var q = document.getElementById('hero-input').value.trim();
    clearTimeout(suggestTimer);
    if (q.length < 2) { hideSuggest(); return; }
    suggestTimer = setTimeout(async function () {
      try {
        var res = await fetch('/api/suggest?q=' + encodeURIComponent(q), { headers: headers() });
        var data = await res.json();
        paintSuggest(data.suggestions || []);
      } catch (e) {
        hideSuggest();
      }
    }, 160);
  });

  document.getElementById('hero-input').addEventListener('keydown', function (e) {
    if (document.getElementById('hero-suggest').hidden) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      suggestIndex = Math.min(suggestItems.length - 1, suggestIndex + 1);
      markSuggest();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      suggestIndex = Math.max(0, suggestIndex - 1);
      markSuggest();
    } else if (e.key === 'Escape') {
      hideSuggest();
    }
  });

  fetch('/api/hero-examples', { headers: headers() })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      var wrap = document.getElementById('hero-chips');
      (data.examples || []).slice(0, 4).forEach(function (ex) {
        var chip = el('<button type="button" class="chip"></button>');
        chip.textContent = ex;
        chip.addEventListener('click', function () {
          document.getElementById('hero-input').value = ex;
          runHeroSearch(ex);
        });
        wrap.appendChild(chip);
      });
    })
    .catch(function () {});

  function addMsg(role, text) {
    var n = el('<div class="msg msg-' + role + '"></div>');
    n.textContent = text;
    document.getElementById('messages').appendChild(n);
    document.getElementById('messages').scrollTop = 99999;
    return n;
  }

  document.getElementById('chat-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    var input = document.getElementById('chat-input');
    var message = input.value.trim();
    if (!message) return;
    input.value = '';
    addMsg('user', message);
    try {
      var look = await fetch('/api/lookup?q=' + encodeURIComponent(message), { headers: headers() });
      if (look.ok) {
        var lookup = await look.json();
        lastLookup = lookup;
        if (officialUrlOf(lookup) || lookup.confidence === 'not_found') renderSpulFromLookup(lookup);
      }
      var res = await fetch('/api/chat', {
        method: 'POST',
        headers: headers(true),
        body: JSON.stringify({ message: message, sessionId: sessionId })
      });
      var ctype = res.headers.get('content-type') || '';
      if (ctype.indexOf('text/event-stream') !== -1) {
        var box = addMsg('ai', '');
        var reader = res.body.getReader();
        var decoder = new TextDecoder();
        var buf = '';
        while (true) {
          var chunk = await reader.read();
          if (chunk.done) break;
          buf += decoder.decode(chunk.value, { stream: true });
          var lines = buf.split('\n');
          buf = lines.pop();
          lines.forEach(function (line) {
            if (line.indexOf('data: ') !== 0) return;
            try {
              var ev = JSON.parse(line.slice(6));
              if (ev.type === 'chunk' || ev.type === 'error') box.textContent += ev.content || '';
            } catch (err) {}
          });
        }
      } else {
        var data = await res.json();
        addMsg('ai', data.content || JSON.stringify(data));
      }
    } catch (err) {
      addMsg('ai', 'Chat unavailable. Lookup still used the locked jurisdiction database.');
    }
  });

  fetch('/api/health', { headers: headers() })
    .then(function (r) { return r.json(); })
    .then(function (h) {
      var db = document.getElementById('db-pill');
      db.textContent = h.db === 'postgres' ? 'Postgres live' : 'Local memory DB';
      db.className = 'sr-only';
      var pass = document.getElementById('passport-pill');
      if (h.workplace && h.workplace.found) {
        pass.textContent = 'Passport clone found';
      } else {
        pass.textContent = 'Passport not mounted';
      }
      pass.className = 'sr-only';
      var spul = document.getElementById('spul-pill');
      spul.textContent = h.groq ? 'S-PUL + Groq' : 'S-PUL database';
      spul.className = 'sr-only';
    })
    .catch(function () {});

  function setAuthError(msg) {
    var n = $('auth-error');
    if (!msg) { n.hidden = true; n.textContent = ''; return; }
    n.hidden = false;
    n.textContent = msg;
  }

  function showAuthTab(which) {
    var signup = which === 'signup';
    $('tab-signup').classList.toggle('active', signup);
    $('tab-login').classList.toggle('active', !signup);
    $('tab-signup').setAttribute('aria-selected', signup ? 'true' : 'false');
    $('tab-login').setAttribute('aria-selected', signup ? 'false' : 'true');
    $('signup-form').hidden = !signup;
    $('login-form').hidden = signup;
    setAuthError('');
  }

  $('tab-signup').addEventListener('click', function () { showAuthTab('signup'); });
  $('tab-login').addEventListener('click', function () { showAuthTab('login'); });

  function offerMemberCode() {
    if (!account || isMember()) {
      closeGate();
      flushPendingSearch();
      return;
    }
    var remaining = account.searches_remaining;
    var copy = remaining === 0
      ? 'Your free search is used. Enter the shop code from your lead for unlimited search, or skip to keep this account.'
      : 'If your shop lead bought seats, attach the code. No code? Skip and use your one free search.';
    $('member-copy').textContent = copy;
    $('member-code').value = '';
    $('member-error').hidden = true;
    openGate('member');
  }

  function beginConfirm(data) {
    pendingEmail = data.email || pendingEmail;
    $('confirm-copy').textContent = 'We sent a confirmation link to ' + pendingEmail + '. Click it to prove it is you.';
    var hold = $('confirm-hold');
    var link = $('confirm-hold-link');
    if (data.confirm_path) {
      hold.hidden = false;
      hold.textContent = 'This host is not sending mail yet — use the link below.';
      link.hidden = false;
      link.href = data.confirm_path;
    } else {
      hold.hidden = true;
      hold.textContent = '';
      link.hidden = true;
      link.removeAttribute('href');
    }
    $('confirm-error').hidden = true;
    openGate('confirm');
  }

  async function startOAuth(provider) {
    setAuthError('');
    try {
      var res = await fetch('/api/auth/' + provider + '/start?state=' + encodeURIComponent(sessionId), {
        headers: { Accept: 'application/json' }
      });
      var data = await res.json().catch(function () { return {}; });
      if (!data.ok) {
        setAuthError(data.error || (provider === 'apple' ? 'Apple sign-in is not connected yet.' : 'Google sign-in is not connected yet.'));
        return;
      }
      window.location.assign(data.url);
    } catch (err) {
      setAuthError('Could not start ' + provider + ' sign-in');
    }
  }

  $('oauth-google').addEventListener('click', function () { startOAuth('google'); });
  $('oauth-apple').addEventListener('click', function () { startOAuth('apple'); });

  function displayNameFromEmail(email) {
    var local = String(email || '').split('@')[0].trim();
    return local.length >= 2 ? local : 'Member';
  }

  $('signup-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    setAuthError('');
    var email = $('su-email').value.trim();
    $('su-submit').disabled = true;
    try {
      var res = await fetch('/api/signup', {
        method: 'POST',
        headers: headers(true),
        body: JSON.stringify({
          display_name: displayNameFromEmail(email),
          email: email,
          password: $('su-password').value
        })
      });
      var data = await res.json();
      if (!data.ok) { setAuthError(data.error || 'Could not create the account'); return; }
      beginConfirm(data);
    } catch (err) {
      setAuthError('Network error creating the account');
    } finally {
      $('su-submit').disabled = false;
    }
  });

  $('login-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    setAuthError('');
    $('li-submit').disabled = true;
    try {
      var res = await fetch('/api/login', {
        method: 'POST',
        headers: headers(true),
        body: JSON.stringify({
          email: $('li-email').value.trim(),
          password: $('li-password').value
        })
      });
      var data = await res.json();
      if (data.needs_confirm) {
        beginConfirm(data);
        return;
      }
      if (!data.ok) { setAuthError(data.error || 'Could not sign in'); return; }
      setSignedIn(data.account, data.token);
      offerMemberCode();
    } catch (err) {
      setAuthError('Network error signing in');
    } finally {
      $('li-submit').disabled = false;
    }
  });

  $('confirm-resend').addEventListener('click', async function () {
    $('confirm-error').hidden = true;
    try {
      var res = await fetch('/api/confirm/resend', {
        method: 'POST',
        headers: headers(true),
        body: JSON.stringify({ email: pendingEmail })
      });
      var data = await res.json();
      if (!data.ok) {
        $('confirm-error').hidden = false;
        $('confirm-error').textContent = data.error || 'Could not resend';
        return;
      }
      beginConfirm(Object.assign({ email: pendingEmail }, data));
    } catch (err) {
      $('confirm-error').hidden = false;
      $('confirm-error').textContent = 'Network error';
    }
  });

  $('confirm-hold-link').addEventListener('click', function () {
    // GET /api/confirm-email sets the session via redirect; bootSession also reads ?auth=
  });

  async function redeemMember(code, errorId) {
    var err = $(errorId);
    if (err) { err.hidden = true; err.textContent = ''; }
    var res = await fetch('/api/member-code', {
      method: 'POST',
      headers: headers(true),
      body: JSON.stringify({ code: code })
    });
    var data = await res.json();
    if (!data.ok) {
      if (err) { err.hidden = false; err.textContent = data.error || 'That code is not valid'; }
      return false;
    }
    account = data.account;
    paintAccount();
    closeGate();
    maybeAskConsent();
    flushPendingSearch();
    return true;
  }

  $('member-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    await redeemMember($('member-code').value.trim(), 'member-error');
  });
  $('member-skip').addEventListener('click', function () {
    closeGate();
    flushPendingSearch();
  });
  $('usage-member-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    $('usage-member-status').textContent = 'Checking…';
    var ok = await redeemMember($('usage-member-code').value.trim(), 'usage-member-status');
    $('usage-member-status').textContent = ok ? 'Members unlocked' : ($('usage-member-status').textContent || 'Could not unlock');
    if (ok) loadUsage();
  });

  $('acct-open').addEventListener('click', function () { openAccount('menu'); });
  $('acct-close-peek').addEventListener('click', closeAccount);
  $('acct-view-profile').addEventListener('click', function () { showAcctView('desktop'); });
  $('acct-add').addEventListener('click', function () { showAcctView('add'); });
  $('acct-recents').addEventListener('click', function () { showAcctView('recents'); });
  $('acct-updates').addEventListener('click', function () { showAcctView('updates'); });
  $('acct-settings').addEventListener('click', function () { showAcctView('settings'); });
  $('acct-usage').addEventListener('click', function () { showAcctView('usage'); loadUsage(); });
  $('acct-invite').addEventListener('click', function () { showAcctView('invite'); });
  $('acct-messages').addEventListener('click', function () { showAcctView('messages'); });
  $('acct-compose-ico').addEventListener('click', function () { showAcctView('compose'); });
  $('acct-new-msg').addEventListener('click', function () { showAcctView('compose'); });
  $('acct-compose-from-list').addEventListener('click', function () { showAcctView('compose'); });
  $('acct-logout').addEventListener('click', signOut);
  $('acct-switch').addEventListener('click', signOut);

  document.querySelectorAll('.acct-back').forEach(function (btn) {
    btn.addEventListener('click', function () { showAcctView(btn.getAttribute('data-back') || 'menu'); });
  });
  document.querySelectorAll('[data-open]').forEach(function (btn) {
    btn.addEventListener('click', function () { showAcctView(btn.getAttribute('data-open')); });
  });

  $('acct-activity').addEventListener('click', async function () {
    if (!account) return;
    var next = account.activity_on === false;
    try {
      var res = await fetch('/api/me', {
        method: 'PATCH',
        headers: headers(true),
        body: JSON.stringify({ activity_on: next })
      });
      var data = await res.json();
      if (data.ok) {
        account = data.account;
        paintAccount();
      }
    } catch (e) {}
  });

  $('settings-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    $('settings-status').textContent = 'Saving…';
    try {
      var res = await fetch('/api/me', {
        method: 'PATCH',
        headers: headers(true),
        body: JSON.stringify({
          display_name: $('set-name').value.trim(),
          company: $('set-company').value.trim(),
          activity_on: $('set-activity').checked,
          learn_consent: $('set-learn') ? $('set-learn').checked : account.learn_consent
        })
      });
      var data = await res.json();
      if (!data.ok) { $('settings-status').textContent = data.error || 'Could not save'; return; }
      account = data.account;
      paintAccount();
      $('settings-status').textContent = 'Saved';
    } catch (err) {
      $('settings-status').textContent = 'Network error';
    }
  });

  async function sendInvite(email, statusId) {
    var status = $(statusId);
    status.textContent = 'Sending…';
    try {
      var res = await fetch('/api/invites', {
        method: 'POST',
        headers: headers(true),
        body: JSON.stringify({ email: email })
      });
      var data = await res.json();
      if (!data.ok) { status.textContent = data.error || 'Could not invite'; return; }
      status.textContent = 'Invite sent to ' + email;
      refreshAccount();
    } catch (err) {
      status.textContent = 'Network error';
    }
  }

  $('invite-form').addEventListener('submit', function (e) {
    e.preventDefault();
    sendInvite($('invite-email').value.trim(), 'invite-status');
    $('invite-email').value = '';
  });
  $('add-invite-form').addEventListener('submit', function (e) {
    e.preventDefault();
    sendInvite($('add-invite-email').value.trim(), 'add-invite-status');
    $('add-invite-email').value = '';
  });

  $('compose-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    $('compose-status').textContent = 'Sending…';
    try {
      var res = await fetch('/api/messages', {
        method: 'POST',
        headers: headers(true),
        body: JSON.stringify({ body: $('compose-body').value.trim() })
      });
      var data = await res.json();
      if (!data.ok) { $('compose-status').textContent = data.error || 'Could not send'; return; }
      $('compose-body').value = '';
      $('compose-status').textContent = 'Sent';
      await refreshAccount();
      showAcctView('messages');
    } catch (err) {
      $('compose-status').textContent = 'Network error';
    }
  });

  $('recents-list').addEventListener('click', function (e) {
    var item = e.target.closest('.acct-item');
    if (!item) return;
    var label = item.getAttribute('data-label') || '';
    closeAccount();
    if (label) {
      $('hero-input').value = label;
      runHeroSearch(label);
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !$('account-overlay').hidden) closeAccount();
  });

  async function bootSession() {
    tickClock();
    setInterval(tickClock, 30000);
    var params = new URLSearchParams(location.search);
    var authFromLink = params.get('auth');
    var confirmed = params.get('confirmed') === '1';
    var oauthFlag = params.get('oauth');
    var confirmFlag = params.get('confirm');
    if (authFromLink) {
      authToken = authFromLink;
      localStorage.setItem('wp_tcs_token', authFromLink);
    }
    if (authFromLink || confirmed || oauthFlag || confirmFlag) {
      history.replaceState({}, '', location.pathname);
    }
    if (oauthFlag === 'unavailable' || oauthFlag === 'failed') {
      setSignedIn(null);
      openGate('account', 'Sign in', 'Email and password always work. Google or Apple light up once those keys are set on the host.');
      setAuthError(oauthFlag === 'unavailable'
        ? 'Google / Apple is not connected on this host yet.'
        : 'That social sign-in did not finish. Use email and password.');
      return;
    }
    if (confirmFlag === 'failed') {
      setSignedIn(null);
      openGate('account', 'Sign in', 'That confirmation link was not valid. Sign in to get a new one.');
      return;
    }
    if (!authToken) {
      setSignedIn(null);
      return;
    }
    try {
      var res = await fetch('/api/me', { headers: headers() });
      var data = await res.json();
      if (data.ok && data.account) {
        setSignedIn(data.account, authToken);
        refreshAccount();
        if ((confirmed || oauthFlag) && !isMember()) offerMemberCode();
        else flushPendingSearch();
      } else {
        authToken = '';
        localStorage.removeItem('wp_tcs_token');
        setSignedIn(null);
      }
    } catch (e) {
      setSignedIn(null);
    }
  }

  bootSession();

  $('go-home').addEventListener('click', function () {
    $('hero-input').value = '';
    showHome();
  });
  $('open-batch').addEventListener('click', function () {
    if (!isMember()) {
      if (!account) openGate('account', 'Create a free account to continue', 'Batches are a members feature. Your shop lead has the code.');
      else openGate('member');
      return;
    }
    $('batch-overlay').hidden = false;
  });
  $('acct-signin').addEventListener('click', function () {
    showAuthTab('login');
    openGate('account', 'Sign in', 'Use email and password, Google, or Apple. After email confirm you can attach a shop code, or skip and keep one free search.', 'login');
  });
  $('gate-close').addEventListener('click', closeGate);
  $('auth-gate').addEventListener('click', function (e) {
    if (e.target === $('auth-gate')) closeGate();
  });
  $('close-batch').addEventListener('click', function () { $('batch-overlay').hidden = true; });
  $('search-clear').addEventListener('click', function () {
    $('hero-input').value = '';
    showHome();
  });
  $('format-btn').addEventListener('click', function () {
    $('format-menu').hidden = !$('format-menu').hidden;
    $('country-menu').hidden = true;
  });
  $('country-btn').addEventListener('click', function () {
    $('country-menu').hidden = !$('country-menu').hidden;
    $('format-menu').hidden = true;
  });
  $('format-menu').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-format]');
    if (!btn) return;
    exportFormat = btn.getAttribute('data-format');
    $('format-btn').innerHTML = (exportFormat === 'pdf' ? 'PDF' : 'HTML') + ' <span>▾</span>';
    $('format-menu').hidden = true;
  });
  $('about-trigger').addEventListener('click', function () { $('about-overlay').hidden = false; });
  $('close-about').addEventListener('click', function () { $('about-overlay').hidden = true; });
  $('about-overlay').addEventListener('click', function (e) {
    if (e.target === $('about-overlay')) $('about-overlay').hidden = true;
  });
  $('heal-toggle').addEventListener('click', function () {
    $('heal-form').hidden = !$('heal-form').hidden;
  });
  $('perm-allow').addEventListener('click', async function () {
    var res = await fetch('/api/consent', { method: 'POST', headers: headers(true), body: JSON.stringify({ learn_consent: true }) });
    var data = await res.json();
    if (data.ok) account = data.account;
    $('perm-overlay').hidden = true;
    paintAccount();
  });
  $('perm-later').addEventListener('click', function () { $('perm-overlay').hidden = true; });
  $('heal-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    $('heal-status').textContent = 'Validating extractor…';
    try {
      var res = await fetch('/api/extractors/heal', {
        method: 'POST',
        headers: headers(true),
        body: JSON.stringify({ q: lastQuery || $('hero-input').value, feedback: $('heal-feedback').value })
      });
      var data = await res.json();
      if (!data.ok) {
        if (handleGate(data)) { $('heal-status').textContent = data.error || ''; return; }
        $('heal-status').textContent = data.error || 'Could not save extractor';
        return;
      }
      $('heal-feedback').value = '';
      $('heal-status').textContent = data.message || 'Saved';
      if (data.card) paintResults(data);
    } catch (err) {
      $('heal-status').textContent = 'Network error';
    }
  });
  document.querySelectorAll('.res-tab').forEach(function (tab) {
    tab.addEventListener('click', function () {
      document.querySelectorAll('.res-tab').forEach(function (t) { t.classList.toggle('on', t === tab); });
      document.querySelectorAll('.tab-panel').forEach(function (p) {
        p.classList.toggle('on', p.id === 'tab-' + tab.getAttribute('data-tab'));
      });
    });
  });
})();
