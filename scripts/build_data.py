"""Build Women on Record' dataset from NCRB Crime in India, 2014 to 2024.

2020 to 2024 are parsed here from data/raw/cii<year>_v1.txt. 2014 to 2019 come
from data/raw/old/, extracted once from NCRB's per-table PDFs and checked
(see scripts/old_extract/README.md); old_rows() below adds them.

Reads the text NCRB's tables were extracted to (`pdftotext -layout`, one file
per edition, kept in data/raw/) and writes data/womenonrecord.csv in long format:
one row per state, year, crime head and measure.

Every value is checked before it is written: the 28 states must add to NCRB's
"Total State(s)" row, the 8 union territories to "Total UT(s)", and both to
"Total All India", for every count column. A mismatch stops the build.

Usage: python3 scripts/build_data.py [--check]
"""
import csv, io, json, os, re, sys

sys.path.insert(0, os.path.dirname(__file__))
import ncrb_parse as P

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, 'data', 'raw')
OUT = os.path.join(ROOT, 'data', 'womenonrecord.csv')
YEARS = [2020, 2021, 2022, 2023, 2024]

# LGD state codes (Local Government Directory, Ministry of Panchayati Raj).
LGD = {"Andhra Pradesh": 28, "Arunachal Pradesh": 12, "Assam": 18, "Bihar": 10,
       "Chhattisgarh": 22, "Goa": 30, "Gujarat": 24, "Haryana": 6, "Himachal Pradesh": 2,
       "Jharkhand": 20, "Karnataka": 29, "Kerala": 32, "Madhya Pradesh": 23,
       "Maharashtra": 27, "Manipur": 14, "Meghalaya": 17, "Mizoram": 15, "Nagaland": 13,
       "Odisha": 21, "Punjab": 3, "Rajasthan": 8, "Sikkim": 11, "Tamil Nadu": 33,
       "Telangana": 36, "Tripura": 16, "Uttar Pradesh": 9, "Uttarakhand": 5,
       "West Bengal": 19, "A&N Islands": 35, "Chandigarh": 4,
       "D&N Haveli and Daman & Diu": 38, "Delhi": 7, "Jammu & Kashmir": 1, "Ladakh": 37,
       "Lakshadweep": 31, "Puducherry": 34}

# Crime heads in table 3A.2. Each maps to the column holding the number of
# cases: one column in the 2020-2023 layout (I, V, R), the Total column in the
# 2024 layout (IPC, BNS, Total, V, R). Victims and rate follow it.
# (code, group, label, ipc, bns_or_act, col_2020_23, col_2024)
HEADS = [
 ("RAPE", "sexual", "Rape", "376", "63-64, 66-68, 70-71", 63, 5),
 ("RAPE_WOMEN", "sexual", "Rape of women (18 and above)", "376", "63-64, 66-68, 70-71", 66, 10),
 ("RAPE_GIRLS_IPC", "sexual", "Rape of girls under 18, booked under the IPC/BNS", "376", "63-64, 66-68, 70-71", 69, 15),
 ("ATTEMPT_RAPE", "sexual", "Attempt to rape", "376/511", "64 r/w 62", 72, 30),
 ("POCSO_TOTAL", "sexual", "POCSO Act, girl victims (all sections)", None, "POCSO Act", 135, 258),
 ("POCSO_RAPE", "sexual", "POCSO: penetrative sexual assault of girls (s.4 and 6)", None, "POCSO s.4, 6", 138, 261),
 ("POCSO_ASSAULT", "sexual", "POCSO: sexual assault of girls (s.8 and 10)", None, "POCSO s.8, 10", 141, 264),
 ("ASSAULT_MODESTY", "sexual", "Assault with intent to outrage modesty (incl. sexual harassment, disrobing, voyeurism, stalking)", "354, 354A-D", "74-78", 81, None),
 ("INSULT_MODESTY", "sexual", "Insult to the modesty of women", "509", "79", 90, 120),
 ("MURDER_RAPE", "killed", "Murder with rape or gang rape", "302 r/w 376", "103 r/w 64-70", 3, 25),
 ("DOWRY_DEATH", "killed", "Dowry deaths", "304B", "80", 6, 135),
 ("ABETMENT_SUICIDE", "killed", "Abetment of suicide of women", "305, 306", "107, 108", 9, 180),
 ("CRUELTY", "home", "Cruelty by husband or his relatives", "498A", "85, 86", 21, 140),
 ("DOWRY_ACT", "home", "Dowry Prohibition Act, 1961", None, "Dowry Prohibition Act", 102, 228),
 ("PWDVA", "home", "Protection of Women from Domestic Violence Act, 2005", None, "PWDVA", 123, 249),
 ("KIDNAP", "other", "Kidnapping and abduction of women", "363-369", "87, 96, 137-140, 142", 24, None),
 ("ACID", "other", "Acid attack", "326A", "124(1)", 15, 185),
 ("ACID_ATTEMPT", "other", "Attempted acid attack", "326B", "124(2)", 18, 190),
 ("TRAFFICKING", "other", "Human trafficking", "370, 370A", None, 54, None),
 ("ITPA", "other", "Immoral Traffic (Prevention) Act, women victims", None, "ITPA 1956", 105, 231),
 ("CYBER", "other", "Cyber crimes against women (IT Act)", None, "IT Act", 126, 252),
 ("IPC_TOTAL", "total", "All IPC/BNS crimes against women", None, None, 99, 225),
 ("SLL_TOTAL", "total", "All special and local law crimes against women", None, None, 159, 279),
 ("TOTAL", "total", "All crimes against women", None, None, 162, 282),
]
# 2024 splits some heads that 2020-2023 report as one. Their sum is the
# comparable figure: s.354 into five heads, and kidnapping into a total that
# leaves out marriage (s.366) and procuration of minor girls (s.366A).
SUMS_2024 = {'ASSAULT_MODESTY': ([45, 60, 75, 90, 105], ['bns74', 'bns75', 'bns76', 'bns77', 'bns78']),
             'KIDNAP': ([195, 145, 165], ['bns137_142', 'bns87_marriage', 'bns96_procuration'])}
SLL_2024 = {228, 231, 249, 252, 258, 261, 264, 279, 282}

PAGES = {2020: "199-215", 2021: "211-227", 2022: "211-227", 2023: "211-227", 2024: "281-309"}
SOURCE = json.load(open(os.path.join(RAW, 'sources.json')))
SOURCE_V2 = json.load(open(os.path.join(RAW, 'sources_v2.json')))

def note_for(code, year):
    if code == 'ASSAULT_MODESTY' and year == 2024:
        return 'Sum of BNS 74-78 / IPC 354, 354A, 354B, 354C, 354D, which 2024 reports separately.'
    if code == 'KIDNAP' and year == 2024:
        return 'Sum of three 2024 heads: kidnapping (BNS 137-140, 142), to compel marriage (BNS 87 / IPC 366) and procuration of minor girls (BNS 96 / IPC 366A). 2020-2023 totals include all three.'
    if code == 'RAPE_GIRLS_IPC':
        return 'Most rape of girls is booked under POCSO s.4 and 6. See POCSO_RAPE.'
    if code == 'TRAFFICKING' and year == 2024:
        return 'Not in table 3A.2 for 2024.'
    return ''

def flags_for(year):
    f = ['PRINCIPAL_OFFENCE']
    if year == 2020:
        f.append('LOCKDOWN_2020')
    if year == 2024:
        f.append('CODE_SPLIT_2024')
    return f

def load(year, table):
    txt = open(os.path.join(RAW, f'cii{year}_v1.txt'), encoding='utf-8').read()
    data, _ = P.parse_table(txt, table)
    for n, col in data.items():
        if all(v is None or float(v).is_integer() for v in col.values()):
            bad = P.check_totals(col)
            if bad and not (year == 2023 and table == '3A.2' and n == 158):
                raise SystemExit(f'{year} {table} col {n}: rows do not add to totals: {bad}')
    return data

def load_v2(year, table, heads=False):
    txt = open(os.path.join(RAW, f'cii{year}_v2.txt'), encoding='utf-8').read()
    if heads:
        return P.parse_heads_table(txt, table)
    data, _ = P.parse_table(txt, table)
    return data

def head_row(table, pattern):
    """The one row of a crime-head table whose label matches, or stop."""
    rows = [l for l in table[4] if re.match(pattern, l)]
    if len(rows) != 1:
        raise SystemExit(f'expected one row matching {pattern!r}, found {rows}')
    return rows[0]

ROWKEYS = P.STATES + ['Total states', 'Total UTs', 'All India']

def rows():
    out = []
    def add(state, year, code, group, label, ipc, bns, measure, value, unit, table, note='', src=None, extra=()):
        src = src or SOURCE[str(year)]
        out.append({
            'state': state, 'lgd_code': LGD.get(state, ''),
            'kind': 'state' if state in P.STATES[:28] else ('ut' if state in P.STATES else 'total'),
            'year': year, 'crime_code': code, 'group': group, 'crime_head': label,
            'ipc_section': ipc or '', 'bns_section_or_act': bns or '',
            'measure': measure, 'value': '' if value is None else (int(value) if float(value).is_integer() and unit != 'rate' else value),
            'unit': unit, 'source_edition': src.get('edition', f'Crime in India {year}, Volume 1'),
            'table_no': table, 'source_url': src['url'], 'source_sha256': src['sha256'],
            'flag': ';'.join(flags_for(year) + list(extra) + (['NOT_REPORTED'] if value is None else [])),
            'note': note})
    for y in YEARS:
        t32 = load(y, '3A.2')
        t31 = load(y, '3A.1')
        popcol = 6
        for s in ROWKEYS:
            pop = t31[popcol].get(s)
            add(s, y, 'FEMALE_POP', 'denominator', 'Female population, mid-year projection', None, None,
                'population_lakh', pop, 'lakh women', '3A.1',
                'Technical Group on Population Projections (July 2020), as printed by NCRB.')
        for code, group, label, ipc, bns, c_old, c_new in HEADS:
            for s in ROWKEYS:
                note = note_for(code, y)
                if y < 2024:
                    i, v, r = (t32[c_old].get(s), t32[c_old + 1].get(s), t32[c_old + 2].get(s))
                    add(s, y, code, group, label, ipc, bns, 'cases', i, 'count', '3A.2', note)
                    add(s, y, code, group, label, ipc, bns, 'victims', v, 'count', '3A.2', note)
                    add(s, y, code, group, label, ipc, bns, 'rate', r, 'rate', '3A.2', 'Cases per lakh women, as printed by NCRB. ' + note)
                    continue
                if code in SUMS_2024:
                    cols, parts = SUMS_2024[code]
                    i = sum(t32[c][s] for c in cols)
                    v = sum(t32[c + 1][s] for c in cols)
                    pop = t31[popcol].get(s)
                    r = round(i / pop, 1) if pop else None
                    add(s, y, code, group, label, ipc, bns, 'cases', i, 'count', '3A.2', note)
                    add(s, y, code, group, label, ipc, bns, 'victims', v, 'count', '3A.2', note)
                    add(s, y, code, group, label, ipc, bns, 'rate', r, 'rate', '3A.2', 'Computed here: cases per lakh women. ' + note)
                    for c, part in zip(cols, parts):
                        add(s, y, code, group, label, ipc, bns, f'cases_{part}', t32[c][s], 'count', '3A.2', f'One of the 2024 heads summed into {code}.')
                    continue
                if c_new is None:
                    add(s, y, code, group, label, ipc, bns, 'cases', None, 'count', '3A.2', note)
                    continue
                if c_new in SLL_2024:
                    i, v, r = (t32[c_new].get(s), t32[c_new + 1].get(s), t32[c_new + 2].get(s))
                else:
                    add(s, y, code, group, label, ipc, bns, 'cases_ipc', t32[c_new - 2].get(s), 'count', '3A.2', 'Offences committed before 1 July 2024, booked under the IPC.')
                    add(s, y, code, group, label, ipc, bns, 'cases_bns', t32[c_new - 1].get(s), 'count', '3A.2', 'Offences from 1 July 2024, booked under the BNS.')
                    i, v, r = (t32[c_new].get(s), t32[c_new + 1].get(s), t32[c_new + 2].get(s))
                add(s, y, code, group, label, ipc, bns, 'cases', i, 'count', '3A.2', note)
                add(s, y, code, group, label, ipc, bns, 'victims', v, 'count', '3A.2', note)
                add(s, y, code, group, label, ipc, bns, 'rate', r, 'rate', '3A.2', 'Cases per lakh women, as printed by NCRB. ' + note)
        # BNS 69, new in 2024
        if y == 2024:
            for s in ROWKEYS:
                add(s, y, 'DECEIT_69', 'sexual', 'Sexual intercourse by deceitful means (BNS 69, new offence)', None, '69',
                    'cases', t32[20][s], 'count', '3A.2', 'No IPC equivalent. Not counted in RAPE.')
        # Women murdered: table 2A.3
        t23 = load(y, '2A.3')
        for s in ROWKEYS:
            add(s, y, 'MURDER_WOMEN', 'killed', 'Women and girls murdered (all motives)', '302', '103',
                'victims', t23[44].get(s), 'count', '2A.3', 'Female victims of murder, child and adult. Counts victims, not cases.')
            add(s, y, 'MURDER_WOMEN', 'killed', 'Women and girls murdered (all motives)', '302', '103',
                'victims_girls', t23[20].get(s), 'count', '2A.3', 'Female victims under 18.')
            add(s, y, 'MURDER_ALL', 'killed', 'All murder victims', '302', '103',
                'victims', t23[46].get(s), 'count', '2A.3', 'Male, female and transgender victims together.')
        # Rape victims by age: table 3A.3
        t33 = load(y, '3A.3')
        bands = [(4, 'victims_under6'), (5, 'victims_6_12'), (6, 'victims_12_16'), (7, 'victims_16_18'),
                 (8, 'victims_girls'), (9, 'victims_18_30'), (10, 'victims_30_45'), (11, 'victims_45_60'),
                 (12, 'victims_60plus'), (13, 'victims_women'), (14, 'victims')]
        for s in ROWKEYS:
            for c, m in bands:
                add(s, y, 'RAPE_VICTIMS_AGE', 'sexual', 'Victims of rape by age (s.376 IPC / BNS 64-70)', '376', '64-70',
                    m, t33[c].get(s), 'count', '3A.3', 'Excludes POCSO cases.')
        # What police did: table 3A.6 (all crimes against women together)
        t36 = load(y, '3A.6')
        pol = [(4, 'reported', 'count'), (6, 'total_for_investigation', 'count'), (11, 'final_report_false', 'count'),
               (13, 'final_report_true_insufficient_evidence', 'count'), (18, 'chargesheeted', 'count'),
               (19, 'disposed_by_police', 'count'), (22, 'pending_investigation_end_of_year', 'count'),
               (23, 'chargesheeting_rate', 'percent'), (24, 'police_pendency', 'percent')]
        for s in ROWKEYS:
            for c, m, u in pol:
                add(s, y, 'POLICE', 'outcome', 'Police disposal, all crimes against women', None, None,
                    m, t36[c].get(s), u, '3A.6', 'All crime heads together. NCRB does not publish this by state for each crime.')
        # What courts did: table 3A.8
        t38 = load(y, '3A.8')
        crt = [(5, 'total_for_trial', 'count'), (15, 'convicted', 'count'), (16, 'discharged', 'count'),
               (17, 'acquitted', 'count'), (18, 'trials_completed', 'count'), (20, 'pending_trial_end_of_year', 'count'),
               (21, 'conviction_rate', 'percent'), (22, 'court_pendency', 'percent')]
        for s in ROWKEYS:
            for c, m, u in crt:
                add(s, y, 'COURTS', 'outcome', 'Court disposal, all crimes against women', None, None,
                    m, t38[c].get(s), u, '3A.8', 'All crime heads together. Trials completed in a year mostly began in earlier years.')
        # National outcomes for single crime heads: tables 3A.5 and 3A.7.
        # NCRB publishes these for India as a whole only.
        txt = open(os.path.join(RAW, f'cii{y}_v1.txt'), encoding='utf-8').read()
        t35 = P.parse_heads_table(txt, '3A.5')
        t37 = P.parse_heads_table(txt, '3A.7')
        def find(tab, test):
            labs = [l for l in tab[3] if test(l)]
            if len(labs) != 1:
                raise SystemExit(f'{y}: expected one row, found {labs}')
            return labs[0]
        top = lambda name: (lambda l: re_top(l) == name)
        pick = {'RAPE': top('Rape'), 'MURDER_RAPE': top('Murder with Rape/Gang Rape'),
                'DOWRY_DEATH': top('Dowry Deaths'), 'CRUELTY': top('Cruelty by Husband or his relatives'),
                'POCSO_TOTAL': lambda l: re_top(l).startswith('Protection of Children from Sexual'),
                'POCSO_RAPE': lambda l: l.split(' ', 1)[0].endswith('.1') and 'POCSO Act Section 4' in l,
                'TOTAL': lambda l: l == 'Total Crime against Women'}
        for code, test in pick.items():
            head = next(h for h in HEADS if h[0] == code)
            lp, lc = find(t35, test), find(t37, test)
            for c, m, u in pol:
                add('All India', y, code, 'outcome', head[2], head[3], head[4], 'police_' + m,
                    t35[c][lp], u, '3A.5', 'India as a whole. NCRB does not publish this by state for each crime.')
            for c, m, u in crt:
                add('All India', y, code, 'outcome', head[2], head[3], head[4], 'court_' + m,
                    t37[c][lc], u, '3A.7', 'India as a whole. Trials completed in a year mostly began in earlier years.')
        # Who the offender was: 3A.4 (rape) and 4A.10 (POCSO s.4 and 6, girls and boys).
        # The two tables print the two middle groups in opposite order, checked against
        # the printed column headers of every edition from 2020 to 2024.
        rel = {'3A.4': ('RAPE_OFFENDER', "Rape cases by the offender's relation to the victim (s.376 IPC / BNS 64-70)", '376', '64-70',
                        {5: 'known_partner', 6: 'known_acquaintance'},
                        'Women and girls. known_partner: friends, online friends, live-in partners or men who promised marriage, and separated husbands. known_acquaintance: family friends, neighbours, employers and other known persons.'),
               '4A.10': ('POCSO_OFFENDER', "POCSO s.4 and 6 cases by the offender's relation to the child", None, 'POCSO Act s.4 and 6',
                         {5: 'known_acquaintance', 6: 'known_partner'},
                         'Child victims, girls and boys (NCRB chapter 4A), so the total is above the POCSO figure in the chapter on crimes against women. known_partner: friends, online friends, or live-in partners or men who promised marriage. known_acquaintance: family friends, neighbours, employers and other known persons.')}
        for t, (code, label, ipc, bns, mid, note) in rel.items():
            tr = load(y, t)
            for st in ROWKEYS:
                if (tr[3][st] or 0) != sum(tr[c][st] or 0 for c in (4, 5, 6)) or (tr[8][st] or 0) != (tr[3][st] or 0) + (tr[7][st] or 0):
                    raise SystemExit(f'{y} {t} {st}: known cases do not add up')
                for c, m in [(3, 'cases_known'), (4, 'known_family'), (5, mid[5]), (6, mid[6]), (7, 'cases_unknown'), (8, 'cases')]:
                    add(st, y, code, 'sexual', label, ipc, bns, m, tr[c][st], 'count', t, note)
                add(st, y, code, 'sexual', label, ipc, bns, 'known_share', tr[9][st], 'percent', t, 'Share of cases in which the offender was known to the victim, as printed by NCRB.')
        # Girls' ages in POCSO s.4 and 6 cases: 4A.9, from the chapter on crimes against children.
        # 2020 prints Boys, Girls, Total per band; from 2021 a Transgender column sits between.
        t49 = load(y, '4A.9')
        step = 3 if y == 2020 else 4
        bands = ['victims_under6', 'victims_6_12', 'victims_12_16', 'victims_16_18', 'victims']
        gcol = {m: 4 + i * step for i, m in enumerate(bands)}
        for st in ROWKEYS:
            if abs(sum(t49[gcol[m]][st] or 0 for m in bands[:4]) - (t49[gcol['victims']][st] or 0)) > 0.5:
                raise SystemExit(f'{y} 4A.9 {st}: the age bands do not add to all girl victims')
            for m in bands:
                add(st, y, 'POCSO_VICTIMS_AGE', 'sexual', 'Girl victims of penetrative sexual assault under POCSO s.4 and 6, by age', None, 'POCSO Act s.4 and 6',
                    m, t49[gcol[m]][st], 'count', '4A.9', 'Girls only, from NCRB chapter 4A (crimes against children). The total equals the girl victims of POCSO s.4 and 6 in chapter 3A.')
        # Rape of Scheduled Caste and Scheduled Tribe women and girls: NCRB Volume 2,
        # chapters 7A and 7C, from 2021 (the 2020 Volume 2 is not held here). The heading
        # is rape booked under the IPC or BNS read with the SC/ST (Prevention of Atrocities) Act.
        if str(y) in SOURCE_V2:
            for code, ch, who in (('RAPE_SC', '7A', 'Scheduled Caste'), ('RAPE_ST', '7C', 'Scheduled Tribe')):
                label = f'Rape of {who} women and girls (IPC/BNS r/w SC/ST (Prevention of Atrocities) Act)'
                src = SOURCE_V2[str(y)]
                pol, crt = load_v2(y, ch + '.3', True), load_v2(y, ch + '.5', True)
                rk = {'': r'^1A\.\d+ Rape$', '_women': r'^1A\.\d+(A|\.1) Rape of Women$', '_children': r'^1A\.\d+(B|\.2) Rape of Children$'}
                rk = {k: (head_row(pol, v), head_row(crt, v)) for k, v in rk.items()}
                for k, (rp, rc) in rk.items():
                    # NCRB prints the rates; recompute them from the counts beside them
                    csr = pol[18][rp] / pol[19][rp] * 100
                    conv = crt[15][rc] / crt[18][rc] * 100
                    if abs(csr - pol[23][rp]) > 0.06 or abs(conv - crt[21][rc]) > 0.06:
                        raise SystemExit(f'{y} {code}{k}: printed rates do not match their counts')
                if abs(pol[4][rk['_women'][0]] + pol[4][rk['_children'][0]] - pol[4][rk[''][0]]) > 0.5:
                    raise SystemExit(f'{y} {code}: rape of women and of children do not add to all rape')
                rp, rc = rk['']
                note = f'Rape of {who} women and girls, as NCRB records it in chapter {ch} of Volume 2.'
                for m, (t, n, r) in {'cases': (pol, 4, rp), 'chargesheeting_rate': (pol, 23, rp), 'trials_completed': (crt, 18, rc),
                                     'convicted': (crt, 15, rc), 'conviction_rate': (crt, 21, rc), 'pending_trial': (crt, 20, rc),
                                     'pendency_pct': (crt, 22, rc)}.items():
                    unit = 'percent' if m.endswith(('_rate', '_pct')) else 'count'
                    add('All India', y, code, 'sexual', label, '376', '64-70', m, t[n][r], unit, ch + ('.3' if t is pol else '.5'), note, src=src)
                add('All India', y, code, 'sexual', label, '376', '64-70', 'cases_women', pol[4][rk['_women'][0]], 'count', ch + '.3', 'Women 18 and over.', src=src)
                add('All India', y, code, 'sexual', label, '376', '64-70', 'cases_children', pol[4][rk['_children'][0]], 'count', ch + '.3', 'Girls under 18. NCRB labels the heading Rape of Children.', src=src)
                # Only the total column is read and checked. In 2024, 7A.2 prints Chhattisgarh's
                # IPC rape cases as 100 beside BNS 32 and a total of 119, so its IPC column
                # does not add up; the total does, and matches 7A.3.
                st = load_v2(y, ch + '.2')[10 if y == 2024 else 87]
                if P.check_totals(st):
                    raise SystemExit(f'{y} {ch}.2: the states do not add to the printed totals: {P.check_totals(st)}')
                if st['All India'] != pol[4][rp]:
                    raise SystemExit(f'{y} {code}: the state table ({st["All India"]}) and the crime-head table ({pol[4][rp]}) disagree')
                for place in ROWKEYS:
                    if place == 'All India': continue
                    add(place, y, code, 'sexual', label, '376', '64-70', 'cases', st[place], 'count', ch + '.2', note, src=src)
        # Rape by section: 3A.11. IPC sections to 2023, BNS from 2024, mapped head by head.
        t311 = load(y, '3A.11')
        if y < 2024:
            sec = {'by_police': [5], 'by_public_servant': [6], 'by_armed_forces': [7], 'by_jail_staff': [8], 'by_hospital_staff': [9],
                   'by_relative_trust': [11], 'gang_rape': [25, 26, 27], 'causing_death': [21], 'by_separated_husband': [22],
                   'repeat_offender': [28], 'cases': [29]}
        else:
            sec = {'by_police': [5], 'by_public_servant': [6], 'by_armed_forces': [7], 'by_jail_staff': [8], 'by_hospital_staff': [9],
                   'by_relative_trust': [10], 'gang_rape': [24], 'causing_death': [21], 'by_separated_husband': [22],
                   'repeat_offender': [27], 'cases': [28]}
        # every case sits in exactly one top-level column, which is what lets the page say so
        top = [3, 4, 18, 21, 22, 23, 24, 27] if y == 2024 else [3, 4, 10] + list(range(20, 29))
        for st in ROWKEYS:
            if abs(sum(t311[c][st] or 0 for c in top) - (t311[sec['cases'][0]][st] or 0)) > 0.5:
                raise SystemExit(f'{y} 3A.11 {st}: the sections do not add to all rape cases')
        for st in ROWKEYS:
            for m, cols in sec.items():
                note = {'gang_rape': 'IPC 376D, 376DA and 376DB added together to 2023; BNS 70 from 2024.',
                        'causing_death': 'Rape causing death or a persistent vegetative state: IPC 376A, BNS 66.',
                        'by_relative_trust': 'By a relative, guardian, teacher or person in a position of trust: IPC 376(2)(f), BNS 64(2)(f).',
                        'cases': 'All rape cases, as the total of the section-wise table.'}.get(m, 'IPC 376(2)(a) to (e), BNS 64(2)(a) to (e).')
                add(st, y, 'RAPE_SECTION', 'sexual', 'Rape cases by section of law (s.376 IPC / BNS 64-71)', '376', '64-71',
                    m, sum(t311[c][st] or 0 for c in cols), 'count', '3A.11', note)
        # Persons arrested to persons convicted: 3A.10 by state (all crimes against women),
        # 3A.9 for India by crime head. 2020 has no transgender columns, so the totals sit elsewhere.
        pcol = ({'persons_arrested': 5, 'persons_arrested_female': 4, 'persons_chargesheeted': 8, 'persons_convicted': 11,
                 'persons_convicted_female': 10, 'persons_discharged': 14, 'persons_acquitted': 17} if y == 2020 else
                {'persons_arrested': 6, 'persons_arrested_female': 4, 'persons_chargesheeted': 10, 'persons_convicted': 14,
                 'persons_convicted_female': 12, 'persons_discharged': 18, 'persons_acquitted': 22})
        t310 = load(y, '3A.10')
        for st in ROWKEYS:
            for m, c in pcol.items():
                add(st, y, 'PERSONS', 'outcome', 'Persons arrested, charge-sheeted and tried, all crimes against women', None, None,
                    m, t310[c][st], 'count', '3A.10', 'Persons, not cases. People convicted, discharged or acquitted in a year were mostly arrested in earlier years.')
        t39 = P.parse_heads_table(txt, '3A.9')
        # Later pages print the row labels without their numbers, so rows are matched by
        # position, and every row's sexes must add to its printed total for each stage.
        labs39 = list(t39[3])
        t39 = {c: dict(zip(labs39, col.values())) for c, col in t39.items()}
        grp = [(3, 5)] + [(c - 2, c) for c in (8, 11, 14, 17)] if y == 2020 else [(c - 3, c) for c in (6, 10, 14, 18, 22)]
        for lab in labs39:
            for a, tot in grp:
                if sum(t39[c][lab] or 0 for c in range(a, tot)) != (t39[tot][lab] or 0):
                    raise SystemExit(f'{y} 3A.9 {lab}: sexes do not add to the total in col {tot}')
        for code, test in pick.items():
            head = next(h for h in HEADS if h[0] == code)
            lp = find(t39, test)
            for m, c in pcol.items():
                add('All India', y, code, 'outcome', head[2], head[3], head[4], m, t39[c][lp], 'count', '3A.9',
                    'India as a whole. Persons, not cases. People convicted in a year were mostly arrested in earlier years.')
        # The 19 cities of two million people or more: table 3B.1. Each edition prints three
        # years; only its own year is taken. NCRB's rate divides by the city's 2011 census
        # population, so it is kept apart from the state rates.
        cities = P.parse_cities(txt)
        tot = cities.pop('Total cities')
        if len(cities) != 19 or any(abs(sum(v[i] for v in cities.values()) - tot[i]) > 0.5 for i in range(3)):
            raise SystemExit(f'{y} 3B.1: cities do not add to the total')
        for name, v in list(cities.items()) + [('Total, 19 cities', tot)]:
            for m, val, unit in (('cases', v[2], 'count'), ('population_lakh_2011', v[3], 'lakh'),
                                 ('rate_2011pop', v[4], 'rate'), ('chargesheeting_rate', v[5], 'percent')):
                add(name, y, 'CITY', 'city', 'Crimes against women in cities of two million or more', None, None, m, val, unit, '3B.1',
                    'The rate is cases per lakh of the 2011 census population NCRB prints for the city, so it does not allow for growth since 2011.')
                out[-1]['kind'] = 'city'
    old_rows(add)
    return out

# ---------- 2014 to 2019 ----------
OLD = os.path.join(RAW, 'old')
# Headings that exist only in the older tables, or whose definition differs
# from the 2020-2024 one, keep a code of their own so no series joins
# figures that count different things. (group, label, ipc, act)
OLD_HEADS = {
 'RAPE_2016DEF': ('sexual', 'Rape, 2016 definition: includes POCSO s.4 and 6 cases booked with s.376', '376', 'POCSO s.4, 6'),
 'IPC_TOTAL_2016DEF': ('total', 'All IPC crimes against women, 2016 definition (13 heads)', None, None),
 'SLL_TOTAL_2016DEF': ('total', 'All special and local law crimes against women, 2016 definition (no POCSO)', None, None),
 'TOTAL_2016DEF': ('total', 'All crimes against women, 2016 definition (no POCSO, no murder with rape)', None, None),
 'RAPE_VICTIMS_AGE_2016DEF': ('sexual', 'Victims of rape by age, 2016 definition (child bands include POCSO s.4 and 6)', '376', 'POCSO s.4, 6'),
 'ACID_INCL_ATTEMPT': ('other', 'Acid attack and attempted acid attack together (2016 heading)', '326A, 326B', None),
 'CYBER_67A': ('other', 'Publishing or transmitting sexually explicit material, IT Act s.67A (2016 heading)', None, 'IT Act s.67A'),
 'TOTAL_2014DEF': ('total', 'All crimes against women, 2014-2015 definition (14 heads, no POCSO, cyber, trafficking, acid or murder with rape)', None, None),
 'KIDNAP_2014DEF': ('other', 'Kidnapping and abduction of women, 2014-2015 definition (363, 364, 364A, 366 and others)', '363-366', None),
 'ABETMENT_SUICIDE_2014DEF': ('killed', 'Abetment of suicide of women, s.306 only', '306', None),
 'MURDER_WOMEN_2014DEF': ('killed', 'Women murdered, 2014-2015 definition (female column includes transgender victims)', '302', None),
 'RAPE_VICTIMS_AGE_2014DEF': ('sexual', 'Victims of rape by age, 2014 rows that include POCSO (Tamil Nadu, Meghalaya and the totals)', '376', None),
 'RAPE_VICTIMS_AGE_INCEST_2014DEF': ('sexual', 'Victims of incest rape by age', '376', None),
 'RAPE_VICTIMS_AGE_NONINCEST_2014DEF': ('sexual', 'Victims of rape other than incest, by age', '376', None),
 'RAPE_CUSTODIAL_2014DEF': ('sexual', 'Custodial rape', '376(2)', None),
 'RAPE_CUSTODIAL_GANG_2014DEF': ('sexual', 'Custodial gang rape', '376(2), 376D', None),
 'RAPE_CUSTODIAL_OTHER_2014DEF': ('sexual', 'Custodial rape, other than gang rape', '376(2)', None),
 'RAPE_NONCUSTODIAL_2014DEF': ('sexual', 'Rape other than custodial', '376', None),
 'RAPE_NONCUSTODIAL_GANG_2014DEF': ('sexual', 'Gang rape other than custodial', '376D', None),
 'RAPE_NONCUSTODIAL_OTHER_2014DEF': ('sexual', 'Rape other than custodial or gang rape', '376', None),
 'SEXUAL_HARASSMENT_2014DEF': ('sexual', 'Sexual harassment', '354A', '75'),
 'DISROBE_2014DEF': ('sexual', 'Assault with intent to disrobe', '354B', '76'),
 'VOYEURISM_2014DEF': ('sexual', 'Voyeurism', '354C', '77'),
 'STALKING_2014DEF': ('sexual', 'Stalking', '354D', '78'),
 'ASSAULT_MODESTY_OTHERS_2014DEF': ('sexual', 'Assault to outrage modesty, other than 354A-D', '354', '74'),
 'INSULT_OFFICE_2014DEF': ('sexual', 'Insult to modesty, at the office', '509', '79'),
 'INSULT_WORK_2014DEF': ('sexual', 'Insult to modesty, at other work places', '509', '79'),
 'INSULT_TRANSPORT_2014DEF': ('sexual', 'Insult to modesty, in public transport', '509', '79'),
 'INSULT_OTHER_2014DEF': ('sexual', 'Insult to modesty, other places', '509', '79'),
 'KIDNAP_363_2014DEF': ('other', 'Kidnapping (s.363)', '363', None),
 'KIDNAP_MURDER_2014DEF': ('other', 'Kidnapping or abduction in order to murder (s.364)', '364', None),
 'KIDNAP_RANSOM_2014DEF': ('other', 'Kidnapping for ransom (s.364A)', '364A', None),
 'KIDNAP_MARRIAGE_2014DEF': ('other', 'Kidnapping or abduction to compel marriage (s.366)', '366', '87'),
 'KIDNAP_OTHERS_2014DEF': ('other', 'Kidnapping and abduction, other', None, None),
 'IMPORT_GIRLS_2014DEF': ('other', 'Importation of girls from a foreign country (s.366B)', '366B', None),
 'INDECENT_REP_2014DEF': ('other', 'Indecent Representation of Women (Prohibition) Act', None, 'IRWA 1986'),
 'SATI_2014DEF': ('other', 'Commission of Sati (Prevention) Act', None, 'Sati Act 1987'),
 'ITPA_S5_2014DEF': ('other', 'Immoral Traffic (Prevention) Act s.5', None, 'ITPA s.5'),
 'ITPA_S6_2014DEF': ('other', 'Immoral Traffic (Prevention) Act s.6', None, 'ITPA s.6'),
 'ITPA_S7_2014DEF': ('other', 'Immoral Traffic (Prevention) Act s.7', None, 'ITPA s.7'),
 'ITPA_S8_2014DEF': ('other', 'Immoral Traffic (Prevention) Act s.8', None, 'ITPA s.8'),
 'ITPA_OTHER_2014DEF': ('other', 'Immoral Traffic (Prevention) Act, other sections', None, 'ITPA'),
}
FIXED = {'FEMALE_POP': ('denominator', 'Female population, mid-year projection', None, None),
         'MURDER_WOMEN': ('killed', 'Women and girls murdered (all motives)', '302', '103'),
         'MURDER_ALL': ('killed', 'All murder victims', '302', '103'),
         'RAPE_VICTIMS_AGE': ('sexual', 'Victims of rape by age (s.376 IPC / BNS 64-70)', '376', '64-70'),
         'POLICE': ('outcome', 'Police disposal, all crimes against women', None, None),
         'COURTS': ('outcome', 'Court disposal, all crimes against women', None, None)}
RENAME_2016 = {'RAPE': 'RAPE_2016DEF', 'IPC_TOTAL': 'IPC_TOTAL_2016DEF', 'SLL_TOTAL': 'SLL_TOTAL_2016DEF',
               'TOTAL': 'TOTAL_2016DEF', 'ABETMENT_SUICIDE': 'ABETMENT_SUICIDE_2014DEF', 'RAPE_VICTIMS_AGE': 'RAPE_VICTIMS_AGE_2016DEF'}
EDITION = {2014: 'Crime in India 2014, chapter 5 tables', 2015: 'Crime in India 2015, chapter 5 tables',
           2016: 'Crime in India 2016, complete publication', 2017: 'Crime in India 2017, Volume 1',
           2018: 'Crime in India 2018, Volume 1', 2019: 'Crime in India 2019, Volume 1'}
OLD_STATES = P.STATES[:28] + ['Jammu & Kashmir']
OLD_UTS = ['A&N Islands', 'Chandigarh', 'D&N Haveli', 'Daman & Diu', 'Delhi', 'Lakshadweep', 'Puducherry']

def unit_of(measure):
    if measure == 'population_lakh': return 'lakh women'
    if measure == 'rate': return 'rate'
    if 'rate' in measure or 'pendency' in measure: return 'percent'
    return 'count'

def old_rows(add):
    srcs = {m['file']: m for m in json.load(open(os.path.join(OLD, 'sources.json')))}
    raw = []
    for f in ('ncrb_2014_2015.csv', 'ncrb_2016_2019.csv'):
        raw += list(csv.DictReader(open(os.path.join(OLD, f), encoding='utf-8')))
    cell, chk = {}, {}
    for r in raw:
        cell[(int(r['year']), r['code'], r['measure'], r['state'])] = r
        # 2014 rape survivors by age are split over two codes by NCRB's own footnote
        # (Tamil Nadu, Meghalaya and the totals include POCSO), so they are checked together
        cc = 'RAPE_VICTIMS_AGE' if r['code'] == 'RAPE_VICTIMS_AGE_2014DEF' else r['code']
        chk[(int(r['year']), cc, r['measure'], r['state'])] = r
    # The states and UTs as printed must add to NCRB's totals before anything is merged.
    keys = {(y, c, m) for (y, c, m, s) in chk}
    for y, c, m in sorted(keys):
        if unit_of(m) != 'count' and m != 'population_lakh':
            continue
        if (y, c, m, 'Total states') not in chk:
            continue
        val = lambda s: float(chk[(y, c, m, s)]['value'] or 0) if (y, c, m, s) in chk else 0.0
        tol = 0.05 * 29 if m == 'population_lakh' else 0.5
        for part, total in ((OLD_STATES, 'Total states'), (OLD_UTS, 'Total UTs')):
            if (y, c, m, total) in chk and chk[(y, c, m, total)]['value'] != '' and abs(sum(val(s) for s in part) - val(total)) > tol:
                raise SystemExit(f'{y} {c} {m}: rows do not add to {total}')
    done = set()
    for r in raw:
        y, c, m, s = int(r['year']), r['code'], r['measure'], r['state']
        if y == 2016 and c in RENAME_2016:
            c = RENAME_2016[c]
        meta = OLD_HEADS.get(c) or FIXED.get(c) or next(((h[1], h[2], h[3], h[4]) for h in HEADS if h[0] == c), None)
        if meta is None:
            raise SystemExit(f'no label for {c}')
        group, label, ipc, bns = meta
        f = srcs[os.path.basename(r['source_file'])]
        src = {'url': f['url'], 'sha256': f['sha256'], 'edition': EDITION[y]}
        u = unit_of(m)
        extra = ['BOUNDARIES_PRE_2020']
        note = re.sub(r'^Col\. ?[\dA-Za-z]+\.?\s*', '', r['note']).strip()
        if s == 'Jammu & Kashmir':
            note = ('Includes Ladakh, which NCRB counted with Jammu and Kashmir until 2019. ' + note).strip()
        if s == 'West Bengal' and y == 2019:
            extra.append('WB_2019_REPEATS_2018')
        if s in ('D&N Haveli', 'Daman & Diu'):
            key = (y, c, m)
            if key in done:
                continue
            done.add(key)
            a, b = cell.get((int(r['year']), r['code'], m, 'D&N Haveli')), cell.get((int(r['year']), r['code'], m, 'Daman & Diu'))
            if u == 'rate':
                ca = (cell.get((int(r['year']), r['code'], 'cases', 'D&N Haveli')) or {}).get('value')
                cb = (cell.get((int(r['year']), r['code'], 'cases', 'Daman & Diu')) or {}).get('value')
                pa = (cell.get((int(r['year']), 'FEMALE_POP', 'population_lakh', 'D&N Haveli')) or {}).get('value')
                pb = (cell.get((int(r['year']), 'FEMALE_POP', 'population_lakh', 'Daman & Diu')) or {}).get('value')
                v = round((float(ca) + float(cb)) / (float(pa) + float(pb)), 1) if ca not in (None, '') and cb not in (None, '') and pa and pb else None
                note = 'Computed here: cases per lakh women for Dadra and Nagar Haveli and Daman and Diu together, which NCRB printed separately before 2020.'
            elif u == 'percent':
                v = None
                note = 'Not computed: NCRB printed Dadra and Nagar Haveli and Daman and Diu separately before 2020, and a percentage cannot be added.'
            else:
                va = a['value'] if a else ''
                vb = b['value'] if b else ''
                v = None if va == '' and vb == '' else float(va or 0) + float(vb or 0)
                note = 'Sum of Dadra and Nagar Haveli and of Daman and Diu, which NCRB printed separately before 2020.'
            add('D&N Haveli and Daman & Diu', y, c, group, label, ipc, bns, m, v, u, r['table_no'], note, src, extra)
            continue
        v = None if r['value'] == '' else float(r['value'])
        add(s, y, c, group, label, ipc, bns, m, v, u, r['table_no'], note, src, extra)

def re_top(label):
    import re
    return re.sub(r'^\d+\s+', '', label) if re.match(r'^\d+\s', label) else ''

FIELDS = ['state', 'lgd_code', 'kind', 'year', 'crime_code', 'group', 'crime_head', 'ipc_section',
          'bns_section_or_act', 'measure', 'value', 'unit', 'source_edition', 'table_no',
          'source_url', 'source_sha256', 'flag', 'note']

def render(rs):
    buf = io.StringIO()
    w = csv.DictWriter(buf, FIELDS, lineterminator='\n')
    w.writeheader()
    w.writerows(rs)
    return buf.getvalue()

if __name__ == '__main__':
    text = render(rows())
    if '--check' in sys.argv:
        if open(OUT, encoding='utf-8').read() != text:
            raise SystemExit('data/womenonrecord.csv is stale: run python3 scripts/build_data.py')
        print('PASS: data/womenonrecord.csv is current')
    else:
        open(OUT, 'w', encoding='utf-8').write(text)
        print('wrote', OUT, text.count('\n') - 1, 'rows')
