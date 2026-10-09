# She Counts

Crimes against women in India, as police and courts recorded them, 2014 to
2024, at shecounts.netlify.app. Static HTML, no framework. Data from NCRB Crime
in India, Volume 1, read by script, and eight context sources beside it.

## Pages

Never edit a built page. `scripts/build_pages.py` writes every page from
`site/shell.html` (head, header, nav, footer) and `site/pages/*.html`, whose
first line is `<!--page {json} -->`. Pages: home (`index.html`),
`protests/`, `courts/`, `states/`, `crimes/`, `context/`, `explore/`, `method/`
and `terms/`. Two
sources are templates: `state.html` is written once per state and union
territory (`states/<slug>/`, 36) and `crime.html` once per crime
(`crimes/<slug>/`, the 17 in `CRIMES`), with the place or crime in a `data-`
attribute on `<body>`. The slug rule is in both `build_pages.py` and `js/app.js`
(`&` becomes "and"); change both or links break. CI runs `--check`.

Every file a page loads or offers for download carries `?v=<hash of its contents>`, and each page
carries the build it came from (`SC_BUILD`); `build_pages.py` writes both, and
`version.json` with the live build. So build pages last, after `build_i18n.py`
and any data build, or the fingerprints describe old files. `netlify.toml`
serves pages with `max-age=0, must-revalidate` and fingerprinted CSS and JS as
immutable. When a reader returns to a tab or goes back to a page, `js/app.js`
fetches `version.json` and reloads if a newer build is live. It never reloads a
page while it is in view. A new file a page loads goes into `ASSETS` in
`build_pages.py`, and a new `fetch` in `app.js` goes through `ver()`, or it
escapes the fingerprint.

Women appear on the site only as data. `C.iso` in `js/charts.js` draws 100
standing figures, each 1 in 100 cases of a crime before the courts in a year,
split by largest remainder so they always add to 100: red for convicted,
red outline for acquitted or discharged, grey for ended another way, indigo for
still waiting. The figure is upright and still on purpose. Never draw a woman
hurt, hiding, crouched or afraid; that image shows women only as victims, and
this site is for the women protesting. The link preview draws the same figure.

Every chart and figure has a row of buttons under it (`tools()` in
`js/app.js`): PNG and SVG cards that carry the chart's title and source, a CSV
of the numbers behind it (each chart keeps them on its box as `__csv`), a
WhatsApp message with the section's finding and link, and a copied link. Every
section heading has a link button (`anchors()`). A new chart gets all of this
by sitting in a `figure.chart` and keeping its numbers in `__csv`.

`js/app.js` draws only what the page's `data-page` names. `js/charts.js` holds
the charts, all plain SVG: `flow` (the sankey on the police and courts page),
`lines`, `stack`, `slope`, `columns`, `heat` (state by year, on the crime
pages), `dumbbell` (a state against India, on the state pages), `treemap` (what
was recorded, on the crimes page), `tiles` (a tile map of India with each
state's five years, on the states page) and `swarm` (every state's rate, one
row per year, with India marked, on the crime pages). The states page also
draws the map once per year on one shared scale. Every chart redraws when its
box changes width, and every chart has a phone layout: below 700px the flow
becomes one labelled bar per stage (`steps`), the dumbbell puts each name on
its own line, and more than five single columns lie on their side. Check every
chart at 390px wide before deploying; the owner reads the site on a phone.

The treemap's boxes must add to the total. The named headings are
`MIX_IPC` and `MIX_SLL` in `js/app.js`, none counted twice because NCRB files
each case under its most serious offence, and what they leave of
`IPC_TOTAL` and `SLL_TOTAL` is drawn as "every other heading". A heading that
contains another (RAPE_WOMEN inside RAPE, POCSO_RAPE inside POCSO_TOTAL) must
never be added to those lists.

`explore/` is the whole dataset as a table that can be filtered, searched,
sorted and downloaded, with the view kept in the address. It reads
`data/explore.json`, which `scripts/build_explore.py` writes from
`data/shecounts.csv` with every repeated value written once (542 KB against
9.3 MB). The build fails unless every CSV row comes back exactly from the
compact file, and a download from the page rebuilds rows in the CSV's own
eighteen columns. Measure names there are English, as in the files; the page
says so in each translation. Rebuild it after any data change; CI runs
`--check`.

The flow joins the police stage to the court stage through "waiting in court
from earlier years", computed as cases before the courts less that year's
charge-sheets. That equals NCRB's own count of cases pending trial from the
year before, to the case in most years and within 0.1% in the rest; checked for
every crime and year before the chart was drawn. Do not draw a flow for a crime
or year where it goes negative.

States are listed alphabetically on every page and never ranked by rate.
NCRB warns against comparing states on these figures, and the state pages show
each state against itself (2020 against 2024) and against India.

## Credit

The footer follows offtheroll.in's: one centred line saying who did the
research, the promise about what is published, then links. The research is by
Vinitha Joseph, Nivedita Biswas, Tarushaa Miittal and Varna. Do not copy
offtheroll's credit here; the two sites credit different people. Names stay in
Latin script in every language. The footer and the terms page say only that She
Counts is not published by NCRB or any government. Do not add a claim of
independence from political parties; the owner removed it because it is untrue. The publisher is PinPoint Ventures and the address is
info@pinpointventures.in, as on offtheroll.in.

`terms/` is the terms and privacy page, in English with a translated note that
the English governs. It describes She Counts as a publisher of public
statistics with a correction and complaints process (acknowledged in 24 hours,
answered in 15 days); the owner chose not to claim or deny news-publisher
status under the 2021 IT Rules. Keep its privacy section true. Every font,
script and data file is served from this site (the fonts are in `fonts/`, with
`css/fonts*.css`), so no service but Netlify sees a reader. If the site ever
loads anything from another origin, or starts recording anything, the privacy
section and the CSP in `netlify.toml` change in the same commit.

## Context sources

`context/<source>/` holds each of the eight sources as collected: `data.csv`,
`sources.json` (addresses, dates, checksums) and `notes.md` (definitions,
limits and every check run). `scripts/build_context.py` writes
`data/context.json` for the page and `data/context.csv` for download, changing
no figure; `build_xlsx.py` writes `downloads/context.xlsx`. Limits each page
must keep saying: NFHS spousal violence is ever-married women 18 to 49; NCW
counts complaints, half from Uttar Pradesh; ADSI does not say why anyone died;
BPR&D is 1 January 2023 (the 2024 edition, about 60 MB, could not be fetched
from the sandbox); the FTSC conviction rate has no stated denominator and the
dashboard's undated figure is never shown with a date; NJDG counts cases a
woman filed, which are not crimes against women; Nirbhaya state figures are
released and used combined; ADR counts declared pending cases, never
convictions, and no legislator is named anywhere on the site.

## Writing rules for everything on this site

These are the owner's rules. They apply to every word a reader sees: the page,
the five translations, the README, the dataset's notes and codebook, the
preview image, and commit messages.

- Write plainly, in full sentences, with facts and explanations. Say what a
  figure is, where it comes from and what it cannot show.
- No euphemisms. Rape is rape. Say "murdered", "killed", "acquitted".
- No em dashes and no double hyphens standing in for one. Use a full stop, a
  comma, parentheses or "and". A range takes "to" or a hyphen.
- No "X, not Y" in any form: "not X but Y", "it's not X, it's Y", "not only
  ... but also", "less about X than Y", "rather than" used as a turn. State
  the claim directly.
- No fragments, countdowns, punchline endings or slogans. End a paragraph on
  the fact. Headings and table labels may be short; sentences may not.
- No colon-hinged sentences ("X: Y") and no clauses strung on semicolons.
- No flourishes and no stock vocabulary. The words in `BANNED` in
  `scripts/check.py` fail the build; the rule covers the whole of the owner's
  list, which is longer than a regex can hold. Read what you write.
- No bold for emphasis in prose, no emoji, sentence-case headings.
- Facts only from a source. Every number on the site comes from the data
  files; every claim in prose names its source and page.
- No survivor is named, pictured or described, in any case. BNS s.72 (IPC
  s.228A) makes it an offence; Nipun Saxena v Union of India (2018) extends it
  to any detail that could identify her.

`scripts/check.py` catches what a regex can: em dashes, the banned words,
", not X." endings and "not only". It cannot catch a fragment or a flourish.

## Translations

`i18n/<lang>.json` for hi, ur, ta, bn, mr. English comes from the page sources
(the `data-i18n` text in `site/`) and `i18n/en.json`. Change an English string, then
change all five translations in the same commit; `build_i18n.py --check`
fails on a missing key or a changed placeholder. No native speaker has read
the translations yet, and every translated page says so. Numbers stay in
Western digits with Indian grouping in every language, and `check.py` fails on
Devanagari, Bengali, Tamil or Arabic-Indic digits (fourteen Bengali strings
had them until October 2026). In Urdu, India is
بھارت everywhere (the owner's rule), and `check.py` fails on ہندوستان.

## Years

The dataset runs from 2014 to 2024. The site's charts run from 2017
(`SITE_FROM` in `scripts/build_site_data.py`), the first year NCRB used the
crime headings and table layout it still uses. Before 2017 only India is
shown, only on the crime pages' trend line, and only for the headings in
`LONG`, which NCRB defined the same way throughout. Rape is in `LONG` for 2014
and 2015 and has a gap at 2016, because NCRB's 2016 rape figure included POCSO
cases. A line never joins two years across a gap (`lines` in `charts.js`).

2014 to 2019 were extracted once from NCRB's per-table PDFs by the scripts in
`scripts/old_extract/` and are read from `data/raw/old/`, where the sources,
checksums, every check and every definition difference are written down.
Do not add a pre-2017 heading to `LONG` unless its definition is the same; a
heading defined differently keeps its own code (`_2014DEF`, `_2016DEF`,
`OLD_HEADS` and `RENAME_2016` in `build_data.py`). Before 2020, Dadra and Nagar
Haveli and Daman and Diu are added together, Jammu and Kashmir includes Ladakh,
and West Bengal's 2019 figures are NCRB's repeat of 2018 (flag
`WB_2019_REPEATS_2018`). The population behind the rates changes in 2018 and
2020. NCRB's 2016 rate for trafficking in Uttarakhand is a misprint, kept as
printed and named in `MISPRINTS` in `check.py`.

## Data

`scripts/build_data.py` reads `data/raw/cii<year>_v1.txt` (the NCRB pages,
extracted with `pdftotext -layout`) and writes `data/shecounts.csv`. For every
count column the 28 states must add to NCRB's Total State(s), the 8 UTs to
Total UT(s), and both to Total All India, or the build stops.
`scripts/check.py` also checks every printed rate against cases over female
population, and IPC/BNS plus SLL against the total.

Traps already met, so nobody meets them again:

- 2024 splits heads the BNS split. s.354 is five heads (BNS 74 to 78), and
  kidnapping leaves out marriage (BNS 87) and procuration (BNS 96). Their sums
  are the comparable figures; read alone, kidnapping shows a false 23% fall.
- In 2024 each IPC/BNS head is five columns (IPC, BNS, Total, V, R). The
  Total column is the third. Pointing at the first gave IPC alone once, and
  the rate check caught it.
- Table 3A.2 page 25 of 2024 prints column numbers 252 to 254 twice.
- NCRB publishes police and court outcomes by state only for all crimes
  against women together. For single crimes such as rape it publishes them
  for India only (tables 3A.5 and 3A.7). Never present a state rape
  conviction rate.
- Rape of girls is mostly booked under POCSO s.4 and 6. Show POCSO beside
  rape whenever rape is shown.

## Commands

```bash
python3 scripts/build_data.py && python3 scripts/build_site_data.py
python3 scripts/build_context.py
python3 scripts/build_explore.py
python3 scripts/build_xlsx.py
python3 scripts/build_i18n.py
python3 scripts/build_pages.py      # last: it fingerprints everything above
python3 scripts/check.py
PLAYWRIGHT_CORE=... CHROME=... python3 scripts/og/make_card.py   # preview image
bash scripts/deploy.sh                                            # until Netlify is linked to the repo
```
