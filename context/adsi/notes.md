# NCRB ADSI 2020-2024: female suicides and suicides of house wives, state-wise

Retrieved 2026-10-09. Every figure in `data.csv` is copied from a printed NCRB table. Nothing is estimated or computed, except in the checks described below.

## Files

- `data.csv`: long format, 555 rows: 37 rows (36 states/UTs and All India) by 5 years by 3 indicators.
- `sources.json`: every document, with URL, retrieval date and sha256 of the downloaded copy.
- `checks.json`: every check run, 150 passed, 0 failed.

## Indicators

- `ADSI_SUI_F`: suicides of females, all professions. Table 2.7 (Concluded), "Total", Female column (col. 100). Printed p.248 in every year (pdf p.273 in 2021-2023, p.274 in 2024, p.9 of the separate 2020 table file).
- `ADSI_SUI_HW`: suicides of house wives. Table 2.7, "House wife", Female column (col. 4). Printed p.240 every year (pdf p.265 in 2021-2023, p.266 in 2024, p.1 of the 2020 file). The House wife Male column is printed as 0 or "-" in every row and year. In 2020 Tamil Nadu also reports 2 transgender persons as house wives; they are not in this figure.
- `ADSI_SUI_T`: all suicides (male + female + transgender), Table 2.7 (Concluded) col. 102. Included so that shares can be computed against the same table; it equals Table 2.2 col. 3.

Table 2.7 is titled "Profession-wise Distribution of Suicides (State & UT-wise)". It is the one state-wise table that gives both the female total and the house wife count, so both indicators come from one table in every year.

## What the figures mean

They are suicides registered by police, as reported by States and UTs to NCRB ("As per data provided by States/UTs" is printed under each table). The state is the state that reported the case. They are counts. NCRB does not print a female suicide rate by state in these tables, and no rate is computed here.

"House wife" is NCRB's profession category. It is the profession recorded for the person, so it says nothing about marital status beyond what the police record. A woman recorded under another profession, or as unemployed, is not counted as a house wife.

Transgender persons are counted separately by NCRB and are not in the female figures.

## Sources by year

- 2020: the three table PDFs NCRB publishes on its own site (Table 2.7, 2.9, 2.2), linked from https://www.ncrb.gov.in/accidental-deaths-suicides-in-india-table-content.html?year=2020. OpenCity has no 2020 ADSI package, and no full 2020 report PDF was found on the NCRB site.
- 2021: full ADSI 2021 report from OpenCity package `national-crime-data-2021`. NCRB's own copy of Table 2.7 for 2021 was also downloaded and parsed: every value in both pages used is identical.
- 2022: full report from OpenCity package `accidental-deaths-and-suicides-in-india-2022`. NCRB's own Table 2.7 for 2022 parsed identically.
- 2023 and 2024: full reports from OpenCity packages `accidental-deaths-and-suicides-in-india-2023` and `-2024`. NCRB's table-content pages for these years did not list separate table files, so the OpenCity copies could not be compared with an NCRB-hosted copy.

## Checks run (all passed)

For every year 2020 to 2024:

1. All 36 states/UTs and the three printed total rows (TOTAL (STATES), TOTAL (UTs), TOTAL (ALL INDIA)) parsed from Table 2.7 page 1, Table 2.7 (Concluded), Table 2.9 (Concluded) and Table 2.2.
2. Female, transgender, total and male totals in Table 2.7 (Concluded): the 28 states sum to the printed TOTAL (STATES), the 8 UTs to TOTAL (UTs), and the two together to TOTAL (ALL INDIA).
3. The same three sums for the House wife columns (female, transgender, total).
4. Male + female + transgender equals the printed total in every row of both tables.
5. Table 2.9 (Concluded), the marital status table, gives the same male, female, transgender and total in all 39 rows as Table 2.7. This is an independent printed table in the same report.
6. Table 2.2 (incidence and rate, state-wise) number of suicides equals the Table 2.7 total in all 39 rows.

All India results: female suicides 44,498 (2020), 45,026 (2021), 48,172 (2022), 46,648 (2023), 45,245 (2024). House wives 22,372 (2020), 23,178 (2021), 25,309 (2022), 24,048 (2023), 22,113 (2024).

## Things that look odd in the printed figures

These are as printed and were not altered. They should be read with care.

- Odisha, house wives: 554 (2020), 377 (2021), 2,691 (2022), 1,925 (2023), 1,123 (2024). Female suicides in Odisha were 1,637, 1,239, 3,990, 2,337 and 1,838. The 2022 female total is confirmed by Table 2.9 and Table 2.2; the house wife figure appears only in Table 2.7. No explanation is printed.
- Puducherry, house wives: 0 in 2020, 2021 and 2022, then 21 and 46, while female suicides were 104 to 133 every year. NCRB does not say why. A change in how the profession was recorded would explain it, and NCRB prints nothing to confirm that.
- Uttar Pradesh female suicides doubled from 1,642 (2020) to 3,454 (2024), and Bihar's rose from 358 to 606. The tables give no reason for the rise.
- Small UTs have single-digit counts (Ladakh 1 to 2, Lakshadweep 0 to 1 female suicides a year).

## Boundaries

- Dadra & Nagar Haveli and Daman & Diu is one row in every year 2020 to 2024 (the merged UT).
- Jammu & Kashmir and Ladakh are separate rows in every year 2020 to 2024.
- Delhi is printed as "DELHI (UT)".

## Not found

- A full ADSI 2020 report PDF. The figures come from the individual 2020 tables NCRB hosts, which carry the same page numbers as the report (Table 2.7 printed pp.240-248).
- Female suicides by state by cause in a form tied to house wives. Table 2.5 (cause-wise, state-wise) exists but was not used.
