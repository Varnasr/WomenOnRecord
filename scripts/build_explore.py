#!/usr/bin/env python3
"""Write data/explore.json, a compact copy of data/shecounts.csv for the data
explorer page. Every value that repeats (place, crime, measure, source, note)
is written once and referred to by number, which takes 9.3 MB to well under
one. The explorer rebuilds full rows from it when a reader downloads, so the
build checks that every row of the CSV comes back exactly as it was.

    python3 scripts/build_explore.py          # write
    python3 scripts/build_explore.py --check  # fail if the file is stale
"""
import csv, json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'data', 'shecounts.csv')
OUT = os.path.join(ROOT, 'data', 'explore.json')

# Plain names for each measure. A police_ or court_ prefix only says which
# table the figure came from (the single-crime tables, India only), so it
# shares the label of the same figure for all crimes together.
MEASURES = {
    'cases': 'Cases recorded',
    'cases_ipc': 'Cases recorded under the IPC (before 1 July 2024)',
    'cases_bns': 'Cases recorded under the BNS (from 1 July 2024)',
    'cases_bns74': 'Cases under BNS 74 (assault to outrage modesty)',
    'cases_bns75': 'Cases under BNS 75 (sexual harassment)',
    'cases_bns76': 'Cases under BNS 76 (assault with intent to disrobe)',
    'cases_bns77': 'Cases under BNS 77 (voyeurism)',
    'cases_bns78': 'Cases under BNS 78 (stalking)',
    'cases_bns87_marriage': 'Cases under BNS 87 (kidnapping to compel marriage)',
    'cases_bns96_procuration': 'Cases under BNS 96 (procuration of a child)',
    'cases_bns137_142': 'Cases under BNS 137 to 142 (other kidnapping and abduction)',
    'rate': 'Cases per lakh women',
    'victims': 'Victims',
    'victims_women': 'Victims, women 18 and over',
    'victims_girls': 'Victims, girls under 18',
    'victims_under6': 'Victims under 6',
    'victims_6_12': 'Victims aged 6 to 12',
    'victims_12_16': 'Victims aged 12 to 16',
    'victims_16_18': 'Victims aged 16 to 18',
    'victims_18_30': 'Victims aged 18 to 30',
    'victims_30_45': 'Victims aged 30 to 45',
    'victims_45_60': 'Victims aged 45 to 60',
    'victims_60plus': 'Victims aged 60 and over',
    'population_lakh': 'Women, mid-year projection (lakh)',
    'reported': 'Police: new cases this year',
    'total_for_investigation': 'Police: cases for investigation, with earlier years',
    'disposed_by_police': 'Police: cases disposed of',
    'chargesheeted': 'Police: charge-sheeted',
    'chargesheeting_rate': 'Police: charge-sheeting rate (%)',
    'final_report_false': 'Police: closed as false',
    'final_report_true_insufficient_evidence': 'Police: closed as true but for lack of evidence',
    'pending_investigation_end_of_year': 'Police: still under investigation at year end',
    'pendency': 'Police: share still under investigation (%)',
    'total_for_trial': 'Courts: cases for trial, with earlier years',
    'trials_completed': 'Courts: trials completed',
    'convicted': 'Courts: convicted',
    'acquitted': 'Courts: acquitted',
    'discharged': 'Courts: discharged',
    'conviction_rate': 'Courts: conviction rate (%)',
    'pending_trial_end_of_year': 'Courts: still waiting for a verdict at year end',
    'court_pendency': 'Courts: share still waiting for a verdict (%)',
}


def label(m):
    if m in MEASURES:
        return MEASURES[m]
    for pre, stage in (('police_', 'Police'), ('court_', 'Courts')):
        if m.startswith(pre):
            rest = m[len(pre):]
            if rest == stage.lower() + '_pendency' or rest == 'pendency':
                rest = 'pendency' if stage == 'Police' else 'court_pendency'
            if rest in MEASURES:
                return MEASURES[rest]
    raise SystemExit(f'no label for measure {m}; add it to MEASURES')


def build():
    rows = list(csv.reader(open(SRC, encoding='utf-8')))
    head, body = rows[0], rows[1:]
    ix = {c: i for i, c in enumerate(head)}
    places, crimes, measures, years, flags, notes, tables = [], {}, {}, {}, [], [], []
    pidx, cidx, midx = {}, {}, {}

    def idx(lst, v):
        if v not in lst:
            lst.append(v)
        return lst.index(v)

    out = []
    for r in body:
        g = lambda c: r[ix[c]]
        pk = (g('state'), g('lgd_code'), g('kind'))
        if pk not in pidx:
            pidx[pk] = len(places); places.append(list(pk))
        # a crime's description can differ between tables (rape by age cites fewer BNS sections),
        # so each distinct description is kept once
        ck = (g('crime_code'), g('group'), g('crime_head'), g('ipc_section'), g('bns_section_or_act'))
        if ck not in cidx:
            cidx[ck] = len(cidx)
        mk = (g('measure'), g('unit'))
        if mk not in midx:
            midx[mk] = len(measures); measures[len(measures)] = [g('measure'), g('unit'), label(g('measure'))]
        src = [g('source_edition'), g('source_url'), g('source_sha256')]
        y = g('year')
        if y in years:
            assert years[y] == src, f'{y} carries two sources'
        else:
            years[y] = src
        v = g('value')
        if v == '':
            val = None
        else:
            f = float(v)
            # keep the figure exactly as written; JSON numbers that would not print back the same stay strings
            val = int(f) if f.is_integer() and '.' not in v else (f if repr(f) == v else v)
        out.append([pidx[pk], int(y), cidx[ck], midx[mk], val, idx(tables, g('table_no')), idx(flags, g('flag')), idx(notes, g('note'))])
    data = {'columns': head, 'places': places, 'crimes': [list(c) for c in cidx], 'measures': [measures[i] for i in range(len(measures))],
            'sources': years, 'tables': tables, 'flags': flags, 'notes': notes, 'rows': out}
    # The explorer must give back exactly the rows of the CSV.
    for r, o in zip(body, out):
        p, c, m = places[o[0]], data['crimes'][o[2]], data['measures'][o[3]]
        s = years[str(o[1])]
        val = '' if o[4] is None else (o[4] if isinstance(o[4], str) else (str(o[4]) if isinstance(o[4], int) else repr(o[4])))
        back = [p[0], p[1], p[2], str(o[1]), c[0], c[1], c[2], c[3], c[4], m[0], val, m[1], s[0], tables[o[5]], s[1], s[2], flags[o[6]], notes[o[7]]]
        assert back == r, f'row does not round-trip: {r} != {back}'
    return json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n'


if __name__ == '__main__':
    text = build()
    if '--check' in sys.argv:
        if not os.path.exists(OUT) or open(OUT, encoding='utf-8').read() != text:
            sys.exit('data/explore.json is stale: run python3 scripts/build_explore.py')
        print('PASS: data/explore.json gives back every row of data/shecounts.csv')
    else:
        open(OUT, 'w', encoding='utf-8').write(text)
        print(f'wrote data/explore.json, {len(text) // 1024} KB')
