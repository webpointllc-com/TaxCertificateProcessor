(function () {
  'use strict';

  var DESIGN_WIDTH = 1280;
  var DESIGN_HEIGHT = 800;
  var PREP_KEY = 'wp_prep_to_pay';
  var openedBilling = false;

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

  function money(n) {
    return n ? ('$' + n + '/mo') : '$0';
  }

  function renderNeeds(plan) {
    var list = document.getElementById('need-list');
    list.innerHTML = plan.selected.map(function (item) {
      return (
        '<article class="need-card' + (item.required ? ' required' : '') + '">' +
          '<input type="checkbox" checked disabled aria-label="' + item.name + ' selected">' +
          '<div><h3>' + item.name + '</h3><p>' + item.note + '</p></div>' +
          '<span class="need-price">' + money(item.monthly) + '</span>' +
        '</article>'
      );
    }).join('');

    document.getElementById('scale-row').innerHTML = plan.scaleLater.map(function (item) {
      return (
        '<article class="scale-card">' +
          '<h3>' + item.name + ' · ' + money(item.monthly) + '</h3>' +
          '<p>Not selected. ' + item.note + '</p>' +
        '</article>'
      );
    }).join('');

    document.getElementById('not-this-month').textContent =
      'Do not buy this month: ' + plan.notThisMonth.join(' · ') + '.';
    document.getElementById('total-pill').textContent = '$' + plan.monthly + '/mo selected';
  }

  function setPrep(on, plan, userGesture) {
    var toggle = document.getElementById('prep-toggle');
    toggle.checked = on;
    sessionStorage.setItem(PREP_KEY, on ? '1' : '0');
    document.getElementById('prep-state').textContent = on
      ? 'On — billing, Blueprint, then Groq key. Card is added on Render, not here.'
      : 'Off — review the stack. Nothing is charged until you add a card on Render.';
    ['btn-billing', 'btn-blueprint', 'btn-groq', 'btn-own'].forEach(function (id) {
      var el = document.getElementById(id);
      el.classList.toggle('ready', on);
      el.setAttribute('aria-disabled', on ? 'false' : 'true');
    });
    if (on && userGesture && !openedBilling) {
      openedBilling = true;
      window.open(plan.billingUrl, '_blank', 'noopener');
    }
  }

  function defaultEmbed(origin) {
    return [
      '<!-- WebPoint Tax Certificate Processor — Squarespace 7.1 Code Block -->',
      '<div class="wp-tcs-embed-root">',
      '  <iframe class="wp-tcs-frame" src="' + origin + '/" title="WebPoint Tax Certificate Processor" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allow="clipboard-read; clipboard-write"></iframe>',
      '</div>',
      '<style>.wp-tcs-embed-root{box-sizing:border-box;width:100%;margin:0 auto;position:relative;padding-top:62.5%}.wp-tcs-frame{position:absolute;inset:0;width:100%;height:100%;border:0;border-radius:16px;background:#cfeaf8}</style>'
    ].join('\n');
  }

  function showCopy(msg) {
    var el = document.getElementById('copy-status');
    el.hidden = false;
    el.textContent = msg;
  }

  function copyText(text, okMsg) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () {
        showCopy(okMsg);
      }).catch(function () {
        fallbackCopy(text, okMsg);
      });
    }
    fallbackCopy(text, okMsg);
  }

  function fallbackCopy(text, okMsg) {
    var ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showCopy(okMsg); } catch (err) {
      showCopy('Select the text and copy manually.');
    }
    document.body.removeChild(ta);
  }

  fetch('/api/launch-plan').then(function (res) { return res.json(); }).then(function (plan) {
    renderNeeds(plan);
    document.getElementById('btn-billing').href = plan.billingUrl;
    document.getElementById('btn-blueprint').href = plan.blueprintUrl;
    document.getElementById('btn-groq').href = plan.groqKeysUrl;

    var live = plan.liveOrigin || 'https://tax-certificate-processor.onrender.com';
    var box = document.getElementById('embed-box');

    fetch('/SQUARESPACE_EMBED.html').then(function (r) { return r.text(); }).then(function (html) {
      box.value = html.trim();
    }).catch(function () {
      box.value = defaultEmbed(live);
    });

    var params = new URLSearchParams(window.location.search);
    var startOn = params.get('prep') === '1' || sessionStorage.getItem(PREP_KEY) === '1';
    setPrep(startOn, plan, false);
    if (params.get('prep') === '1' && !openedBilling) {
      openedBilling = true;
      window.open(plan.billingUrl, '_blank', 'noopener');
    }

    document.getElementById('prep-toggle').addEventListener('change', function () {
      setPrep(this.checked, plan, true);
    });

    document.getElementById('copy-embed').addEventListener('click', function () {
      copyText(box.value, 'Squarespace embed copied. Paste into a Code Block after Render is live.');
    });

    document.getElementById('copy-handoff').addEventListener('click', function () {
      fetch('/CLAUDE_PASTE.txt').then(function (r) { return r.text(); }).then(function (text) {
        copyText(text, 'Claude / Twin2 handoff copied. Paste it into Claude.');
      });
    });
  }).catch(function () {
    document.getElementById('need-list').innerHTML =
      '<article class="need-card required"><div><h3>Launch plan unavailable</h3><p>Start the Node server, then reload.</p></div></article>';
  });
})();
