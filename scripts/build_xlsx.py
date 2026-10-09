"""Write downloads/shecounts.xlsx and downloads/codebook.csv from data/shecounts.csv.

Sheets: About, Codebook, Sources, Data (every row of the CSV), and one wide
sheet per crime head (states down, years across) for the measure most people
want: cases, or victims where NCRB counts victims.
Usage: python3 scripts/build_xlsx.py
"""
import csv, json, os
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment, PatternFill
from openpyxl.utils import get_column_letter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rows = list(csv.DictReader(open(os.path.join(ROOT, 'data', 'shecounts.csv'), encoding='utf-8')))
src = json.load(open(os.path.join(ROOT, 'data', 'raw', 'sources.json')))
YEARS = sorted({r['year'] for r in rows})

COLUMNS = [
 ('state', 'State or union territory as NCRB prints it, or a total row (Total states, Total UTs, All India).'),
 ('lgd_code', 'Local Government Directory state code, for joining to other data. Blank for total rows.'),
 ('kind', 'state, ut (union territory) or total.'),
 ('year', 'Calendar year the cases were recorded, 2020 to 2024.'),
 ('crime_code', 'Short stable code for the crime head. See the crime codes below.'),
 ('group', 'sexual, killed, home, other, total, outcome or denominator.'),
 ('crime_head', 'The crime head in plain words.'),
 ('ipc_section', 'Indian Penal Code section(s), where the head is an IPC offence.'),
 ('bns_section_or_act', 'Bharatiya Nyaya Sanhita section(s), or the special law, that the head covers.'),
 ('measure', 'What the value counts. cases: FIRs recorded. victims: persons. rate: cases per lakh women. Police and court measures are named in full.'),
 ('value', 'The figure. Blank where NCRB published no figure (flag NOT_REPORTED); a blank is never a zero.'),
 ('unit', 'count, rate, percent or lakh women.'),
 ('source_edition', 'The Crime in India edition the figure was read from.'),
 ('table_no', 'NCRB table number in Volume 1.'),
 ('source_url', 'Where the PDF was downloaded from.'),
 ('source_sha256', 'SHA-256 of that PDF, so anyone can confirm they hold the same file.'),
 ('flag', 'Coded caveats, separated by semicolons. See the flags below.'),
 ('note', 'Plain-words note where the figure needs one.'),
]
FLAGS = [
 ('PRINCIPAL_OFFENCE', 'NCRB counts each FIR once, under its most serious offence. On every row.'),
 ('LOCKDOWN_2020', '2020: the COVID-19 lockdown kept people from police stations and courts. Counts are lower for that reason.'),
 ('CODE_SPLIT_2024', '2024: offences from 1 July 2024 were booked under the BNS, earlier ones under the IPC. NCRB reports both; cases is their sum.'),
 ('NOT_REPORTED', 'NCRB published no figure for this cell.'),
]

wb = Workbook()
bold = Font(bold=True)
head_fill = PatternFill('solid', fgColor='1F2A5C')
head_font = Font(bold=True, color='FFFFFF')

def header(ws, cols):
    ws.append(cols)
    for c in ws[1]:
        c.font = head_font; c.fill = head_fill
    ws.freeze_panes = 'A2'

ws = wb.active; ws.title = 'About'
about = [
 ['She Counts: crimes against women in India, as police and courts recorded them, 2020 to 2024'],
 [],
 ['What this is', 'Every figure published state-wise in Chapter 3A (crimes against women) and table 2A.3 (murder victims by sex) of NCRB Crime in India, Volume 1, for 2020 to 2024, read from the PDFs by script and checked against NCRB\'s own totals.'],
 ['What it cannot show', 'These are cases recorded by police. They are not a measure of how often these crimes happen: most violence against women is never reported. A higher rate in one state can mean more crime or more recording. NCRB itself warns that states should not be compared on these figures alone.'],
 ['Police and court outcomes', 'NCRB publishes police and court disposal by state only for all crimes against women together (COURTS, POLICE). For single crimes such as rape it publishes them for India as a whole only (measures starting police_ and court_ on All India rows).'],
 ['Checks', 'For every count column, the 28 states add to NCRB\'s Total State(s), the 8 union territories to Total UT(s), and both to Total All India. The build stops on any mismatch.'],
 ['Licence', 'Figures: National Crime Records Bureau. This compilation, its codes and notes: CC BY 4.0. Cite NCRB and She Counts.'],
 ['Built', 'scripts/build_data.py and scripts/build_xlsx.py at github.com/Varnasr/SheCounts'],
]
for r in about: ws.append(r)
ws['A1'].font = Font(bold=True, size=14)
ws.column_dimensions['A'].width = 26; ws.column_dimensions['B'].width = 120
for r in ws.iter_rows(min_row=3):
    r[0].font = bold
    for c in r: c.alignment = Alignment(wrap_text=True, vertical='top')

ws = wb.create_sheet('Codebook')
header(ws, ['item', 'meaning'])
ws.append(['COLUMNS', '']); ws[ws.max_row][0].font = bold
for k, v in COLUMNS: ws.append([k, v])
ws.append([]); ws.append(['CRIME CODES', '']); ws[ws.max_row][0].font = bold
seen = {}
for r in rows:
    seen.setdefault(r['crime_code'], (r['crime_head'], r['ipc_section'], r['bns_section_or_act']))
for k, (lab, ipc, bns) in seen.items():
    ws.append([k, lab + (f'. IPC {ipc}' if ipc else '') + (f'. BNS/Act {bns}' if bns else '')])
ws.append([]); ws.append(['FLAGS', '']); ws[ws.max_row][0].font = bold
for k, v in FLAGS: ws.append([k, v])
ws.append([]); ws.append(['MEASURES', '']); ws[ws.max_row][0].font = bold
for m in sorted({r['measure'] for r in rows}): ws.append([m, ''])
ws.column_dimensions['A'].width = 40; ws.column_dimensions['B'].width = 120

ws = wb.create_sheet('Sources')
header(ws, ['year', 'title', 'publisher', 'copy held by', 'url', 'sha256', 'retrieved on'])
for y, s in src.items():
    ws.append([int(y), s['title'], s['publisher'], s['mirror'], s['url'], s['sha256'], s['retrieved_on']])
for i, w in enumerate([8, 30, 44, 30, 90, 70, 14], 1): ws.column_dimensions[get_column_letter(i)].width = w

ws = wb.create_sheet('Data')
cols = list(rows[0].keys())
header(ws, cols)
for r in rows:
    v = r['value']
    ws.append([int(r['year']) if k == 'year' else (float(v) if k == 'value' and v != '' else r[k]) for k in cols])
ws.auto_filter.ref = ws.dimensions

# One wide sheet per head
order = []
for r in rows:
    if r['crime_code'] not in order: order.append(r['crime_code'])
for code in order:
    if code in ('POLICE', 'COURTS', 'FEMALE_POP', 'RAPE_VICTIMS_AGE'):
        measure = {'POLICE': 'chargesheeting_rate', 'COURTS': 'conviction_rate', 'FEMALE_POP': 'population_lakh', 'RAPE_VICTIMS_AGE': 'victims'}[code]
    elif code in ('MURDER_WOMEN', 'MURDER_ALL'):
        measure = 'victims'
    else:
        measure = 'cases'
    sub = [r for r in rows if r['crime_code'] == code and r['measure'] == measure]
    if not sub: continue
    ws = wb.create_sheet(code[:31])
    ws.append([sub[0]['crime_head'] + f' ({measure})'])
    ws['A1'].font = Font(bold=True, size=12)
    ws.append(['state'] + YEARS)
    for c in ws[2]: c.font = head_font; c.fill = head_fill
    places = []
    for r in sub:
        if r['state'] not in places: places.append(r['state'])
    for p in places:
        vals = {r['year']: r['value'] for r in sub if r['state'] == p}
        ws.append([p] + [float(vals[y]) if vals.get(y) not in (None, '') else None for y in YEARS])
    notes = sorted({r['note'] for r in sub if r['note']})
    ws.append([])
    for n in notes: ws.append(['Note: ' + n])
    ws.column_dimensions['A'].width = 34
    ws.freeze_panes = 'B3'

os.makedirs(os.path.join(ROOT, 'downloads'), exist_ok=True)
wb.save(os.path.join(ROOT, 'downloads', 'shecounts.xlsx'))
with open(os.path.join(ROOT, 'downloads', 'codebook.csv'), 'w', newline='', encoding='utf-8') as f:
    w = csv.writer(f)
    w.writerow(['kind', 'item', 'meaning'])
    for k, v in COLUMNS: w.writerow(['column', k, v])
    for k, (lab, ipc, bns) in seen.items(): w.writerow(['crime_code', k, lab + (f'. IPC {ipc}' if ipc else '') + (f'. BNS/Act {bns}' if bns else '')])
    for k, v in FLAGS: w.writerow(['flag', k, v])
print('wrote downloads/shecounts.xlsx and downloads/codebook.csv')
