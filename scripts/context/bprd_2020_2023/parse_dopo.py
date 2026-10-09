"""Parse state rows out of the Firecrawl markdown of a DoPO edition.
Usage: parse_dopo.py <markdown> <out_json>
Writes {table_key: {state: [cells...]}} for the tables we need, keyed by the
first line of the table heading that follows. Cells are kept as printed."""
import json, re, sys

md = open(sys.argv[1], encoding="utf-8").read().split("\n")

WANT = {
    "2.1.2": r"^TABLE 2\.1\.2 --AREA",
    "2.1.3": r"^TABLE 2\.1\.3 --SANCTIONED",
    "3.1.1": r"^TABLE 3\.1\.1 --SANCTIONED",
    "3.1.1c": r"^TABLE 3\.1\.1 --\(CONTINUED",
    "3.2.1": r"^TABLE 3\.2\.1 --STRENGTH",
    "5.1.4": r"^TABLE 5\.1\.4 --ACTUAL",
    "6.2.4": r"^TABLE 6\.2\.4 ",
}
out = {}
for key, pat in WANT.items():
    starts = [i for i, l in enumerate(md) if re.search(pat, l)]
    rows = {}
    for s in starts[:1] if key != "6.2.4" else starts:
        hdr = None
        for l in md[s + 1:s + 120]:
            if l.startswith("TABLE ") and l is not md[s]:
                break
            if not l.startswith("|"):
                continue
            cells = [c.strip() for c in l.strip().strip("|").split("|")]
            if hdr is None:
                hdr = cells
                rows.setdefault("__header__", hdr)
                continue
            if cells[0] in ("---",) or cells[0].startswith("("):
                continue
            name = cells[1] if cells[0] not in ("All India", "TOTAL", "Total") else cells[0]
            if key == "6.2.4":
                rows.setdefault(name, cells)  # first row per state carries the totals
            else:
                rows[name] = cells
        out[key] = rows
json.dump(out, open(sys.argv[2], "w"), indent=1, ensure_ascii=False)
for k, v in out.items():
    print(k, len(v) - 1, list(v)[:3])
