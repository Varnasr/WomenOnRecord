"""Write downloads/womenonrecord.xlsx and downloads/codebook.csv from data/womenonrecord.csv.

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
rows = list(csv.DictReader(open(os.path.join(ROOT, 'data', 'womenonrecord.csv'), encoding='utf-8')))
src = json.load(open(os.path.join(ROOT, 'data', 'raw', 'sources.json')))
LAST = max(int(r['year']) for r in rows)
YEARS = sorted({r['year'] for r in rows})

COLUMNS = [
 ('state', 'State or union territory as NCRB prints it, or a total row (Total states, Total UTs, All India).'),
 ('lgd_code', 'Local Government Directory state code, for joining to other data. Blank for total rows.'),
 ('kind', 'state, ut (union territory) or total.'),
 ('year', f'Calendar year the cases were recorded, 2014 to {LAST}.'),
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
 ('LOCKDOWN_2020', 'In 2020 the COVID-19 lockdown limited access to police stations and courts. Counts are lower in 2020, and NCRB does not say how much of the fall the lockdown explains.'),
 ('CODE_SPLIT_2024', 'In 2024, offences from 1 July 2024 were booked under the BNS and earlier ones under the IPC. NCRB reports both, and cases is their sum.'),
 ('NOT_REPORTED', 'NCRB published no figure for this cell.'),
 ('BOUNDARIES_PRE_2020', '2014 to 2019: Jammu and Kashmir includes Ladakh, and Dadra and Nagar Haveli and Daman and Diu, which NCRB printed separately, are added together here. Totals for states and for union territories are as NCRB printed them, with Jammu and Kashmir counted as a state.'),
 ('WB_2019_REPEATS_2018', 'For West Bengal in 2019, NCRB received no data in time and printed the 2018 figures again. Rates differ only because the population changed.'),
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
 [f'Women on Record: crimes against women in India, as police and courts recorded them, 2014 to {LAST}'],
 [],
 ['What this is', f'Every figure published state-wise in Chapter 3A (crimes against women) and table 2A.3 (murder victims by sex) of NCRB Crime in India, Volume 1, for 2016 to {LAST}, the tables on rape of Scheduled Caste and Scheduled Tribe women and girls in chapters 7A and 7C of Volume 2 for 2021 to {LAST}, and in tables 5.2, 5.3, 5.5, 5.6 and 3.3 for 2014 and 2015, read from the PDFs by script and checked against NCRB\'s own totals.'],
 ['Years that differ', 'NCRB changed its crime headings in 2017. A heading defined differently before then carries a code of its own ending in _2014DEF or _2016DEF, so it never joins a later series by accident. In 2016 rape includes POCSO cases booked with s.376, and before 2017 the total for crimes against women leaves out POCSO and several other headings. For 2014 and 2015 NCRB published police and court outcomes for India only. The population behind the rates changed in 2018 and again in 2020.'],
 ['What it cannot show', 'These are cases recorded by police, which is fewer than the crimes that took place. In the National Family Health Survey of 2019-21, 76.5 in every 100 women who had experienced physical or sexual violence had never told anyone about it. A higher rate in one state can mean more crime or more recording. NCRB itself warns that states should not be compared on these figures alone.'],
 ['Police and court outcomes', 'NCRB publishes police and court disposal by state only for all crimes against women together (COURTS, POLICE). For single crimes such as rape it publishes them for India as a whole only (measures starting police_ and court_ on All India rows).'],
 ['Checks', 'For every count column, the states add to NCRB\'s Total State(s), the union territories to Total UT(s), and both to Total All India, as NCRB drew them in that year. The build stops on any mismatch. The checks on 2014 to 2019 are in data/raw/old.'],
 ['Licence', 'Figures: National Crime Records Bureau. This compilation, its codes and notes: CC BY 4.0. Cite NCRB and Women on Record.'],
 ['Built', 'Read from the NCRB PDFs and compiled by script.'],
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
for y, s in json.load(open(os.path.join(ROOT, 'data', 'raw', 'sources_v2.json'))).items():
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
    if code in ('POLICE', 'COURTS', 'FEMALE_POP', 'RAPE_VICTIMS_AGE', 'POCSO_VICTIMS_AGE'):
        measure = {'POLICE': 'chargesheeting_rate', 'COURTS': 'conviction_rate', 'FEMALE_POP': 'population_lakh', 'RAPE_VICTIMS_AGE': 'victims', 'POCSO_VICTIMS_AGE': 'victims'}[code]
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
wb.save(os.path.join(ROOT, 'downloads', 'womenonrecord.xlsx'))
with open(os.path.join(ROOT, 'downloads', 'codebook.csv'), 'w', newline='', encoding='utf-8') as f:
    w = csv.writer(f)
    w.writerow(['kind', 'item', 'meaning'])
    for k, v in COLUMNS: w.writerow(['column', k, v])
    for k, (lab, ipc, bns) in seen.items(): w.writerow(['crime_code', k, lab + (f'. IPC {ipc}' if ipc else '') + (f'. BNS/Act {bns}' if bns else '')])
    for k, v in FLAGS: w.writerow(['flag', k, v])
print('wrote downloads/womenonrecord.xlsx and downloads/codebook.csv')

# The eight context sources, in a workbook of their own: an About sheet, then
# each source's rows exactly as collected (context/<source>/data.csv).
CX = [('nfhs', 'NFHS-5', 'National Family Health Survey 2019-21: violence by a husband, sexual violence, and whether women sought help. Percentages of women surveyed.'),
      ('ncw', 'NCW complaints', 'Complaints received by the National Commission for Women, 2020 to 2024, by state and category. Complaints, not crimes.'),
      ('adsi', 'ADSI suicides', 'NCRB Accidental Deaths and Suicides in India, 2020 to 2024: suicides of women and of housewives, by state.'),
      ('bprd', 'BPR&D police', 'Data on Police Organisations as on 1 January 2020 and 2023: strength, women police and women police stations.'),
      ('ftsc', 'Fast track courts', 'Fast track special courts: courts working, cases pending and decided, conviction rate and central funds, from answers in Parliament.'),
      ('njdg', 'NJDG', 'National Judicial Data Grid, 9 October 2026: pending cases in district and taluka courts and those filed by a woman. Not crimes against women.'),
      ('nirbhaya', 'Nirbhaya Fund', 'Nirbhaya Fund allocated and released or used, from answers in Parliament of 12 August 2026.'),
      ('adr', 'ADR legislators', 'Sitting MPs and MLAs who declared pending cases of crimes against women in election affidavits. Counts only, no names. Not convictions.')]
cw = Workbook()
ws = cw.active; ws.title = 'About'
ws.append(['Women on Record: context sources beside the NCRB figures'])
ws['A1'].font = Font(bold=True, size=14)
ws.append([])
ws.append(['Read first', 'Each source measures something different from NCRB recorded crime, so none can be added to NCRB figures or set against them as a rate. Every row carries its source, table and page. The checks run on each source are in context/<source>/notes.md in the repository.'])
for key, name, what in CX: ws.append([name, what])
ws.column_dimensions['A'].width = 24; ws.column_dimensions['B'].width = 120
for r in ws.iter_rows(min_row=3):
    r[0].font = bold
    for c in r: c.alignment = Alignment(wrap_text=True, vertical='top')
for key, name, what in CX:
    rd = list(csv.reader(open(os.path.join(ROOT, 'context', key, 'data.csv'), encoding='utf-8')))
    ws = cw.create_sheet(name[:31])
    header(ws, rd[0])
    vi = rd[0].index('value')
    for r in rd[1:]:
        v = r[vi].replace(',', '')
        try: r[vi] = float(v) if v not in ('', 'NA') else (None if v == '' else v)
        except ValueError: pass
        ws.append(r)
    ws.auto_filter.ref = ws.dimensions
    for i in range(1, len(rd[0]) + 1): ws.column_dimensions[get_column_letter(i)].width = 22
cw.save(os.path.join(ROOT, 'downloads', 'context.xlsx'))
