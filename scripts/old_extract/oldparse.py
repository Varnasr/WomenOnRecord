"""Parse NCRB Crime in India 2014/2015 tables (old layout) after pdftotext -layout.

Column numbers are printed as "(1) (2) (3) ...". Page footers: "TABLE 5.2 - Page: 1 of 11".
Two shapes: state-wise tables (one row per State/UT) and crime-head tables (rows coded 1, 1.1, ...).
"""
import re

STATES14 = ["Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat",
            "Haryana", "Himachal Pradesh", "Jammu & Kashmir", "Jharkhand", "Karnataka", "Kerala",
            "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha",
            "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh",
            "Uttarakhand", "West Bengal"]
UTS14 = ["A&N Islands", "Chandigarh", "D&N Haveli", "Daman & Diu", "Delhi", "Lakshadweep", "Puducherry"]
TOTALS = ["Total states", "Total UTs", "All India"]
ROWS = STATES14 + UTS14 + TOTALS

COLNUM = re.compile(r'\((\d+)\)')
NUMTOK = re.compile(r'^-?\d+(\.\d+)?$')


def clean_tokens(s):
    s = s.replace('–', '-').replace('−', '-')
    toks = []
    for t in s.split():
        t2 = t.replace('*', '').replace(',', '')
        if t2 == '':
            continue  # standalone '*' marker
        toks.append(t2)
    return toks


def split_nums(toks):
    nums = []
    while toks and (NUMTOK.match(toks[-1]) or toks[-1] == '-'):
        nums.insert(0, toks.pop())
    return toks, nums


def val(v):
    if v == '-':
        return None
    f = float(v)
    return int(f) if '.' not in v else f


def canon_state(name):
    u = re.sub(r'\s+', ' ', name).strip()
    up = u.upper()
    if up.startswith('TOTAL STATE'):
        return 'Total states'
    if up.startswith('TOTAL UT'):
        return 'Total UTs'
    if up.startswith('TOTAL (ALL INDIA)') or up.startswith('TOTAL ALL INDIA'):
        return 'All India'
    low = u.lower().replace('&', 'and')
    low = re.sub(r'\s+', ' ', low)
    alias = {'a and n islands': 'A&N Islands', 'delhi ut': 'Delhi', 'd and n haveli': 'D&N Haveli',
             'daman and diu': 'Daman & Diu', 'jammu and kashmir': 'Jammu & Kashmir'}
    if low in alias:
        return alias[low]
    for s in STATES14 + UTS14:
        if s.lower().replace('&', 'and') == low:
            return s
    return None


def pages(txt, table):
    out = []
    for p in txt.split('\f'):
        m = re.search(r'TABLE\s+' + re.escape(table) + r'\s*-', p)
        if not m:
            continue
        m2 = re.search(r'Page:\s*(\d+)\s+of', p[m.start():])
        if not m2:
            raise ValueError('footer without page number')
        out.append((int(m2.group(1)), p))
    return sorted(out)


def colrow(lines):
    for i, l in enumerate(lines):
        if l.strip().startswith('(1)'):
            cols = [int(x) for x in COLNUM.findall(l)]
            return i, cols
    raise ValueError('no column-number row')


def parse_statewise(txt, table):
    """Return data {col: {row: value}}, pagecols {col: page}."""
    data, pagecol = {}, {}
    for pno, p in pages(txt, table):
        lines = p.split('\n')
        ci, cols = colrow(lines)
        dcols = [c for c in cols if c >= 3]
        seen = set()
        for l in lines[ci + 1:]:
            s = l.strip()
            if not s or s.startswith(('STATES', 'UNION', 'TABLE', 'Col', 'Source', 'Note', '‘', "'")):
                continue
            toks, nums = split_nums(clean_tokens(s))
            if len(nums) != len(dcols):
                if len(nums) == len(dcols) + 1 and toks == [] :
                    nums = nums[1:]
                else:
                    continue
            name = ' '.join(toks)
            name = re.sub(r'^\d+\s+', '', name)
            if not name and len(toks) == 0:
                continue
            key = canon_state(name)
            if key is None:
                raise ValueError(f'{table} p{pno}: unrecognised row {s!r}')
            if key in seen:
                raise ValueError(f'{table} p{pno}: duplicate row {key}')
            seen.add(key)
            for c, v in zip(dcols, nums):
                data.setdefault(c, {})[key] = val(v)
        missing = [r for r in ROWS if r not in seen]
        if missing:
            raise ValueError(f'{table} p{pno}: missing rows {missing}')
        for c in dcols:
            pagecol[c] = pno
    return data, pagecol


CODE = re.compile(r'^(\d+(?:\.\d+)*)\s+(.*)$')


def parse_heads(txt, table):
    """Crime-head tables. Return data {col: {code: value}}, labels {code: label}, pagecol."""
    data, labels, pagecol = {}, {}, {}
    for pno, p in pages(txt, table):
        lines = [l for l in p.split('\n')]
        ci, cols = colrow(lines)
        dcols = [c for c in cols if c >= 3]
        body = [l.strip() for l in lines[ci + 1:]]
        body = [b for b in body if b]
        i = 0
        while i < len(body):
            s = body[i]
            if s.startswith('Total Crimes against Women'):
                code, label = 'TOTAL', 'Total Crimes against Women'
                rest = s
            else:
                m = CODE.match(s)
                if not m or s.startswith(('TABLE',)):
                    i += 1
                    continue
                code = m.group(1)
                rest = m.group(2)
            toks, nums = split_nums(clean_tokens(rest))
            if len(nums) > len(dcols):
                extra = len(nums) - len(dcols)
                toks = toks + nums[:extra]
                nums = nums[extra:]
            label = ' '.join(toks) if code != 'TOTAL' else 'Total Crimes against Women'
            if len(nums) == 0 and i + 1 < len(body):
                t2, n2 = split_nums(clean_tokens(body[i + 1]))
                if not t2 and len(n2) == len(dcols):
                    nums = n2
                    i += 1
                    # label continuation line after values
                    if i + 1 < len(body) and not CODE.match(body[i + 1]) and not body[i + 1].startswith(('Total', 'TABLE', 'This')):
                        label = label + ' ' + body[i + 1]
                        i += 1
            if len(nums) != len(dcols):
                raise ValueError(f'{table} p{pno}: row {code} has {len(nums)} values, expected {len(dcols)}: {s!r}')
            labels.setdefault(code, label)
            for c, v in zip(dcols, nums):
                data.setdefault(c, {})[code] = val(v)
            i += 1
        for c in dcols:
            pagecol[c] = pno
    return data, labels, pagecol


def headers(txt, table):
    """Printed header block (text above the column-number row) for each page."""
    out = {}
    for pno, p in pages(txt, table):
        lines = p.split('\n')
        ci, cols = colrow(lines)
        out[pno] = ('\n'.join(l.rstrip() for l in lines[:ci + 1] if l.strip()), cols)
    return out


def footers(txt, table):
    out = {}
    for pno, p in pages(txt, table):
        lines = p.split('\n')
        last = max(i for i, l in enumerate(lines) if canon_state(re.sub(r'^\d+\s+', '', ' '.join(split_nums(clean_tokens(l.strip()))[0]))) == 'All India' or l.strip().startswith('Total Crimes against Women')) if any(l.strip().startswith(('TOTAL (ALL', 'TOTAL ALL', 'Total Crimes against')) for l in lines) else 0
        out[pno] = '\n'.join(l.strip() for l in lines[last + 1:] if l.strip())
    return out
