"""Add NCRB tables to data/raw/cii<year>_v1.txt from the edition's PDF.

The raw files hold only the pages the site reads. This copies more of them, by
the footer NCRB prints on every table page ("TABLE 3A.4 Page 1 of 1"), from the
`pdftotext -layout` text of the same PDF whose SHA-256 is in data/raw/sources.json.
A page already in the file is not added twice.

Usage: python3 scripts/add_raw_tables.py <year> <pdf> <table> [<table> ...]
"""
import hashlib, json, os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, 'data', 'raw')

def main():
    year, pdf, tables = sys.argv[1], sys.argv[2], sys.argv[3:]
    src = json.load(open(os.path.join(RAW, 'sources.json')))
    want = src[year]['sha256']
    got = hashlib.sha256(open(pdf, 'rb').read()).hexdigest()
    if got != want:
        raise SystemExit(f'{pdf}: sha256 {got} is not the recorded {want}')
    full = subprocess.run(['pdftotext', '-layout', pdf, '-'], capture_output=True, text=True, check=True).stdout.split('\f')
    path = os.path.join(RAW, f'cii{year}_v1.txt')
    text = open(path, encoding='utf-8').read()
    have = text.split('\f')
    new = []
    for t in tables:
        pat = re.compile(r'TABLE\s+' + re.escape(t) + r'\s+Page\s+\d+(\s+of\s+\d+)?\b')
        pages = [p for p in full if pat.search(p)]
        if not pages:
            raise SystemExit(f'{year}: no page carries the footer of table {t}')
        new += [p for p in pages if p not in have and p not in new]
    if new:
        open(path, 'w', encoding='utf-8').write(text + '\f' + '\f'.join(new))
    added = len(new)
    src[year]['pages_kept'] = len(have) + added
    open(os.path.join(RAW, 'sources.json'), 'w', encoding='utf-8').write(json.dumps(src, indent=1, ensure_ascii=False))
    have = have + new
    print(f'{year}: added {added} pages, {len(have)} kept')

if __name__ == '__main__':
    main()
