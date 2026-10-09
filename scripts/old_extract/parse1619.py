"""Parser for NCRB Crime in India 2016-2019 tables after pdftotext -layout.

Column numbers are read from the printed column-number row of each page
("1 2 3 ..." or "21A 22A ..."), values are assigned by order when a row has
one value per column, and by position (nearest column-number centre) when a
row has fewer values (e.g. a blank rank on a total row).
"""
import re

NUMTOK = re.compile(r'^-?[\d,]+(\.\d+)?$|^-$|^NA$|^N\.A\.?$')
COLTOK = re.compile(r'^\[?\d+[A-Z]?\]?$')

STATES29 = ["Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa",
            "Gujarat", "Haryana", "Himachal Pradesh", "Jammu & Kashmir", "Jharkhand", "Karnataka",
            "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
            "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana",
            "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal"]   # 29 states before 2019 reorganisation
UTS = ["A&N Islands", "Chandigarh", "D&N Haveli", "Daman & Diu", "Delhi", "Lakshadweep", "Puducherry"]
TOTALS = ["Total states", "Total UTs", "All India"]
ROWKEYS = STATES29 + UTS + TOTALS


def canon(name):
    u = re.sub(r'[*@+#$●]', '', name)
    u = re.sub(r'\s+', ' ', u).strip()
    up = u.upper()
    if up.startswith('TOTAL STATE'):
        return 'Total states'
    if up.startswith('TOTAL UT'):
        return 'Total UTs'
    if up.startswith('TOTAL ALL') or up in ('TOTAL (ALL INDIA)', 'ALL INDIA'):
        return 'All India'
    low = u.lower().replace('&', ' and ')
    low = re.sub(r'\s+', ' ', low).strip()
    alias = {'a and n islands': 'A&N Islands', 'andaman and nicobar islands': 'A&N Islands',
             'd and n haveli': 'D&N Haveli', 'dadra and nagar haveli': 'D&N Haveli',
             'daman and diu': 'Daman & Diu', 'delhi ut': 'Delhi', 'delhi': 'Delhi',
             'jammu and kashmir': 'Jammu & Kashmir', 'orissa': 'Odisha', 'pondicherry': 'Puducherry'}
    if low in alias:
        return alias[low]
    for st in STATES29 + UTS:
        if re.sub(r'\s+', ' ', st.lower().replace('&', ' and ')).strip() == low:
            return st
    return None


def find_colrow(lines):
    for i, l in enumerate(lines):
        toks = l.split()
        if len(toks) >= 3 and all(COLTOK.match(t) for t in toks):
            return i
    return None


def tokspans(line):
    return [(m.group(0), m.start(), m.end()) for m in re.finditer(r'\S+', line)]


def parse_page(page, rowmode='state', positional=False):
    """Return (cols, header_lines, rows, notes). cols: list of (label, start, end)
    excluding columns '1' and '2'. rows: {key: {col: value}} where key is a
    canonical state name (rowmode='state') or the printed label (rowmode='head')."""
    lines = page.split('\n')
    ci = find_colrow(lines)
    if ci is None:
        return None
    cols = [(t.strip('[]'), s, e) for t, s, e in tokspans(lines[ci])]
    cols = [c for c in cols if c[0] not in ('1', '2')]
    header = lines[:ci]
    rows, order, notes = {}, [], []
    pend = []
    pend_sl = ''
    skip = set()
    for j in range(ci + 1, len(lines)):
        if j in skip:
            continue
        raw = lines[j]
        l = raw.replace('‐', '-').replace('–', '-').replace('−', '-')
        s = l.strip()
        if not s:
            continue
        if re.match(r'^(STATES|UNION TERRITOR)', s, re.I):
            pend = []
            continue
        if re.search(r'TABLE\s+\d', s) or re.match(r'^(Note|NOTE|●|Col\.|col\.|\*|I\s*=|\(|‘|\'|Source)', s):
            notes.append(s)
            continue
        sp = tokspans(l)
        vals = []
        while sp and NUMTOK.match(sp[-1][0]):
            vals.insert(0, sp.pop())
        if rowmode == 'head':
            single_sl = (not sp and len(vals) == 1 and re.match(r'^\d+(\.\d+)*$', vals[0][0]))
            if len(vals) < len(cols) and not single_sl:
                k, extra_lines = j + 1, []
                while k < len(lines):
                    nxt = lines[k].strip()
                    if not nxt:
                        k += 1
                        continue
                    ts = tokspans(lines[k])
                    if all(NUMTOK.match(t) for t, _, _ in ts):
                        extra_lines.append(k)
                        left = [t for t in ts if t[2] < cols[0][1] - 4]
                        if left:   # an SL number printed at the left margin
                            pend_sl = left[0][0]
                            ts = [t for t in ts if t not in left]
                        vals = vals + ts
                        k += 1
                        if len(vals) >= len(cols):
                            break
                    else:
                        break
                if len(vals) >= len(cols):
                    for k in extra_lines:
                        skip.add(k)
                    notes.append('WRAPPED(head): ' + s)
            if len(vals) > len(cols):
                extra = len(vals) - len(cols)
                sp += vals[:extra]
                vals = vals[extra:]
            if len(vals) < len(cols) and not single_sl:
                pend.append(s)   # numbers inside a wrapped label, e.g. 'Act, 2005'
                continue
        nametoks = [t for t, _, _ in sp]
        if not vals:
            if rowmode == 'head':
                pend.append(s)
            else:
                notes.append(s)
            continue
        # a leading SL number left with values only (no name) -> it is a value list with SL
        if rowmode == 'state':
            if nametoks and re.match(r'^\d+$', nametoks[0]):
                nametoks = nametoks[1:]
            if not nametoks and len(vals) == len(cols) + 1:
                vals = vals[1:]
            name = ' '.join(nametoks)
            if not name and pend:
                name = ' '.join(pend)
            key = canon(name)
            if key == 'Total states' and 'Total states' in rows and any(u in rows for u in UTS):
                key = 'Total UTs'
                notes.append('MISLABEL: UT total row printed as %r' % s)
            if key is None:
                # maybe a wrapped name
                pend.append(s)
                notes.append('UNPARSED: ' + s)
                continue
            pend = []
        else:
            if not nametoks and len(vals) == 1 and re.match(r'^\d+(\.\d+)*$', vals[0][0]) and len(cols) > 1 and raw.strip() == vals[0][0]:
                if order and not re.match(r'^\d', order[-1]) and not order[-1].startswith('Total'):
                    # the SL printed on the line after its row
                    last = order.pop()
                    nk = vals[0][0] + ' ' + last
                    rows[nk] = rows.pop(last)
                    order.append(nk)
                    notes.append('SL-AFTER(%s): %s' % (nk, s))
                else:
                    pend_sl = vals[0][0]
                continue
            sl = ''
            if pend_sl:
                sl, pend_sl = pend_sl, ''
            if nametoks and re.match(r'^\d+(\.\d+)*$', nametoks[0]):
                sl = nametoks.pop(0)
            elif not nametoks and len(vals) == len(cols) + 1 and re.match(r'^\d+(\.\d+)*$', vals[0][0]):
                sl = vals.pop(0)[0]
            name = ' '.join(pend + nametoks)
            pend = []
            key = (sl + ' ' + re.sub(r'\s+', ' ', name)).strip()
        if len(vals) < len(cols):
            # a row whose values wrap onto the next line(s)
            k = j + 1
            while k < len(lines) and len(vals) < len(cols):
                nxt = lines[k].strip()
                if not nxt:
                    k += 1
                    continue
                ts = tokspans(lines[k])
                if all(NUMTOK.match(t) for t, _, _ in ts):
                    vals += ts
                    skip.add(k)
                    notes.append('WRAPPED(%s): %s // %s' % (key, s, nxt))
                    k += 1
                else:
                    break
            if len(vals) > len(cols):
                raise ValueError('wrap join overshoot: %r' % raw)
        if len(vals) > len(cols):
            raise ValueError('too many values: %r' % raw)
        if len(vals) < len(cols) and not positional:
            raise ValueError('too few values (%d of %d): %r' % (len(vals), len(cols), raw))
        assign = {}
        if len(vals) == len(cols):
            for (c, _, _), (v, _, _) in zip(cols, vals):
                assign[c] = v
            if positional and rowmode == 'state':
                # self-test of the positional rule on complete rows
                try:
                    pa = posassign(cols, vals)
                    if pa != assign:
                        notes.append('POSCHECK-MISMATCH(%s): %s' % (key, s))
                except ValueError:
                    notes.append('POSCHECK-AMBIGUOUS(%s): %s' % (key, s))
        else:
            # position: nearest column-number centre to the value's right edge region
            used = set()
            for v, vs, ve in vals:
                best = min(cols, key=lambda c: min(abs(ve - c[2]), abs((vs + ve) / 2 - (c[1] + c[2]) / 2)))
                if best[0] in used:
                    raise ValueError('ambiguous position %r' % raw)
                used.add(best[0])
                assign[best[0]] = v
            notes.append('POSITIONAL(%s): %s' % (key, s))
        rows[key] = {c: conv(v) for c, v in assign.items()}
        order.append(key)
    return cols, header, rows, notes


def posassign(cols, vals):
    assign, used = {}, set()
    for v, vs, ve in vals:
        best = min(cols, key=lambda c: min(abs(ve - c[2]), abs((vs + ve) / 2 - (c[1] + c[2]) / 2)))
        if best[0] in used:
            raise ValueError('ambiguous')
        used.add(best[0])
        assign[best[0]] = v
    return assign


def conv(v):
    if v in ('-', 'NA', 'N.A.', 'N.A'):
        return None
    return float(v.replace(',', ''))


def table_pages(txt, pattern):
    """Pages of a text whose text matches the table regex pattern."""
    return [p for p in txt.split('\f') if re.search(pattern, p)]


def parse_table(pages_, rowmode='state', positional=False):
    data, heads, notes = {}, {}, []
    for k, p in enumerate(pages_):
        r = parse_page(p, rowmode, positional)
        if r is None:
            continue
        cols, header, rows, nts = r
        for c, s, e in cols:
            new = {key: v.get(c) for key, v in rows.items() if c in v}
            if c in data:
                if rowmode != 'head':
                    raise ValueError('column %s printed twice' % c)
                dup = set(new) & set(data[c])
                if dup:
                    raise ValueError('row label repeated in col %s: %s' % (c, dup))
                data[c].update(new)
                heads[c] = heads[c] + [(k + 1, header, s, e)]
            else:
                data[c] = new
                heads[c] = [(k + 1, header, s, e)] if rowmode == 'head' else (k + 1, header, s, e)
        notes += nts
    return data, heads, notes


def check_totals(col):
    st = sum(col.get(s) or 0 for s in STATES29)
    ut = sum(col.get(s) or 0 for s in UTS)
    probs = []
    for label, got, want in (('states', st, col.get('Total states')),
                             ('uts', ut, col.get('Total UTs')),
                             ('india', st + ut, col.get('All India'))):
        if want is None:
            probs.append((label, got, 'MISSING'))
        elif abs(got - want) > 0.5:
            probs.append((label, got, want))
    return probs
