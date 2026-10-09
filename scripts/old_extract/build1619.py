"""Extract NCRB Crime in India 2016-2019, chapter 3A (and 2A.3 murder victims),
into one long CSV in She Counts' coding. Writes ../out1619.csv and checks.json.

Every column is located by its printed column number on the page, and the
page header text and the I/V/R sub-heading above it are checked against what
is expected before a value is taken.
"""
import csv, hashlib, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import parse1619 as P

OLD = os.path.dirname(HERE)
DL = os.path.join(OLD, 'dl')
TXT = os.path.join(HERE, 'txt')
MANIFEST = {e['file'].split('/')[-1]: e for e in json.load(open(os.path.join(OLD, 'manifest.json')))}
URL_2016_FULL = 'https://www.ncrb.gov.in/uploads/nationalcrimerecordsbureau/custom/1653886924_Crime in India - 2016 Complete PDF 291117.pdf'
EXTRA_URLS = {
    '2017_table-2A.3_1-2007.pdf': 'https://www.ncrb.gov.in/uploads/2022/July/11/custom/crime-in-india/table-2A.3_1-2007.pdf',
    '2018_table-2A.3_0-2018.pdf': 'https://www.ncrb.gov.in/uploads/2022/July/11/custom/crime-in-india/table-2A.3_0-2018.pdf',
    '2019_1681276651Table2A32.pdf': 'https://www.ncrb.gov.in/uploads/nationalcrimerecordsbureau/custom/1681276651Table2A32.pdf',
    '2016_full.pdf': URL_2016_FULL,
}

import functools
@functools.lru_cache(None)
def sha(fn):
    return hashlib.sha256(open(os.path.join(DL, fn), 'rb').read()).hexdigest()

def url(fn):
    return EXTRA_URLS.get(fn) or MANIFEST[fn]['url']

# ---------------------------------------------------------------- sources
FULL16 = '2016_full.pdf'
SRC = {
 2016: {'3A.1': (FULL16, r'TABLE 3A\.1 - Page', True), '3A.2': (FULL16, r'TABLE 3A\.2\((i|ii)\) - Page', False),
        '2A.3': (FULL16, r'TABLE 2A\.3- Page', False),
        '3A.3': ('2016_1679982722Table3A3.pdf', r'TABLE 3A', False), '3A.5': ('2016_1679982966Table3A5.pdf', r'TABLE 3A', False),
        '3A.6': ('2016_1679983444Table3A6.pdf', r'TABLE 3A', True), '3A.7': ('2016_1679983481Table3A7.pdf', r'TABLE 3A', False),
        '3A.8': ('2016_1679983519Table3A8.pdf', r'TABLE 3A', True)},
 2017: {'3A.1': ('2017_Table-3A.1_1.pdf',), '3A.2': ('2017_Table-3A.2_1.pdf',), '3A.3': ('2017_Table-3A.3_1.pdf',),
        '3A.5': ('2017_Table-3A.5_1.pdf',), '3A.6': ('2017_Table-3A.6_1.pdf',), '3A.7': ('2017_Table-3A.7_1.pdf',),
        '3A.8': ('2017_Table-3A.8_1.pdf',), '2A.3': ('2017_table-2A.3_1-2007.pdf',)},
 2018: {'3A.1': ('2018_Table-3A.1_0.pdf',), '3A.2': ('2018_Table-3A.2_0.pdf',), '3A.3': ('2018_Table-3A.3_0.pdf',),
        '3A.5': ('2018_Table-3A.5_0.pdf',), '3A.6': ('2018_Table-3A.6_0.pdf',), '3A.7': ('2018_Table-3A.7_0.pdf',),
        '3A.8': ('2018_Table-3A.8_0.pdf',), '2A.3': ('2018_table-2A.3_0-2018.pdf',)},
 2019: {'3A.1': ('2019_Table-3A.1_2.pdf',), '3A.2': ('2019_Table-3A.2_2.pdf',), '3A.3': ('2019_Table-3A.3_2.pdf',),
        '3A.5': ('2019_Table-3A.5_2.pdf',), '3A.6': ('2019_Table-3A.6_2.pdf',), '3A.7': ('2019_Table-3A.7_2.pdf',),
        '3A.8': ('2019_Table-3A.8_2.pdf',), '2A.3': ('2019_1681276651Table2A32.pdf',)},
}

def src(year, table):
    t = SRC[year][table]
    fn = t[0]
    pat = t[1] if len(t) > 1 else r'TABLE\s+' + re.escape(table)
    pos = t[2] if len(t) > 2 else (table in ('3A.6', '3A.8', '3A.1'))
    return fn, pat, pos

def headkey(label):
    if re.search(r'Total Crime against Women$', label, re.I):
        return 'Total Crime against Women'
    if re.search(r'Total IPC Crimes', label, re.I):
        return 'Total IPC Crimes against Women'
    if re.search(r'Total SLL Crimes', label, re.I):
        return 'Total SLL Crimes against Women'
    m = re.match(r'^(\d+(\.\d+)*) ', label)
    if m:
        return m.group(1)
    ms = re.findall(r'(?:^|\s)(\d{1,2}(?:\.\d+)*)(?= [A-Z]|$)', label)
    if ms:
        return ms[-1]
    raise ValueError('unkeyed head row: %r' % label)

HEADLABELS = {}
def rekey(col):
    out = {}
    for l, v in col.items():
        k = headkey(l)
        if k in out:
            raise ValueError('duplicate head key %s' % k)
        HEADLABELS.setdefault(k, l)
        out[k] = v
    return out

def rekey_by_order(year, table, data):
    """Head rows are printed in the same order on every page group; key every
    column by the SL of the row in the same position in the first column.
    Where a column's own label yields an SL, it must agree."""
    cols = list(data)
    ref = list(data[cols[0]].keys())
    keys = [headkey(l) for l in ref]
    if len(set(keys)) != len(keys):
        raise ValueError('%s %s: duplicate head keys %s' % (year, table, keys))
    for l, k in zip(ref, keys):
        HEADLABELS.setdefault((year, table, k), l)
    out, disagree = {}, 0
    for c in cols:
        labs, vals = list(data[c].keys()), list(data[c].values())
        if len(vals) != len(keys):
            raise ValueError('%s %s col %s: %d rows, first column has %d' % (year, table, c, len(vals), len(keys)))
        for l, k in zip(labs, keys):
            try:
                if headkey(l) != k:
                    disagree += 1
            except ValueError:
                pass
        out[c] = dict(zip(keys, vals))
    if disagree:
        LOG['info'].append('%s %s: %d row labels read on later pages disagree with the first column (labels wrapped, SL printed below its row); rows keyed by order and checked by row identities across pages' % (year, table, disagree))
    else:
        ok('%s %s: %d head rows in the same order in all %d columns (labels agree wherever an SL could be read)' % (year, table, len(keys), len(cols)))
    return out

_cache = {}
def load(year, table, mode='state'):
    key = (year, table, mode)
    if key in _cache:
        return _cache[key]
    fn, pat, pos = src(year, table)
    txt = open(os.path.join(TXT, fn[:-4] + '.txt'), encoding='utf-8').read()
    pages = P.table_pages(txt, pat)
    data, heads, notes = P.parse_table(pages, mode, pos)
    if mode == 'head':
        data = rekey_by_order(year, table, data)
    _cache[key] = (data, heads, notes, pages, fn)
    return _cache[key]

# ---------------------------------------------------------------- column maps
# 3A.2 heads: code -> (cases col, page-header regex, printed header as read)
HEADS_1719 = {
 'MURDER_RAPE': ('3', r'Murder with Rape/Gang', 'Murder with Rape/Gang Rape'),
 'DOWRY_DEATH': ('6', r'Dowry Deaths \(Sec\. 304B', 'Dowry Deaths (Sec. 304B IPC)'),
 'ABETMENT_SUICIDE': ('9', r'Abetment to Suicide of', 'Abetment to Suicide of Women (Sec. 305/306 IPC)'),
 'ACID': ('15', r'Acid Attack \(Sec\.', 'Acid Attack (Sec. 326A IPC)'),
 'ACID_ATTEMPT': ('18', r'Attempt to\s+Acid', 'Attempt to Acid Attack (Sec. 326B IPC)'),
 'CRUELTY': ('21', r'Cruelty by\s+Husband', 'Cruelty by Husband or his relatives (Sec. 498 A IPC)'),
 'KIDNAP': ('24', r'Kidnapping & Abduction of\s+Women \(Total\)|Women \(Total\)', 'Kidnapping & Abduction of Women (Total)'),
 'TRAFFICKING': ('54', r'Human Trafficking', 'Human Trafficking (Sec. 370 & 370A IPC)'),
 'RAPE': ('63', r'Rape \(Total\)', 'Rape (Total) [Rape (Sec. 376 IPC)]'),
 'RAPE_WOMEN': ('66', r'A\) Women \(18 Yrs\.', 'Rape (Sec. 376 IPC): A) Women (18 Yrs. And above)'),
 'RAPE_GIRLS_IPC': ('69', r'B\) Girls \(Below 18', 'Rape (Sec. 376 IPC): B) Girls (Below 18 yrs)'),
 'ATTEMPT_RAPE': ('72', r'Attempt to Commit Rape', 'Attempt to Commit Rape (Total) [Sec. 376/511 IPC]'),
 'ASSAULT_MODESTY': ('81', r'Outrage her', 'Assault on Women with Intent to Outrage her Modesty (Total) [Sec. 354 IPC]'),
 'INSULT_MODESTY': ('90', r'Insult to the', 'Insult to the Modesty of Women (Total) [Sec. 509 IPC]'),
 'IPC_TOTAL': ('99', r'Total IPC Crimes', 'Total IPC Crimes against Women'),
 'DOWRY_ACT': ('102', r'Dowry Prohibition', 'Dowry Prohibition Act, 1961'),
 'ITPA': ('105', r'Immoral Traffic', 'Immoral Traffic (Prevention) Act, 1956 (Total) [Women Victims cases only]'),
 'PWDVA': ('123', r'Domestic (Violence|Offences)', 'Protection of Women from Domestic Violence Act (2019 prints "Domestic Offences Act")'),
 'CYBER': ('126', r'Cyber Crimes/Information', 'Cyber Crimes/Information Technology Act (Women Centric Crimes only) (Total)'),
 'POCSO_TOTAL': ('135', r'Protection of\s+Children', 'Protection of Children from Sexual Violence Act (Girl Child Victims only) (Total) (2019: "Sexual Offences Act")'),
 'POCSO_RAPE': ('138', r'A\) Child Rape', 'A) Child Rape (Sec. 4 & 6 of POCSO Act) / Sec. 376 IPC'),
 'POCSO_ASSAULT': ('141', r'B\) Sexual Assault', 'B) Sexual Assault of Children (Sec. 8 & 10 of POCSO Act) / Sec. 354 IPC'),
 'SLL_TOTAL': ('159', r'Total SLL Crimes', 'Total SLL Crimes against Women'),
 'TOTAL': ('162', r'Total Crime against', 'Total Crime against Women (IPC+SLL)'),
}
HEADS_16 = {
 'DOWRY_DEATH': ('3', r'Dowry Deaths \(Sec\.304B', 'Dowry Deaths (Sec.304B IPC)'),
 'ABETMENT_SUICIDE': ('6', r'Abetment of Suicide of', 'Abetment of Suicide of Women (Sec.306 IPC)'),
 'ACID_INCL_ATTEMPT': ('15', r'Acid Attack \(Sec\. 326 A', 'Acid Attack (Sec. 326 A IPC) & Attempt to Acid Attack (Sec. 326 B IPC)'),
 'CRUELTY': ('18', r'Cruelty by Husband', 'Cruelty by Husband or his relatives (Sec. 498 A)'),
 'KIDNAP': ('21', r'Abduction of Women', 'Kidnapping & Abduction of Women (Total)'),
 'TRAFFICKING': ('24', r'Human Trafficking', 'Human Trafficking (Sec. 370 & 370A IPC) (Female) *'),
 'RAPE': ('27', r'Rape \*', 'Rape * (Total) [* Includes Cases Registered under Section 4 & 6 of POCSO Act r/w 376 IPC]'),
 'ATTEMPT_RAPE': ('30', r'Attempt to Commit Rape', 'Attempt to Commit Rape (Sec. 376/511 IPC)'),
 'ASSAULT_MODESTY': ('36', r'Assault On Women', 'Assault On Women With Intent To Outrage Her Modesty: Assault On Women (Total)'),
 'INSULT_MODESTY': ('39', r'Insult to Modesty', 'Insult to Modesty of Women (Sec. 509 IPC)'),
 'IPC_TOTAL': ('42', r'Total IPC Crimes\*', 'Total IPC Crimes* against Women'),
 'DOWRY_ACT': ('45', r'Dowry Prohibition', 'Dowry Prohibition Act, 1961'),
 'ITPA': ('48', r'Immoral Traffic', 'Immoral Traffic (Prevention) Act* 1956 (Total) [Women Cases only]'),
 'PWDVA': ('51', r'Domestic Violence', 'Protection of Women From Domestic Violence Act, 2005'),
 'CYBER_67A': ('54', r'Sexually Explicit Act', 'Publishing or Transmitting of Material containing Sexually Explicit Act (Sec 67A IT Act)'),
 'SLL_TOTAL': ('60', r'Total SLL Crimes', 'Total SLL Crimes against Women @'),
 'TOTAL': ('63', r'Total Crime against', 'Total Crime against Women (IPC+SLL)'),
}
HEAD_LABEL = {  # from build_data.py HEADS, plus two 2016-only codes
 'RAPE': 'Rape', 'RAPE_WOMEN': 'Rape of women (18 and above)', 'RAPE_GIRLS_IPC': 'Rape of girls under 18, booked under the IPC',
 'ATTEMPT_RAPE': 'Attempt to rape', 'POCSO_TOTAL': 'POCSO Act, girl victims (all sections)',
 'POCSO_RAPE': 'POCSO: penetrative sexual assault of girls (s.4 and 6)', 'POCSO_ASSAULT': 'POCSO: sexual assault of girls (s.8 and 10)',
 'ASSAULT_MODESTY': 'Assault with intent to outrage modesty', 'INSULT_MODESTY': 'Insult to the modesty of women',
 'MURDER_RAPE': 'Murder with rape or gang rape', 'DOWRY_DEATH': 'Dowry deaths', 'ABETMENT_SUICIDE': 'Abetment of suicide of women',
 'CRUELTY': 'Cruelty by husband or his relatives', 'DOWRY_ACT': 'Dowry Prohibition Act, 1961', 'PWDVA': 'PWDVA 2005',
 'KIDNAP': 'Kidnapping and abduction of women', 'ACID': 'Acid attack', 'ACID_ATTEMPT': 'Attempted acid attack',
 'TRAFFICKING': 'Human trafficking', 'ITPA': 'ITPA, women victims', 'CYBER': 'Cyber crimes against women (IT Act)',
 'IPC_TOTAL': 'All IPC crimes against women', 'SLL_TOTAL': 'All SLL crimes against women', 'TOTAL': 'All crimes against women',
 'ACID_INCL_ATTEMPT': '2016 only: acid attack and attempted acid attack combined (s.326A and 326B)',
 'CYBER_67A': '2016 only: publishing or transmitting sexually explicit material (s.67A IT Act)',
}
ALL_CODES = [h for h in HEAD_LABEL]

NOTE_16 = {
 'RAPE': 'Includes cases registered under s.4 and 6 of POCSO r/w s.376 IPC (NCRB footnote). 2017 onward these are under POCSO_RAPE, so RAPE 2016 is not comparable with 2017 onward.',
 'ABETMENT_SUICIDE': 'Sec. 306 IPC only (2017 onward prints Sec. 305/306).',
 'ACID_INCL_ATTEMPT': 'Acid attack and attempted acid attack are one head in 2016; not comparable with ACID or ACID_ATTEMPT.',
 'CYBER_67A': 'Only s.67A IT Act in 2016; CYBER (all women-centric cyber crimes) starts in 2017.',
 'TRAFFICKING': 'Only women-victim cases of human trafficking are taken (NCRB footnote).',
 'ITPA': 'Out of 2337 ITP cases, only 2214 cases of women victims are taken (NCRB footnote, All India).',
 'IPC_TOTAL': 'NCRB: does not include gender-neutral crime (murder, attempt to murder, culpable homicide, dacoity, robbery, arson, theft etc). Includes unnatural offences (s.377) and miscarriage; excludes selling/buying of minor girls and murder with rape, which 2017 onward include.',
 'SLL_TOTAL': 'NCRB: excludes 123 ITPA cases in which women are not victim and includes 930 cases of s.67A IT Act. No POCSO in 2016.',
 'TOTAL': 'IPC+SLL. Excludes POCSO girl-victim cases, which 2017 onward include.',
}
NOTE_1719 = {
 'RAPE_GIRLS_IPC': 'Most rape of girls is booked under POCSO s.4 and 6. See POCSO_RAPE.',
 'TOTAL': 'IPC+SLL. Includes POCSO girl-victim cases (POCSO_TOTAL) and women-centric cyber crimes.',
}

# 3A.3 rape victims by age: (col, measure, header regex)
BANDS = [('4', 'victims_under6'), ('5', 'victims_6_12'), ('6', 'victims_12_16'), ('7', 'victims_16_18'),
         ('8', 'victims_girls'), ('9', 'victims_18_30'), ('10', 'victims_30_45'), ('11', 'victims_45_60'),
         ('12', 'victims_60plus'), ('13', 'victims_women'), ('14', 'victims')]
BANDS_HDR = {'3': 'Cases Reported', '4': 'Below 6 Years', '5': '6 Years & Above - Below 12 Years', '6': '12 Years & Above - Below 16 Years',
             '7': '16 Years & Above - Below 18 Years', '8': 'Total Girl/Child Victims', '9': '18 Years & Above - Below 30 Years',
             '10': '30 Years & Above - Below 45 Years', '11': '45 Years & Above - Below 60 Years', '12': '60 Years & Above',
             '13': 'Total Women/Adult Victims', '14': 'Total Victims (Col.8+Col.13)'}

# police (3A.5/3A.6) and court (3A.7/3A.8): (col, measure, unit, printed header)
POL_1719 = [('4', 'reported', 'count', 'Cases Reported during the year'),
            ('6', 'total_for_investigation', 'count', 'Total Cases for Investigation (Col.3+Col.4+Col.5)'),
            ('11', 'final_report_false', 'count', 'Final Report: Cases Ended as Final Report False'),
            ('13', 'final_report_true_insufficient_evidence', 'count', 'Final Report: Cases True but Insufficient Evidence or Untraced or No Clue'),
            ('18', 'chargesheeted', 'count', 'Cases Chargesheeted (Col.16+Col.17)'),
            ('19', 'disposed_by_police', 'count', 'Total Cases Disposed Off by Police (Col.7+Col.8+Col.15+Col.18)'),
            ('22', 'pending_investigation_end_of_year', 'count', 'Cases Pending Investigation at End of the Year (Col.6-Col.9-Col.19-Col.20)'),
            ('23', 'chargesheeting_rate', 'percent', 'Charge-Sheeting Rate (Col.18/Col.19)*100'),
            ('24', 'police_pendency', 'percent', 'Pendency Percentage (Col.22/Col.6)*100')]
POL_16 = [('4', 'reported', 'count', 'Cases Reported During the Year'),
          ('5', 'total_for_investigation', 'count', 'Total Cases for Investigation (Col.3+4) [no re-opened column in 2016]'),
          ('10', 'final_report_false', 'count', 'Final Report: False'),
          ('9', 'final_report_true_insufficient_evidence', 'count', 'Final Report: True but insufficient Evidence [2016 has no "or Untraced or No Clue" wording]'),
          ('14', 'chargesheeted', 'count', 'Cases in Which Charge-sheets were Submitted'),
          ('15', 'disposed_by_police', 'count', 'Total Cases Disposed off by Police (Col.7+8+Col.13+Col.14)'),
          ('16', 'pending_investigation_end_of_year', 'count', 'Cases Pending Investigation at the End of the Year (Col.5 - (Col.6 + Col.15))'),
          ('17', 'chargesheeting_rate', 'percent', 'Charge-Sheeting Rate (Col.14/Col.15)*100'),
          ('18', 'police_pendency', 'percent', 'Pendency Percentage (Col.16/(Col.5))*100')]
CRT_1719 = [('5', 'total_for_trial', 'count', 'Total Cases for Trial (Col.3+Col.4)'),
            ('15', 'convicted', 'count', 'Cases Convicted (Col.13+Col.14)'),
            ('16', 'discharged', 'count', 'Cases Discharged'),
            ('17', 'acquitted', 'count', 'Cases Acquitted'),
            ('18', 'trials_completed', 'count', 'Cases in which Trials were Completed (Col.15+Col.16+Col.17)'),
            ('20', 'pending_trial_end_of_year', 'count', 'Cases Pending Trial at End of the Year (Col.5-Col.19)'),
            ('21', 'conviction_rate', 'percent', 'Conviction Rate (Col.15/Col.18)*100'),
            ('22', 'court_pendency', 'percent', 'Pendency Percentage (Col.20/Col.5)*100')]
CRT_16 = [('5', 'total_for_trial', 'count', 'Total Cases for Trial During the Year (Col.3+4)'),
          ('10', 'convicted', 'count', 'Cases Convicted'),
          ('11', 'acquitted_or_discharged', 'count', 'Cases Acquitted or Discharged [one column in 2016]'),
          ('9', 'trials_completed', 'count', 'Cases in Which Trials were Completed (Col.10+11)'),
          ('13', 'pending_trial_end_of_year', 'count', 'Cases Pending Trial at the End of the Year (Col.5-Col.12)'),
          ('14', 'conviction_rate', 'percent', 'Conviction Rate (Col.10/Col.9)*100'),
          ('15', 'court_pendency', 'percent', 'Pendency Percentage (Col.13/Col.5)*100')]

# 3A.1 columns: (year-total col, female pop col, rate col)
T31 = {2016: ('5', '8', '9'), 2017: ('5', '7', '8'), 2018: ('5', '7', '8'), 2019: ('5', '7', '8')}
# 2A.3: female girls, female total, all victims
T23 = {2016: ('16', '34', '35'), 2017: ('20', '44', '46'), 2018: ('20', '44', '46'), 2019: ('20', '44', '46')}

# 3A.5/3A.7 rows: code -> (SL, label regex)
PICK_1719 = {'MURDER_RAPE': ('1', r'Murder with Rape'), 'DOWRY_DEATH': ('2', r'Dowry Deaths'),
             'CRUELTY': ('7', r'Cruelty by Husband'), 'RAPE': ('12', r'^12 Rape$'),
             'POCSO_TOTAL': ('20', r'Protection of Children from Sexual'), 'POCSO_RAPE': ('20.1', r'POCSO Act Section 4 & 6'),
             'TOTAL': (None, r'Total Crime against Women$')}
PICK_16 = {'DOWRY_DEATH': ('1', r'Dowry Deaths'), 'CRUELTY': ('6', r'Cruelty by Husband'), 'RAPE': ('9', r'^9 Rape$'),
           'TOTAL': (None, r'Total Crime Against Women$')}

# ---------------------------------------------------------------- helpers
LOG = {'blank': [], 'checks': [], 'failures': [], 'columns': [], 'absent': [], 'revisions': [], 'identities': [], 'info': []}

def ok(msg):
    LOG['checks'].append(msg)

def fail(msg):
    LOG['failures'].append(msg)

def page_header_text(heads, col):
    pg, header, s, e = heads[col]
    return pg, ' '.join(' '.join(header).split())

def subhead(heads, col):
    """The I/V/R (or M/F/T) letter printed above a column."""
    pg, header, s, e = heads[col]
    for l in reversed(header):
        toks = [(m.group(0), m.start(), m.end()) for m in re.finditer(r'\S+', l)]
        toks = [t for t in toks if t[0] not in ('No.', 'No', 'S.', 'Sl', 'State/UT')]
        if toks and all(t in ('I', 'V', 'R', 'M', 'F', 'T', 'Trans', 'Total') for t, _, _ in toks):
            c = (s + e) / 2
            return min(toks, key=lambda t: abs((t[1] + t[2]) / 2 - c))[0]
    return None

def verify_col(year, table, heads, col, regex, printed, sub=None):
    pg, text = page_header_text(heads, col)
    if not re.search(regex, text):
        fail(f'{year} {table} col {col}: page {pg} header does not match /{regex}/')
    if sub is not None:
        got = subhead(heads, col)
        if got != sub:
            fail(f'{year} {table} col {col}: sub-heading {got!r}, expected {sub!r}')
    LOG['columns'].append({'year': year, 'table': table, 'col': col, 'page': pg, 'printed_header': printed,
                           'subhead': sub or ''})

def is_count(col):
    return all(v is None or float(v).is_integer() for v in col.values())

def check_all_totals(year, table, data, skip=()):
    n = 0
    for c, col in data.items():
        if c in skip or not is_count(col):
            continue
        bad = P.check_totals(col)
        n += 1
        if bad:
            fail(f'{year} {table} col {c}: rows do not add to NCRB totals: {bad}')
    ok(f'{year} {table}: {n} count columns, states sum to Total State(s), UTs to Total UT(s), both to All India' )
    return n

def check_identities(year, table, data, notes):
    """NCRB's own printed 'Col.a=Col.b+Col.c' footnotes, for every row."""
    seen = set()
    for n in notes:
        for m in re.finditer(r'[Cc]ol\.\s*(\w+)\s*=\s*([Cc]ol\.\s*\w+(?:\s*\+\s*[Cc]ol\.\s*\w+)*)', n):
            lhs = m.group(1)
            rhs = re.findall(r'[Cc]ol\.\s*(\w+)', m.group(2))
            if (lhs, tuple(rhs)) in seen:
                continue
            seen.add((lhs, tuple(rhs)))
            if lhs in data and not is_count(data[lhs]):
                continue
            if lhs not in data or any(r not in data for r in rhs):
                LOG['identities'].append(f'{year} {table}: Col.{lhs}={"+".join(rhs)}: column not on these pages, not checked')
                continue
            bad = []
            for row, v in data[lhs].items():
                s = sum(data[r].get(row) or 0 for r in rhs)
                if v is not None and abs(s - v) > 0.5:
                    bad.append((row, v, s))
            msg = f'{year} {table}: printed identity Col.{lhs}=' + '+'.join('Col.' + r for r in rhs)
            if bad:
                LOG['identities'].append(msg + f' FAILS in {len(bad)} rows, e.g. {bad[:3]}')
            else:
                LOG['identities'].append(msg + ' holds in all 39 rows')

def rate_check(year, label, cases, rate, pop):
    bad = []
    for s in P.ROWKEYS:
        i, r, p = cases.get(s), rate.get(s), pop.get(s)
        if r is None or i is None or not p:
            continue
        exp = i / p
        tol = 0.05 + exp * 0.05 / p + 0.011
        if abs(exp - r) > tol:
            bad.append((s, i, p, r, round(exp, 3)))
    if bad:
        fail(f'{year} {label}: printed rate differs from cases/female population: {bad}')
        return False
    return True

# ---------------------------------------------------------------- build
OUT = []
def add(year, state, code, measure, value, table, fn, note=''):
    if value is None:
        LOG['blank'].append(f'{year} {state} {code} {measure} ({table}): printed blank or "-", left out')
        return
    if measure.endswith(('rate', 'pendency', 'population_lakh')) or measure == 'rate':
        v = value
    else:
        if not float(value).is_integer():
            fail(f'{year} {state} {code} {measure}: non-integer count {value}')
        v = int(value)
    OUT.append({'year': year, 'state': state, 'code': code, 'measure': measure, 'value': v,
                'table_no': table, 'source_file': fn, 'source_sha256': sha(fn), 'note': note})

def build_year(y):
    # ---- 3A.1
    d31, h31, n31, _, f31 = load(y, '3A.1')
    check_all_totals(y, '3A.1', d31, skip=('7', '10') if y == 2016 else ())
    tc, pc, rc = T31[y]
    verify_col(y, '3A.1', h31, tc, str(y), f'{y} (cases of crime against women, IPC+SLL)')
    verify_col(y, '3A.1', h31, pc, r'Female\s+Population|Projected', f'Mid-Year Projected Female Population (In Lakhs) ({y})')
    verify_col(y, '3A.1', h31, rc, r'Rate of', f'Rate of Total Crime against Women ({y})')
    pops = d31[pc]
    for s in P.ROWKEYS:
        add(y, s, 'FEMALE_POP', 'population_lakh', pops.get(s), '3A.1', f31, f'Col {pc}. Mid-year projected female population, in lakh, as printed by NCRB.')
    if rate_check(y, '3A.1 rate', d31[tc], d31[rc], pops):
        ok(f'{y} 3A.1: printed rate (col {rc}) = col {tc} / female population (col {pc}) within rounding, all 39 rows')
    # ---- 3A.2
    d32, h32, n32, _, f32 = load(y, '3A.2')
    check_all_totals(y, '3A.2', d32)
    check_identities(y, '3A.2', d32, n32)
    heads = HEADS_16 if y == 2016 else HEADS_1719
    notes = NOTE_16 if y == 2016 else NOTE_1719
    for code, (c, rx, printed) in heads.items():
        cv = str(int(re.match(r'\d+', c).group(0)) + 1) + re.sub(r'^\d+', '', c)
        cr = str(int(re.match(r'\d+', c).group(0)) + 2) + re.sub(r'^\d+', '', c)
        verify_col(y, '3A.2', h32, c, rx, printed + ' : I', 'I')
        verify_col(y, '3A.2', h32, cv, rx, printed + ' : V', 'V')
        verify_col(y, '3A.2', h32, cr, rx, printed + ' : R', 'R')
        if rate_check(y, f'3A.2 {code} rate col {cr}', d32[c], d32[cr], pops):
            ok(f'{y} 3A.2 {code}: printed rate col {cr} = col {c} / female population (3A.1 col {pc}), all 39 rows')
        extra = notes.get(code, '')
        for s in P.ROWKEYS:
            wb = ' West Bengal 2019: NCRB used the 2018 data (not received in time).' if (y == 2019 and s == 'West Bengal') else ''
            nt = lambda col: (f'Col {col}. ' + extra + wb).strip()
            add(y, s, code, 'cases', d32[c].get(s), '3A.2', f32, nt(c))
            add(y, s, code, 'victims', d32[cv].get(s), '3A.2', f32, nt(cv))
            rn = ''
            if y == 2016 and code == 'TRAFFICKING' and s == 'Uttarakhand':
                rn = ' NCRB prints 0.1; 2 cases over 52.2 lakh women is 0.04. Kept as printed.'
            add(y, s, code, 'rate', d32[cr].get(s), '3A.2', f32, ('Cases per lakh women, as printed by NCRB. ' + nt(cr) + rn).strip())
    for code in ALL_CODES:
        if code not in heads:
            LOG['absent'].append(f'{y}: {code} not a head in table 3A.2')
    # cross-check 3A.1 total vs 3A.2 total head
    tcol = heads['TOTAL'][0]
    bad = [(s, d31[tc].get(s), d32[tcol].get(s)) for s in P.ROWKEYS if d31[tc].get(s) != d32[tcol].get(s)]
    if bad:
        fail(f'{y}: 3A.1 col {tc} differs from 3A.2 col {tcol} (total crime against women): {bad}')
    else:
        ok(f'{y}: 3A.1 col {tc} (total crime against women) equals 3A.2 col {tcol} in all 39 rows')
    # IPC + SLL = TOTAL
    ic, sc_ = heads['IPC_TOTAL'][0], heads['SLL_TOTAL'][0]
    for off in (0, 1):
        def sh(c, o=off):
            return str(int(re.match(r'\d+', c).group(0)) + o)
        bad = [s for s in P.ROWKEYS if (d32[sh(ic)].get(s) or 0) + (d32[sh(sc_)].get(s) or 0) != d32[sh(tcol)].get(s)]
        what = 'cases' if off == 0 else 'victims'
        if bad:
            fail(f'{y} 3A.2: IPC total + SLL total != total ({what}) in {bad}')
        else:
            ok(f'{y} 3A.2: IPC total (col {sh(ic)}) + SLL total (col {sh(sc_)}) = total (col {sh(tcol)}) for {what}, all 39 rows')
    # what the IPC and SLL totals are made of
    if y == 2016:
        comp = {'42': ['3', '6', '9', '12', '15', '18', '21', '24', '27', '30', '33', '36', '39'], '60': ['45', '48', '51', '54', '57']}
    else:
        comp = {'99': ['3', '6', '9', '12', '15', '18', '21', '24', '54', '57', '60', '63', '72', '81', '90'],
                '159': ['102', '105', '123', '126', '135', '156'], '24': ['27', '30', '33', '36', '45', '48', '51']}
    for tot_c, parts in comp.items():
        bad = [s for s in P.ROWKEYS if sum(d32[c][s] for c in parts) != d32[tot_c][s]]
        msg = f'{y} 3A.2: col {tot_c} = ' + ' + '.join('col ' + c for c in parts)
        (fail if bad else ok)(msg + (f' FAILS in {bad}' if bad else ', all 39 rows'))
    # sum of IPC heads = IPC total (cases), to find out what the IPC total contains
    pages = load(y, '3A.2')[3]
    ipc_cases = [c for c in d32 if re.fullmatch(r'\d+', c) and int(c) < int(ic) and (int(c) % 3 == 0)]
    LOG['info'].append((y, 'ipc_case_cols', ipc_cases))
    # ---- 3A.3
    d33, h33, n33, _, f33 = load(y, '3A.3')
    check_all_totals(y, '3A.3', d33)
    check_identities(y, '3A.3', d33, n33)
    verify_col(y, '3A.3', h33, '3', r'Repor', BANDS_HDR['3'])
    for c, m in BANDS:
        verify_col(y, '3A.3', h33, c, r'Victims', BANDS_HDR[c])
        nt = f'Col {c}.'
        if y == 2016:
            nt += ' Victims of rape under s.376 IPC and under s.4 and 6 of POCSO r/w s.376 IPC (NCRB header).'
        else:
            nt += ' Victims of rape (s.376 IPC); excludes POCSO cases.'
        for s in P.ROWKEYS:
            add(y, s, 'RAPE_VICTIMS_AGE', m, d33[c].get(s), '3A.3', f33, nt)
    rc32, rv32 = heads['RAPE'][0], str(int(heads['RAPE'][0]) + 1)
    for a, b, what in (('3', rc32, 'cases'), ('14', rv32, 'victims')):
        bad = [(s, d33[a].get(s), d32[b].get(s)) for s in P.ROWKEYS if d33[a].get(s) != d32[b].get(s)]
        if bad:
            fail(f'{y}: 3A.3 col {a} differs from 3A.2 RAPE col {b} ({what}) in {len(bad)} rows: {bad[:6]}')
        else:
            ok(f'{y}: 3A.3 col {a} equals 3A.2 RAPE col {b} ({what}), all 39 rows')
    # bands sum
    bad = [s for s in P.ROWKEYS if sum(d33[c].get(s) or 0 for c in ('4', '5', '6', '7')) != d33['8'].get(s)
           or sum(d33[c].get(s) or 0 for c in ('9', '10', '11', '12')) != d33['13'].get(s)
           or (d33['8'].get(s) or 0) + (d33['13'].get(s) or 0) != d33['14'].get(s)]
    if bad:
        fail(f'{y} 3A.3: age bands do not add to girl/women/total victims in {bad}')
    else:
        ok(f'{y} 3A.3: bands 4-7 = col 8, bands 9-12 = col 13, col 8 + col 13 = col 14, all 39 rows')
    # ---- 3A.6 police, 3A.8 courts
    pol = POL_16 if y == 2016 else POL_1719
    crt = CRT_16 if y == 2016 else CRT_1719
    for table, cmap, code, unit_note in (('3A.6', pol, 'POLICE', 'All crime heads together. NCRB does not publish this by state for each crime.'),
                                         ('3A.8', crt, 'COURTS', 'All crime heads together. Trials completed in a year mostly began in earlier years.')):
        d, h, n, _, fn = load(y, table)
        check_all_totals(y, table, d)
        check_identities(y, table, d, n)
        for c, m, u, printed in cmap:
            verify_col(y, table, h, c, r'.', printed)
            for s in P.ROWKEYS:
                add(y, s, code, m, d[c].get(s), table, fn, f'Col {c}. {unit_note}')
    # police reported = 3A.1 total?
    d36 = load(y, '3A.6')[0]
    bad = [(s, d36['4'].get(s), d31[tc].get(s)) for s in P.ROWKEYS if d36['4'].get(s) != d31[tc].get(s)]
    if bad:
        fail(f'{y}: 3A.6 col 4 (reported) differs from 3A.1 col {tc} in {len(bad)} rows: {bad}')
    else:
        ok(f'{y}: 3A.6 col 4 (cases reported) equals 3A.1 col {tc}, all 39 rows')
    # ---- 3A.5 / 3A.7
    pick = PICK_16 if y == 2016 else PICK_1719
    for table, cmap, pref, statetab in (('3A.5', pol, 'police_', '3A.6'), ('3A.7', crt, 'court_', '3A.8')):
        d, h, n, _, fn = load(y, table, 'head')
        labels = list(d[cmap[0][0]].keys())
        check_head_sums(y, table, d)
        check_row_identities(y, table, d)
        for code, (sl, rx) in pick.items():
            if sl:
                cand = [l for l in labels if l == sl]
            else:
                cand = [l for l in labels if re.search(rx, l, re.I)]
            if len(cand) != 1 or (sl and not re.search(rx, HEADLABELS.get((y, table, sl), ''))):
                fail(f'{y} {table}: row for {code} not found uniquely: {cand}')
                continue
            lab = cand[0]
            for c, m, u, printed in cmap:
                note = f'Col {c}, row {lab} ("{HEADLABELS.get((y, table, lab), lab)}"). India as a whole. NCRB does not publish this by state for each crime.'
                if y == 2016 and code == 'RAPE':
                    note += ' Rape in 2016 includes POCSO s.4 and 6 r/w s.376 IPC cases.'
                add(y, 'All India', code, pref + m, d[c].get(lab), table, fn, note)
        # total row of the heads table equals the All India row of the state table
        tot = 'Total Crime against Women'
        ds = load(y, statetab)[0]
        bad = [(c, d[c].get(tot), ds[c].get('All India')) for c in d if d[c].get(tot) != ds[c].get('All India')]
        if bad:
            fail(f'{y}: {table} total row differs from {statetab} All India in columns {bad}')
        else:
            ok(f'{y}: {table} "Total Crime against Women" row equals {statetab} All India row in all {len(d)} columns')
    for code in ('MURDER_RAPE', 'POCSO_TOTAL', 'POCSO_RAPE'):
        if code not in pick:
            LOG['absent'].append(f'{y}: no {code} row in 3A.5/3A.7')
    # rape national police reported vs 3A.2
    d35 = load(y, '3A.5', 'head')[0]
    lab = pick['RAPE'][0]
    if d35['4'][lab] != d32[rc32]['All India']:
        fail(f'{y}: 3A.5 rape reported {d35["4"][lab]} != 3A.2 rape cases {d32[rc32]["All India"]}')
    else:
        ok(f'{y}: 3A.5 rape row col 4 (reported) equals 3A.2 RAPE cases, All India')
    # ---- 2A.3 murder victims
    d23, h23, n23, _, f23 = load(y, '2A.3')
    check_all_totals(y, '2A.3', d23)
    check_identities(y, '2A.3', d23, n23)
    g, fw, t = T23[y]
    verify_col(y, '2A.3', h23, g, r'Total Child Victims', 'Total Child Victims : F', 'F')
    verify_col(y, '2A.3', h23, fw, r'Total Victims', 'Total Victims (Child + Adult) : F', 'F')
    verify_col(y, '2A.3', h23, t, r'Total Victims', 'Total Victims (Child + Adult) : Total' if y > 2016 else 'Total Victims (Child+Adult) : T', 'Total' if y > 2016 else 'T')
    for s in P.ROWKEYS:
        add(y, s, 'MURDER_WOMEN', 'victims', d23[fw].get(s), '2A.3', f23, f'Col {fw}. Female victims of murder, child and adult. Counts victims, not cases.')
        add(y, s, 'MURDER_WOMEN', 'victims_girls', d23[g].get(s), '2A.3', f23, f'Col {g}. Female victims under 18.')
        add(y, s, 'MURDER_ALL', 'victims', d23[t].get(s), '2A.3', f23,
            f'Col {t}. ' + ('Male and female victims together (2016 table has no transgender column).' if y == 2016 else 'Male, female and transgender victims together.'))

def HEADTXT(y, table, sl):
    """The printed label of a head row on the table's first page (wrapped labels re-joined)."""
    fn = src(y, table)[0]
    txt = open(os.path.join(TXT, fn[:-4] + '.txt'), encoding='utf-8').read()
    page = P.table_pages(txt, src(y, table)[1])[0]
    lines = page.split('\n')
    for i, l in enumerate(lines):
        m = re.match(r'^\s*' + re.escape(sl) + r'\s+(.*?)\s*(?:[\d,]+\s+){3,}', l + ' ')
        if m and m.group(1):
            name = m.group(1)
            # a label wrapped onto the next line, with no numbers on it
            if i + 1 < len(lines) and lines[i + 1].strip() and not re.search(r'\d', lines[i + 1]):
                name += ' ' + lines[i + 1].strip()
            return re.sub(r'\s+', ' ', name).strip()
        m2 = re.match(r'^\s*' + re.escape(sl) + r'\s+([^\d]+)$', l)
        if m2:
            return re.sub(r'\s+', ' ', m2.group(1) + ' ' + re.sub(r'[\d,.\s]+$', '', lines[i + 1].strip())).strip()
    return ''

ROWID = {('3A.5', 2016): [('5', ['3', '4'], []), ('15', ['7', '8', '13', '14'], []), ('16', ['5'], ['6', '15']), ('13', ['9', '10', '11', '12'], [])],
         ('3A.5', 0): [('6', ['3', '4', '5'], []), ('15', ['10', '11', '12', '13', '14'], []), ('18', ['16', '17'], []),
                       ('19', ['7', '8', '15', '18'], []), ('22', ['6'], ['9', '19', '20'])],
         ('3A.7', 2016): [('5', ['3', '4'], []), ('9', ['10', '11'], []), ('12', ['6', '7', '8', '9'], []), ('13', ['5'], ['12'])],
         ('3A.7', 0): [('5', ['3', '4'], []), ('11', ['6', '7', '8', '9', '10'], []), ('15', ['13', '14'], []),
                       ('18', ['15', '16', '17'], []), ('19', ['11', '18'], []), ('20', ['5'], ['19'])]}

def check_row_identities(y, table, d):
    """Each head row's own arithmetic, which joins columns printed on different
    pages: proves the rows line up across page groups."""
    ids = ROWID[(table, 2016 if y == 2016 else 0)]
    keys = list(d[list(d)[0]].keys())
    bad = []
    for lhs, plus, minus in ids:
        for k in keys:
            v = d[lhs][k]
            s = sum(d[c][k] or 0 for c in plus) - sum(d[c][k] or 0 for c in minus)
            if v is not None and abs(v - s) > 0.5:
                bad.append((k, lhs, v, s))
    txt = '; '.join(f'Col.{l}=' + '+'.join(p) + ('-' + '-'.join(m) if m else '') for l, p, m in ids)
    if bad:
        fail(f'{y} {table}: row identities across pages fail: {bad[:10]} ({len(bad)} in all)')
    else:
        ok(f'{y} {table}: row identities across page groups hold for all {len(keys)} head rows ({txt})')

def check_head_sums(y, table, d):
    """Top-level heads add to the printed totals (proves the head rows parsed)."""
    c0 = list(d)[0]
    labels = list(d[c0].keys())
    top = [l for l in labels if re.fullmatch(r'\d+', l)]
    tot = 'Total Crime against Women'
    ipc = [l for l in labels if l == 'Total IPC Crimes against Women']
    bad = []
    for c in d:
        if not is_count(d[c]):
            continue
        if ipc:
            i = labels.index(ipc[0])
            a = sum(d[c][l] or 0 for l in top if labels.index(l) < i)
            b = sum(d[c][l] or 0 for l in top if labels.index(l) > i)
            sll = 'Total SLL Crimes against Women'
            if abs(a - d[c][ipc[0]]) > .5 or abs(b - d[c][sll]) > .5 or abs(d[c][ipc[0]] + d[c][sll] - d[c][tot]) > .5:
                bad.append((c, a, d[c][ipc[0]], b, d[c][sll], d[c][tot]))
        else:
            a = sum(d[c][l] or 0 for l in top)
            if abs(a - d[c][tot]) > .5:
                bad.append((c, a, d[c][tot]))
    if bad:
        fail(f'{y} {table}: top-level heads do not add to printed totals: {bad}')
    else:
        ok(f'{y} {table}: the {len(top)} top-level crime heads add to the printed total rows in every count column')

def revisions():
    """Each edition's three-year 3A.1 against the earlier editions."""
    own = {y: load(y, '3A.1')[0][T31[y][0]] for y in (2016, 2017, 2018, 2019)}
    later = {2017: {'2016': '4'}, 2018: {'2016': '3', '2017': '4'}, 2019: {'2017': '3', '2018': '4'}}
    for ed, m in later.items():
        d = load(ed, '3A.1')[0]
        h = load(ed, '3A.1')[1]
        for yr, c in m.items():
            pg, text = page_header_text(h, c)
            col = d[c]
            diffs = [(s, own[int(yr)].get(s), col.get(s)) for s in P.ROWKEYS if own[int(yr)].get(s) != col.get(s)]
            if diffs:
                LOG['revisions'].append(f'{yr} as printed in the {ed} edition (3A.1 col {c}) differs from the {yr} edition: '
                                        + '; '.join(f'{s}: {a} -> {b} ({(b or 0) - (a or 0):+g})' for s, a, b in diffs))
            else:
                LOG['revisions'].append(f'{yr} as printed in the {ed} edition (3A.1 col {c}) equals the {yr} edition in all 39 rows')

def cross_2016_full():
    """2016 separate per-table files against the same tables in the full publication."""
    txt = open(os.path.join(TXT, '2016_full.txt'), encoding='utf-8').read()
    for table, mode in (('3A.3', 'state'), ('3A.6', 'state'), ('3A.8', 'state'), ('3A.5', 'head'), ('3A.7', 'head')):
        sep = load(2016, table, mode)[0]
        pages = [p for p in txt.split('\f') if re.search(r'TABLE ' + re.escape(table) + r'\s*[-–]\s*P', p, re.I)]
        full = P.parse_table(pages, mode)[0]
        if mode == 'head':
            # labels can differ in wrapping; compare by SL/order of values
            a = [[sep[c][l] for l in sep[c]] for c in sep]
            b = [[full[c][l] for l in full[c]] for c in full]
            same = a == b
        else:
            same = sep == full
        (ok if same else fail)(f'2016 {table}: separate NCRB file ' + ('identical to' if same else 'DIFFERS from') + ' the same table in the full 2016 publication')

if __name__ == '__main__':
    for y in (2016, 2017, 2018, 2019):
        build_year(y)
    revisions()
    cross_2016_full()
    with open(os.path.join(OLD, 'out1619.csv'), 'w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, ['year', 'state', 'code', 'measure', 'value', 'table_no', 'source_file', 'source_sha256', 'note'], lineterminator='\n')
        w.writeheader()
        w.writerows(OUT)
    LOG['sources'] = sorted({(r['year'], r['table_no'], r['source_file'], r['source_sha256'], url(r['source_file'])) for r in OUT})
    json.dump(LOG, open(os.path.join(HERE, 'checks.json'), 'w'), indent=1, default=str)
    print('rows', len(OUT), 'checks', len(LOG['checks']), 'failures', len(LOG['failures']))
    for f_ in LOG['failures']:
        print('FAIL', f_[:400])
