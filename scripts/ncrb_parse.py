"""Parse state-wise tables from NCRB Crime in India, Volume 1, after
`pdftotext -layout`. Each page of a table has a row of column numbers
([3] [4] ...) and one row per State/UT. Values are assigned to column numbers
by position in the row, and each column gets the header text sitting above it.
"""
import re

NUM = re.compile(r'^(-?\d+(\.\d+)?|-)$')
COLROW = re.compile(r'\[(\d+)\]')

STATES = ["Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa",
"Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh",
"Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab","Rajasthan",
"Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal",
"A&N Islands","Chandigarh","D&N Haveli and Daman & Diu","Delhi","Jammu & Kashmir",
"Ladakh","Lakshadweep","Puducherry"]
TOTALS = {"TOTAL STATE":"Total states","TOTAL UT":"Total UTs","TOTAL ALL":"All India"}

def pages(txt):
    return txt.split('\f')

def table_pages(txt, table):
    """Pages whose footer names the table, e.g. 'TABLE 3A.2 Page 3 of 28'."""
    out = []
    for p in pages(txt):
        m = re.search(r'TABLE\s+' + re.escape(table) + r'\s+Page\s+(\d+)\s+of\s+(\d+)', p)
        if m:
            out.append((int(m.group(1)), p))
    return [p for _, p in sorted(out)]

def colpositions(line):
    return [(int(m.group(1)), m.start(), m.end()) for m in COLROW.finditer(line)]

def parse_page(p):
    lines = p.split('\n')
    ci = next(i for i, l in enumerate(lines) if l.strip().startswith('[1]'))
    cols = colpositions(lines[ci])
    datacols = [c for c in cols if c[0] >= 3]
    header = lines[:ci]
    # header text above each data column: characters within a widened span
    labels = {}
    for k, (n, s, e) in enumerate(datacols):
        labels[n] = ''
    rows = {}
    pending_name = ''
    for j in range(ci + 1, len(lines)):
        l = re.sub(r'[*+@#$]', ' ', lines[j]).replace('\u2010', '-').replace('\u2013', '-').replace('\u2212', '-')
        s = l.strip()
        if not s or s.startswith(('●', '+', 'STATES', 'UNION', 'TABLE')) or 'Page' in s:
            if s.startswith(('STATES', 'UNION')):
                pending_name = ''
            continue
        toks = s.split()
        nums = []
        while toks and NUM.match(toks[-1].replace(',', '')):
            nums.insert(0, toks.pop())
        name = ' '.join(toks)
        if len(nums) < len(datacols):
            # a wrapped name fragment, e.g. 'D&N Haveli and Daman'
            pending_name = (pending_name + ' ' + s).strip()
            continue
        if len(nums) > len(datacols):
            # leading SL number with no name
            nums = nums[len(nums) - len(datacols):]
        name = re.sub(r'^\d+\s*', '', name).strip()
        if not name:
            name = pending_name
        pending_name = ''
        nxt = lines[j + 1].strip() if j + 1 < len(lines) else ''
        key = canon(name, nxt)
        if key is None and nxt and not any(NUM.match(t) for t in nxt.split()):
            key = canon(name + ' ' + nxt)
        if key is None:
            raise ValueError('unrecognised row: %r' % l)
        rows[key] = {n: (None if v == '-' else float(v.replace(',', ''))) for (n, _, _), v in zip(datacols, nums)}
    return datacols, header, rows

def canon(name, nextline=''):
    u = re.sub(r'\s+', ' ', re.sub(r'[*@+#$]', '', name)).strip()
    for k, v in TOTALS.items():
        if u.upper().startswith(k):
            return v
    low = u.lower().replace('&', 'and')
    if 'haveli' in low or 'daman' in low or (not u and 'diu' in nextline.lower()):
        return "D&N Haveli and Daman & Diu"
    alias = {'a and n islands':'A&N Islands','andaman and nicobar islands':'A&N Islands',
             'jammu and kashmir':'Jammu & Kashmir','orissa':'Odisha','pondicherry':'Puducherry',
             'delhi ut':'Delhi','delhi (ut)':'Delhi'}
    if low in alias:
        return alias[low]
    for st in STATES:
        if st.lower().replace('&', 'and') == low:
            return st
    pre = [st for st in STATES if low and st.lower().replace('&', 'and').startswith(low)]
    if len(pre) == 1 and len(low) >= 5:
        return pre[0]
    return None

def parse_table(txt, table):
    """Return {col_number: {row_key: value}} and {col_number: header_snippet}."""
    data, heads = {}, {}
    for p in table_pages(txt, table):
        datacols, header, rows = parse_page(p)
        for n, s, e in datacols:
            heads[n] = header_above(header, s, e)
            data[n] = {r: v[n] for r, v in rows.items()}
    return data, heads

def header_above(header, s, e):
    out = []
    for l in header:
        seg = l[max(0, s - 6):e + 6].strip()
        if seg:
            out.append(seg)
    return ' | '.join(out)

def check_totals(col):
    """States sum to Total states, UTs to Total UTs, both to All India."""
    st = sum(col.get(s) or 0 for s in STATES[:28])
    ut = sum(col.get(s) or 0 for s in STATES[28:])
    probs = []
    for label, got, want in (('states', st, col.get('Total states')),
                             ('uts', ut, col.get('Total UTs')),
                             ('india', st + ut, col.get('All India'))):
        if want is not None and abs(got - want) > 0.5:
            probs.append((label, got, want))
    return probs

def parse_heads_table(txt, table):
    """Crime-head-wise tables (3A.5, 3A.7): rows are crime heads, not States.
    Returns {col_number: {row_label: value}} with labels as printed, numbered
    labels prefixed by their SL (e.g. '1 Rape', '1.1 Women')."""
    data = {}
    for p in table_pages(txt, table):
        lines = p.split('\n')
        ci = next(i for i, l in enumerate(lines) if l.strip().startswith('[1]'))
        datacols = [c for c in colpositions(lines[ci]) if c[0] >= 3]
        pend = []
        for j in range(ci + 1, len(lines)):
            l = re.sub(r'[*+@#$]', ' ', lines[j]).replace('‐', '-').replace('–', '-')
            s = l.strip()
            if not s or s.startswith(('●', 'TABLE')) or 'Page' in s:
                continue
            toks = s.split()
            nums = []
            while toks and NUM.match(toks[-1]):
                nums.insert(0, toks.pop())
            if len(nums) < len(datacols):
                pend.append(s)
                continue
            nums = nums[len(nums) - len(datacols):]
            sl = ''
            if toks and re.match(r'^\d+(\.\d+)*$', toks[0]):
                sl = toks.pop(0)
            name = ' '.join(pend + toks).strip()
            if not name and j + 1 < len(lines):
                nxt = lines[j + 1].strip()
                if nxt and not any(NUM.match(t) for t in nxt.split()):
                    name = nxt
            pend = []
            label = (sl + ' ' + re.sub(r'\s+', ' ', name)).strip()
            for (n, _, _), v in zip(datacols, nums):
                data.setdefault(n, {})[label] = None if v == '-' else float(v)
    return data
