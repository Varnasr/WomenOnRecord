"""Save the National Commission for Women's complaint tables for one calendar year.

The portal (https://ncwapps.nic.in/frmComp_stat_Overview.aspx) is an ASP.NET form with no
download link, so this script posts the form the way a browser does and saves each
response as it came back. One response gives the State-Wise table (every State and UT with
twelve months and a total), one gives the Nature-Wise table for India, and one per State
gives its Nature-Wise table. ncw_build.py reads the saved files, checks them and writes the
rows. Standard library only.

    python3 scripts/context/ncw_fetch.py 2025 OUT_DIR

OUT_DIR is outside the repository on purpose: the responses are about 80 KB each. Their
SHA-256 sums go into context/ncw/sources.json.
"""
import hashlib, html, http.cookiejar, json, os, re, sys, time, urllib.parse, urllib.request

URL = 'https://ncwapps.nic.in/frmComp_stat_Overview.aspx'
F = 'ctl00$ContentBody$'

def opener():
    op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
    op.addheaders = [('User-Agent', 'Mozilla/5.0 (research script; Women on Record, womenonrecord.net)')]
    return op

def hidden(t):
    return {m.group(1): html.unescape(m.group(2)) for m in re.finditer(r'<input[^>]*type="hidden"[^>]*name="([^"]+)"[^>]*value="([^"]*)"', t)}

def states(t):
    block = re.search(r'<select[^>]*id="ddlState".*?</select>', t, flags=re.S).group(0)
    return [(v, html.unescape(re.sub(r'\s+', ' ', x)).strip()) for v, x in re.findall(r'<option[^>]*value="([^"]*)"[^>]*>(.*?)</option>', block, flags=re.S) if v != '0']

def post(op, year, report_type, state, tries=4):
    for k in range(tries):
        try:
            t = op.open(URL, timeout=60).read().decode('utf-8', 'ignore')   # a fresh form each time, with its own state
            f = hidden(t)
            f.update({F + 'ddlYear': str(year), F + 'ddlReportType': str(report_type), F + 'ddlState': str(state),
                      F + 'ddlDistrict': '0', F + 'rdbSelection': '0', F + 'btnSubmit': 'Submit'})
            return t, op.open(urllib.request.Request(URL, data=urllib.parse.urlencode(f).encode()), timeout=60).read().decode('utf-8', 'ignore')
        except Exception as e:
            print('retry', year, report_type, state, e, file=sys.stderr); time.sleep(2 * (k + 1))
    raise SystemExit(f'could not fetch {year} type {report_type} state {state}')

def main(year, out):
    os.makedirs(out, exist_ok=True)
    op = opener(); sums = {}
    def save(name, text):
        open(os.path.join(out, name), 'w', encoding='utf-8').write(text)
        sums[name] = hashlib.sha256(text.encode('utf-8')).hexdigest(); print('saved', name)
    form, r = post(op, year, 1, 0); save(f'ncw_{year}_type1.html', r)          # State Wise
    _, r = post(op, year, 0, 0); save(f'ncw_{year}_type0.html', r)             # Nature Wise, All States
    for v, name in states(form):
        _, r = post(op, year, 0, v); save(f'ncw_{year}_type0_st{v}.html', r)   # Nature Wise, one State
        time.sleep(0.4)
    json.dump(sums, open(os.path.join(out, f'ncw_{year}_sha256.json'), 'w'), indent=1)

if __name__ == '__main__':
    if len(sys.argv) != 3: raise SystemExit(__doc__)
    main(int(sys.argv[1]), sys.argv[2])
