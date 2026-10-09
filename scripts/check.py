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

page = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
for ref in re.findall(r'(?:src|href)="([^"#:]+)"', page):
    if not os.path.exists(os.path.join(ROOT, ref)):
        fail.append(f'index.html loads {ref}, which does not exist')
app = open(os.path.join(ROOT, 'js', 'app.js'), encoding='utf-8').read()
for ref in re.findall(r"fetch\('([^']+)'\)", app):
    if not os.path.exists(os.path.join(ROOT, ref)):
        fail.append(f'app.js fetches {ref}, which does not exist')

toml = open(os.path.join(ROOT, 'netlify.toml'), encoding='utf-8').read()
csp = re.search(r'Content-Security-Policy = "([^"]+)"', toml).group(1)
i18n = open(os.path.join(ROOT, 'js', 'i18n.js'), encoding='utf-8').read()
loaded = re.sub(r'<a\s[^>]*>', '', page)  # a link is navigation, which the CSP does not govern
for origin in set(re.findall(r'https://[a-z0-9.-]+', loaded + i18n)) - {'https://github.com', 'https://shecounts.netlify.app'}:
    if origin not in csp:
        fail.append(f'{origin} is loaded but not allowed by the CSP')

rows = list(csv.DictReader(open(os.path.join(ROOT, 'data', 'shecounts.csv'), encoding='utf-8')))
pop = {(r['state'], r['year']): float(r['value']) for r in rows if r['crime_code'] == 'FEMALE_POP' and r['value']}
cases = {(r['crime_code'], r['state'], r['year']): float(r['value']) for r in rows if r['measure'] == 'cases' and r['value']}
checked = 0
for r in rows:
    if r['measure'] != 'rate' or not r['value'] or 'Computed here' in r['note']:
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

for f in ('downloads/shecounts.xlsx', 'downloads/codebook.csv', 'data/site.json'):
    if not os.path.exists(os.path.join(ROOT, f)):
        fail.append(f'{f} is missing')

text = re.sub(r'<(script|style)[^>]*>.*?</\1>', '', page, flags=re.S)
text = re.sub(r'<[^>]+>', ' ', text)
# The owner's banned words (the part of the list a regex can hold) and the
# "X, not Y" endings. See CLAUDE.md.
BANNED = r'\b(delve\w*|certainly|utilise|leverage|robust|streamline|harness|foster|underscore|enhance|testament|pivotal|intricate|crucial|transformative|groundbreaking|tapestry|landscape|paradigm|synergy|showcas\w+|meticulous\w*|notabl[ey]|noteworthy|seamless\w*|multifaceted|nuanced|holistic|invaluable|unparalleled|garner|bolster|elucidate|interplay|underpin\w*|vibrant|stunning|boasts|renowned|embark|unlock|unleash|empower\w*|elevate|amplify|resonate|facilitate|spearhead|realm|myriad|plethora|genuinely|truly|arguably|honestly|navigate)\b'
TURNS = [r',\s*not\s+(?:a |an |the )?\w+\.', r'\bnot only\b', r'\bnot just\b', r"\bit'?s not\b.*\bit'?s\b"]
en = json.load(open(os.path.join(ROOT, 'i18n', 'en.json'), encoding='utf-8'))
readme = open(os.path.join(ROOT, 'README.md'), encoding='utf-8').read()
for where, s in [('index.html', text), ('README.md', readme)] + [(f'en.json {k}', v) for k, v in en.items()]:
    if ';' in s and where != 'index.html':
        fail.append(f'semicolon in {where}')
    if '\u2014' in s or ' -- ' in s:
        fail.append(f'em dash in {where}')
    for w in re.findall(BANNED, s, flags=re.I):
        fail.append(f'banned word "{w}" in {where}')
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

if fail:
    print('\n'.join(fail)); sys.exit(1)
print(f'PASS: {checked} printed rates agree with cases and population; references, CSP and downloads in order')
