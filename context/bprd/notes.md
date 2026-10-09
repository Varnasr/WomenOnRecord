# BPR&D Data on Police Organisations: notes

Retrieved 2026-10-09. Scripts: `../../work/parse_dopo.py` (table extraction) and `../../work/build_bprd.py` (CSV and checks). Check output: `../../work/bprd_checks.log`.

## What is in data.csv

Two editions of Data on Police Organizations (DoPO), published by the Bureau of Police Research and Development, Ministry of Home Affairs:

- as on 1 January 2023 (`year_or_as_of` = 2023-01-01), 36 States/UTs plus All India
- as on 1 January 2020 (`year_or_as_of` = 2020-01-01), for comparison

Indicators, all as printed by BPR&D:

| indicator_code | DoPO table | meaning |
|---|---|---|
| police_sanctioned_total | 2.1.2 | Total State police strength, sanctioned: Civil + District Armed Reserve + State Armed Police + India Reserve Battalions |
| police_actual_total | 2.1.2 | The same, actual (persons in post) |
| women_police_actual | 3.2.1 | Women police in post, Civil + DAR + Armed + IRB |
| women_police_pct_actual | 3.2.1 | Women police as a percentage of actual total strength, as printed |
| police_per_lakh_sanctioned / _actual | 2.1.3 | Total police per 100,000 population |
| population_thousand | 2.1.2 | The projected population DoPO used for its ratios (RGI projection from Census 2011, as on 1 October of the preceding year) |
| ps_special_crime_against_women_children | 5.1.4 | Special purpose police stations in the column "Crime against women & children" |
| women_police_stations_total / _rural / _urban | 6.2.4 | Women police stations, 2023 edition only |

Central forces (CAPFs, CPOs) are not included. Every figure is State/UT police.

## The latest edition was not retrieved

The latest edition is DoPO as on 1 January 2024, launched on 1 July 2025 and posted as `https://bprd.nic.in/uploads/pdf/Data%20on%20Police%20Organizations%20(2024)_%20(14-07-25)%20All.pdf`. It could not be read from this sandbox. bprd.nic.in reset every connection, web.archive.org (which holds four captures of the file) also reset direct connections, and the one route that reached the archive (Firecrawl) refuses files over 50 MiB; this one is about 60 MB. No figure from the 2024 edition is in data.csv. No DoPO as on 1 January 2025 was found published as of 2026-10-09.

To fill the gap, download the file from bprd.nic.in or the Wayback capture listed in sources.json on an ordinary connection, check its SHA-1 against the Wayback digest `SZBJFBIFOKGTYXKBTNFOW3WQO7MJUY2Z`, and rerun the same tables (2.1.2, 2.1.3, 3.2.1, 5.1.4, 6.2.4). The 2023 table numbering may have shifted.

## How the files were read

The two PDFs could not be downloaded as bytes, for the reasons above. Both were read as text through Firecrawl's PDF extraction of the Wayback Machine captures of the BPR&D files (URLs in sources.json). So there is no sha256 of the PDFs. sources.json gives the Wayback SHA-1 for the 2023 capture and the sha256 of the text extraction that was parsed. The publisher's own URL is the one recorded in `source_url`. Page numbers in `table_or_page` are the printed page numbers from each edition's list of tables, not PDF page indices.

Extraction from a PDF can misread a cell. The checks below are the reason to trust these figures: each total is printed twice or three times in different tables, and every one agrees.

## Checks run, and results

For both editions:

- Sum of the State/UT rows equals the printed All India row for sanctioned strength, actual strength, women police, population and special purpose police stations for crimes against women and children. All equal exactly (2023: 27,22,669 sanctioned, 21,41,305 actual, 2,63,762 women; 2020: 26,23,225, 20,91,488, 2,15,504).
- Actual and sanctioned totals in Table 2.1.2 equal those in Table 3.1.1, and the actual total equals the one in Table 3.2.1, for every State/UT. All agree.
- Women police in Table 3.2.1 equal the women column of Table 3.1.1 for every State/UT. All agree.
- Women as a percentage, recomputed as women / actual total, matches the printed percentage to the second decimal for every State/UT.
- Police per lakh, recomputed from strength and the printed population, matches the printed ratio within 0.6 for every State/UT, sanctioned and actual.
- 2023 women police stations: the State/UT totals sum to the printed Total of 769 (rural 121, urban 648), with Maharashtra printed as NA.

## Things to know before using these figures

- **Women police stations (2023, Table 6.2.4).** The table lists every station by name, and the text extraction shifted columns for seven States/UTs. For those the total is the printed rural count plus the printed urban count, and the `note` column says so: Rajasthan (the total cell read as "4)1"; rural 0 and urban 41 are printed), Sikkim (1 + 1), Tamil Nadu (47 + 175), Chandigarh (0 + 1), Jammu & Kashmir (8 + 2, total 10 legible), Ladakh (0 + 1), Puducherry (1 + 2, with the stations named). With these the column sums to the printed national total of 769. Tamil Nadu (222) and Puducherry (3) also equal their Table 5.1.4 counts. Maharashtra is printed NA and is recorded as NA, not zero.
- **Two counts of women's police stations.** Table 5.1.4 counts special purpose stations for "crime against women & children" (681 in 2023). Table 6.2.4 counts women police stations (769 in 2023). They differ for many States and are kept as separate indicators. Neither is defined in the edition beyond its column heading.
- **D&N Haveli and Daman & Diu, 2020.** The 2020 edition prints the two UTs as separate rows although they merged on 26 January 2020. data.csv gives one row per indicator, the sum of the two printed counts, with both components in the note. Its percentages and per-lakh ratios are left out because the edition prints none for the merged UT. For special purpose stations Daman & Diu is printed "@", with the footnote "Data of Daman & Diu is included in D & N Haveli".
- **Name mapping.** DoPO spellings were mapped to the project list: "A & N Islands" to "A&N Islands", "Dadra and Nagar Haveli and Daman and Diu" to "D&N Haveli and Daman & Diu", "Jammu and Kashmir" to "Jammu & Kashmir", "TOTAL"/"Total" to "All India". Footnote markers (~ ! @ # ^ *) after names were dropped; the 2020 extraction also read "Delhi" as "Delh" in one table. The footnotes themselves (State reservation rules for women, for example) are not carried into the CSV.
- **Dashes.** DoPO prints "-" for zero. These are recorded as 0, following the edition's own legend "(-) denotes Zero".
- **Population.** Per-lakh ratios use RGI projections built on Census 2011, as on 1 October of the year before the edition. They will not match ratios built on other population figures.

## Limits

DoPO is a staffing and infrastructure count reported by each State/UT police force to BPR&D. Its own disclaimer: "The information published in this report has only been collected and compiled at BPR&D as per the information obtained from the Police forces of the States/UTs/CAPFs/CPOs." It says nothing about how police respond to crimes against women. A State with more women police or more women police stations does not, on this evidence, register or investigate those crimes better. Sanctioned strength is a budgeted post count and actual strength is a headcount on one date.

## Gaps

- DoPO as on 1 January 2024 (latest): not retrieved, see above.
- DoPO as on 1 January 2021 and 2022: not used. The 2022 edition is in the Wayback index (about 4 MB) if a third year is wanted.
- Women police stations for 2020: the 2020 edition has no equivalent of Table 6.2.4 in the pages read, so only the Table 5.1.4 count is given for that year.
