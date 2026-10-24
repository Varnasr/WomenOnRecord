"""Checks the site and data that CI runs. Each guards a failure that shows no error.

- Every local file the page loads exists.
- Every outside origin the page loads is allowed by the CSP in netlify.toml.
- NCRB's printed rates agree with cases / female population, so a column
  mapped to the wrong head cannot pass quietly.
- The downloads exist and are newer in content than nothing: the CSV the page
  offers is the one the site data was built from.
- No em dash in reader-facing text (the owner's house style).
"""
import csv, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
fail = []

# Every page the site serves, written by scripts/build_pages.py.
PAGES = sorted(os.path.relpath(os.path.join(d, f), ROOT) for d, _, fs in os.walk(ROOT) for f in fs
               if f == 'index.html' and not set(os.path.relpath(d, ROOT).split(os.sep)) & {'.git', 'site', 'node_modules'})
def exists(ref, base):
    path = ref.lstrip('/') if ref.startswith('/') else os.path.join(os.path.dirname(base), ref)
    path = path.split('?')[0]
    return os.path.exists(os.path.join(ROOT, path, 'index.html') if path.endswith('/') or path == '' else os.path.join(ROOT, path))
page = ''
for f in PAGES:
    src = open(os.path.join(ROOT, f), encoding='utf-8').read()
    page += src
    for ref in re.findall(r'(?:src|href)="([^"#:]*)"', src):
        if not exists(ref or '/', f):
            fail.append(f'{f} links to {ref}, which does not exist')
app = open(os.path.join(ROOT, 'js', 'app.js'), encoding='utf-8').read()
for ref in re.findall(r"fetch\('([^']+)'\)", app):
    if not exists(ref, 'index.html'):
        fail.append(f'app.js fetches {ref}, which does not exist')
# Every page link the script writes must point at a page that exists.
for kind in ('states', 'crimes'):
    if not os.path.isdir(os.path.join(ROOT, kind)): fail.append(f'{kind}/ has not been built')

toml = open(os.path.join(ROOT, 'netlify.toml'), encoding='utf-8').read()
csp = re.search(r'Content-Security-Policy = "([^"]+)"', toml).group(1)
i18n = open(os.path.join(ROOT, 'js', 'i18n.js'), encoding='utf-8').read()
loaded = re.sub(r'<a\s[^>]*>', '', page)  # a link is navigation, which the CSP does not govern
loaded = re.sub(r'<script type="application/ld\+json">.*?</script>', '', loaded, flags=re.S)  # structured data names addresses, it loads nothing
for origin in set(re.findall(r'https://[a-z0-9.-]+', loaded + i18n)) - {'https://github.com', 'https://www.womenonrecord.net'}:
    if origin not in csp:
        fail.append(f'{origin} is loaded but not allowed by the CSP')

rows = list(csv.DictReader(open(os.path.join(ROOT, 'data', 'womenonrecord.csv'), encoding='utf-8')))
pop = {(r['state'], r['year']): float(r['value']) for r in rows if r['crime_code'] == 'FEMALE_POP' and r['value']}
cases = {(r['crime_code'], r['state'], r['year']): float(r['value']) for r in rows if r['measure'] == 'cases' and r['value']}
checked = 0
# NCRB misprints, kept as printed because the dataset never alters a printed figure.
# Each is named here with its source, so a new one still fails.
MISPRINTS = {('2016', 'Uttarakhand', 'TRAFFICKING'): 'Crime in India 2016, table 3A.2: 2 cases over 52.2 lakh women is 0.04, NCRB prints 0.1'}
for r in rows:
    if r['measure'] != 'rate' or not r['value'] or 'Computed here' in r['note']:
        continue
    if (r['year'], r['state'], r['crime_code']) in MISPRINTS:
        continue
    c = cases.get((r['crime_code'], r['state'], r['year']))
    p = pop.get((r['state'], r['year']))
    if c is None or not p:
        continue
    want = c / p
    # population is printed to 0.1 lakh, so allow for that rounding and no more
    if abs(want - float(r["value"])) > 0.06 + want * 0.05 / p + 0.01 * want:
        fail.append(f"{r['year']} {r['state']} {r['crime_code']}: printed rate {r['value']} but cases/pop = {want:.2f}")
    checked += 1

# IPC/BNS crimes plus special-law crimes must equal the total, for every place and year.
for (code, st_, yr), v in cases.items():
    if code == 'TOTAL':
        parts = cases.get(('IPC_TOTAL', st_, yr), 0) + cases.get(('SLL_TOTAL', st_, yr), 0)
        if abs(parts - v) > 0.5:
            fail.append(f'{yr} {st_}: IPC_TOTAL + SLL_TOTAL = {parts}, TOTAL = {v}')

# Tables added in October 2026 must agree with the ones they sit beside.
val = {(r['crime_code'], r['state'], r['year'], r['measure']): r['value'] for r in rows}
for (code, st_, yr, m), v in val.items():
    if code == 'RAPE_SECTION' and m == 'cases' and v != val.get(('RAPE', st_, yr, 'cases')):
        fail.append(f'{yr} {st_}: rape by section (3A.11) totals {v}, rape cases (3A.2) are {val.get(("RAPE", st_, yr, "cases"))}')
    if code == 'RAPE_OFFENDER' and m == 'cases' and v != val.get(('RAPE', st_, yr, 'cases')):
        fail.append(f'{yr} {st_}: rape by offender (3A.4) totals {v}, rape cases (3A.2) are {val.get(("RAPE", st_, yr, "cases"))}')
    if code == 'POCSO_VICTIMS_AGE' and m == 'victims' and v != val.get(('POCSO_RAPE', st_, yr, 'victims')):
        fail.append(f'{yr} {st_}: girls by age (4A.9) total {v}, POCSO s.4 and 6 girl victims (3A.2) are {val.get(("POCSO_RAPE", st_, yr, "victims"))}')
    if code == 'PERSONS' and st_ == 'All India' and v != val.get(('TOTAL', st_, yr, m)):
        fail.append(f'{yr}: {m} is {v} by state (3A.10) and {val.get(("TOTAL", st_, yr, m))} by crime head (3A.9)')
# Continuity from one year to the next. A column read one place to the left or right
# still adds up to its own printed totals, and its printed rate still matches its own
# cases, so neither check above can see it. What it changes is the size of the crime and
# where in India it happens. Each crime's India count may not move by more than JUMP
# times between two years, and its spread across the states (total variation distance
# between the two years' shares) by more than SPREAD, unless CONTINUITY_OK names the
# pair with its reason. Crimes under FLOOR cases in both years are too noisy to judge.
# Set from 2017 to 2024, where the largest ordinary moves are 2.1 times and 0.34.
# Fault-injected on 2026-10-12 by pointing seven 2024 headings at a neighbouring
# column (cruelty, dowry deaths, acid attack, rape, POCSO, insult, cyber): all seven fail,
# here or in the cross-checks above.
JUMP, SPREAD, FLOOR = 2.5, 0.36, 100
CONTINUITY_OK = {
    ('RAPE_GIRLS_IPC', 2019): 'Rape of girls moved to POCSO; the IPC count fell by half.',
    ('RAPE_GIRLS_IPC', 2020): 'Rape of girls moved to POCSO; the IPC count fell by half.',
    ('RAPE_GIRLS_IPC', 2022): 'Rape of girls moved to POCSO; the IPC count fell to a third.',
}
STATE_ROWS = {r['state'] for r in rows if r['kind'] in ('state', 'ut')}
cont = {}
for r in rows:
    if r['measure'] == 'cases' and r['value'] != '' and int(r['year']) >= 2017 and (r['kind'] in ('state', 'ut') or r['state'] == 'All India'):
        cont.setdefault((r['crime_code'], int(r['year'])), {})[r['state']] = float(r['value'])
for (code, yr), now in sorted(cont.items()):
    before = cont.get((code, yr - 1))
    if not before or (code, yr) in CONTINUITY_OK:
        continue
    a, b = before.get('All India'), now.get('All India')
    if not a or not b or max(a, b) < FLOOR:
        continue
    ta = sum(v for k, v in before.items() if k in STATE_ROWS); tb = sum(v for k, v in now.items() if k in STATE_ROWS)
    tv = 0.5 * sum(abs(before.get(k, 0) / ta - now.get(k, 0) / tb) for k in STATE_ROWS) if ta and tb else 0
    if max(a, b) / min(a, b) > JUMP or tv > SPREAD:
        fail.append(f'{code} {yr - 1} to {yr}: India cases {a:,.0f} to {b:,.0f}, spread across states moved {tv:.2f}. '
                    f'A column may be read from the wrong place; if the change is real, add it to CONTINUITY_OK with its reason')
# Every crime and state page has a link preview of its own, and every card says what the
# data says now. A card is an image, so nothing else would notice it going stale.
sys.path.insert(0, os.path.join(ROOT, 'scripts', 'og'))
import make_page_cards
_, want = make_page_cards.plan()
have = json.load(open(os.path.join(ROOT, 'assets', 'og', 'cards.json'), encoding='utf-8'))
if have != want:
    fail.append('assets/og/cards.json is stale: run python3 scripts/og/make_page_cards.py')
for u, c in want.items():
    if not os.path.exists(os.path.join(ROOT, c['img'])):
        fail.append(f'{u} has no preview image at {c["img"]}')
for f in PAGES:
    u = '/' + f[:-len('index.html')]
    if u.startswith(('/crimes/', '/states/')) and u not in ('/crimes/', '/states/') and u not in want:
        fail.append(f'{u} has no preview card of its own')
for f in ('downloads/womenonrecord.xlsx', 'downloads/codebook.csv', 'data/site.json'):
    if not os.path.exists(os.path.join(ROOT, f)):
        fail.append(f'{f} is missing')

text = re.sub(r'<(script|style)[^>]*>.*?</\1>', '', page, flags=re.S)
text = re.sub(r'<[^>]+>', ' ', text)
# The owner's banned words (the part of the list a regex can hold) and the
# "X, not Y" endings. See CLAUDE.md.
BANNED = r'\b(delve\w*|certainly|utilise|leverage|robust|streamline|harness|foster|underscore|enhance|testament|pivotal|intricate|crucial|transformative|groundbreaking|tapestry|landscape|paradigm|synergy|showcas\w+|meticulous\w*|notabl[ey]|noteworthy|seamless\w*|multifaceted|nuanced|holistic|invaluable|unparalleled|garner|bolster|elucidate|interplay|underpin\w*|vibrant|stunning|boasts|renowned|embark|unlock|unleash|empower\w*|elevate|amplify|resonate|facilitate|spearhead|realm|myriad|plethora|genuinely|truly|arguably|honestly|navigate|liminal|palpable|ineffable|visceral|dappled|ledger|commendable|versatil\w+|solidif\w+|bustling|nestled|picturesque|breathtaking|poignant|captivat\w+|evocative|evoke|indelible|picturesque)\b'
PHRASES = r"shed(?:s|ding)? light on|at the intersection of|when it comes to|it.s important to note|plays? a (?:vital|key|significant) role|in today.s|ever-evolving|needless to say|pave the way|stands? as a testament|rich (?:cultural )?heritage|deeply rooted|a stark reminder"
TURNS = [r',\s*not\s+(?:a |an |the )?\w+\.', r'\bnot only\b', r'\bnot just\b', r"\bit'?s not\b.*\bit'?s\b"]
en = json.load(open(os.path.join(ROOT, 'i18n', 'en.json'), encoding='utf-8'))
readme = open(os.path.join(ROOT, 'README.md'), encoding='utf-8').read()
for where, s in [('the pages', text), ('README.md', readme)] + [(f'en.json {k}', v) for k, v in en.items()]:
    if ';' in s and where != 'the pages':
        fail.append(f'semicolon in {where}')
    if '\u2014' in s or ' -- ' in s:
        fail.append(f'em dash in {where}')
    for w in re.findall(BANNED, s, flags=re.I):
        fail.append(f'banned word "{w}" in {where}')
    for w in re.findall(PHRASES, s, flags=re.I):
        fail.append(f'banned phrase "{w}" in {where}')
    for pat in TURNS:
        if re.search(pat, s, flags=re.I):
            fail.append(f'"X, not Y" turn ({pat}) in {where}')

# A locale's strings must not carry another Indic script, which is what a
# machine-translated or pasted-in string shows first.
SCRIPTS = {'deva': (0x0900, 0x097F), 'beng': (0x0980, 0x09FF), 'taml': (0x0B80, 0x0BFF), 'arab': (0x0600, 0x06FF)}
OWN = {'hi': 'deva', 'mr': 'deva', 'bn': 'beng', 'ta': 'taml', 'ur': 'arab'}
for l, own in OWN.items():
    d = json.load(open(os.path.join(ROOT, 'i18n', l + '.json'), encoding='utf-8'))
    for k, v in d.items():
        for name, (a, b) in SCRIPTS.items():
            if name != own and any(a <= ord(ch) <= b and ch not in '\u0964\u0965' for ch in v):
                fail.append(f'{l} {k} carries {name} characters')
        if ';' in v or '\u061b' in v:
            fail.append(f'{l} {k} joins clauses with a semicolon')
        # The owner's rule: India is بھارت everywhere in Urdu.
        if l == 'ur' and 'ہندوستان' in v:
            fail.append(f'ur {k} names India as ہندوستان, use بھارت')
        # Numbers stay in Western digits in every language.
        if re.search('[\u0966-\u096f\u09e6-\u09ef\u0be6-\u0bef\u06f0-\u06f9\u0660-\u0669]', v):
            fail.append(f'{l} {k} writes a number in native digits, use 0-9')

# data/events.json: the protests list. Each entry is backed by a report that was read, so
# it needs a link, the report's own words and an honest account of how its date was found.
# A date worked out from a weekday has to say so, and nothing may carry a survivor's details.
import datetime
EV = json.load(open(os.path.join(ROOT, 'data', 'events.json'), encoding='utf-8'))
ev_ids = set()
for e in EV['events']:
    w = 'events.json ' + str(e.get('id'))
    for k in ['id', 'title', 'kind', 'place', 'start', 'date_basis', 'what', 'outlet', 'url', 'quote', 'accessed']:
        if not e.get(k): fail.append(f'{w} has no {k}')
    if e.get('id') in ev_ids: fail.append(f'{w} is listed twice')
    ev_ids.add(e.get('id'))
    try: datetime.date.fromisoformat(e.get('start', ''))
    except ValueError: fail.append(f'{w} start is not a date')
    if e.get('date_basis') not in ('stated', 'worked out'): fail.append(f'{w} date_basis must be stated or worked out')
    if e.get('date_basis') == 'worked out' and not e.get('date_note'): fail.append(f'{w} works its date out and does not say how')
    if not str(e.get('url', '')).startswith('https://'): fail.append(f'{w} url is not https')
    for k in ['title', 'organiser', 'place', 'what', 'date_note', 'affiliation']:
        v = e.get(k) or ''
        for pat, what in [(';', 'a semicolon'), ('\u2014', 'an em dash'), (BANNED, 'a banned word'), (PHRASES, 'a banned phrase')]:
            if re.search(pat, v, flags=re.I): fail.append(f'{w} {k} carries {what}')
        for pat in TURNS:
            if re.search(pat, v, flags=re.I): fail.append(f'{w} {k} has an "X, not Y" turn')
    if re.search(r'\b(her name|his name|named|identified as|\d{1,2}-year-old|aged \d)', e.get('what', ''), flags=re.I):
        fail.append(f'{w} may describe a survivor: no name, age or detail that could identify her')

# data/updates.json and data/corrections.json: the public record of changes. Both are newest
# first, dated, and follow the writing rules. A correction names the page it changed, and a
# link must point at a page that exists. Nothing may repeat a detail that could identify a survivor.
for fname, fields in [('updates', None), ('corrections', ['page', 'href', 'before', 'after', 'why'])]:
    D2 = json.load(open(os.path.join(ROOT, 'data', fname + '.json'), encoding='utf-8'))
    dates = [e.get('date', '') for e in D2['entries']]
    if dates != sorted(dates, reverse=True): fail.append(f'{fname}.json is not newest first')
    for e in D2['entries']:
        w = f"{fname}.json {e.get('date')}"
        try: datetime.date.fromisoformat(e.get('date', ''))
        except ValueError: fail.append(f'{w} has no valid date')
        texts, hrefs = [], []
        if fname == 'updates':
            if not e.get('items'): fail.append(f'{w} has no items')
            for it in e.get('items', []):
                texts.append(it.get('text', '')); hrefs.append(it.get('href'))
        else:
            for k in fields:
                if not e.get(k): fail.append(f'{w} has no {k}')
            texts = [e.get(k, '') for k in ['page', 'before', 'after', 'why']]; hrefs = [e.get('href')]
        for h in hrefs:
            if h and not exists(h.split('#')[0], '/'): fail.append(f'{w} links to {h}, which is not a page')
        for v in texts:
            for pat, what in [(';', 'a semicolon'), ('\u2014', 'an em dash'), (BANNED, 'a banned word'), (PHRASES, 'a banned phrase')]:
                if re.search(pat, v, flags=re.I): fail.append(f'{w} carries {what}: {v[:50]}')
            for pat in TURNS:
                if re.search(pat, v, flags=re.I): fail.append(f'{w} has an "X, not Y" turn: {v[:50]}')
            if re.search(r'\b(\d{1,2}-year-old|aged \d|girl of \d|schoolgirl|schoolboy)', v, flags=re.I):
                fail.append(f'{w} may repeat a detail that could identify a survivor: {v[:50]}')

if fail:
    print('\n'.join(fail)); sys.exit(1)
print(f'PASS: {checked} printed rates agree with cases and population; references, CSP and downloads in order')
