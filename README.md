# She Counts

Crimes against women in India, as police and courts recorded them, 2020 to 2024.
Every state and union territory, from the National Crime Records Bureau's
*Crime in India* reports, with a free dataset in CSV and Excel.

Live at https://shecounts.netlify.app

## What it shows

- Cases recorded each year for thirteen groups of crime: rape, POCSO sexual
  offences against girls, attempt to rape, assault and harassment, insult to
  modesty, murder with rape, dowry deaths, abetment of suicide, women murdered,
  cruelty by husband or relatives, the Dowry Prohibition Act, the Domestic
  Violence Act, kidnapping, acid attacks, trafficking and cyber crimes.
- Rates per lakh women, using the female population NCRB itself uses.
- What police and courts did: charge-sheeting, convictions, and the cases still
  waiting. These are shown by state for all crimes against women together.
  For single crimes such as rape they are shown for India as a whole, because
  NCRB publishes them only at that level.

## Pages

Home, Protests, Police and courts, States (with a page for each of the 36
states and union territories), Crimes (with a page for each of 17 crimes),
Context and Data and method.

## Context

Eight other sources sit beside the NCRB figures, each on the Context page with
its limits: the National Family Health Survey (NFHS-5), complaints to the
National Commission for Women, NCRB's Accidental Deaths and Suicides in India,
BPR&D's Data on Police Organisations, fast track special courts, the National
Judicial Data Grid, the Nirbhaya Fund, and ADR's count of legislators with
declared cases. Each measures something different, and none can be added to
NCRB's figures.

## What it cannot show

These are cases that reached a police station and were written down. They are
not a measure of how often the crimes happen. A higher rate in one state can
mean more crime or more recording, and NCRB itself warns against comparing
states on these figures alone. The site says this where the numbers are.

## The data

| File | What it is |
|---|---|
| `data/shecounts.csv` | One row per state, year, crime and measure, with the IPC and BNS sections, the NCRB table, the source PDF's address and SHA-256, and coded flags. |
| `downloads/shecounts.xlsx` | The same rows, plus About, Codebook and Sources sheets and one wide sheet per crime. |
| `downloads/codebook.csv` | Every column, crime code and flag explained. |
| `downloads/context.xlsx`, `data/context.csv` | The eight context sources, every row with its source, table and page. |
| `context/` | Each context source as collected, with its notes and checks. |
| `data/raw/` | The NCRB pages the figures were read from, as extracted text, and `sources.json` with each PDF's address and checksum. |

The figures are NCRB's. The compilation, codes and notes are released under
CC BY 4.0, and the code is released under the MIT licence. The state map is DataMeet's (CC BY 4.0), following India's
official boundary.

## Rebuilding

```bash
python3 scripts/build_data.py        # data/raw -> data/shecounts.csv, with total checks
python3 scripts/build_site_data.py   # -> data/site.json, which the page reads
python3 scripts/build_context.py     # context/*/data.csv -> data/context.json and .csv
python3 scripts/build_xlsx.py        # -> downloads/
python3 scripts/build_pages.py       # site/ -> every page
python3 scripts/build_i18n.py        # i18n/*.json -> js/i18n.js
python3 -m http.server 8000
```

No one is named on this site. It holds counts only.
