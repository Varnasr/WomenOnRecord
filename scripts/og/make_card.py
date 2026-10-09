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
n = {'conv': round(conv / total * 100), 'acq': round(acq / total * 100), 'pend': round(pend / total * 100)}
n['other'] = 100 - sum(n.values())
font = lambda f: base64.b64encode(open(os.path.join(HERE, f), 'rb').read()).decode()
knots = ''.join(f'<i class="{k}"></i>' * n[k] for k in ('conv', 'acq', 'other', 'pend'))
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
body{{width:1200px;height:630px;background:#eef0f6;color:#1f2a5c;font-family:M;font-weight:600;position:relative;overflow:hidden}}
.band{{height:24px;background:#fff repeating-linear-gradient(120deg,transparent 0 6px,#1f2a5c 6px 7.5px,transparent 7.5px 10px);border-top:3px solid #1f2a5c;border-bottom:3px solid #1f2a5c}}
.in{{display:grid;grid-template-columns:600px 1fr;gap:56px;padding:44px 64px 0}}
.mark{{font:600 40px/1 R}}
h1{{font:600 50px/1.1 R;margin-top:26px}}
.big{{margin-top:30px;font-size:25px;line-height:1.35;color:#4a557f}}
.big b{{font:600 56px/1 R;color:#a3243b;display:block;margin-bottom:6px}}
.cloth{{background:#fff;outline:2px dashed #8a93b8;outline-offset:-10px;padding:26px 30px 22px;border-radius:4px;align-self:start;margin-top:4px;justify-self:end}}
.grid{{display:grid;grid-template-columns:repeat(10,22px);gap:9px}}
i{{display:block;width:22px;height:22px;border-radius:50%;background:#3c4a8a}}
i.conv{{background:#a3243b}} i.acq{{background:none;box-shadow:inset 0 0 0 3px #a3243b}} i.other{{background:#9aa3c6}}
.leg{{margin-top:14px;font-size:17px;max-width:300px;line-height:1.35;line-height:1.5;color:#4a557f}}
.leg em{{font-style:normal;color:#a3243b}}
.foot{{position:absolute;left:64px;right:64px;z-index:2;background:#eef0f6;bottom:30px;display:flex;justify-content:space-between;font-size:21px;color:#4a557f;border-top:3px dashed #a3243b;padding-top:14px}}
.foot b{{color:#1f2a5c}}
</style>
<div class="band"></div>
<div class="in"><div>
<div class="mark">She Counts</div>
<h1>Crimes against women in India, as police and courts recorded them</h1>
<p class="big"><b>{n['pend']} in every 100</b>rape cases before the courts in 2024 were still waiting for a verdict when the year ended.</p>
</div>
<div class="cloth"><div class="grid">{knots}</div>
<p class="leg">1 knot = 1 in 100 cases.<br><em>{n['conv']} convicted</em>, {n['acq']} acquitted or discharged.</p></div></div>
<div class="foot"><span><b>shecounts.netlify.app</b> · every state, 2020 to 2024</span><span>Source: NCRB, Crime in India 2024</span></div>
"""
out = os.path.join(HERE, 'card.html')
open(out, 'w', encoding='utf-8').write(html)
print('card numbers', n, 'from', int(total), 'cases')
subprocess.run(['node', os.path.join(HERE, 'render.mjs'), out, os.path.join(ROOT, 'assets', 'og.png')], check=True)
