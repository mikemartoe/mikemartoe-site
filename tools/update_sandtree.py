#!/usr/bin/env python3
"""Refresh Redfin and Homes.com views/saves in assets/sandtree/activity.json.
Rules (see assets/sandtree/README.md): only sources.* change; preLaunch is never touched; totals are
recomputed cumulative (Active + preLaunch). Zillow blocks bots (PerimeterX), so its last number is kept.
Fail-safe: a source that can't be fetched or parsed keeps its last good value; a new value lower than
the stored one is rejected (portal counts only go up). If nothing changed, the file is not written."""
import json, re, sys, datetime, zoneinfo, urllib.request
PATH = 'assets/sandtree/activity.json'
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'

def curl(url):
    try:
        req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml', 'Accept-Language': 'en-US,en;q=0.9'})
        return urllib.request.urlopen(req, timeout=30).read().decode('utf-8', 'ignore')
    except Exception as e:
        print('  curl failed:', e); return ''

def browser(url, wait_text):
    try:
        from playwright.sync_api import sync_playwright
    except Exception as e:
        print('  playwright not available:', e); return ''
    try:
        with sync_playwright() as p:
            b = p.chromium.launch(headless=True, args=['--disable-blink-features=AutomationControlled'])
            pg = b.new_page(user_agent=UA, locale='en-US', viewport={'width': 1366, 'height': 900})
            pg.goto(url, timeout=60000, wait_until='domcontentloaded')
            try: pg.wait_for_function('t => document.body && document.body.innerText.toLowerCase().includes(t)', arg=wait_text, timeout=25000)
            except Exception: pass
            txt = pg.inner_text('body'); b.close(); return txt
    except Exception as e:
        print('  browser failed:', e); return ''

def reader(url):
    # free public reader proxy (r.jina.ai), same idea as the WebFetch the old routine used; last resort
    return curl('https://r.jina.ai/' + url)  # anonymous use is rate-limited; blocked from some networks

def diag(t):
    print('  attempt: %d chars: %s' % (len(t), re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', t))[:120]))

def num(s): return int(s.replace(',', ''))

def redfin(url):
    for get in (lambda: curl(url), lambda: browser(url, 'favorites'), lambda: reader(url)):
        t = get(); diag(t)
        m = re.search(r'([\d,]+)\s*views?\s*[•·\u2022|]?\s*([\d,]+)\s*favorites?', t, re.I)
        if m: return num(m.group(1)), num(m.group(2))
    return None

def homes(url):
    for get in (lambda: curl(url), lambda: browser(url, 'total views'), lambda: reader(url)):
        t = get(); diag(t)
        m = re.search(r'Total\s+Views\W*(?:<[^>]*>\W*)*([\d,]+)', t, re.I)
        if m: return num(m.group(1)), None
    return None

def main():
    d = json.load(open(PATH))
    src = d['sources']
    now = datetime.datetime.now(zoneinfo.ZoneInfo('America/New_York')).replace(second=0, microsecond=0).isoformat()
    changed = False
    for key, fn in (('redfin', redfin), ('homes_com', homes)):
        s = src.get(key) or {}
        print(key + ':')
        got = fn(s['url'])
        if not got:
            print('  not fetched; keeping last good value', s.get('views'), s.get('saves')); continue
        v, f = got
        if (s.get('views') or 0) > v or (f is not None and (s.get('saves') or 0) > f):
            print('  got', got, 'lower than stored; rejected, keeping last good value'); continue
        if v > (s.get('views') or 0) * 3 + 2000:
            print('  got', got, 'implausible jump; rejected, keeping last good value'); continue
        print('  got', got)
        if v != s.get('views') or (f is not None and f != s.get('saves')):
            s['views'] = v
            if f is not None: s['saves'] = f
            s['as_of'] = now; changed = True
    if not changed:
        print('no changes; activity.json not written'); return
    src['zillow']['note'] = 'Zillow blocks automated fetches (PerimeterX 403); number kept from the last manual check on ' + src['zillow'].get('as_of', '')[:10] + '.'
    pre = d.get('preLaunch') or {}
    def tot(b, k):
        return sum((v.get(k) or 0) for v in b.values() if isinstance(v, dict) and ('views' in v or 'saves' in v))
    av, asv, pv, ps = tot(src, 'views'), tot(src, 'saves'), tot(pre, 'views'), tot(pre, 'saves')
    t = d.setdefault('totals', {})
    t['views'] = av + pv; t['saves_favorites'] = asv + ps
    t.setdefault('breakdown', {}).update({'active_portals': av, 'pre_launch_portals': pv, 'active_saves': asv, 'pre_launch_saves': ps})
    d['updated'] = now
    with open(PATH, 'w') as fh:
        json.dump(d, fh, indent=2); fh.write('\n')
    print('activity.json updated; totals', t['views'], t['saves_favorites'])

if __name__ == '__main__':
    main()
