"""Write data/site.json, the compact form of data/womenonrecord.csv the site reads.

The CSV is the source; this file only reshapes it, so the page and the
download cannot disagree. Usage: python3 scripts/build_site_data.py [--check]
"""
import csv, json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSV = os.path.join(ROOT, 'data', 'womenonrecord.csv')
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

# The site's charts start in 2017, the first year NCRB used the table layout and
# crime headings it still uses. Before that, only these headings were defined
# the same way, so only they reach back, and only for India, in 'long'.
SITE_FROM = 2017
LONG = {'RAPE': [2014, 2015], 'ATTEMPT_RAPE': [2014, 2015, 2016], 'ASSAULT_MODESTY': [2014, 2015, 2016],
        'INSULT_MODESTY': [2014, 2015, 2016], 'DOWRY_DEATH': [2014, 2015, 2016], 'CRUELTY': [2014, 2015, 2016],
        'DOWRY_ACT': [2014, 2015, 2016], 'PWDVA': [2014, 2015, 2016], 'ITPA': [2014, 2015, 2016],
        'KIDNAP': [2016], 'FEMALE_POP': [2014, 2015, 2016]}
LONG_YEARS = [2014, 2015, 2016]

def build():
    allrows = list(csv.DictReader(open(CSV, encoding='utf-8')))
    rows = [r for r in allrows if int(r['year']) >= SITE_FROM]
    years = sorted({int(r['year']) for r in rows})
    long = {}
    for r in allrows:
        y = int(r['year'])
        if r['state'] == 'All India' and r['crime_code'] in LONG and y in LONG[r['crime_code']] and r['measure'] in ('cases', 'rate', 'population_lakh'):
            long.setdefault(r['crime_code'], {}).setdefault(r['measure'], [None] * len(LONG_YEARS))[LONG_YEARS.index(y)] = num(r['value'])
    places, heads, series, notes = [], {}, {}, {}
    seen = set()
    # every heading is named, including those before 2017, so the explorer can label them
    for r in allrows:
        c = r['crime_code']
        if c not in heads or int(r['year']) >= SITE_FROM:
            heads[c] = {'label': r['crime_head'], 'group': r['group'],
                        'ipc': r['ipc_section'], 'bns': r['bns_section_or_act']}
    cities = {}
    for r in rows:
        s = r['state']
        if r['kind'] == 'city':
            # cities stay out of the places list, which every state map and table is drawn from
            cities.setdefault(s, {}).setdefault(r['measure'], [None] * len(years))[years.index(int(r['year']))] = num(r['value'])
            continue
        if s not in seen:
            seen.add(s)
            places.append({'id': s, 'name': DISPLAY.get(s, s), 'map': MAPNAME.get(s, s),
                           'kind': r['kind'], 'lgd': num(r['lgd_code'])})
        c = r['crime_code']
        y = years.index(int(r['year']))
        series.setdefault(c, {}).setdefault(r['measure'], {}).setdefault(s, [None] * len(years))[y] = num(r['value'])
        if r['note'] and r['measure'] == 'cases':
            notes.setdefault(c, {})[r['year']] = r['note']
    srcs = json.load(open(os.path.join(ROOT, 'data', 'raw', 'sources.json')))
    old = json.load(open(os.path.join(ROOT, 'data', 'raw', 'old', 'sources.json')))
    for y, v in json.load(open(os.path.join(ROOT, 'data', 'raw', 'sources_v2.json'))).items():
        srcs[y]['v2'] = {k: v[k] for k in ('title', 'mirror', 'url', 'sha256')}
    for y in sorted({m['year'] for m in old}):
        srcs[str(y)] = {'title': f'Crime in India {y}', 'mirror': 'National Crime Records Bureau (ncrb.gov.in), one file for each table',
                        'files': [{'url': m['url'], 'sha256': m['sha256'], 'name': m['file'][5:]} for m in old if m['year'] == y]}
    return {'years': years, 'places': places, 'heads': heads, 'series': series,
            'notes': notes, 'cities': cities, 'sources': srcs, 'long': {'years': LONG_YEARS, 'series': long}}

if __name__ == '__main__':
    text = json.dumps(build(), ensure_ascii=False, separators=(',', ':'))
    if '--check' in sys.argv:
        if open(OUT, encoding='utf-8').read() != text:
            raise SystemExit('data/site.json is stale: run python3 scripts/build_site_data.py')
        print('PASS: data/site.json is current')
    else:
        open(OUT, 'w', encoding='utf-8').write(text)
        print('wrote', OUT, len(text) // 1024, 'KB')
