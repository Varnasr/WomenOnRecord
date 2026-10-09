"""Extract NCRB Crime in India 2014 and 2015, chapter 5 (and table 3.3), into one long CSV,
running every check. Writes ../out1415.csv and checks.json (results used by the report)."""
import csv, hashlib, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import oldparse as P

HERE = os.path.dirname(os.path.abspath(__file__))
OLD = os.path.dirname(HERE)
DL = os.path.join(OLD, 'dl')
TXT = os.path.join(HERE, 'txt')

FILES = {
    (2014, '5.1'): '2014_Table-5.1_2014', (2014, '5.2'): '2014_Table-5.2_2014',
    (2014, '5.3'): '2014_Table-5.3_2014', (2014, '5.5'): '2014_Table-5.5_2014',
    (2014, '5.6'): '2014_Table-5.6_2017', (2014, '3.3'): '2014_Table-3.3_2014',
    (2015, '5.1'): '2015_Table-5.1_2015', (2015, '5.2'): '2015_Table-5.2_2015',
    (2015, '5.3'): '2015_Table-5.3_2015', (2015, '5.5'): '2015_Table-5.5_2015',
    (2015, '5.6'): '2015_Table-5.6_2015', (2015, '3.3'): '2015_Table-3.3_2015',
}
SHA = {k: hashlib.sha256(open(os.path.join(DL, v + '.pdf'), 'rb').read()).hexdigest() for k, v in FILES.items()}

def text(y, t):
    return open(os.path.join(TXT, FILES[(y, t)] + '.txt'), encoding='utf-8').read()

checks = []   # (year, table, check, result, detail)
def chk(y, t, name, ok, detail='', kind='check'):
    checks.append({'year': y, 'table': t, 'check': name, 'pass': bool(ok), 'detail': detail, 'kind': kind})

# ---------------------------------------------------------------- 5.2 coding
SAME = 'same'
# (code, first column (I), label, definition note or SAME)
H52 = [
 ('RAPE', 4, 'Rape (Sec. 376 IPC), total', SAME),
 ('RAPE_CUSTODIAL_2014DEF', 7, 'Custodial rape, total', 'Sub-head of 376 not coded by the site for 2020-2024.'),
 ('RAPE_CUSTODIAL_GANG_2014DEF', 10, 'Custodial gang rape', 'Sub-head not coded by the site.'),
 ('RAPE_CUSTODIAL_OTHER_2014DEF', 13, 'Custodial other rape', 'Sub-head not coded by the site.'),
 ('RAPE_NONCUSTODIAL_2014DEF', 16, 'Rape other than custodial, total', 'Sub-head not coded by the site.'),
 ('RAPE_NONCUSTODIAL_GANG_2014DEF', 19, 'Rape other than custodial, gang rape', 'Sub-head not coded by the site.'),
 ('RAPE_NONCUSTODIAL_OTHER_2014DEF', 22, 'Rape other than custodial, other rape', 'Sub-head not coded by the site.'),
 ('ATTEMPT_RAPE', 25, 'Attempt to commit rape (Sec. 376/511 IPC)', SAME),
 ('KIDNAP_2014DEF', 28, 'Kidnapping & abduction of women, total (Sec. 363, 364, 364A, 366 IPC)', 'Narrower than the 2020 KIDNAP total, which also carries procuration of minor girls (366A), importation of girls (366B) and other sections (363A, 365, 367, 368, 369). Importation (366B) is a separate head here.'),
 ('KIDNAP_363_2014DEF', 31, 'K&A of female (Sec. 363 IPC)', 'Sub-head of KIDNAP_2014DEF.'),
 ('KIDNAP_MURDER_2014DEF', 34, 'K&A in order to murder, female (Sec. 364 IPC)', 'Sub-head of KIDNAP_2014DEF.'),
 ('KIDNAP_RANSOM_2014DEF', 37, 'K&A for ransom, female (Sec. 364A IPC)', 'Sub-head of KIDNAP_2014DEF.'),
 ('KIDNAP_MARRIAGE_2014DEF', 40, 'K&A of women to compel her for marriage (Sec. 366 IPC)', 'Sub-head of KIDNAP_2014DEF.'),
 ('KIDNAP_OTHERS_2014DEF', 43, 'K&A (female) others', 'Sub-head of KIDNAP_2014DEF; sections not printed.'),
 ('DOWRY_DEATH', 46, 'Dowry deaths (Sec. 304B IPC)', SAME),
 ('ASSAULT_MODESTY', 49, 'Assault on women with intent to outrage her modesty (Sec. 354 IPC), total incl. 354A-D', SAME),
 ('SEXUAL_HARASSMENT_2014DEF', 52, 'Sexual harassment (Sec. 354A IPC)', 'Sub-head of ASSAULT_MODESTY, not coded by the site.'),
 ('DISROBE_2014DEF', 55, 'Assault or use of criminal force to women with intent to disrobe (Sec. 354B IPC)', 'Sub-head of ASSAULT_MODESTY.'),
 ('VOYEURISM_2014DEF', 58, 'Voyeurism (Sec. 354C IPC)', 'Sub-head of ASSAULT_MODESTY.'),
 ('STALKING_2014DEF', 61, 'Stalking (Sec. 354D IPC)', 'Sub-head of ASSAULT_MODESTY.'),
 ('ASSAULT_MODESTY_OTHERS_2014DEF', 64, 'Assault on women with intent to outrage her modesty, others', 'Sub-head of ASSAULT_MODESTY.'),
 ('INSULT_MODESTY', 67, 'Insult to the modesty of women (Sec. 509 IPC), total', SAME),
 ('INSULT_OFFICE_2014DEF', 70, 'Insult to modesty, at office premises', 'Sub-head of INSULT_MODESTY.'),
 ('INSULT_WORK_2014DEF', 73, 'Insult to modesty, other places related to work', 'Sub-head of INSULT_MODESTY.'),
 ('INSULT_TRANSPORT_2014DEF', 76, 'Insult to modesty, in public transport system', 'Sub-head of INSULT_MODESTY.'),
 ('INSULT_OTHER_2014DEF', 79, 'Insult to modesty, places other than previous columns', 'Sub-head of INSULT_MODESTY.'),
 ('CRUELTY', 82, 'Cruelty by husband or his relatives (Sec. 498A IPC)', SAME),
 ('IMPORT_GIRLS_2014DEF', 85, 'Importation of girls from foreign country, up to 21 years (Sec. 366B IPC)', 'A separate head here; inside the KIDNAP total in 2020. Not coded by the site.'),
 ('ABETMENT_SUICIDE_2014DEF', 88, 'Abetment of suicide of women (Sec. 306 IPC)', 'Sec. 306 only; the 2020 head is Sec. 305/306.'),
 ('DOWRY_ACT', 91, 'Dowry Prohibition Act, 1961', SAME),
 ('INDECENT_REP_2014DEF', 94, 'Indecent Representation of Women (Prohibition) Act, 1986', 'Not coded by the site.'),
 ('SATI_2014DEF', 97, 'Commission of Sati Prevention Act, 1987', 'Not coded by the site.'),
 ('PWDVA', 100, 'Protection of Women from Domestic Violence Act, 2005', SAME),
 ('ITPA', 103, 'Immoral Traffic (Prevention) Act, total (women cases)', SAME),
 ('ITPA_S5_2014DEF', 106, 'ITP Act section 5', 'Sub-head of ITPA.'),
 ('ITPA_S6_2014DEF', 109, 'ITP Act section 6', 'Sub-head of ITPA.'),
 ('ITPA_S7_2014DEF', 112, 'ITP Act section 7', 'Sub-head of ITPA.'),
 ('ITPA_S8_2014DEF', 115, 'ITP Act section 8', 'Sub-head of ITPA.'),
 ('ITPA_OTHER_2014DEF', 118, 'ITP Act other sections', 'Sub-head of ITPA.'),
 ('TOTAL_2014DEF', 121, 'Total crimes against women (14 heads)', 'Excludes POCSO, IT Act (cyber), human trafficking (370), acid attack, murder with rape, miscarriage, procuration/selling/buying of minor girls, which the 2020 TOTAL includes.'),
]
RAPE_STATE_NOTE = {'Tamil Nadu': 'NCRB footnote (Table 5.3): figures of rape (Sec 376 IPC) also include figures of POCSO Act as furnished by Tamil Nadu and Meghalaya.',
                   'Meghalaya': 'NCRB footnote (Table 5.3): figures of rape (Sec 376 IPC) also include figures of POCSO Act as furnished by Tamil Nadu and Meghalaya.'}

HEADROW = {'1': 'RAPE', '2': 'ATTEMPT_RAPE', '3': 'KIDNAP_2014DEF', '4': 'DOWRY_DEATH', '5': 'ASSAULT_MODESTY',
           '6': 'INSULT_MODESTY', '7': 'CRUELTY', '8': 'IMPORT_GIRLS_2014DEF', '9': 'ABETMENT_SUICIDE_2014DEF',
           '10': 'DOWRY_ACT', '11': 'INDECENT_REP_2014DEF', '12': 'SATI_2014DEF', '13': 'PWDVA', '14': 'ITPA',
           'TOTAL': 'TOTAL_2014DEF'}

POL = {2014: [(3, 'police_pending_from_previous_year', 'count'), (4, 'police_reported', 'count'),
              (5, 'police_withdrawn_by_govt', 'count'), (6, 'police_transferred', 'count'),
              (7, 'police_total_for_investigation_2014def', 'count'), (8, 'police_not_investigated_157_1_b', 'count'),
              (9, 'police_final_report_false', 'count'), (10, 'police_final_report_mistake_of_fact_or_law', 'count'),
              (11, 'police_final_report_non_cognizable', 'count'), (12, 'police_chargesheeted', 'count'),
              (13, 'police_final_report_true_insufficient_evidence', 'count'),
              (14, 'police_disposed_by_police_2014def', 'count'), (15, 'police_pending_investigation_end_of_year', 'count'),
              (16, 'police_chargesheeting_rate_2014def', 'percent'), (17, 'police_police_pendency_2014def', 'percent')]}
POL[2015] = [(7, 'police_not_investigated_157_1_b', 'count') if m == 'police_total_for_investigation_2014def' else
             (8, 'police_total_for_investigation_2014def', 'count') if m == 'police_not_investigated_157_1_b' else (c, m, u)
             for c, m, u in POL[2014]]
POL[2015] = sorted(POL[2015])
CRT = [(3, 'court_pending_trial_from_previous_year', 'count'), (4, 'court_sent_for_trial', 'count'),
       (5, 'court_withdrawn_by_govt', 'count'), (6, 'court_disposed_by_plea_bargaining', 'count'),
       (7, 'court_total_for_trial_2014def', 'count'), (8, 'court_compounded_or_withdrawn', 'count'),
       (9, 'court_trials_completed', 'count'), (10, 'court_convicted', 'count'),
       (11, 'court_acquitted_or_discharged', 'count'), (12, 'court_pending_trial_end_of_year', 'count'),
       (13, 'court_conviction_rate', 'percent'), (14, 'court_court_pendency', 'percent')]

AGE = [(0, 'cases'), (1, 'victims_under6'), (2, 'victims_6_12'), (3, 'victims_12_16'), (4, 'victims_16_18'),
       (5, 'victims_18_30'), (6, 'victims_30_45'), (7, 'victims_45_60'), (8, 'victims_60plus'), (9, 'victims')]
MUR_F = [(4, 'victims_female_under6'), (7, 'victims_female_6_12'), (10, 'victims_female_12_16'),
         (13, 'victims_female_16_18'), (16, 'victims_female_18_30'), (19, 'victims_female_30_45'),
         (22, 'victims_female_45_60'), (25, 'victims_female_60plus'), (28, 'victims')]

out = []
def add(y, state, code, measure, value, table, col, note=''):
    out.append({'year': y, 'state': state, 'code': code, 'measure': measure,
                'value': '' if value is None else value, 'table_no': table,
                'source_file': 'dl/' + FILES[(y, table)] + '.pdf', 'source_sha256': SHA[(y, table)],
                'note': (f'Col. {col}. ' + note).strip()})

def is_count(col):
    return all(v is None or isinstance(v, int) for v in col.values())

def totals_check(y, t, data, pagecol, cols=None, tol=0.0):
    for c in sorted(cols or data):
        col = data[c]
        st = sum(col[s] or 0 for s in P.STATES14)
        ut = sum(col[s] or 0 for s in P.UTS14)
        ok = (abs(st - (col['Total states'] or 0)) <= tol and abs(ut - (col['Total UTs'] or 0)) <= tol
              and abs((col['Total states'] or 0) + (col['Total UTs'] or 0) - (col['All India'] or 0)) <= tol)
        chk(y, t, f'col {c} states/UTs/All India sum', ok,
            f'page {pagecol[c]}: states {round(st,1)} vs {col["Total states"]}; UTs {round(ut,1)} vs {col["Total UTs"]}; '
            f'TS+TU {round((col["Total states"] or 0)+(col["Total UTs"] or 0),1)} vs AI {col["All India"]}')

summary = {}
for y in (2014, 2015):
    # ---------- 5.1
    d51, pc51 = P.parse_statewise(text(y, '5.1'), '5.1')
    totals_check(y, '5.1', d51, pc51, [3])
    totals_check(y, '5.1', d51, pc51, [5], tol=29 * 0.05)
    # ---------- 5.2
    d52, pc52 = P.parse_statewise(text(y, '5.2'), '5.2')
    countcols = [c for c in d52 if c != 3 and (c - 4) % 3 != 2]
    ratecols = [c for c in d52 if c != 3 and (c - 4) % 3 == 2]
    for c in countcols:
        if not is_count(d52[c]):
            chk(y, '5.2', f'col {c} integer', False, 'non-integer value in a count column')
    totals_check(y, '5.2', d52, pc52, countcols)
    totals_check(y, '5.2', d52, pc52, [3], tol=29 * 0.05)
    # rates
    fails = []
    for c in ratecols:
        for s in P.ROWS:
            i, r, pop = d52[c - 2][s], d52[c][s], d52[3][s]
            if r is None or i is None or not pop:
                continue
            lo, hi = i / (pop + 0.05), i / (pop - 0.05)
            if not (lo - 0.0501 <= r <= hi + 0.0501):
                fails.append(f'col {c} {s}: printed {r}, cases/pop = {i/pop:.3f} (range {lo:.3f}-{hi:.3f})')
    chk(y, '5.2', 'every rate = cases / female population (lakh), allowing for the population being printed to 0.1 lakh and the rate to 0.1', not fails, '; '.join(fails) or f'{len(ratecols)} rate columns x 39 rows')
    # 5.1 rate
    fails = [f'{s}: printed {d51[6][s]}, calc {d51[3][s]/d51[5][s]:.3f}' for s in P.ROWS
             if not (d51[3][s]/(d51[5][s]+0.05) - 0.0501 <= d51[6][s] <= d51[3][s]/(d51[5][s]-0.05) + 0.0501)]
    chk(y, '5.1', 'rate col 6 = col 3 / col 5 x 1 (cases per lakh women), allowing for rounding of the printed population', not fails, '; '.join(fails))
    # 5.1 vs 5.2
    f1 = [f'{s}: 5.1={d51[3][s]} 5.2={d52[121][s]}' for s in P.ROWS if d51[3][s] != d52[121][s]]
    chk(y, '5.1/5.2', 'Table 5.1 col 3 = Table 5.2 col 121 (total) for every row', not f1, '; '.join(f1))
    f2 = [f'{s}: 5.1={d51[5][s]} 5.2={d52[3][s]}' for s in P.ROWS if d51[5][s] != d52[3][s]]
    chk(y, '5.1/5.2', 'Table 5.1 col 5 = Table 5.2 col 3 (female population)', not f2, '; '.join(f2))
    f3 = [f'{s}: 5.1={d51[6][s]} 5.2={d52[123][s]}' for s in P.ROWS if d51[6][s] != d52[123][s]]
    chk(y, '5.1/5.2', 'Table 5.1 col 6 (rate) = Table 5.2 col 123', not f3, '; '.join(f3))
    # footer identities
    ids = [(4, [7, 16]), (5, [8, 17]), (7, [10, 13]), (8, [11, 14]), (16, [19, 22]), (17, [20, 23]),
           (28, [31, 34, 37, 40, 43]), (29, [32, 35, 38, 41, 44]), (49, [52, 55, 58, 61, 64]), (50, [53, 56, 59, 62, 65]),
           (67, [70, 73, 76, 79]), (68, [71, 74, 77, 80]), (103, [106, 109, 112, 115, 118]), (104, [107, 110, 113, 116, 119]),
           (121, [4, 25, 28, 46, 49, 67, 82, 85, 88, 91, 94, 100, 103]), (122, [5, 26, 29, 47, 50, 68, 83, 86, 89, 92, 95, 101, 104])]
    for lhs, rhs in ids:
        bad = []
        for s in P.ROWS:
            vals = [d52[c][s] for c in rhs]
            if d52[lhs][s] is None or any(v is None for v in vals):
                if d52[lhs][s] is None or any(v is None for v in vals):
                    bad.append(f'{s}: blank ("-") in {[c for c in [lhs]+rhs if d52[c][s] is None]}')
                continue
            if d52[lhs][s] != sum(vals):
                bad.append(f'{s}: col {lhs}={d52[lhs][s]} vs sum={sum(vals)}')
        chk(y, '5.2', f'Col. {lhs} = ' + ' + '.join(f'Col. {c}' for c in rhs), not bad, '; '.join(bad))
    if y == 2015:
        bad = [st for st in P.ROWS if d52[116][st] is not None or d52[104][st] != d52[107][st] + d52[110][st] + d52[113][st] + d52[119][st]]
        chk(y, '5.2', 'Col. 116 (ITP s.8 victims) is printed "-" in every row and Col. 104 = Col. 107 + 110 + 113 + 119 holds exactly without it', not bad, ', '.join(bad))
    # Sati column (97) is left out of the printed col 121 formula
    chk(y, '5.2', 'Col. 97 (Sati) is zero in every row, so its omission from the printed Col. 121 formula changes nothing',
        all((d52[97][s] or 0) == 0 for s in P.ROWS))
    # ---------- 5.3
    d53, pc53 = P.parse_statewise(text(y, '5.3'), '5.3')
    totals_check(y, '5.3', d53, pc53)
    for base in (3, 13, 23):
        bad = [f'{s}: {d53[base+9][s]} vs {sum(d53[base+k][s] for k in range(1, 9))}' for s in P.ROWS
               if d53[base + 9][s] != sum(d53[base + k][s] for k in range(1, 9))]
        chk(y, '5.3', f'col {base+9} (total victims) = sum of cols {base+1}-{base+8} (age bands)', not bad, '; '.join(bad))
    for k in range(10):
        bad = [f'{s}: {d53[23+k][s]} vs {d53[3+k][s]}+{d53[13+k][s]}' for s in P.ROWS if d53[23 + k][s] != d53[3 + k][s] + d53[13 + k][s]]
        chk(y, '5.3', f'col {23+k} (total rape) = col {3+k} (incest) + col {13+k} (other than incest)', not bad, '; '.join(bad))
    bad = [f'{s}: 5.3={d53[23][s]} 5.2={d52[4][s]}' for s in P.ROWS if d53[23][s] != d52[4][s]]
    chk(y, '5.2/5.3', 'Table 5.3 col 23 (total rape cases) = Table 5.2 col 4 (rape cases)', not bad, '; '.join(bad))
    bad = [f'{s}: 5.3={d53[32][s]} 5.2={d52[5][s]}' for s in P.ROWS if d53[32][s] != d52[5][s]]
    chk(y, '5.2/5.3', 'Table 5.3 col 32 (total rape victims) = Table 5.2 col 5 (rape victims)', not bad, '; '.join(bad))
    # ---------- 3.3
    d33, pc33 = P.parse_statewise(text(y, '3.3'), '3.3')
    totals_check(y, '3.3', d33, pc33)
    bad = []
    for b in range(3, 28, 3):
        for s in P.ROWS:
            if d33[b][s] + d33[b + 1][s] != d33[b + 2][s]:
                bad.append(f'{s} cols {b}+{b+1}!={b+2}')
    chk(y, '3.3', 'T = M + F in every age band and in the total', not bad, '; '.join(bad))
    for k, lab in ((0, 'M'), (1, 'F'), (2, 'T')):
        bad = [s for s in P.ROWS if d33[27 + k][s] != sum(d33[b + k][s] for b in range(3, 27, 3))]
        chk(y, '3.3', f'col {27+k} (total {lab}) = sum of the eight age bands', not bad, ', '.join(bad))

    # ---------- write 5.1/5.2 rows
    for s in P.ROWS:
        star = ' Population marked * in the table: adjusted figure (newly created state).' if s in ('Andhra Pradesh', 'Telangana') else ''
        add(y, s, 'FEMALE_POP', 'population_lakh', d52[3][s], '5.2', 3,
            'Mid-year projected female population (in lakhs), RGI/Census Commissioner, MHA, as printed by NCRB.' + star)
    for code, c, label, dfn in H52:
        for s in P.ROWS:
            note = label + '. ' + ('' if dfn == SAME else dfn + ' ')
            add(y, s, code, 'cases', d52[c][s], '5.2', c, note + '(I)')
            add(y, s, code, 'victims', d52[c + 1][s], '5.2', c + 1, note + '(V)' + (' Printed "-" (blank).' if d52[c + 1][s] is None else ''))
            add(y, s, code, 'rate', d52[c + 2][s], '5.2', c + 2, note + '(R) Cases per lakh women, as printed by NCRB.')
    # ---------- 5.3 rows
    for base, code0, part in ((23, 'RAPE_VICTIMS_AGE', 'Total rape'),
                              (3, 'RAPE_VICTIMS_AGE_INCEST_2014DEF', 'Incest rape (rape by blood relatives)'),
                              (13, 'RAPE_VICTIMS_AGE_NONINCEST_2014DEF', 'Other than incest rape')):
        for s in P.ROWS:
            code = code0
            n = f'Table 5.3, {part}. Sec. 376 IPC; POCSO cases are reported separately (chapter 6).'
            if y == 2014 and s in ('Tamil Nadu', 'Meghalaya', 'Total states', 'All India'):
                n += (' NCRB footnote: figures of Rape (Section 376 IPC) also include figures of POCSO Act as furnished by Tamil Nadu and Meghalaya.'
                      ' This row of Table 5.3 therefore does not match Table 5.2 rape.')
                if code0 == 'RAPE_VICTIMS_AGE':
                    code = 'RAPE_VICTIMS_AGE_2014DEF'
            if y == 2014 and code0 == 'RAPE_VICTIMS_AGE' and s in ('Haryana', 'Maharashtra'):
                n += ' Total victims here exceed Table 5.2 rape victims by 2; cases agree.'
            for k, m in AGE:
                add(y, s, code, m, d53[base + k][s], '5.3', base + k, n)
    # ---------- 3.3 rows
    for s in P.ROWS:
        for c, m in MUR_F:
            add(y, s, 'MURDER_WOMEN_2014DEF', m, d33[c][s], '3.3',
                c, 'Female victims of murder (Table 3.3, "F"). NCRB note: Transgender is also included in Female. Counts victims.')
        add(y, s, 'MURDER_ALL', 'victims', d33[29][s], '3.3', 29, 'All murder victims (Table 3.3, total "T"), all age groups.')
    # ---------- 5.5
    d55, lab55, pc55 = P.parse_heads(text(y, '5.5'), '5.5')
    d56, lab56, pc56 = P.parse_heads(text(y, '5.6'), '5.6')
    codes = list(lab55)
    if set(codes) != set(lab56):
        chk(y, '5.5/5.6', 'same crime-head rows', False, str(set(codes) ^ set(lab56)))
    # parent = sum of children (count cols)
    def children(code, allc):
        if code == 'TOTAL':
            return [k for k in allc if k != 'TOTAL' and '.' not in k]
        return [k for k in allc if k.startswith(code + '.') and k.count('.') == code.count('.') + 1]
    for t, d, ratec in (('5.5', d55, {16, 17}), ('5.6', d56, {13, 14})):
        bad = []
        for code in d[3]:
            ch = children(code, list(d[3]))
            if not ch:
                continue
            for c in d:
                if c in ratec:
                    continue
                sv = sum(d[c][k] or 0 for k in ch)
                if sv != (d[c][code] or 0):
                    bad.append(f'row {code} col {c}: printed {d[c][code]}, sum of {"+".join(ch)} = {sv}')
        chk(y, t, 'every head = sum of its sub-heads, and the total = sum of the 14 heads, in every count column', not bad, '; '.join(bad))
    # 5.5 printed identities
    T = {}
    if y == 2014:
        idl = [('Col. 7 = Col. 3 + Col. 4 - Col. 5 - Col. 6', lambda r: r[3] + r[4] - r[5] - r[6], 7),
               ('Col. 14 = Col. 9 + 10 + 11 + 12 + 13 (as printed after the modification note)', lambda r: r[9] + r[10] + r[11] + r[12] + r[13], 14),
               ('Col. 15 = Col. 7 - Col. 14 (printed formula)', lambda r: r[7] - r[14], 15),
               ('Col. 15 = Col. 7 - Col. 8 - Col. 14 (what the printed values satisfy)', lambda r: r[7] - r[8] - r[14], 15)]
    else:
        idl = [('Col. 8 = Col. 3 + 4 - 5 - 6 - 7', lambda r: r[3] + r[4] - r[5] - r[6] - r[7], 8),
               ('Col. 14 = Col. 9 + 10 + 11 + 12 + 13', lambda r: r[9] + r[10] + r[11] + r[12] + r[13], 14),
               ('Col. 15 = Col. 8 - Col. 14', lambda r: r[8] - r[14], 15)]
    for name, f, lhs in idl:
        bad = []
        for code in d55[3]:
            r = {c: d55[c][code] for c in d55}
            if f(r) != r[lhs]:
                bad.append(f'{code} {lab55[code]}: printed {r[lhs]}, formula {f(r)}')
        chk(y, '5.5', name, not bad, '; '.join(bad))
    for name, num, den, lhs in (('Col. 16 = Col. 12 / (Col. 12 + Col. 13) x 100', lambda r: r[12], lambda r: r[12] + r[13], 16),
                                ('Col. 17 = Col. 15 / (Col. 3 + Col. 4) x 100', lambda r: r[15], lambda r: r[3] + r[4], 17)):
        bad = []
        for code in d55[3]:
            r = {c: d55[c][code] for c in d55}
            if den(r) == 0:
                if r[lhs] not in (None, 0, 0.0):
                    bad.append(f'{code}: zero denominator, printed {r[lhs]}')
                continue
            v = num(r) / den(r) * 100
            if r[lhs] is None or abs(v - r[lhs]) > 0.051:
                bad.append(f'{code} {lab55[code]}: printed {r[lhs]}, formula {v:.2f}')
        chk(y, '5.5', name, not bad, '; '.join(bad))
    # 5.6 identities
    for name, f, lhs in (('Col. 7 = Col. 3 + 4 - Col. 5 - Col. 6', lambda r: r[3] + r[4] - r[5] - r[6], 7),
                         ('Col. 9 = Col. 10 + Col. 11', lambda r: r[10] + r[11], 9),
                         ('Col. 12 = Col. 7 - (Col. 8 + Col. 9)', lambda r: r[7] - r[8] - r[9], 12)):
        bad = []
        for code in d56[3]:
            r = {c: d56[c][code] for c in d56}
            if f(r) != r[lhs]:
                bad.append(f'{code} {lab56[code]}: printed {r[lhs]}, formula {f(r)}')
        chk(y, '5.6', name, not bad, '; '.join(bad))
    for name, num, den, lhs in (('Col. 13 = Col. 10 / Col. 9 x 100', lambda r: r[10], lambda r: r[9], 13),
                                ('Col. 14 = Col. 12 / (Col. 3 + Col. 4) x 100', lambda r: r[12], lambda r: r[3] + r[4], 14)):
        bad = []
        for code in d56[3]:
            r = {c: d56[c][code] for c in d56}
            if den(r) == 0:
                continue
            v = num(r) / den(r) * 100
            if r[lhs] is None or abs(v - r[lhs]) > 0.051:
                bad.append(f'{code} {lab56[code]}: printed {r[lhs]}, formula {v:.2f}')
        chk(y, '5.6', name, not bad, '; '.join(bad))
    # cross-table: 5.5 reported = 5.2 cases (All India); 5.6 sent for trial = 5.5 chargesheeted
    m52 = {'1': 4, '2': 25, '3': 28, '4': 46, '5': 49, '6': 67, '7': 82, '8': 85, '9': 88, '10': 91, '11': 94, '12': 97, '13': 100, '14': 103, 'TOTAL': 121}
    bad = [f'{k}: 5.5={d55[4][k]} 5.2={d52[c]["All India"]}' for k, c in m52.items() if d55[4][k] != d52[c]['All India']]
    chk(y, '5.2/5.5', 'Table 5.5 col 4 (reported) = Table 5.2 All India cases, for all 15 rows', not bad, '; '.join(bad))
    bad = [f'{k}: 5.6 col4={d56[4][k]} 5.5 col12={d55[12][k]}' for k in d56[4] if d56[4][k] != d55[12][k]]
    chk(y, '5.5/5.6', 'Table 5.6 col 4 (sent for trial) = Table 5.5 col 12 (chargesheeted), every row incl. sub-heads', not bad, '; '.join(bad))
    for code, sc in HEADROW.items():
        for c, m, u in POL[y]:
            add(y, 'All India', sc, m, d55[c][code], '5.5', c, f'{lab55[code]}. India as a whole: NCRB 2014/2015 publish police disposal of crimes against women for All India only.' + (' Printed "-".' if d55[c][code] is None else ''))
        for c, m, u in CRT:
            add(y, 'All India', sc, m, d56[c][code], '5.6', c, f'{lab56[code]}. India as a whole: NCRB 2014/2015 publish court disposal of crimes against women for All India only.' + (' Printed "-".' if d56[c][code] is None else ''))
    summary[y] = {'d51': d51, 'd52': d52, 'd53': d53, 'd55': d55, 'd56': d56, 'd33': d33}

# cross-year continuity
s14, s15 = summary[2014], summary[2015]
bad = [f'{k}: 2014 end {s14["d55"][15][k]} vs 2015 start {s15["d55"][3][k]}' for k in s14['d55'][15] if s14['d55'][15][k] != s15['d55'][3][k]]
chk(2015, '5.5', '2015 col 3 (pending from previous year) = 2014 col 15 (pending at end of 2014)', not bad, '; '.join(bad), kind='comparison')
bad = [f'{k}: 2014 end {s14["d56"][12][k]} vs 2015 start {s15["d56"][3][k]}' for k in s14['d56'][12] if s14['d56'][12][k] != s15['d56'][3][k]]
chk(2015, '5.6', '2015 col 3 (pending trial from previous year) = 2014 col 12 (pending at end of 2014)', not bad, '; '.join(bad), kind='comparison')

# revisions: 2016 edition Table 3A.1 prints 2014 and 2015
rev = {}
for l in open(os.path.join(TXT, '2016_3A1_excerpt.txt'), encoding='utf-8'):
    toks, nums = P.split_nums(P.clean_tokens(l.strip()))
    if len(nums) < 3:
        continue
    import re
    name = re.sub(r'^\d+\s+', '', ' '.join(toks))
    key = P.canon_state(name)
    if key:
        rev[key] = (int(nums[0]), int(nums[1]))
rev17 = {}
for l in open(os.path.join(TXT, '2017_3A1.txt'), encoding='utf-8'):
    toks, nums = P.split_nums(P.clean_tokens(l.strip()))
    if len(nums) < 3:
        continue
    import re
    name = re.sub(r'^\d+\s+', '', ' '.join(toks))
    key = P.canon_state(name)
    if key:
        rev17[key] = int(nums[0])
revisions = []
for s in P.ROWS:
    revisions.append({'state': s, '2014_ed2014': s14['d51'][3][s], '2014_ed2016': rev.get(s, (None,))[0],
                      '2015_ed2015': s15['d51'][3][s], '2015_ed2016': rev.get(s, (None, None))[1], '2015_ed2017': rev17.get(s)})
chk(2015, 'rev', '2016 edition Table 3A.1 parsed for all 39 rows', len(rev) == 39, str(len(rev)))
chk(2015, 'rev', '2017 edition Table 3A.1 parsed for all 39 rows', len(rev17) == 39, str(len(rev17)))

FIELDS = ['year', 'state', 'code', 'measure', 'value', 'table_no', 'source_file', 'source_sha256', 'note']
with open(os.path.join(OLD, 'out1415.csv'), 'w', newline='', encoding='utf-8') as f:
    w = csv.DictWriter(f, FIELDS, lineterminator='\n')
    w.writeheader()
    w.writerows(out)
json.dump({'checks': checks, 'revisions': revisions, 'rows': len(out), 'sha': {f'{k[0]} {k[1]}': [FILES[k], v] for k, v in SHA.items()}},
          open(os.path.join(HERE, 'checks.json'), 'w'), indent=1)
npass = sum(c['pass'] for c in checks)
print('rows', len(out), 'checks', len(checks), 'pass', npass, 'fail', len(checks) - npass)
for c in checks:
    if not c['pass']:
        print('FAIL' if c['kind']=='check' else 'DIFF', c['year'], c['table'], c['check'], '|', c['detail'][:400])
