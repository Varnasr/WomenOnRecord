"""Write a link-preview image for every crime page and every state page.

A shared link to /states/kerala/ should show Kerala, and a link to the dowry
deaths page should show dowry deaths. Each card names its page, gives the page's
own figure for the latest year and draws its line from 2017, all computed from
data/site.json, so a card cannot say something its page does not.

Writes assets/og/<crimes|states>-<slug>.png and assets/og/cards.json, which
scripts/build_pages.py reads for each page's og:image and its alt text. Pages
without a card keep assets/og.png. Renders with headless Chromium (needs
playwright-core; CHROME may name the binary).
Usage: python3 scripts/og/make_page_cards.py
"""
import base64, json, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.dirname(HERE))
from build_pages import CRIMES, slug

D = json.load(open(os.path.join(ROOT, 'data', 'site.json'), encoding='utf-8'))
YEARS = D['years']
OUT = os.path.join(ROOT, 'assets', 'og')
font = lambda f: base64.b64encode(open(os.path.join(HERE, f), 'rb').read()).decode()
FONTS = (f"@font-face{{font-family:R;font-weight:600;src:url(data:font/woff2;base64,{font('plexserif600-latin.woff2')})}}"
         f"@font-face{{font-family:M;font-weight:600;src:url(data:font/woff2;base64,{font('plexsans600-latin.woff2')})}}")

def inr(x, dp=0):
    """Indian grouping: 1,33,676."""
    if dp: return f'{x:.{dp}f}'
    s = str(int(round(x))); head, tail = s[:-3], s[-3:]
    out = ''
    while len(head) > 2: out = ',' + head[-2:] + out; head = head[:-2]
    return (head + out + ',' + tail) if head else tail

def series(code, measure, place):
    return D['series'].get(code, {}).get(measure, {}).get(place)

def latest(vals):
    """The last year with a figure, and the figure."""
    for i in range(len(vals) - 1, -1, -1):
        if vals[i] is not None: return YEARS[i], vals[i]
    return None, None

def line(vals, dp=0):
    """The page's line from the first year to the last, with both ends labelled with
    their year and figure, because a line with no numbers on it overstates any change."""
    pts = [(i, v) for i, v in enumerate(vals) if v is not None]
    if len(pts) < 2: return ''
    W, H, lo, hi = 360, 190, min(v for _, v in pts), max(v for _, v in pts)
    x = lambda i: 14 + i * (W - 28) / (len(vals) - 1)
    y = lambda v: H - 62 - (0.5 if hi == lo else (v - lo) / (hi - lo)) * (H - 92)
    d = ' '.join(('M' if k == 0 else 'L') + f'{x(i):.1f} {y(v):.1f}' for k, (i, v) in enumerate(pts))
    i0, v0 = pts[0]; i1, v1 = pts[-1]
    lab = lambda i, v, a: (f'<text x="{x(i):.1f}" y="{H - 30}" font-size="20" fill="#5b5348" text-anchor="{a}">{YEARS[i]}</text>'
                           f'<text x="{x(i):.1f}" y="{H - 4}" font-size="22" fill="#1d1a16" text-anchor="{a}">{inr(v, dp)}</text>')
    return (f'<svg viewBox="0 0 {W} {H}" width="{W}" height="{H}"><path d="{d}" fill="none" stroke="#3a3f6b" stroke-width="4" stroke-linejoin="round"/>'
            f'<circle cx="{x(i0):.1f}" cy="{y(v0):.1f}" r="6" fill="#3a3f6b"/><circle cx="{x(i1):.1f}" cy="{y(v1):.1f}" r="8" fill="#a3243b"/>'
            + lab(i0, v0, 'start') + lab(i1, v1, 'end') + '</svg>')

def card(title, big, text, sub, vals, what):
    size = 60 if len(title) < 26 else 50 if len(title) < 44 else 42
    return f"""<!doctype html><meta charset="utf-8"><style>{FONTS}
*{{box-sizing:border-box;margin:0}}
body{{width:1200px;height:630px;background:#f6f1e7;color:#1d1a16;font-family:M;font-weight:600;position:relative;overflow:hidden}}
.band{{height:6px;background:#a3243b}}
.in{{display:grid;grid-template-columns:620px 1fr;gap:36px;padding:44px 64px 0}}
.mark{{font:600 34px/1 R;color:#5b5348}}
h1{{font:600 {size}px/1.08 R;margin-top:24px}}
.big{{margin-top:28px;font-size:26px;line-height:1.35;color:#5b5348}}
.big b{{font:600 64px/1 R;color:#a3243b;display:block;margin-bottom:8px}}
.sub{{margin-top:16px;font-size:22px;color:#5b5348}}
.cloth{{background:#fffdf8;border:1px solid #d9cfbd;padding:22px 20px 18px;border-radius:4px;align-self:center;margin-top:60px;width:400px}}
.cloth p{{font-size:18px;color:#5b5348;margin-bottom:6px}}
.foot{{position:absolute;left:64px;right:64px;bottom:30px;display:flex;justify-content:space-between;font-size:21px;color:#5b5348;border-top:1px solid #d9cfbd;padding-top:14px}}
.foot b{{color:#1d1a16}}
</style>
<div class="band"></div>
<div class="in"><div>
<div class="mark">Women on Record</div>
<h1>{title}</h1>
<p class="big"><b>{big}</b>{text}</p>
<p class="sub">{sub}</p>
</div>
<div class="cloth"><p>{what}</p>{line(vals)}</div></div>
<div class="foot"><span><b>womenonrecord.net</b> · every state, {YEARS[0]} to {YEARS[-1]}</span><span>Source: NCRB, Crime in India</span></div>
"""

def plan():
    """Every card's HTML and file name, and the manifest, without rendering."""
    jobs, manifest = [], {}
    ri_all = series('TOTAL', 'rate', 'All India')
    for c in CRIMES:
        lab = D['heads'][c]['label']
        m = 'victims' if c == 'MURDER_WOMEN' else 'cases'
        vals = series(c, m, 'All India')
        y, n = latest(vals)
        r = series(c, 'rate', 'All India')
        r = r[YEARS.index(y)] if r else None
        what = 'women and girls murdered in India' if m == 'victims' else 'cases recorded by police in India'
        text = f'{what} in {y}.'
        sub = f'{inr(r, 1)} for every lakh women.' if r is not None else ''
        alt = f'{lab}: {inr(n)} {what} in {y}' + (f', {inr(r, 1)} for every lakh women' if r is not None else '') + '. Source: NCRB.'
        jobs.append((card(lab, inr(n), text, sub, vals, 'Women and girls murdered, India' if m == 'victims' else 'Cases recorded, India'), f'crimes-{slug(c)}.png'))
        manifest[f'/crimes/{slug(c)}/'] = {'img': f'assets/og/crimes-{slug(c)}.png', 'alt': alt}
    for p in D['places']:
        if p['kind'] == 'total': continue
        vals = series('TOTAL', 'cases', p['id'])
        y, n = latest(vals)
        r = series('TOTAL', 'rate', p['id'])[YEARS.index(y)]
        ri = ri_all[YEARS.index(y)]
        text = f'crimes against women for every lakh women in {y}, against {inr(ri, 1)} for India.'
        sub = f'{inr(n)} cases recorded by police in {y}.'
        alt = f'{p["name"]}: {inr(r, 1)} crimes against women for every lakh women in {y}, against {inr(ri, 1)} for India, and {inr(n)} cases. Source: NCRB.'
        jobs.append((card(p['name'], inr(r, 1), text, sub, vals, 'Crimes against women recorded, ' + p['name']), f'states-{slug(p["id"])}.png'))
        manifest[f'/states/{slug(p["id"])}/'] = {'img': f'assets/og/states-{slug(p["id"])}.png', 'alt': alt}
    return jobs, manifest

def main():
    os.makedirs(OUT, exist_ok=True)
    jobs, manifest = plan()
    work = os.path.join(HERE, 'cards')
    os.makedirs(work, exist_ok=True)
    spec = []
    for html, name in jobs:
        src = os.path.join(work, name.replace('.png', '.html'))
        open(src, 'w', encoding='utf-8').write(html)
        spec.append([src, os.path.join(OUT, name)])
    open(os.path.join(work, 'jobs.json'), 'w').write(json.dumps(spec))
    subprocess.run(['node', os.path.join(HERE, 'render.mjs'), '--many', os.path.join(work, 'jobs.json')], check=True)
    open(os.path.join(OUT, 'cards.json'), 'w', encoding='utf-8').write(json.dumps(manifest, indent=1, ensure_ascii=False) + '\n')
    print(f'wrote {len(jobs)} cards and assets/og/cards.json')

if __name__ == '__main__':
    main()
