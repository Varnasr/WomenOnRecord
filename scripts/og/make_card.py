"""Write assets/og.png, the image shown when the site's link is shared.

Every figure on the card is computed from data/site.json, so the card cannot
say something the page does not. Renders with headless Chromium through
render.mjs (needs playwright-core). Usage: python3 scripts/og/make_card.py
"""
import base64, json, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
D = json.load(open(os.path.join(ROOT, 'data', 'site.json'), encoding='utf-8'))
Y = D['years'].index(2024)
S = lambda m: D['series']['RAPE'][m]['All India'][Y]
total, conv = S('court_total_for_trial'), S('court_convicted')
acq = S('court_acquitted') + S('court_discharged')
pend = S('court_pending_trial_end_of_year')
n = {'conv': round(conv / total * 100), 'acq': round(acq / total * 100), 'pend': round(pend / total * 100)}  # 2, 8, 90 for 2024, as the site's largest-remainder split gives
n['other'] = 100 - sum(n.values())
font = lambda f: base64.b64encode(open(os.path.join(HERE, f), 'rb').read()).decode()
# The same standing woman the site draws (js/charts.js), one per 100 cases.
def woman(k, i):
    st = {'conv': 'fill="#a3243b"', 'acq': 'fill="none" stroke="#a3243b" stroke-width="1.5"',
          'other': 'fill="#5b5348"', 'pend': 'fill="#3a3f6b"'}[k]
    hair = '<circle cx="10" cy="1.3" r="2.1"/>' if i % 3 == 0 else '<path d="M13.5 6.2q2.2 5.6-.3 12.4l-1.1-.4q1.9-5.8.1-11.6z"/>'
    return (f'<svg viewBox="0 0 20 40" width="17" height="34" {st}><circle cx="10" cy="5" r="4.2"/>{hair}'
            '<path d="M5.7 11.2q4.3-2.3 8.6 0l2.5 20.6q-6.8 2-13.6 0z"/><path d="M5.9 12.6l-2.1 9.3 1.5.4 2.3-8.4z"/>'
            '<path d="M14.1 12.6l2.1 9.3-1.5.4-2.3-8.4z"/><rect x="7.1" y="32" width="2.1" height="7.4" rx="1"/>'
            '<rect x="10.8" y="32" width="2.1" height="7.4" rx="1"/></svg>')
seq = [k for k in ('conv', 'acq', 'other', 'pend') for _ in range(n[k])]
knots = ''.join(woman(k, i) for i, k in enumerate(seq))
fmt = lambda x: format(int(x), ',') if x < 100000 else f"{int(x)//100000},{int(x)%100000:05,}".replace(',', ',', 1)

def inr(x):
    s = str(int(x)); head, tail = s[:-3], s[-3:]
    while len(head) > 2: tail = head[-2:] + ',' + tail if False else tail; break
    out = ''
    while len(head) > 2: out = ',' + head[-2:] + out; head = head[:-2]
    return (head + out + ',' + tail) if head else tail

html = f"""<!doctype html><meta charset="utf-8"><style>
@font-face{{font-family:R;font-weight:600;src:url(data:font/woff2;base64,{font('plexserif600-latin.woff2')})}}
@font-face{{font-family:M;font-weight:600;src:url(data:font/woff2;base64,{font('plexsans600-latin.woff2')})}}
*{{box-sizing:border-box;margin:0}}
body{{width:1200px;height:630px;background:#f6f1e7;color:#1d1a16;font-family:M;font-weight:600;position:relative;overflow:hidden}}
.band{{height:6px;background:#a3243b}}
.in{{display:grid;grid-template-columns:600px 1fr;gap:56px;padding:44px 64px 0}}
.mark{{font:600 40px/1 R}}
h1{{font:600 50px/1.1 R;margin-top:26px}}
.big{{margin-top:30px;font-size:25px;line-height:1.35;color:#5b5348}}
.big b{{font:600 56px/1 R;color:#a3243b;display:block;margin-bottom:6px}}
.cloth{{background:#fffdf8;border:1px solid #d9cfbd;padding:26px 30px 22px;border-radius:4px;align-self:start;margin-top:4px;justify-self:end}}
.grid{{display:grid;grid-template-columns:repeat(10,17px);gap:1px 9px}}
.grid svg{{display:block}}
i{{display:block;width:22px;height:22px;border-radius:50%;background:#3c4a8a}}
i.conv{{background:#a3243b}} i.acq{{background:none;box-shadow:inset 0 0 0 3px #a3243b}} i.other{{background:#9aa3c6}}
.leg{{margin-top:14px;font-size:17px;max-width:300px;line-height:1.35;line-height:1.5;color:#5b5348}}
.leg em{{font-style:normal;color:#a3243b}}
.foot{{position:absolute;left:64px;right:64px;z-index:2;background:#f6f1e7;bottom:30px;display:flex;justify-content:space-between;font-size:21px;color:#5b5348;border-top:1px solid #d9cfbd;padding-top:14px}}
.foot b{{color:#1d1a16}}
</style>
<div class="band"></div>
<div class="in"><div>
<div class="mark">She Counts</div>
<h1>Crimes against women in India, as police and courts recorded them</h1>
<p class="big"><b>{n['pend']} in every 100</b>rape cases before the courts in 2024 were still waiting for a verdict when the year ended.</p>
</div>
<div class="cloth"><div class="grid">{knots}</div>
<p class="leg">Each figure is 1 in 100 cases.<br><em>{n['conv']} convicted</em>, {n['acq']} acquitted or discharged.</p></div></div>
<div class="foot"><span><b>shecounts.netlify.app</b> · every state, 2020 to 2024</span><span>Source: NCRB, Crime in India 2024</span></div>
"""
out = os.path.join(HERE, 'card.html')
open(out, 'w', encoding='utf-8').write(html)
print('card numbers', n, 'from', int(total), 'cases')
subprocess.run(['node', os.path.join(HERE, 'render.mjs'), out, os.path.join(ROOT, 'assets', 'og.png')], check=True)
