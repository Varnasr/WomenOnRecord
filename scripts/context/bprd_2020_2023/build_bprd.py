"""Write the 2023 and 2020 rows of context/bprd/data.csv from parsed DoPO tables
and run consistency checks. Prints a check log to stdout.

    python3 scripts/context/bprd_2020_2023/build_bprd.py

dopo2023.json and dopo2020.json beside this script were written by parse_dopo.py
from Firecrawl's text extraction of the Wayback copies of the two PDFs (see
context/bprd/notes.md). Rows for other editions in data.csv, such as 2024, are kept."""
import csv, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "..", "..", "context", "bprd", "data.csv")

CANON = ["Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat",
         "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh",
         "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan",
         "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
         "A&N Islands", "Chandigarh", "D&N Haveli and Daman & Diu", "Delhi", "Jammu & Kashmir", "Ladakh",
         "Lakshadweep", "Puducherry", "All India"]
MAP = {"A & N Islands": "A&N Islands", "Dadra and Nagar Haveli and Daman and Diu": "D&N Haveli and Daman & Diu",
       "Jammu and Kashmir": "Jammu & Kashmir", "Delh": "Delhi", "TOTAL": "All India", "Total": "All India",
       "D & N Haveli": "D & N Haveli", "Daman & Diu": "Daman & Diu"}


def canon(n):
    n = re.sub(r"[\s~!@#^*\\]+$", "", n).strip()
    return MAP.get(n, n)


def num(v):
    v = v.strip()
    if v in ("-",):
        return 0.0
    if v in ("", "NA", "NP", "@"):
        return None
    v = v.replace(",", "").replace("%", "")
    try:
        return float(v)
    except ValueError:
        return None


ED = {
    "2023": dict(json=os.path.join(HERE, "dopo2023.json"), asof="2023-01-01",
                 title="Data on Police Organizations (as on January 01, 2023), Bureau of Police Research and Development, Ministry of Home Affairs",
                 url="https://bprd.nic.in/uploads/pdf/1716639795_d6fce11ed56a985b635c.pdf",
                 pages={"2.1.2": 52, "2.1.3": 54, "3.1.1": 56, "3.2.1": 94, "5.1.4": 153, "6.2.4": 206},
                 pop_note="population in thousands as on 1 October 2022, RGI projection based on Census 2011"),
    "2020": dict(json=os.path.join(HERE, "dopo2020.json"), asof="2020-01-01",
                 title="Data on Police Organizations (as on 01.01.2020), Bureau of Police Research and Development, Ministry of Home Affairs",
                 url="https://bprd.nic.in/WriteReadData/userfiles/file/202101011201011648364DOPO01012020.pdf",
                 pages={"2.1.2": 62, "2.1.3": 64, "3.1.1": 66, "3.2.1": 106, "5.1.4": 162},
                 pop_note="population in thousands as on 1 October 2019, RGI projection based on Census 2011"),
}

rows, log = [], []


def add(state, asof, code, label, value, unit, ed, table, note=""):
    rows.append(dict(state=state, year_or_as_of=asof, indicator_code=code, indicator_label=label,
                     value=value, unit=unit, source_title=ed["title"], source_url=ed["url"],
                     table_or_page=table, note=note))


def fmt(x):
    return ("%d" % x) if float(x).is_integer() else ("%.2f" % x)


for yr, ed in ED.items():
    d = json.load(open(ed["json"]))
    t = {k: {canon(s): v for s, v in tab.items() if s not in ("__header__", "")} for k, tab in d.items()}
    pg = ed["pages"]
    vals = {}
    for s, c in t["2.1.2"].items():
        vals.setdefault(s, {})
        vals[s]["pop_k"] = num(c[3]); vals[s]["sanc"] = num(c[4]); vals[s]["act"] = num(c[5])
    for s, c in t["2.1.3"].items():
        vals.setdefault(s, {})
        vals[s]["ppr_s"] = num(c[-2]); vals[s]["ppr_a"] = num(c[-1])
    for s, c in t["3.1.1c"].items():
        hdr = d["3.1.1c"]["__header__"]
        i_s = [i for i, h in enumerate(hdr) if h.startswith("TOTAL STRENGTH OF STATE POLICE") and h.endswith(" S")][0]
        vals.setdefault(s, {})
        vals[s]["sanc_311"] = num(c[i_s]); vals[s]["act_311"] = num(c[i_s + 1]); vals[s]["women_311"] = num(c[-1])
    for s, c in t["3.2.1"].items():
        vals.setdefault(s, {})
        vals[s]["act_321"] = num(c[2]); vals[s]["women"] = num(c[3]); vals[s]["women_pct"] = num(c[4])
    for s, c in t["5.1.4"].items():
        vals.setdefault(s, {})
        vals[s]["ps_caw"] = num(c[3])

    # women police stations, 2023 only, from Table 6.2.4 (see notes for reconstructed rows)
    wps = {}
    if "6.2.4" in pg:
        printed = {s: c for s, c in t["6.2.4"].items()}
        fixes = {  # state: (rural, urban, total, note) where the extracted total cell was not legible
            "Rajasthan": (0, 41, 41, "Total cell extracted as '4)1'; rural 0 and urban 41 are printed, so total read as 41."),
            "Sikkim": (1, 1, 2, "Columns shifted in extraction; rural 1 and urban 1 printed, total is their sum."),
            "Tamil Nadu": (47, 175, 222, "Columns shifted in extraction; rural 47 and urban 175 printed, total is their sum. Equals Table 5.1.4 'crime against women & children' (222)."),
            "Chandigarh": (0, 1, 1, "Columns shifted in extraction; rural 0 and urban 1 printed."),
            "Jammu & Kashmir": (8, 2, 10, "Columns shifted in extraction; rural 8, urban 2 and total 10 legible."),
            "Ladakh": (0, 1, 1, "Columns shifted in extraction; rural 0 and urban 1 printed."),
            "Puducherry": (1, 2, 3, "Columns shifted in extraction; rural 1 (Karaikal) and two urban stations listed (Pondy, Villianur); total is their sum. Equals Table 5.1.4 'crime against women & children' (3)."),
        }
        for s, c in printed.items():
            if s in fixes:
                r, u, tot, note = fixes[s]
                wps[s] = (r, u, tot, note)
            else:
                wps[s] = (num(c[2]), num(c[4]), num(c[6]), "")

    states = [s for s in vals if s != "All India"]
    # ---------- checks ----------
    log.append(f"== DoPO as on {ed['asof']}: {len(states)} state/UT rows")
    for key, lab in [("sanc", "sanctioned total (T2.1.2)"), ("act", "actual total (T2.1.2)"),
                     ("women", "women actual (T3.2.1)"), ("pop_k", "population thousand (T2.1.2)"),
                     ("ps_caw", "special PS crime against women & children (T5.1.4)")]:
        sm = sum(vals[s].get(key) or 0 for s in states)
        ai = vals["All India"].get(key)
        log.append(f"sum of states {lab}: {fmt(sm)} vs All India {fmt(ai) if ai is not None else None} -> {'OK' if ai is not None and abs(sm-ai) < 0.5 else 'DIFF %s' % (fmt(sm-ai) if ai is not None else '')}")
    if wps:
        sm = sum(v[2] or 0 for s, v in wps.items() if s != "All India")
        log.append(f"sum of states women police stations (T6.2.4): {fmt(sm)} vs printed Total {fmt(wps['All India'][2])} -> {'OK' if abs(sm - wps['All India'][2]) < .5 else 'DIFF'}")
        smr = sum(v[0] or 0 for s, v in wps.items() if s != 'All India'); smu = sum(v[1] or 0 for s, v in wps.items() if s != 'All India')
        log.append(f"  rural {fmt(smr)} vs {fmt(wps['All India'][0])}; urban {fmt(smu)} vs {fmt(wps['All India'][1])}")
    bad = []
    for s in vals:
        v = vals[s]
        if v.get("act") != v.get("act_311") or v.get("act") != v.get("act_321") or v.get("sanc") != v.get("sanc_311"):
            bad.append(f"{s}: T2.1.2 S/A {v.get('sanc')}/{v.get('act')}, T3.1.1 S/A {v.get('sanc_311')}/{v.get('act_311')}, T3.2.1 A {v.get('act_321')}")
        if v.get("women") != v.get("women_311"):
            bad.append(f"{s}: women T3.2.1 {v.get('women')} vs T3.1.1 {v.get('women_311')}")
        if v.get("women") is not None and v.get("act"):
            r = round(100 * v["women"] / v["act"], 2)
            if v.get("women_pct") is None or abs(r - v["women_pct"]) > 0.011:
                bad.append(f"{s}: women % printed {v.get('women_pct')} vs recomputed {r}")
        if v.get("pop_k") and v.get("act") is not None and v.get("ppr_a") is not None:
            r = v["act"] / (v["pop_k"] * 1000) * 1e5
            rs = v["sanc"] / (v["pop_k"] * 1000) * 1e5
            if abs(r - v["ppr_a"]) > 0.6 or abs(rs - v["ppr_s"]) > 0.6:
                bad.append(f"{s}: police per lakh printed S/A {v['ppr_s']}/{v['ppr_a']} vs recomputed {rs:.2f}/{r:.2f}")
    log.append("cross-table and recompute checks: " + ("all OK" if not bad else f"{len(bad)} discrepancies"))
    log += ["  " + b for b in bad]

    # ---------- rows ----------
    if "D & N Haveli" in vals:
        a, b = vals.pop("D & N Haveli"), vals.pop("Daman & Diu")
        comb = {}
        parts = []
        for k in ("sanc", "act", "women", "pop_k"):
            if a.get(k) is not None and b.get(k) is not None:
                comb[k] = a[k] + b[k]
                parts.append(f"{k}: D & N Haveli {fmt(a[k])} + Daman & Diu {fmt(b[k])}")
        comb["ps_caw"] = a.get("ps_caw")
        comb["_note"] = ("The 2020 edition prints 'D & N Haveli' and 'Daman & Diu' as separate rows (the UTs merged on 26 Jan 2020). "
                         "Counts here are the sum of the two printed rows (" + "; ".join(parts) + "). Ratios and percentages are left out because the "
                         "edition prints none for the merged UT. For special purpose police stations Daman & Diu is printed '@', with the footnote "
                         "'Data of Daman & Diu is included in D & N Haveli'.")
        vals["D&N Haveli and Daman & Diu"] = comb
    for s in vals:
        v = vals[s]
        st = s
        note = v.get("_note", "")

        def A(code, label, val, unit, tab, n=""):
            if val is None:
                return
            add(st, ed["asof"], code, label, fmt(val), unit, ed, f"Table {tab}, p.{pg[tab.split()[0]]}", "; ".join(x for x in [note, n] if x))
        A("police_sanctioned_total", "Total State police strength, sanctioned (Civil + DAR + Armed + IRB)", v.get("sanc"), "persons", "2.1.2")
        A("police_actual_total", "Total State police strength, actual (Civil + DAR + Armed + IRB)", v.get("act"), "persons", "2.1.2")
        A("women_police_actual", "Women police, actual strength (Civil + DAR + Armed + IRB)", v.get("women"), "persons", "3.2.1")
        A("women_police_pct_actual", "Women police as % of actual total police strength (as printed)", v.get("women_pct"), "percent", "3.2.1")
        A("police_per_lakh_sanctioned", "Total police per lakh population, sanctioned", v.get("ppr_s"), "per 100,000 population", "2.1.3")
        A("police_per_lakh_actual", "Total police per lakh population, actual", v.get("ppr_a"), "per 100,000 population", "2.1.3")
        A("population_thousand", "Projected population used by DoPO for ratios", v.get("pop_k"), "thousand persons", "2.1.2", ed["pop_note"])
        if v.get("ps_caw") is not None:
            A("ps_special_crime_against_women_children", "Special purpose police stations: crime against women & children (actual)", v.get("ps_caw"), "police stations", "5.1.4")
        elif s == "Daman & Diu":
            pass
    for s, (r, u, tot, n) in wps.items():
        for code, lab, val in [("women_police_stations_total", "Women police stations, rural + urban (total)", tot),
                               ("women_police_stations_rural", "Women police stations, rural", r),
                               ("women_police_stations_urban", "Women police stations, urban", u)]:
            if val is None:
                add(s, ed["asof"], code, lab, "NA", "police stations", ed, f"Table 6.2.4, p.{pg['6.2.4']}", "Printed as NA (not available) for this state.")
            else:
                add(s, ed["asof"], code, lab, fmt(val), "police stations", ed, f"Table 6.2.4, p.{pg['6.2.4']}", n)

missing = sorted(set(CANON) - {r["state"] for r in rows})
log.append("canonical names missing from output: " + (", ".join(missing) or "none"))
extra = sorted({r["state"] for r in rows} - set(CANON))
log.append("non-canonical names in output: " + (", ".join(extra) or "none"))
mine = {ed["asof"] for ed in ED.values()}
rows += [r for r in csv.DictReader(open(OUT, encoding="utf-8")) if r["year_or_as_of"] not in mine]
order = {s: i for i, s in enumerate(CANON)}
rows.sort(key=lambda r: (r["year_or_as_of"], r["indicator_code"], order.get(r["state"], 99)))
with open(OUT, "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
    w.writeheader(); w.writerows(rows)
print("\n".join(log)); print(len(rows), "rows written")
