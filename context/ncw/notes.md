# National Commission for Women complaints: notes

Retrieved 2026-10-09 from the NCW portal page "Statistical Overview of Received Complaints" at https://ncwapps.nic.in/frmComp_Stat_Overview.aspx. Scripts: `../../work/ncw_fetch.py` (drives the form and saves each response), `../../work/parse_ncw.py` and `../../work/build_ncw.py` (CSV and checks). Check output: `../../work/ncw_checks.log`. The 195 saved responses are in `../../dl/ncw/html/`, each hashed in sources.json.

## What is counted

Complaints received by the National Commission for Women, by calendar year (the portal's "Year" option; it also offers financial years, which were not used). The portal's headings are "Statistical Overview of Received Complaints" and "State-Wise Report of the Complaints Received by NCW in the Year : 2024". So these are complaints received, not complaints found true, registered as cases, or acted on. The state is the state recorded on the complaint; the portal does not say whether that is where the complainant lives or where the incident happened.

data.csv holds, for 2020 to 2024:

- `ncw_complaints_total`: all complaints for each State/UT and All India.
- `ncw_nature_<category>`: complaints by nature (category) for each State/UT and All India, with the category label exactly as NCW prints it.

Categories relevant to the site, as NCW labels them: "Rape/Attempt to Rape", "Domestic Violence", "Dowry harassment", "Dowry death", "Police Apathy against women", "Outraging modesty of women/Molestation", "Sexual Harassment", "Cyber Crime against women". The largest category in 2020 to 2023 is "Right to live with dignity", which NCW does not define on the page.

The figures are the live portal counts on 2026-10-09. NCW can revise them, so a later download may differ.

All India totals: 2020 23,722; 2021 30,865; 2022 30,957; 2023 28,811; 2024 25,743.

## Checks run, and results

For every year:

- The State/UT totals sum to the printed All India total. All five years equal exactly.
- Each row's twelve monthly figures sum to its annual total, in the state table and in every nature table. All pass.
- For each State/UT, the nature rows sum to that table's printed total, and that total equals the State's figure in the state-wise table. All pass.
- For each nature, the sum over States/UTs equals the All India nature table. All match (23 natures in 2020 to 2022, 24 in 2023, 34 in 2024).
- Every saved response's heading names the year and State that were requested, so no response was saved under the wrong label.

## Things to know before using these figures

- **The categories changed in 2024.** In 2025 the portal uses a new list (Assault, Criminal Intimidation, Abduction, Murder and others, with "Stalking" and "Voyeurism" separate). 2024 carries both lists: some complaints are under the old labels ("Stalking / Voyeurism", "Trafficking / Prostitution of women", "Right to live with dignity") and some under the new ones ("Stalking", "Trafficking of women", "Assault", "Criminal Intimidation"). Category counts for 2024 are therefore not comparable with 2020 to 2023, and a fall in an old category in 2024 may only be a move to a new one. "Police Apathy against women" (920 in 2024 against 1,624 in 2023) should be read with this in mind. "Harassment of Transgender" first appears in 2023.
- **States not listed.** The state-wise table omits a State/UT in some years, and the nature-wise query for it returns no table: Ladakh in 2020, 2022 and 2024; Lakshadweep in 2022, 2023 and 2024; Nagaland in 2024. The portal prints no figure for them, so data.csv has no row for them in those years. That most likely means no complaints were recorded, but the portal does not print a zero and none is entered here.
- **Name mapping.** Portal spellings were mapped to the project list: "Andaman and Nicobar Islands" to "A&N Islands", "Dadra & Nagar Haveli and Daman & Diu" to "D&N Haveli and Daman & Diu", "Jammu and Kashmir" to "Jammu & Kashmir", "Pondicherry" to "Puducherry", "Total" to "All India". One label had the link text "Cleck Here to see sub-categories" attached in the HTML; it was removed.

## Limits

NCW complaints are self-selected. They count women who knew of NCW, chose to complain to it and could reach it, online or otherwise. They say nothing about how much crime happens in a State, and they do not overlap cleanly with NCRB's registered cases. Uttar Pradesh alone is half or more of all complaints in every year (50.0% in 2020, 55.9% in 2023, 13,868 of 25,743 or 53.9% in 2024), which reflects access to and awareness of NCW as well as crime. Small counts in small States and UTs move a lot from year to year. Per-capita rates are not provided here; if built, they should be labelled as complaints to NCW per population, not as crime rates.

## Gaps

- Category breakdowns are as NCW defines them; NCW publishes no definitions of the categories on this page.
- NCW Annual Reports (2023-24 and 2024-25) could not be downloaded: cdn.ncw.gov.in returned 403 to this sandbox. They use financial years and were not needed for the calendar-year series.
- No parliamentary answers were used; the portal is the primary source and covers every year asked for.
