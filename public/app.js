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
    return h;
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
      if (!data.ok) { setStatus(data.error || 'Order failed'); return; }
      lastLookup = data.lookup;
      setStatus('Order ' + data.order.id.slice(0, 8) + ' · ' + (data.order.status || 'issued') + ' · ' + (data.lookup.entity || ''));
      renderCerts(data);
      if (data.lookup && data.lookup.url) renderSpulFromLookup(data.lookup, 'Batch used locked collector URL.');
    } catch (e) {
      setStatus('Network error processing batch');
    }
  });

  document.getElementById('open-collector').addEventListener('click', async function () {
    var q = document.getElementById('county').value.trim() + ' County ' + document.getElementById('state').value.trim();
    var res = await fetch('/api/lookup?q=' + encodeURIComponent(q), { headers: headers() });
    var data = await res.json();
    lastLookup = data;
    if (data.url) window.open(data.url, '_blank', 'noopener');
    else setStatus(data.error || 'No locked collector URL');
  });

  function renderSpulFromLookup(lookup, extra) {
    var url = lookup.url || lookup.lockedUrl || '';
    var host = '';
    try { host = new URL(url).hostname.replace(/^www\./, ''); } catch (e) { host = url; }
    var card = el(
      '<div class="spul-card">' +
        '<div class="entity"><span>' + escapeHtml(lookup.entity || 'Property tax search') + '</span>' +
        '<span class="conf conf-' + escapeHtml(lookup.confidence || 'not_found') + '">' + escapeHtml(lookup.confidence || '') + '</span></div>' +
        (url ? '<a href="' + encodeURI(url) + '" target="_blank" rel="noopener">Open official tax search page</a>' : '') +
        '<div class="host">' + escapeHtml(host) + '</div>' +
        '<p>' + escapeHtml(lookup.entityNote || lookup.source || extra || '') + '</p>' +
      '</div>'
    );
    document.getElementById('messages').appendChild(card);
    document.getElementById('messages').scrollTop = 99999;
  }

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
        if (lookup.url && lookup.confidence !== 'not_found') renderSpulFromLookup(lookup);
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
      db.className = 'pill ' + (h.db === 'postgres' ? 'ok' : 'warn');
      var pass = document.getElementById('passport-pill');
      if (h.workplace && h.workplace.found) {
        pass.textContent = 'Passport clone found';
        pass.className = 'pill ok';
      } else {
        pass.textContent = 'Passport not mounted';
        pass.className = 'pill warn';
      }
      var spul = document.getElementById('spul-pill');
      spul.textContent = h.groq ? 'S-PUL + Groq' : 'S-PUL database';
      spul.className = 'pill ok';
    })
    .catch(function () {});
})();
