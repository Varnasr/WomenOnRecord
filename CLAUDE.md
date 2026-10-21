# Women on Record

Shared engineering standard: @.claude/engineering-standards.md. It applies to all work in this repository. This file adds what is specific to the project, and wins where the two disagree.

Crimes against women in India, as police and courts recorded them, 2014 to
2024, at www.womenonrecord.net. Static HTML, no framework. Data from NCRB Crime
in India, Volume 1, read by script, and eight context sources beside it.

## Pages

Never edit a built page. `scripts/build_pages.py` writes every page from
`site/shell.html` (head, header, nav, footer) and `site/pages/*.html`, whose
first line is `<!--page {json} -->`. Pages: home (`index.html`),
`protests/`, `courts/`, `states/`, `crimes/`, `context/`, `explore/`, `method/`,
`law/`, `counting/`, `path/` and `terms/`. Two
sources are templates: `state.html` is written once per state and union
territory (`states/<slug>/`, 36) and `crime.html` once per crime
(`crimes/<slug>/`, the 17 in `CRIMES`), with the place or crime in a `data-`
attribute on `<body>`. The slug rule is in both `build_pages.py` and `js/app.js`
(`&` becomes "and"); change both or links break. CI runs `--check`.

Every file a page loads or offers for download carries `?v=<hash of its contents>`, and each page
carries the build it came from (`WOR_BUILD`); `build_pages.py` writes both, and
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
`data/womenonrecord.csv` with every repeated value written once (about 1.8 MB against
25 MB, before gzip). The build fails unless every CSV row comes back exactly from the
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

`law/` sets each crime's IPC section against its BNS section and lists what the
BNSS requires when a woman reports a sexual offence, with the section for every
line. It is English only, because the English text of an Act is the
authoritative one. Each row of its table has an id, and the law line on every
crime page links to it through `LAW_ROW` in `js/app.js`; rename a row and
change both. Every quotation was checked on 9 October 2026: the BNS and BNSS against the
Gazette of India texts of 25 December 2023 (Acts 45 and 46 of 2023), the IPC
and CrPC sections against Indian Kanoon because India Code refused the sandbox,
and Imran Pratapgadhi v State of Gujarat (2025 INSC 410) and Lalita Kumari
((2014) 2 SCC 1, para 120.6 as reproduced there) against the judgment itself.
Add a line to it only from the text of the Act, the Gazette or a judgment.

`counting/` ("How the numbers are made") sets out how NCRB counts, in NCRB's
own words: the Principal Offence Rule (Crime in India 2024, Volume 1, General
Notes, pages v and vii), the 2016 edition's statement that the rule did not
apply to the chapter on crimes against women (2016, page xi) and the 2024
edition's silence on it, murder with rape, the 2016 rape and POCSO change,
the population sources, and what NFHS-5 says never reaches the police. Its two
sentences with figures are computed in `counting()` in `js/app.js` from
`site.json` and `context.json`. NCRB has not said whether the 2016 exception
still holds; the owner chose to say so plainly and not to file an RTI
application. Checked on 10 October 2026 in every edition from 2016 to 2024:
the exception appears only in 2016 (General Notes, page xi); 2017 to 2021 keep
the "Murder with Rape is accounted as Murder" example in their Limitations and
drop the exception; 2022 to 2024 drop the example too. The one measurement of
what the rule hides is NCRB's own, in the 2016 Limitations (page ix): about
38,632 FIRs carried a Dowry Prohibition Act charge in CCTNS against 9,683
counted, and the 2016 chapter (Table 3A.2) prints that same 9,683. So for that
heading in that year the chapter figure is the rule's figure, and the page says
exactly that much. Do not extend it to other headings or years, and do not
write that the rule applies to the whole chapter, or that it does not, until
NCRB says which.

`path/` ("Where a woman's case is lost") follows a case step by step: the
violence (NFHS-5), telling someone, the police (BNSS s.173, Lalita Kumari,
BNS s.199(c), the CHRI and AALI study of 14 cases), being counted, the
investigation and the trial (both computed in `pathPage()` in `js/app.js`).
Then the gaps in the law itself (BNS s.63 Exception 2 and the definition's
"A man"), cases and reports that changed the law by legal title only, and
organisations working on the same steps, each line from that organisation's
own pages. The help-seeking figure is a count (141 of 17,765, Ghoshal and
others 2024, Table 3), never a weighted percentage. Women were 12.3% of the
police in January 2023 (India Justice Report 2025, page 53); the 8% figure is
officers. Tuka Ram v State of Maharashtra (1978) is on the list with the
1983 Act as the sources state it: Act 43 of 1983, in force 25 December 1983,
adding IPC s.228A and CrPC s.327(2) (Nipun Saxena, paras 6 to 8) and Evidence
Act s.114A (Law Commission, 185th Report, page 265). The Act's own text could
not be read (India Code refuses the sandbox), so say nothing else about it,
and do not say the judgment caused the Act; the 84th Report (para 1.4) says
only that it provoked debate. A case goes on the list only by its legal title, with
no survivor named or described.

The header nav has eight items in three groups, with a rule between groups:
the records (Crimes, States, Police and courts), reading them (Context, How it
works, Protests) and the data (Explore, Data and method). `NAV` and
`NAV_GROUP_STARTS` in `build_pages.py` set the order and groups; the home
page's cards and the tour follow the same order. On a wide screen the rule sits
inside the gap between groups, so it costs the row no width; in the menu it is
a line across. `ALSO` in `build_pages.py` marks "How it works" as current
on `/counting/` and `/law/` too, and the home page's "How the records work"
band links all three. Eight items fill the header row at 1280px with almost
nothing to spare: the wordmark is 23px, the nav 15px with 10px gaps (17px
between groups) and the row 16px gaps, measured so that English, Hindi, Urdu, Bengali and Marathi fit
on one row at 1280 and 1440 (Tamil folds into the menu, as it did before).
A ninth item, or a longer label in any language, will fold the header into
the menu on a laptop. Measure at 1280 in all six languages after any change to
the nav.

## Addresses

The site is the Netlify site `womenonrecord`, served at www.womenonrecord.net,
with DNS on Netlify (the domain is registered at Porkbun). The bare domain and
womenonrecord.netlify.app forward to www. The site was called She Counts until
10 October 2026. Its first address, shecounts.netlify.app, is now a separate
Netlify site, also named `shecounts`, holding only a `_redirects` file that
forwards every path here. Keep it: deleting it frees the name for anyone, and
links to the old address are already shared. The old download names
(`shecounts.csv`, `shecounts.xlsx`) redirect in `netlify.toml`, and the theme
and language a reader chose are read from the old `sc-` keys as well as `wor-`.

## Credit

The footer follows offtheroll.in's: one centred line saying who did the
research, the promise about what is published, then links. The research is by
Vinitha Joseph, Nivedita Biswas, Tarushaa Miittal and Varna. Do not copy
offtheroll's credit here; the two sites credit different people. Names stay in
Latin script in every language. The footer and the terms page say only that Women
on Record is not published by NCRB or any government. Do not add a claim of
independence from political parties. The publisher is PinPoint Ventures and the address is
info@pinpointventures.in, as on offtheroll.in.

`terms/` is the terms and privacy page, in English with a translated note that
the English governs. It describes Women on Record as a publisher of public
statistics with a correction and complaints process (acknowledged in 24 hours,
answered in 15 days). Keep its privacy section true. Every font,
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
BPR&D is 1 January 2024 (the PDF is checked against the Wayback SHA-1 by
`scripts/context/bprd_2024.py`, which refuses any other file); the FTSC conviction rate has no stated denominator and the
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
extracted with `pdftotext -layout`) and writes `data/womenonrecord.csv`. For every
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

## Accessibility

Audited with axe-core on 12 October 2026 over all 65 pages and the 404 page, in
both colour themes at 390 and 1280 wide, and over nine pages in Hindi, Urdu and
Tamil: 0 serious or critical. Three things it found, so they are not undone:

- An element that holds something focusable cannot be `role="img"`. The state map
  (`#map`) and the tile map are `role="group"`, because every state on them is a
  link, and the home page figure has no role, because the share buttons sit inside it.
- The 100 figures (`C.iso`) are `aria-hidden`. The text and legend beside them give
  every number.
- `.btn` writes `var(--ground)` on `var(--red)`, which is white on dark red in the
  light theme and near-black on pale red in the dark one. A literal `#fff` measured
  2.38:1 in the dark theme.

`scripts/audit.mjs` runs it in CI as its own job (`npm ci`, then
`node scripts/audit.mjs`; locally pass `CHROME=` the Chromium path). It walks every
page, so a new page is covered by existing, loads each in both themes at 390 and 1280
and three pages in Urdu and Tamil, and fails on a serious or critical axe finding, a
page wider than the screen, a script error or a failed request. The site loads
nothing from another origin, so a failed request is always a fault. 288 page views,
about four minutes.

## Tables added in October 2026

`scripts/add_raw_tables.py` copies more NCRB tables into `data/raw/cii<year>_v1.txt`
from the edition's PDF, by the footer NCRB prints on each table page, and refuses a
PDF whose SHA-256 is not the one in `sources.json`. It appends and never rewrites.
The tables it added, all 2020 to 2024, and what each needs:

- **3A.4 and 4A.10, who the offender was** (`RAPE_OFFENDER`, `POCSO_OFFENDER`). The two
  tables print their middle columns in opposite order (3A.4 has partners in col 5 and
  acquaintances in col 6, 4A.10 the reverse), checked against the printed header
  positions in every edition. 4A.10 is from the chapter on crimes against children and
  counts boys, so its total is above POCSO_RAPE. 3A.4's total equals RAPE, and
  `check.py` holds it there.
- **3A.11, rape by section** (`RAPE_SECTION`). IPC columns to 2023, BNS from 2024,
  mapped head by head in `build_data.py`; gang rape is IPC 376D+376DA+376DB. The
  top-level columns must add to all rape cases in every row, and the build fails if
  they do not. IPC 376AB is labelled differently in different editions and is left out.
  Page 3 of the 2024 table prints its footer as "TABLE 3A.11 Page 3" with no "of 4",
  which is why `table_pages()` accepts a footer without it.
- **3A.9 and 3A.10, persons arrested to acquitted** (`PERSONS` by state, `persons_*`
  measures on the FIR crime codes for India). 2020 has no transgender columns, so its
  totals sit in different columns. 3A.9's later pages drop the row numbers, so rows are
  matched by position and every row's sexes must add to its printed total.
  `check.py` holds the state table's India row equal to 3A.9's total. More people are
  charge-sheeted than arrested in most states, which the courts page explains with
  Siddharth v State of Uttar Pradesh (16 August 2021).
- **4A.9, girls' ages under POCSO s.4 and 6** (`POCSO_VICTIMS_AGE`). Boys, girls and
  (from 2021) transgender columns per age band; only girls are read. The girls' total
  equals POCSO_RAPE victims in chapter 3A in every state and year, and `check.py`
  holds it there. The rape age chart puts these beside table 3A.3, where few girls appear.
- **Volume 2, rape of Scheduled Caste and Scheduled Tribe women and girls**
  (`RAPE_SC`, `RAPE_ST`), tables 7A.2, 7A.3, 7A.5, 7C.2, 7C.3 and 7C.5, 2021 to 2024,
  in `data/raw/cii<year>_v2.txt` with `sources_v2.json` (`add_raw_tables.py --vol2`).
  The 2020 Volume 2 is not held: NCRB's 2020 page serves it as chapter files behind
  tabs and no mirror carries it. The heading is rape under the IPC or BNS read with the
  SC/ST (Prevention of Atrocities) Act, the only heading under which NCRB lists it, so a
  case where police did not apply the Act is not in these tables, and the page says so.
  Rows are found by label (`head_row`), because their numbers move between editions
  (1A.8 to 2023, 1A.1 in 2024). The build recomputes the printed charge-sheeting rate
  (col 18 / col 19) and conviction rate (col 15 / col 18) from their counts. The state
  table's rape total is col 87 to 2023 and col 10 in 2024; only that column is read,
  because 2024's 7A.2 misprints Chhattisgarh's IPC count (100 beside BNS 32 and a total
  of 119). Never compare these counts between states: the SC and ST populations differ.
- **3B.1, the 19 cities** (`CITY`, `kind` = city). Cities are kept out of
  `site.json` places (they would land on every state map) and sit in `cities`.
  NCRB's city rate divides by the 2011 census population and is stored as
  `rate_2011pop`, never compared with state rates.

## Link previews and search engines

Every page carries Open Graph and Twitter tags, `og:site_name`, `og:locale` with the
five translations as alternates, a canonical address and hreflang links. The home
page carries a `WebSite` JSON-LD block and the Data and method page a `Dataset`
block (licence, creators, publisher, coverage, the CSV and workbook), which is what
Google Dataset Search reads. Both are written by `structured()` in `build_pages.py`.

`assets/og.png` is the default preview, from `scripts/og/make_card.py`. Each crime
and state page has its own, `assets/og/<crimes|states>-<slug>.png`, from
`scripts/og/make_page_cards.py`: the page's figure for the latest year and its line
from 2017, both ends labelled with year and figure, all from `data/site.json`. The
image address carries `?v=<hash>`, because WhatsApp and others cache a preview by
address. `check.py` fails if a crime or state page has no card or if
`assets/og/cards.json` no longer matches what the data gives, so re-run the script
after any data change. WhatsApp share buttons under every chart pre-fill the
section's finding and link.

## Adding an NCRB edition

Rehearsed on 12 October 2026 with a fake 2025 made from the 2024 pages. In order:

1. Get Volume 1 and Volume 2, add each to `data/raw/sources.json` and
   `sources_v2.json` with its URL, SHA-256 and date, and copy the tables in with
   `add_raw_tables.py` (the list is every table already in the 2024 raw files).
2. Add the year to `YEARS` in `build_data.py`. The build stops at once with "No
   layout recorded": that is deliberate. Read the column headers of 3A.2, 3A.9, 3A.10,
   3A.11, 4A.9 and 7A.2 against 2024. If they match, add the year to `LAYOUT` as
   `'split'`. If NCRB drops the IPC column, that is a new layout: add a name for it and
   give every branch on `layout(y)` its columns. `HEADS` holds the 3A.2 columns.
3. Run every build and `check.py`. The continuity check fails if a crime's India count
   moves more than 2.5 times, or its spread across states more than 0.36, from the
   year before. That is what a column read from the wrong place looks like, and the
   sum and rate checks cannot see it. If a change is real, put it in `CONTINUITY_OK`
   with the reason.
4. Every sentence about the latest year takes it from the data: `{last}` in a page
   source or a string becomes the latest year at build, and scripts read
   `D.years`. A new sentence about the latest year uses one or the other, never a
   literal year. A literal year is right only for a fixed fact (1 July 2024, the 2024
   edition's notes).
5. `note_for`, `flags_for`, `SUMS_2024` and the 2024 caption on the rape-by-section
   table describe 2024. Decide whether each holds for the new year.
6. The context sources and their pages are separate and dated; update them only from
   their own new editions.
7. Re-run `scripts/og/make_card.py` and `scripts/og/make_page_cards.py`, the audit, and read the home, rape, courts and a
   state page at 390 wide.

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
