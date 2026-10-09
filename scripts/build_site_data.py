"""Write data/site.json, the compact form of data/shecounts.csv the site reads.

The CSV is the source; this file only reshapes it, so the page and the
download cannot disagree. Usage: python3 scripts/build_site_data.py [--check]
"""
import csv, json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSV = os.path.join(ROOT, 'data', 'shecounts.csv')
OUT = os.path.join(ROOT, 'data', 'site.json')

DISPLAY = {'A&N Islands': 'Andaman and Nicobar Islands',
           'D&N Haveli and Daman & Diu': 'Dadra and Nagar Haveli and Daman and Diu',
           'Jammu & Kashmir': 'Jammu and Kashmir'}
MAPNAME = {'A&N Islands': 'Andaman & Nicobar',
           'D&N Haveli and Daman & Diu': 'Dadra and Nagar Haveli and Daman and Diu'}

def num(v):
    if v == '':
        return None
    f = float(v)
    return int(f) if f.is_integer() else f

def build():
    rows = list(csv.DictReader(open(CSV, encoding='utf-8')))
    years = sorted({int(r['year']) for r in rows})
    places, heads, series, notes = [], {}, {}, {}
    seen = set()
    for r in rows:
        s = r['state']
        if s not in seen:
            seen.add(s)
            places.append({'id': s, 'name': DISPLAY.get(s, s), 'map': MAPNAME.get(s, s),
                           'kind': r['kind'], 'lgd': num(r['lgd_code'])})
        c = r['crime_code']
        if c not in heads:
            heads[c] = {'label': r['crime_head'], 'group': r['group'],
                        'ipc': r['ipc_section'], 'bns': r['bns_section_or_act']}
        y = years.index(int(r['year']))
        series.setdefault(c, {}).setdefault(r['measure'], {}).setdefault(s, [None] * len(years))[y] = num(r['value'])
        if r['note'] and r['measure'] == 'cases':
            notes.setdefault(c, {})[r['year']] = r['note']
    srcs = json.load(open(os.path.join(ROOT, 'data', 'raw', 'sources.json')))
    return {'years': years, 'places': places, 'heads': heads, 'series': series,
            'notes': notes, 'sources': srcs}

if __name__ == '__main__':
    text = json.dumps(build(), ensure_ascii=False, separators=(',', ':'))
    if '--check' in sys.argv:
        if open(OUT, encoding='utf-8').read() != text:
            raise SystemExit('data/site.json is stale: run python3 scripts/build_site_data.py')
        print('PASS: data/site.json is current')
    else:
        open(OUT, 'w', encoding='utf-8').write(text)
        print('wrote', OUT, len(text) // 1024, 'KB')
