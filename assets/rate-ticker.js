/* Site-wide mortgage rate ticker. Reads assets/rates.json (updated daily by hand or a scheduled job).
   Hidden entirely if the file is missing, malformed, or has no usable items. */
(function () {
  'use strict';
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function fmtDate(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
    if (!m) return '';
    var mo = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][parseInt(m[2], 10) - 1];
    return mo ? mo + ' ' + parseInt(m[3], 10) + ', ' + m[1] : '';
  }
  fetch('assets/rates.json', { cache: 'no-store' }).then(function (r) {
    if (!r.ok) throw new Error('no rates');
    return r.json();
  }).then(function (d) {
    var items = (d && Array.isArray(d.items) ? d.items : []).filter(function (it) {
      return it && it.label && it.value !== null && it.value !== undefined && it.value !== '';
    });
    if (!items.length) return;
    window.__ratesData = { items: items, updated: d.updated };
    window.dispatchEvent(new CustomEvent('rates:loaded', { detail: window.__ratesData }));

    var src = esc(d.source || 'Mortgage News Daily');
    var url = esc(d.source_url || 'https://www.mortgagenewsdaily.com/mortgage-rates');
    var upd = fmtDate(d.updated);
    var note = d.note ? '<span class="rt-note">' + esc(d.note) + '</span>' : '';

    var seq = items.map(function (it) {
      var ch = it.change == null ? '' : String(it.change).trim();
      var dir = /^-/.test(ch) ? 'dn' : (/^\+?0*(\.0+)?%?$/.test(ch) || ch === '' ? 'flat' : 'up');
      var arrow = dir === 'up' ? '\u25B2' : dir === 'dn' ? '\u25BC' : '';
      return '<span class="rt-item"><span class="rt-lbl">' + esc(it.label) + '</span><span class="rt-val">' + esc(it.value) + '</span>' +
        (ch ? '<span class="rt-ch rt-' + dir + '"><span aria-hidden="true">' + arrow + '</span> ' + esc(ch) + '</span>' : '') + '</span>';
    }).join('');
    var meta = '<span class="rt-item rt-meta">' + (upd ? 'Updated ' + esc(upd) + ' · ' : '') +
      'Source: <a href="' + url + '" target="_blank" rel="noopener">' + src + '</a>' + note + '</span>';
    var group = seq + meta;

    var bar = document.createElement('div');
    bar.className = 'rate-ticker';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'Mortgage rate index from ' + (d.source || 'Mortgage News Daily'));
    bar.innerHTML =
      '<span class="rt-tag">Rates</span>' +
      '<div class="rt-view"><div class="rt-track"><div class="rt-group">' + group + '</div>' +
      '<div class="rt-group" aria-hidden="true">' + group.replace(/<a /g, '<a tabindex="-1" ') + '</div></div></div>';
    document.body.insertBefore(bar, document.body.firstChild);
  }).catch(function () { /* no ticker */ });
})();
