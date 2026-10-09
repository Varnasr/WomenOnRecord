"""Write js/i18n.js from i18n/<lang>.json.

i18n/en.json is the reference. Keys used in the pages (data-i18n) are read
from site/shell.html and site/pages/, so the English shown without JavaScript and the English
the script applies cannot drift. Every other language must carry every key,
with the same {placeholders}. Usage: python3 scripts/build_i18n.py [--check]
"""
import html.parser, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LANGS = {
 'en': {'name': 'English', 'dir': 'ltr', 'font': None},
 'hi': {'name': 'हिन्दी', 'dir': 'ltr', 'font': None},
 'ur': {'name': 'اردو', 'dir': 'rtl', 'font': 'https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;700&display=swap'},
 'ta': {'name': 'தமிழ்', 'dir': 'ltr', 'font': 'https://fonts.googleapis.com/css2?family=Noto+Sans+Tamil:wght@400;600;700&family=Noto+Serif+Tamil:wght@600&display=swap'},
 'bn': {'name': 'বাংলা', 'dir': 'ltr', 'font': 'https://fonts.googleapis.com/css2?family=Noto+Sans+Bengali:wght@400;600;700&family=Noto+Serif+Bengali:wght@600&display=swap'},
 'mr': {'name': 'मराठी', 'dir': 'ltr', 'font': None},
}

class Grab(html.parser.HTMLParser):
    def __init__(self):
        super().__init__(); self.stack = []; self.out = {}
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        self.stack.append([a.get('data-i18n'), ''])
    def handle_endtag(self, tag):
        if not self.stack: return
        key, text = self.stack.pop()
        if key:
            self.out[key] = re.sub(r'\s+', ' ', text).strip()
        if self.stack: self.stack[-1][1] += text
    def handle_startendtag(self, tag, attrs): pass
    def handle_data(self, d):
        if self.stack: self.stack[-1][1] += d

VOID = re.compile(r'<(meta|link|br|img|input|source|line|rect|path|circle)\b[^>]*?>')

def page_keys():
    """Keys and English text from the shell and every page source. A key used
    on two pages must carry the same English on both."""
    out = {}
    files = [os.path.join(ROOT, 'site', 'shell.html')] + sorted(
        os.path.join(ROOT, 'site', 'pages', f) for f in os.listdir(os.path.join(ROOT, 'site', 'pages')))
    for f in files:
        g = Grab(); g.feed(VOID.sub('', open(f, encoding='utf-8').read()))
        for k, v in g.out.items():
            if k in out and out[k] != v:
                raise SystemExit(f'{os.path.basename(f)} and another page disagree on the English for {k}')
            out[k] = v
    return out

def build():
    en = json.load(open(os.path.join(ROOT, 'i18n', 'en.json'), encoding='utf-8'))
    pk = page_keys()
    for k, v in pk.items():
        if k in en and en[k] != v:
            raise SystemExit(f'en.json and the pages disagree on {k}')
        en[k] = v
    dicts = {'en': en}
    probs = []
    for l in LANGS:
        if l == 'en': continue
        p = os.path.join(ROOT, 'i18n', f'{l}.json')
        if not os.path.exists(p):
            dicts[l] = {}  # not translated yet; the page hides it from the menu
            continue
        d = json.load(open(p, encoding='utf-8'))
        for k, v in en.items():
            if k not in d:
                probs.append(f'{l}: missing {k}')
            elif sorted(re.findall(r'\{\w+\}', v)) != sorted(re.findall(r'\{\w+\}', d[k])):
                probs.append(f'{l}: placeholders differ in {k}')
        extra = set(d) - set(en)
        probs += [f'{l}: unused key {k}' for k in extra]
        dicts[l] = d
    return dicts, probs

if __name__ == '__main__':
    dicts, probs = build()
    js = '/* Written by scripts/build_i18n.py from i18n/*.json. Do not edit. */\nwindow.SC_I18N = ' + json.dumps(
        {'langs': LANGS, 'dict': dicts}, ensure_ascii=False, separators=(',', ':')) + ';\n'
    out = os.path.join(ROOT, 'js', 'i18n.js')
    if '--check' in sys.argv:
        if probs: raise SystemExit('\n'.join(probs))
        if open(out, encoding='utf-8').read() != js: raise SystemExit('js/i18n.js is stale: run python3 scripts/build_i18n.py')
        print('PASS: every language carries every key')
    else:
        open(out, 'w', encoding='utf-8').write(js)
        print('wrote js/i18n.js;', len(probs), 'translation gaps')
        for p in probs[:8]: print(' ', p)
