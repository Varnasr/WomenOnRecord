"""Read the NCW pages saved by ncw_fetch.py, check them, and write rows in context/ncw/data.csv's format.

    python3 scripts/context/ncw_build.py YEAR HTML_DIR            # check only, print a summary
    python3 scripts/context/ncw_build.py YEAR HTML_DIR --compare  # also compare with the rows already stored for YEAR
    python3 scripts/context/ncw_build.py YEAR HTML_DIR --append --retrieved YYYY-MM-DD

Checks, each of which stops the build: the heading of every page names the year (and the State) that was asked
for; every State and UT row has twelve months that add to its total; the State totals add to the All India total;
each State's nature rows add to its State total; the nature rows add to the All India nature table's rows.
A State whose page prints no table gets no rows (the same gap as in earlier years). Standard library only.
"""
import csv, html, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA = os.path.join(ROOT, 'context', 'ncw', 'data.csv')
MAP = {'Andaman and Nicobar Islands': 'A&N Islands', 'Dadra & Nagar Haveli and Daman & Diu': 'D&N Haveli and Daman & Diu',
       'Jammu and Kashmir': 'Jammu & Kashmir', 'Pondicherry': 'Puducherry', 'Total': 'All India'}
TITLE = 'National Commission for Women, Statistical Overview of Received Complaints (ncwapps.nic.in), calendar year view'
URL = 'https://ncwapps.nic.in/frmComp_Stat_Overview.aspx'
TOTAL_LABEL = 'Complaints received by NCW, all natures'

def cells(r): return [re.sub(r'\s*Cleck Here to see sub-categories', '', html.unescape(re.sub(r'<[^>]+>', '', c))).strip() for c in re.findall(r'<t[hd][^>]*>(.*?)</t[hd]>', r, flags=re.S)]

def table(path, year, kind, state=None):
    t = open(path, encoding='utf-8').read()
    head = re.search(rf'({kind}-Wise Report of the Complaints Received by NCW in the Year : {year}[^<]*)', t)
    if not head:
        return None, {}                                     # the portal printed no table for this request
    h = html.unescape(re.sub(r'\s+', ' ', head.group(1))).strip()
    if state and not h.endswith('from the State ' + state): raise SystemExit(f'heading names another state: {h!r} for {state!r}')
    out = {}
    for r in re.findall(r'<tr[^>]*>(.*?)</tr>', t, flags=re.S):
        c = cells(r)
        if len(c) == 15 and c[0].isdigit():
            v = [int(x.replace(',', '')) for x in c[2:]]
            name = MAP.get(c[1], c[1])
            if sum(v[:12]) != v[12]: raise SystemExit(f'months do not add: {h} / {c[1]}: {v}')
            out[name] = v[12]
    return h, out

def slug(l): return 'ncw_nature_' + re.sub(r'_+', '_', re.sub(r'[^a-z0-9]+', '_', l.lower())).strip('_')

def build(year, d):
    state_head, st = table(os.path.join(d, f'ncw_{year}_type1.html'), year, 'State')
    nat_head, nat = table(os.path.join(d, f'ncw_{year}_type0.html'), year, 'Nature')
    if not state_head or not nat_head: raise SystemExit('no state-wise or nature-wise table for the year')
    total = st.pop('All India')
    if sum(st.values()) != total: raise SystemExit(f'states add to {sum(st.values())}, not {total}')
    if nat.pop('All India') != total: raise SystemExit('nature table total differs from the state table total')
    if sum(nat.values()) != total: raise SystemExit(f'nature rows add to {sum(nat.values())}, not {total}')
    block = re.search(r'<select[^>]*id="ddlState".*?</select>', open(os.path.join(d, f'ncw_{year}_type1.html'), encoding='utf-8').read(), flags=re.S).group(0)
    rows = [('All India', year, 'ncw_complaints_total', TOTAL_LABEL, total,
             f"Year={year}, Report Type=State Wise, State=All (table '{state_head}')")]
    for k, v in sorted(st.items()): rows.append((k, year, 'ncw_complaints_total', TOTAL_LABEL, v, f"Year={year}, Report Type=State Wise, State=All (table '{state_head}')"))
    allsum, gaps = {}, []
    for f in sorted(os.listdir(d)):
        m = re.fullmatch(rf'ncw_{year}_type0_st(\d+)\.html', f)
        if not m: continue
        opt = re.search(rf'<option[^>]*value="{m.group(1)}"[^>]*>(.*?)</option>', block, flags=re.S)
        raw = html.unescape(re.sub(r'\s+', ' ', opt.group(1))).strip().split(' / ')[0]
        h, n = table(os.path.join(d, f), year, 'Nature', raw)
        name = MAP.get(raw, raw)
        if not h: gaps.append(name); continue
        tot = n.pop('All India')
        if tot != st.get(name): raise SystemExit(f'{name}: nature rows total {tot}, state table says {st.get(name)}')
        if sum(n.values()) != tot: raise SystemExit(f'{name}: nature rows add to {sum(n.values())}, not {tot}')
        for lab, v in n.items():
            allsum[lab] = allsum.get(lab, 0) + v
            rows.append((name, year, slug(lab), f'Complaints received by NCW, nature: {lab}', v,
                         f"Year={year}, Report Type=Nature Wise, State={raw} (table '{h}')"))
    for lab, v in nat.items():
        if allsum.get(lab, 0) != v: raise SystemExit(f'nature {lab}: states add to {allsum.get(lab, 0)}, India table says {v}')
        rows.append(('All India', year, slug(lab), f'Complaints received by NCW, nature: {lab}', v,
                     f"Year={year}, Report Type=Nature Wise, State=All (table '{nat_head}')"))
    return rows, gaps

if __name__ == '__main__':
    a = [x for x in sys.argv[1:] if not x.startswith('--')]
    year, d = a[0], a[1]
    rows, gaps = build(year, d)
    print(f'{year}: {len(rows)} rows; All India {rows[0][4]}; no table printed for: {gaps or "none"}; all checks passed')
    stored = list(csv.DictReader(open(DATA, encoding='utf-8')))
    if '--compare' in sys.argv:
        old = {(r['state'], r['indicator_code']): int(r['value']) for r in stored if r['year_or_as_of'] == year}
        new = {(r[0], r[2]): r[4] for r in rows}
        diff = [(k, old.get(k), new.get(k)) for k in sorted(set(old) | set(new)) if old.get(k) != new.get(k)]
        print('rows stored', len(old), 'rows now', len(new), 'differences', len(diff)); [print(' ', x) for x in diff[:40]]
    if '--append' in sys.argv:
        if any(r['year_or_as_of'] == year for r in stored): raise SystemExit(f'{year} is already in data.csv')
        ret = sys.argv[sys.argv.index('--retrieved') + 1]
        w = csv.writer(open(DATA, 'a', encoding='utf-8', newline=''), lineterminator='\n')
        for s, y, code, lab, v, tp in rows:
            note = (f'Retrieved {ret}; calendar year, by state recorded on the complaint.' if code == 'ncw_complaints_total'
                    else f'Retrieved {ret}; category label as printed by NCW; categories vary between years.')
            w.writerow([s, y, code, lab, v, 'complaints', TITLE, URL, tp, note])
        print('appended', len(rows), 'rows')
