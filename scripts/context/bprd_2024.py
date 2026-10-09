#!/usr/bin/env python3
"""Add Data on Police Organizations as on 1 January 2024 to context/bprd/data.csv.

    pdftotext -layout dopo2024.pdf dopo2024.txt
    python3 scripts/context/bprd_2024.py dopo2024.pdf dopo2024.txt          # check and write
    python3 scripts/context/bprd_2024.py dopo2024.pdf dopo2024.txt --check  # check only

The PDF is BPR&D's own file (about 70 MB, not committed). The script refuses a
file whose SHA-1 is not the one the Wayback Machine recorded for the BPR&D
address, reads the five tables the context page uses from the text layer,
runs the same checks as the 2023 and 2020 editions, and replaces any rows
dated 2024-01-01 in data.csv. Rows for other editions are left as they are.
"""
import base64, csv, hashlib, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'context', 'bprd', 'data.csv')
WAYBACK_SHA1 = 'SZBJFBIFOKGTYXKBTNFOW3WQO7MJUY2Z'
ASOF = '2024-01-01'
TITLE = ('Data on Police Organizations (as on January 01, 2024), Bureau of Police Research and Development, '
         'Ministry of Home Affairs')
URL = 'https://bprd.nic.in/uploads/pdf/Data%20on%20Police%20Organizations%20(2024)_%20(14-07-25)%20All.pdf'
# printed page numbers, which are the PDF page number less 50 in this edition
PAGES = {'2.1.2': 62, '2.1.3': 64, '3.1.1': 66, '3.2.1': 104, '5.1.4': 163, '6.2.4': 218}
POP_NOTE = 'population in thousands as on 1 October 2023, RGI projection based on Census 2011'

CANON = ['Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat',
         'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh',
         'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan',
         'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
         'A&N Islands', 'Chandigarh', 'D&N Haveli and Daman & Diu', 'Delhi', 'Jammu & Kashmir', 'Ladakh',
         'Lakshadweep', 'Puducherry', 'All India']
# the first word or two of each name as the PDF prints it on a row's first line
PREFIX = {'A & N Islands': 'A&N Islands', 'Dadra and': 'D&N Haveli and Daman & Diu',
          'Jammu and Kashmir': 'Jammu & Kashmir', 'J&K': 'Jammu & Kashmir', 'TOTAL': 'All India',
          'All India': 'All India', 'Andhra': 'Andhra Pradesh', 'Arunachal': 'Arunachal Pradesh',
          'Himachal': 'Himachal Pradesh', 'Madhya': 'Madhya Pradesh'}
TOK = r'(?:\d[\d,]*(?:\.\d+)?%?|-|NA|NP)'


def canon(name):
    name = re.sub(r'[\s~!@#^*$]+$', '', name).strip()
    if name in CANON:
        return name
    for k in sorted(PREFIX, key=len, reverse=True):
        if name == k or name.startswith(k + ' ') or name.startswith(k):
            return PREFIX[k]
    return None


def num(v):
    if v == '-':
        return 0.0
    if v in ('NA', 'NP'):
        return None
    return float(v.replace(',', '').replace('%', ''))


def rows_of(page):
    """{state: [cells]} for every line that starts a state row."""
    out = {}
    for line in page.split('\n'):
        m = re.match(r'^\s*(?:\d{1,2}\s+)?([A-Za-z&][A-Za-z &.]*?[A-Za-z][~@#*$^ ]*?)\s{2,}(' + TOK + r'(?:\s+' + TOK + r')*)\s*$', line)
        if not m:
            continue
        s = canon(m.group(1))
        if s:
            out[s] = m.group(2).split()
    return out


def women_stations(pages):
    """Table 6.2.4: (rural, urban, total) per state, from each state's first line."""
    out = {}
    for page in pages:
        for line in page.split('\n'):
            m = re.match(r'^\s*(?:(\d{1,2})\s+)?([A-Za-z&][A-Za-z &]*?)\s{2,}(.*)$', line)
            if not m or (not m.group(1) and not m.group(2).startswith('TOTAL')):
                continue
            s = canon(m.group(2))
            if not s or s in out:
                continue
            toks = m.group(3).split()
            rural, total = toks[0], toks[-1]
            if not re.fullmatch(TOK, rural) or not re.fullmatch(TOK, total):
                raise SystemExit(f'6.2.4: cannot read the row for {s}: {line!r}')
            r, t = num(rural), num(total)
            u = None if t is None else t - (r or 0)
            # the urban count is printed on the same line; make sure it is there
            if u is not None and ('%d' % u if u else '-') not in toks[1:-1]:
                raise SystemExit(f'6.2.4: urban count {u} for {s} is not printed on its line: {line!r}')
            out[s] = (r, u, t)
    return out


def fmt(x):
    return ('%d' % x) if float(x).is_integer() else ('%.2f' % x)


def main():
    pdf, txt = sys.argv[1], sys.argv[2]
    sha1 = base64.b32encode(hashlib.sha1(open(pdf, 'rb').read()).digest()).decode()
    if sha1 != WAYBACK_SHA1:
        raise SystemExit(f'{pdf} is not the BPR&D file: SHA-1 {sha1}, expected {WAYBACK_SHA1}')
    sha256 = hashlib.sha256(open(pdf, 'rb').read()).hexdigest()
    pages = open(txt, encoding='utf-8').read().split('\f')
    pg = lambda printed: pages[printed + 49]  # printed page n is PDF page n + 50

    t212, t212c = rows_of(pg(62)), rows_of(pg(63))
    t213 = rows_of(pg(64))
    t311c = rows_of(pg(67))
    t321 = rows_of(pg(104))
    t514 = rows_of(pg(163))
    wps = women_stations([pg(n) for n in range(218, 237)])

    v, log, bad = {}, [], []
    for s in CANON:
        for name, tab, need in (('2.1.2', t212, 5), ('2.1.3', t213, 10), ('3.1.1', t311c, 6),
                                ('3.2.1', t321, 3), ('5.1.4', t514, 7)):
            if s not in tab or len(tab[s]) < need:
                bad.append(f'{s}: row missing or short in Table {name}: {tab.get(s)}')
        if s not in wps:
            bad.append(f'{s}: row missing in Table 6.2.4')
    if bad:
        raise SystemExit('\n'.join(bad))
    for s in CANON:
        a, b, c, d, e = t212[s], t213[s], t311c[s], t321[s], t514[s]
        v[s] = dict(pop_k=num(a[1]), sanc=num(a[2]), act=num(a[3]), ppr_s=num(b[-2]), ppr_a=num(b[-1]),
                    sanc_311=num(c[2]), act_311=num(c[3]), women_311=num(c[5]),
                    act_321=num(d[0]), women=num(d[1]), women_pct=num(d[2]), ps_caw=num(e[1]))

    states = [s for s in CANON if s != 'All India']
    log.append(f'== DoPO as on {ASOF}: {len(states)} state/UT rows; SHA-1 {sha1} matches Wayback; sha256 {sha256}')
    for key, lab in [('sanc', 'sanctioned total (T2.1.2)'), ('act', 'actual total (T2.1.2)'),
                     ('women', 'women actual (T3.2.1)'), ('pop_k', 'population thousand (T2.1.2)'),
                     ('ps_caw', 'special PS crime against women & children (T5.1.4)')]:
        sm, ai = sum(v[s][key] or 0 for s in states), v['All India'][key]
        ok = abs(sm - ai) < 0.5
        log.append(f'sum of states {lab}: {fmt(sm)} vs All India {fmt(ai)} -> {"OK" if ok else "DIFF"}')
        if not ok:
            bad.append(f'{lab}: states sum to {fmt(sm)}, All India printed {fmt(ai)}')
    for i, lab in ((0, 'rural'), (1, 'urban'), (2, 'total')):
        sm = sum(wps[s][i] or 0 for s in states)
        ok = abs(sm - wps['All India'][i]) < 0.5
        log.append(f'sum of states women police stations, {lab} (T6.2.4): {fmt(sm)} vs printed TOTAL {fmt(wps["All India"][i])} -> {"OK" if ok else "DIFF"}')
        if not ok:
            bad.append(f'women police stations {lab}: states sum to {fmt(sm)}')
    for s in CANON:
        x = v[s]
        if x['act'] != x['act_311'] or x['act'] != x['act_321'] or x['sanc'] != x['sanc_311']:
            bad.append(f"{s}: T2.1.2 S/A {x['sanc']}/{x['act']}, T3.1.1 S/A {x['sanc_311']}/{x['act_311']}, T3.2.1 A {x['act_321']}")
        if x['women'] != x['women_311']:
            bad.append(f"{s}: women T3.2.1 {x['women']} vs T3.1.1 {x['women_311']}")
        r = round(100 * x['women'] / x['act'], 2)
        if abs(r - x['women_pct']) > 0.011:
            bad.append(f"{s}: women % printed {x['women_pct']} vs recomputed {r}")
        ra, rs = x['act'] / (x['pop_k'] * 1000) * 1e5, x['sanc'] / (x['pop_k'] * 1000) * 1e5
        if abs(ra - x['ppr_a']) > 0.6 or abs(rs - x['ppr_s']) > 0.6:
            bad.append(f"{s}: police per lakh printed S/A {x['ppr_s']}/{x['ppr_a']} vs recomputed {rs:.2f}/{ra:.2f}")
    log.append('cross-table and recompute checks: ' + ('all OK' if not bad else f'{len(bad)} discrepancies'))
    print('\n'.join(log + ['  ' + b for b in bad]))
    if bad:
        raise SystemExit(1)

    rows = []

    def add(s, code, label, val, unit, tab, note=''):
        rows.append(dict(state=s, year_or_as_of=ASOF, indicator_code=code, indicator_label=label,
                         value=val, unit=unit, source_title=TITLE, source_url=URL,
                         table_or_page=f'Table {tab}, p.{PAGES[tab]}', note=note))
    for s in CANON:
        x = v[s]
        add(s, 'police_sanctioned_total', 'Total State police strength, sanctioned (Civil + DAR + Armed + IRB)', fmt(x['sanc']), 'persons', '2.1.2')
        add(s, 'police_actual_total', 'Total State police strength, actual (Civil + DAR + Armed + IRB)', fmt(x['act']), 'persons', '2.1.2')
        add(s, 'women_police_actual', 'Women police, actual strength (Civil + DAR + Armed + IRB)', fmt(x['women']), 'persons', '3.2.1')
        add(s, 'women_police_pct_actual', 'Women police as % of actual total police strength (as printed)', fmt(x['women_pct']), 'percent', '3.2.1')
        add(s, 'police_per_lakh_sanctioned', 'Total police per lakh population, sanctioned', fmt(x['ppr_s']), 'per 100,000 population', '2.1.3')
        add(s, 'police_per_lakh_actual', 'Total police per lakh population, actual', fmt(x['ppr_a']), 'per 100,000 population', '2.1.3')
        add(s, 'population_thousand', 'Projected population used by DoPO for ratios', fmt(x['pop_k']), 'thousand persons', '2.1.2', POP_NOTE)
        add(s, 'ps_special_crime_against_women_children', 'Special purpose police stations: crime against women & children (actual)', fmt(x['ps_caw']), 'police stations', '5.1.4')
        r, u, t = wps[s]
        for code, lab, val in (('women_police_stations_total', 'Women police stations, rural + urban (total)', t),
                               ('women_police_stations_rural', 'Women police stations, rural', r),
                               ('women_police_stations_urban', 'Women police stations, urban', u)):
            if val is None:
                add(s, code, lab, 'NA', 'police stations', '6.2.4', 'Printed as NA (not available) for this state.')
            else:
                add(s, code, lab, fmt(val), 'police stations', '6.2.4')

    old = list(csv.DictReader(open(OUT, encoding='utf-8')))
    fields = list(old[0].keys())
    keep = [r for r in old if r['year_or_as_of'] != ASOF]
    order = {s: i for i, s in enumerate(CANON)}
    allrows = keep + rows
    allrows.sort(key=lambda r: (r['year_or_as_of'], r['indicator_code'], order.get(r['state'], 99)))
    if '--check' in sys.argv:
        same = [dict(r) for r in old] == allrows
        print('PASS: data.csv carries the 2024 edition as read' if same else 'data.csv differs from the 2024 edition as read')
        sys.exit(0 if same else 1)
    with open(OUT, 'w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(allrows)
    print(f'{len(rows)} rows for {ASOF} written; {len(allrows)} rows in all')


if __name__ == '__main__':
    main()
