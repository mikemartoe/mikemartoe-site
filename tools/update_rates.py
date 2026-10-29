#!/usr/bin/env python3
"""Refresh assets/rates.json from the Mortgage News Daily header ticker (public page, no key).
Fail-safe: on any fetch/parse problem, exit 0 without touching the file (last good values stay)."""
import html, json, re, sys, urllib.request, datetime, zoneinfo
PATH = 'assets/rates.json'
URL = 'https://www.mortgagenewsdaily.com/mortgage-rates'
WANT = [('30YR Fixed Rate', '30YR Fixed', r'\d\.\d{2}%'), ('15YR Fixed Rate', '15YR Fixed', r'\d\.\d{2}%'),
        ('UMBS 30YR 6.0', 'UMBS 30YR 6.0', r'\d{2,3}\.\d{2}'), ('10 Year Treasury', '10 Year Treasury', r'\d\.\d{3}')]
def main():
    try:
        req = urllib.request.Request(URL, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36', 'Accept-Language': 'en-US,en;q=0.9'})
        page = urllib.request.urlopen(req, timeout=30).read().decode('utf-8', 'ignore')
    except Exception as e:
        print('rates: fetch failed, keeping last good values:', e); return
    items = []
    for product, label, pat in WANT:
        m = re.search(r'<div class="product">\s*' + re.escape(product) + r'\s*</div>\s*<div class="price">\s*([^<]+?)\s*</div>\s*<div class="rate[^"]*">\s*([^<]+?)\s*</div>', page)
        if not m:
            print('rates: could not parse', product, '- keeping last good values'); return
        val, chg = html.unescape(m.group(1)).strip(), html.unescape(m.group(2)).strip()
        if not re.fullmatch(pat, val) or not re.fullmatch(r'[+-]?\d+\.\d+%?', chg):
            print('rates: unexpected value', product, val, chg, '- keeping last good values'); return
        if chg[0] not in '+-': chg = '+' + chg
        items.append({'label': label, 'value': val, 'change': chg})
    r30 = float(items[0]['value'].rstrip('%'))
    if not 2.0 <= r30 <= 15.0:
        print('rates: 30yr out of range, keeping last good values'); return
    old = json.load(open(PATH))
    if old.get('items') == items:
        print('rates: unchanged'); return
    old['items'] = items
    old['updated'] = datetime.datetime.now(zoneinfo.ZoneInfo('America/New_York')).date().isoformat()
    old['source'] = 'Mortgage News Daily'; old['source_url'] = URL
    with open(PATH, 'w') as f:
        json.dump(old, f, indent=2); f.write('\n')
    print('rates: updated', items)
if __name__ == '__main__':
    main()
