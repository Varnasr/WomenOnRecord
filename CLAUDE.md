# She Counts

Crimes against women in India, as police and courts recorded them, 2020 to
2024, at shecounts.netlify.app. Static HTML, no framework, no build step for
the page. Data from NCRB Crime in India, Volume 1, read by script.

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

`i18n/<lang>.json` for hi, ur, ta, bn, mr. English comes from `index.html`
(the `data-i18n` text) and `i18n/en.json`. Change an English string, then
change all five translations in the same commit; `build_i18n.py --check`
fails on a missing key or a changed placeholder. No native speaker has read
the translations yet, and every translated page says so. Numbers stay in
Western digits with Indian grouping in every language.

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
python3 scripts/build_xlsx.py
python3 scripts/build_i18n.py
python3 scripts/check.py
PLAYWRIGHT_CORE=... CHROME=... python3 scripts/og/make_card.py   # preview image
bash scripts/deploy.sh                                            # until Netlify is linked to the repo
```
