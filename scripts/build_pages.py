"""Write every page of the site from site/shell.html and site/pages/*.html.

Each page source starts with <!--page {json} --> naming its address and title.
Two sources are templates: state.html is written once per state and union
territory (states/<slug>/), crime.html once per crime (crimes/<slug>/), with
the place or crime in a data attribute that js/app.js reads. Never edit the
written pages; edit the sources and run this. --check fails if any is stale.
Usage: python3 scripts/build_pages.py [--check]
"""
import hashlib, html, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = os.path.join(ROOT, 'site')

NAV = [('/crimes/', 'nav.crimes', 'Crimes'), ('/states/', 'nav.states', 'States'),
       ('/courts/', 'nav.pc', 'Police and courts'), ('/context/', 'nav.cx', 'Context'),
       ('/path/', 'nav.how', 'How it works'), ('/protests/', 'nav.protests', 'Protests'),
       ('/explore/', 'nav.ex', 'Explore'), ('/method/', 'nav.dm', 'Data and method')]
# The nav is three groups (the records, reading them, the data), and a rule
# separates each group from the one before it.
NAV_GROUP_STARTS = ('/context/', '/explore/')
# The languages every page is offered in, as read by js/app.js from ?lang=.
LANGS = ['en', 'hi', 'ur', 'ta', 'bn', 'mr']
SITE_URL = 'https://www.womenonrecord.net'

def alternates(url):
    a = SITE_URL + url
    return [(l, a if l == 'en' else a + '?lang=' + l) for l in LANGS] + [('x-default', a)]

# Pages outside the nav that mark a nav item as current.
ALSO = {'/path/': ('/counting/', '/law/')}
# The crimes that get a page of their own, in the order the crimes page shows them.
CRIMES = ['RAPE', 'POCSO_RAPE', 'ATTEMPT_RAPE', 'ASSAULT_MODESTY', 'INSULT_MODESTY', 'MURDER_WOMEN', 'MURDER_RAPE',
          'DOWRY_DEATH', 'ABETMENT_SUICIDE', 'CRUELTY', 'DOWRY_ACT', 'PWDVA', 'KIDNAP', 'ACID', 'ITPA', 'CYBER', 'TOTAL']

# Every file a page loads. Each gets ?v=<hash of its contents> in its address,
# so a changed file has a new address and no browser can serve an old copy.
ASSETS = ['css/site.css', 'css/fonts.css', 'css/fonts-ur.css', 'css/fonts-ta.css', 'css/fonts-bn.css', 'js/i18n.js', 'js/charts.js', 'js/app.js',
          'data/site.json', 'data/context.json', 'data/explore.json', 'data/geo/india.json',
          # the downloads, so a new file is a new link the moment it is deployed
          'data/womenonrecord.csv', 'data/context.csv', 'downloads/womenonrecord.xlsx',
          'downloads/context.xlsx', 'downloads/codebook.csv']

def digest(b):
    return hashlib.sha256(b).hexdigest()[:10]

def versions():
    v = {a: digest(open(os.path.join(ROOT, a), 'rb').read()) for a in ASSETS}
    src = b''.join(open(os.path.join(SITE, d, f), 'rb').read() for d, fs in
                   [('', ['shell.html'])] + [('pages', sorted(os.listdir(os.path.join(SITE, 'pages'))))] for f in fs)
    build = digest((json.dumps(v, sort_keys=True)).encode() + src)
    return v, build

def stamp(out, v):
    for a, h in v.items():
        out = out.replace(f'"/{a}"', f'"/{a}?v={h}"')
    return out

def slug(s):
    s = s.lower().replace('&', ' and ')
    return re.sub(r'[^a-z0-9]+', '-', s).strip('-')

def last_year():
    """The latest NCRB year in the data. '{last}' in a page source or in the shell
    becomes this, so text about the latest year moves with the data."""
    return str(max(json.load(open(os.path.join(ROOT, 'data', 'site.json'), encoding='utf-8'))['years']))

def read(name):
    src = open(os.path.join(SITE, 'pages', name), encoding='utf-8').read().replace('{last}', last_year())
    m = re.match(r'<!--page (\{.*?\}) -->\n', src)
    if not m: raise SystemExit(f'{name}: first line must be <!--page {{json}} -->')
    return json.loads(m.group(1)), src[m.end():]

# The default link preview, and the page's own where scripts/og/make_page_cards.py made one.
OG_DEFAULT = ('assets/og.png', "90 in every 100 rape cases before India's courts in 2024 were still waiting for a verdict when the year ended. Source: NCRB.")
def og(url):
    cards = os.path.join(ROOT, 'assets', 'og', 'cards.json')
    c = json.load(open(cards, encoding='utf-8')).get(url) if os.path.exists(cards) else None
    img, alt = (c['img'], c['alt']) if c else OG_DEFAULT
    return f'{SITE_URL}/{img}?v=' + digest(open(os.path.join(ROOT, img), 'rb').read()), alt

# Structured data for search engines. The Dataset block is what Google Dataset Search
# reads; it sits on the Data and method page, which describes the dataset.
RESEARCHERS = ['Vinitha Joseph', 'Nivedita Biswas', 'Tarushaa Miittal', 'Varna']
PUBLISHER = {'@type': 'Organization', 'name': 'PinPoint Ventures', 'email': 'info@pinpointventures.in'}
def structured(url):
    last = last_year()
    if url == '/':
        ld = {'@context': 'https://schema.org', '@type': 'WebSite', 'name': 'Women on Record', 'url': SITE_URL + '/',
              'inLanguage': LANGS, 'publisher': PUBLISHER,
              'description': f'Crimes against women in India, as police and courts recorded them, 2014 to {last}, from NCRB Crime in India.'}
    elif url == '/method/':
        ld = {'@context': 'https://schema.org', '@type': 'Dataset',
              'name': f'Women on Record: crimes against women in India, 2014 to {last}',
              'description': (f'Every figure NCRB publishes state-wise on crimes against women in Crime in India, 2014 to {last}. '
                              'It holds cases, victims and rates by crime and state, what police and courts did with them, who the offender was '
                              'in rape cases, rape by section of law, people arrested and tried, the 19 largest cities, and rape of '
                              'Scheduled Caste and Scheduled Tribe women and girls. Read from the NCRB PDFs by script and checked '
                              'against NCRB\'s own printed totals.'),
              'url': SITE_URL + '/method/', 'license': 'https://creativecommons.org/licenses/by/4.0/', 'isAccessibleForFree': True,
              'creator': [{'@type': 'Person', 'name': n} for n in RESEARCHERS], 'publisher': PUBLISHER,
              'temporalCoverage': f'2014/{last}', 'spatialCoverage': {'@type': 'Place', 'name': 'India'}, 'inLanguage': LANGS,
              'isBasedOn': {'@type': 'CreativeWork', 'name': 'Crime in India',
                            'author': {'@type': 'GovernmentOrganization', 'name': 'National Crime Records Bureau'}},
              'variableMeasured': ['Cases recorded', 'Victims', 'Cases per lakh women', 'Charge-sheeting rate', 'Conviction rate',
                                   'Cases pending trial', 'People arrested', 'People convicted'],
              'distribution': [{'@type': 'DataDownload', 'encodingFormat': 'text/csv', 'contentUrl': SITE_URL + '/data/womenonrecord.csv'},
                               {'@type': 'DataDownload', 'encodingFormat': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                                'contentUrl': SITE_URL + '/downloads/womenonrecord.xlsx'}]}
    else:
        return ''
    return '<script type="application/ld+json">' + json.dumps(ld, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/') + '</script>\n'

def render(shell, meta, content, url, attrs='', v=None, build=''):
    nav = '\n'.join(f'      <a href="{h}"' + (' class="grp"' if h in NAV_GROUP_STARTS else '') + f' data-i18n="{k}"' + (' aria-current="page"' if url.startswith(h) or url.startswith(tuple(ALSO.get(h, ()))) else '') + f'>{t}</a>'
                    for h, k, t in NAV)
    title = meta['title'] if meta['title'] == 'Women on Record' else meta['title'] + ' · Women on Record'
    out = shell
    for k, val in {'title': html.escape(title), 'desc': html.escape(meta['desc']), 'url': url, 'nav': nav,
                 'page': meta.get('page', ''), 'body_attrs': attrs, 'content': content.rstrip('\n'),
                 'alts': '\n'.join(f'<link rel="alternate" hreflang="{l}" href="{h}">' for l, h in alternates(url)),
                 'build': build, 'vmap': json.dumps(v, sort_keys=True, separators=(',', ':')),
                 'ogimg': og(url)[0], 'ogalt': html.escape(og(url)[1]), 'ld': structured(url)}.items():
        out = out.replace('{{' + k + '}}', val)
    if '{{' in out: raise SystemExit(f'{url}: unfilled placeholder')
    return stamp(out, v)

def pages():
    shell = open(os.path.join(SITE, 'shell.html'), encoding='utf-8').read().replace('{last}', last_year())
    site = json.load(open(os.path.join(ROOT, 'data', 'site.json'), encoding='utf-8'))
    v, build = versions()
    R = lambda *a, **k: render(*a, v=v, build=build, **k)
    out = {'version.json': json.dumps({'build': build}) + '\n'}
    for name in sorted(os.listdir(os.path.join(SITE, 'pages'))):
        meta, content = read(name)
        meta['page'] = name[:-5]
        if meta.get('template') == 'state':
            for p in site['places']:
                if p['kind'] == 'total': continue
                m = dict(meta, title=meta['title'].format(place=p['name']), desc=meta['desc'].format(place=p['name']))
                u = f'/states/{slug(p["id"])}/'
                out[u.strip('/') + '/index.html'] = R(shell, m, content, u, f' data-place="{html.escape(p["id"])}"')
        elif meta.get('template') == 'crime':
            for c in CRIMES:
                lab = site['heads'][c]['label']
                m = dict(meta, title=meta['title'].format(crime=lab), desc=meta['desc'].format(crime=lab))
                u = f'/crimes/{slug(c)}/'
                out[u.strip('/') + '/index.html'] = R(shell, m, content, u, f' data-crime="{c}"')
        else:
            out[meta['out']] = R(shell, meta, content, meta['url'])
    # Every page, with its five translations, for search engines. The 404 page is left out.
    urls = sorted('/' + k[:-len('index.html')] for k in out if k.endswith('index.html'))
    sm = ['<?xml version="1.0" encoding="UTF-8"?>',
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">']
    for u in urls:
        for l, h in alternates(u)[:-1]:
            sm.append(f'<url><loc>{html.escape(h)}</loc>' + ''.join(
                f'<xhtml:link rel="alternate" hreflang="{l2}" href="{html.escape(h2)}"/>' for l2, h2 in alternates(u)) + '</url>')
    sm.append('</urlset>')
    out['sitemap.xml'] = '\n'.join(sm) + '\n'
    out['robots.txt'] = f'User-agent: *\nAllow: /\n\nSitemap: {SITE_URL}/sitemap.xml\n'
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
