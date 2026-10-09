"""Gather the eight context sources into one file the site reads and one CSV
readers can download.

context/<source>/data.csv is each source as it was collected and checked, with
its notes.md and sources.json beside it (see those for every table, page and
check). This script changes no figure. It writes:
  data/context.json   {source: {code: {state: {period: value}}}, labels}
  data/context.csv    every row of every source, with a source column
Usage: python3 scripts/build_context.py [--check]
"""
import csv, io, json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCES = ['nfhs', 'adsi', 'ncw', 'bprd', 'ftsc', 'nirbhaya', 'njdg', 'adr']
COLS = ['source', 'state', 'period', 'indicator_code', 'indicator_label', 'value', 'unit', 'source_title', 'source_url', 'table_or_page', 'note']

def num(v):
    v = (v or '').strip().replace(',', '')
    if v in ('', 'NA', '-'): return None
    try: return int(v) if v.lstrip('-').isdigit() else float(v)
    except ValueError: raise SystemExit(f'not a number: {v!r}')

def build():
    site, rows = {'labels': {}, 'units': {}}, []
    for s in SOURCES:
        f = os.path.join(ROOT, 'context', s, 'data.csv')
        rd = csv.reader(open(f, encoding='utf-8'))
        head = next(rd)
        out = site.setdefault(s, {})
        for r in rd:
            d = dict(zip(head, r))
            period = r[1]
            out.setdefault(d['indicator_code'], {}).setdefault(d['state'], {})[period] = num(d['value'])
            site['labels'][d['indicator_code']] = d['indicator_label']
            site['units'][d['indicator_code']] = d['unit']
            rows.append([s, d['state'], period] + [d.get(c, '') for c in COLS[3:]])
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator='\n'); w.writerow(COLS); w.writerows(rows)
    return json.dumps(site, ensure_ascii=False, separators=(',', ':')), buf.getvalue()

if __name__ == '__main__':
    js, cs = build()
    targets = {os.path.join(ROOT, 'data', 'context.json'): js, os.path.join(ROOT, 'data', 'context.csv'): cs}
    if '--check' in sys.argv:
        stale = [p for p, t in targets.items() if not os.path.exists(p) or open(p, encoding='utf-8').read() != t]
        if stale: raise SystemExit('stale, run python3 scripts/build_context.py: ' + ', '.join(stale))
        print('PASS: context files match their sources')
    else:
        for p, t in targets.items(): open(p, 'w', encoding='utf-8').write(t)
        print('wrote data/context.json and data/context.csv,', cs.count('\n') - 1, 'rows')
