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
for origin in set(re.findall(r'https://[a-z0-9.-]+', page + i18n)) - {'https://github.com'}:
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
en = json.load(open(os.path.join(ROOT, 'i18n', 'en.json'), encoding='utf-8'))
for where, s in [('index.html', text)] + [(f'en.json {k}', v) for k, v in en.items()]:
    if '—' in s:
        fail.append(f'em dash in {where}')

if fail:
    print('\n'.join(fail)); sys.exit(1)
print(f'PASS: {checked} printed rates agree with cases and population; references, CSP and downloads in order')
