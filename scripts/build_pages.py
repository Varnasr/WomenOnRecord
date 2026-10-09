"""Write every page of the site from site/shell.html and site/pages/*.html.

Each page source starts with <!--page {json} --> naming its address and title.
Two sources are templates: state.html is written once per state and union
territory (states/<slug>/), crime.html once per crime (crimes/<slug>/), with
the place or crime in a data attribute that js/app.js reads. Never edit the
written pages; edit the sources and run this. --check fails if any is stale.
Usage: python3 scripts/build_pages.py [--check]
"""
import html, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = os.path.join(ROOT, 'site')

NAV = [('/protests/', 'nav.protests', 'Protests'), ('/courts/', 'nav.pc', 'Police and courts'),
       ('/states/', 'nav.states', 'States'), ('/crimes/', 'nav.crimes', 'Crimes'), ('/context/', 'nav.cx', 'Context'),
       ('/method/', 'nav.dm', 'Data and method')]
# The crimes that get a page of their own, in the order the crimes page shows them.
CRIMES = ['RAPE', 'POCSO_RAPE', 'ATTEMPT_RAPE', 'ASSAULT_MODESTY', 'INSULT_MODESTY', 'MURDER_WOMEN', 'MURDER_RAPE',
          'DOWRY_DEATH', 'ABETMENT_SUICIDE', 'CRUELTY', 'DOWRY_ACT', 'PWDVA', 'KIDNAP', 'ACID', 'ITPA', 'CYBER', 'TOTAL']

def slug(s):
    s = s.lower().replace('&', ' and ')
    return re.sub(r'[^a-z0-9]+', '-', s).strip('-')

def read(name):
    src = open(os.path.join(SITE, 'pages', name), encoding='utf-8').read()
    m = re.match(r'<!--page (\{.*?\}) -->\n', src)
    if not m: raise SystemExit(f'{name}: first line must be <!--page {{json}} -->')
    return json.loads(m.group(1)), src[m.end():]

def render(shell, meta, content, url, attrs=''):
    nav = '\n'.join(f'      <a href="{h}" data-i18n="{k}"' + (' aria-current="page"' if url.startswith(h) else '') + f'>{t}</a>'
                    for h, k, t in NAV)
    title = meta['title'] if meta['title'] == 'She Counts' else meta['title'] + ' · She Counts'
    out = shell
    for k, v in {'title': html.escape(title), 'desc': html.escape(meta['desc']), 'url': url, 'nav': nav,
                 'page': meta.get('page', ''), 'body_attrs': attrs, 'content': content.rstrip('\n')}.items():
        out = out.replace('{{' + k + '}}', v)
    if '{{' in out: raise SystemExit(f'{url}: unfilled placeholder')
    return out

def pages():
    shell = open(os.path.join(SITE, 'shell.html'), encoding='utf-8').read()
    site = json.load(open(os.path.join(ROOT, 'data', 'site.json'), encoding='utf-8'))
    out = {}
    for name in sorted(os.listdir(os.path.join(SITE, 'pages'))):
        meta, content = read(name)
        meta['page'] = name[:-5]
        if meta.get('template') == 'state':
            for p in site['places']:
                if p['kind'] == 'total': continue
                m = dict(meta, title=meta['title'].format(place=p['name']), desc=meta['desc'].format(place=p['name']))
                u = f'/states/{slug(p["id"])}/'
                out[u.strip('/') + '/index.html'] = render(shell, m, content, u, f' data-place="{html.escape(p["id"])}"')
        elif meta.get('template') == 'crime':
            for c in CRIMES:
                lab = site['heads'][c]['label']
                m = dict(meta, title=meta['title'].format(crime=lab), desc=meta['desc'].format(crime=lab))
                u = f'/crimes/{slug(c)}/'
                out[u.strip('/') + '/index.html'] = render(shell, m, content, u, f' data-crime="{c}"')
        else:
            out[meta['out']] = render(shell, meta, content, meta['url'])
    return out

if __name__ == '__main__':
    out = pages()
    stale = []
    for path, text in out.items():
        f = os.path.join(ROOT, path)
        if '--check' in sys.argv:
            if not os.path.exists(f) or open(f, encoding='utf-8').read() != text: stale.append(path)
        else:
            os.makedirs(os.path.dirname(f) or ROOT, exist_ok=True)
            open(f, 'w', encoding='utf-8').write(text)
    if '--check' in sys.argv:
        if stale: raise SystemExit('stale pages, run python3 scripts/build_pages.py: ' + ', '.join(stale[:5]))
        print(f'PASS: {len(out)} pages match their sources')
    else:
        print(f'wrote {len(out)} pages')
