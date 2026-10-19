/* 901 Sandtree: property facts tabs + mortgage calculator (client-side only) */
(function () {
  'use strict';

  /* ---------- Tabs ---------- */
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.ft-tab'));
  function selectTab(t, focus) {
    tabs.forEach(function (b) {
      var on = b === t;
      b.setAttribute('aria-selected', on ? 'true' : 'false');
      b.tabIndex = on ? 0 : -1;
      var p = document.getElementById(b.getAttribute('aria-controls'));
      if (!p) return;
      if (on) { p.hidden = false; p.classList.remove('ft-in'); void p.offsetWidth; p.classList.add('ft-in'); }
      else { p.hidden = true; }
    });
    if (focus) t.focus();
  }
  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { selectTab(t, false); });
    t.addEventListener('keydown', function (e) {
      var n = null;
      if (e.key === 'ArrowRight') n = tabs[(i + 1) % tabs.length];
      if (e.key === 'ArrowLeft') n = tabs[(i - 1 + tabs.length) % tabs.length];
      if (e.key === 'Home') n = tabs[0];
      if (e.key === 'End') n = tabs[tabs.length - 1];
      if (n) { e.preventDefault(); selectTab(n, true); }
    });
  });

  /* ---------- Calculator ---------- */
  var $ = function (id) { return document.getElementById(id); };
  var el = {
    price: $('c-price'), down: $('c-down'), downpct: $('c-downpct'), downr: $('c-downr'),
    rate: $('c-rate'), rater: $('c-rater'), tax: $('c-tax'), hoa: $('c-hoa'), ins: $('c-ins'),
    total: $('c-total'), pi: $('c-pi'), taxm: $('c-taxm'), insm: $('c-insm'), hoam: $('c-hoam'),
    loan: $('c-loan'), pmi: $('c-pmi'), ask: $('c-ask')
  };
  if (!el.price) return;

  var state = { price: 349900, pct: 20, rate: 6.5, years: 30, tax: 2798, hoa: 128, ins: 150 };
  var rateTouched = false;

  function num(v) { var n = parseFloat(String(v).replace(/[^0-9.]/g, '')); return isFinite(n) ? n : 0; }
  function fmt0(n) { return Math.round(n).toLocaleString('en-US'); }
  function money(n) { return '$' + fmt0(n); }
  function clamp(n, a, b) { return Math.min(b, Math.max(a, n)); }
  function trimPct(n) { return String(Math.round(n * 1000) / 1000); }

  /* Standard amortization: M = L * r / (1 - (1 + r)^-n) */
  function monthlyPI(loan, annualRatePct, years) {
    var n = years * 12, r = annualRatePct / 100 / 12;
    if (loan <= 0) return 0;
    if (r === 0) return loan / n;
    return loan * r / (1 - Math.pow(1 + r, -n));
  }
  window.sandtreeMonthlyPI = monthlyPI;

  /* animated total */
  var shown = 0, target = 0, raf = null, t0 = 0, from = 0;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function animateTo(v) {
    target = v;
    if (reduce) { shown = v; el.total.textContent = money(v); return; }
    from = shown; t0 = 0;
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(function step(ts) {
      if (!t0) t0 = ts;
      var k = Math.min(1, (ts - t0) / 380), e = 1 - Math.pow(1 - k, 3);
      shown = from + (target - from) * e;
      el.total.textContent = money(shown);
      if (k < 1) raf = requestAnimationFrame(step); else raf = null;
    });
  }

  var C = 2 * Math.PI * 48;
  var segs = ['pi', 'tax', 'ins', 'hoa'].map(function (k) { return document.querySelector('.cd-' + k); });

  function render() {
    var downAmt = state.price * state.pct / 100;
    var loan = Math.max(0, state.price - downAmt);
    var pi = monthlyPI(loan, state.rate, state.years);
    var taxm = state.tax / 12, insm = state.ins, hoam = state.hoa;
    var total = pi + taxm + insm + hoam;

    el.pi.textContent = money(pi);
    el.taxm.textContent = money(taxm);
    el.insm.textContent = money(insm);
    el.hoam.textContent = money(hoam);
    el.loan.textContent = money(loan);
    el.pmi.hidden = !(state.pct < 20 && loan > 0);
    animateTo(total);

    var parts = [pi, taxm, insm, hoam], off = 0;
    segs.forEach(function (s, i) {
      if (!s) return;
      var len = total > 0 ? C * parts[i] / total : 0;
      s.style.strokeDasharray = len + ' ' + (C - len);
      s.style.strokeDashoffset = String(-off);
      off += len;
    });
  }

  function syncDownFields(skip) {
    var amt = state.price * state.pct / 100;
    if (skip !== 'down') el.down.value = fmt0(amt);
    if (skip !== 'downpct') el.downpct.value = trimPct(state.pct);
    if (skip !== 'downr') el.downr.value = clamp(state.pct, 0, 50);
    document.querySelectorAll('.cchip').forEach(function (c) {
      c.classList.toggle('on', Math.abs(parseFloat(c.dataset.pct) - state.pct) < 0.001);
    });
  }
  function syncRate(skip) {
    if (skip !== 'rate') { var rs = trimPct(state.rate), dp = (rs.split('.')[1] || '').length; el.rate.value = dp < 2 ? state.rate.toFixed(2) : rs; }
    if (skip !== 'rater') el.rater.value = clamp(state.rate, 2, 10);
  }

  el.price.addEventListener('input', function () { state.price = num(el.price.value); syncDownFields(); render(); });
  el.down.addEventListener('input', function () {
    var a = num(el.down.value);
    state.pct = state.price > 0 ? clamp(a / state.price * 100, 0, 100) : 0;
    syncDownFields('down'); render();
  });
  el.downpct.addEventListener('input', function () { state.pct = clamp(num(el.downpct.value), 0, 100); syncDownFields('downpct'); render(); });
  el.downr.addEventListener('input', function () { state.pct = num(el.downr.value); syncDownFields('downr'); render(); });
  el.rate.addEventListener('input', function () { rateTouched = true; state.rate = clamp(num(el.rate.value), 0, 30); syncRate('rate'); render(); });
  el.rater.addEventListener('input', function () { rateTouched = true; state.rate = num(el.rater.value); syncRate('rater'); render(); });
  el.tax.addEventListener('input', function () { state.tax = num(el.tax.value); render(); });
  el.hoa.addEventListener('input', function () { state.hoa = num(el.hoa.value); render(); });
  el.ins.addEventListener('input', function () { state.ins = num(el.ins.value); render(); });

  [el.price, el.down, el.tax, el.hoa, el.ins].forEach(function (i) {
    i.addEventListener('blur', function () { i.value = fmt0(num(i.value)); });
  });

  document.querySelectorAll('.cchip').forEach(function (c) {
    c.addEventListener('click', function () { state.pct = parseFloat(c.dataset.pct); syncDownFields(); render(); });
  });
  document.querySelectorAll('.cterm').forEach(function (b) {
    b.addEventListener('click', function () {
      state.years = parseInt(b.dataset.yrs, 10);
      document.querySelectorAll('.cterm').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      render();
    });
  });

  if (el.ask) {
    el.ask.addEventListener('click', function (e) {
      var f = document.getElementById('showing');
      if (!f) return;
      e.preventDefault();
      f.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      var first = f.querySelector('input[name="name"]');
      if (first) setTimeout(function () { first.focus({ preventScroll: true }); }, reduce ? 0 : 450);
    });
  }

  /* Default rate from the 30YR fixed value in the rate ticker feed, fallback 6.5% */
  window.addEventListener('rates:loaded', function (ev) {
    if (rateTouched) return;
    var items = (ev.detail && ev.detail.items) || [];
    for (var i = 0; i < items.length; i++) {
      if (/30\s*YR\s*Fixed/i.test(items[i].label || '')) {
        var v = num(items[i].value);
        if (v > 0 && v < 30) {
          state.rate = v; syncRate(); render();
          var hint = document.getElementById('c-ratesrc');
          if (hint) { hint.textContent = 'Default from the Mortgage News Daily 30YR Fixed index' + (ev.detail.updated ? ' (' + new Date(ev.detail.updated + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ')' : '') + '. Edit to use your own rate.'; hint.hidden = false; }
        }
        return;
      }
    }
  });
  if (window.__ratesData) window.dispatchEvent(new CustomEvent('rates:loaded', { detail: window.__ratesData }));

  syncDownFields(); syncRate(); render();
})();
