# NJDG: pending district court cases filed by women

Retrieved 2026-10-09 from https://njdg.ecourts.gov.in/njdg_v3/ (the district and taluka courts grid). The site was reachable from here. The dashboard pages and the state-wise table needed no captcha. Captchas appear only on case-level search, which was not used.

## What was taken

- For each of the 36 states and UTs, plus All India, the "Pending Dashboard" header figures: Civil Cases, Criminal Cases and Total Cases.
- For the same units, "Cases Filed By Woman" in civil, criminal and total.
- State figures come from the dashboard filtered by state (`?p=home/index&state_code=<code>`), fetched one after another from 13:08:59 to 13:10:10 UTC (18:38 to 18:40 IST) on 9 October 2026. The All India page was fetched at 13:07 and again at 13:10:16 UTC, and both copies are byte-identical. Every page reads "Last Updated : 09-10-2026". The `note` column gives each state's fetch time.
- NJDG's state names are mapped to the project spellings in three cases: "Andaman and Nicobar" becomes A&N Islands, "Jammu and Kashmir" becomes Jammu & Kashmir, and "The Dadra And Nagar Haveli And Daman And Diu" becomes D&N Haveli and Daman & Diu.

## Definitions and limits

- **Cases filed by women are not crimes against women.** The NJDG figure counts pending cases in which the filing party (petitioner or complainant) is recorded as a woman, in civil and criminal matters alike. These include property, family, maintenance, money and motor accident claims, and criminal complaints of every kind. Most crimes against women are prosecuted by the State on a police report, so the woman is not the filing party and those cases are not counted here. Do not read this figure as the pendency of crimes against women.
- NJDG prints no written definition of "Filed Cases By Woman". How the litigant's sex is recorded is not stated on the dashboard. Cases where it was not entered cannot be in the count.
- On the pending dashboard the figure appears as a card reading "Cases Filed By Woman, 8% of Total Pending Cases". That reading treats it as a pending count. The same numbers appear in the "Other Alerts" table as "Filed Cases By Woman". The All India figure is 39,56,823 of 5,16,05,557 pending, or 7.67%, which NJDG rounds to 8%.
- This is a live snapshot. It changes daily and cannot be reproduced later from the site. The raw pages are saved under `downloads/njdg/` with their hashes in `sources.json`.
- The figures cover district and taluka courts only, not the High Courts or the Supreme Court. They also cover only courts whose data reaches NJDG. The dashboard lists separate counts for courts whose data was not transferred.
- "Total Cases" here excludes the separately shown "Pre-Litigation / Pre-Trial" count (13,22,611 All India).
- One internal inconsistency on NJDG's own page: the age-wise pending table sums to 5,16,08,834, which is 3,277 more than the 5,16,05,557 Total Cases figure. The headline figure is recorded, and the age table was not used.

## Checks run (all passed)

1. The 36 state totals sum exactly to the All India figures for pending civil (1,12,24,133), criminal (4,03,81,424) and total (5,16,05,557).
2. The 36 state women-filed figures sum exactly to the All India women-filed civil (18,69,079), criminal (20,87,744) and total (39,56,823).
3. Civil + criminal = total in every state, for all pending cases and for women-filed cases.
4. On every state page, the "Cases Filed By Woman" card and the "Filed Cases By Woman" alert row agree.
5. NJDG's separate state-wise women table (`home/fetchStateData`, flag `women`, the table that opens when the All India figure is clicked) gives the same civil, criminal and total for every state as the state pages. Its footer totals are 39,56,823, 18,69,079 and 20,87,744.
6. Every state page shows its own state selected, and every page reads "Last Updated : 09-10-2026".
7. Women-filed never exceeds total pending in any state.

## Gaps

- I did not look for a parliamentary answer or a Supreme Court annual report quoting the women-filed figure, because NJDG itself was reachable. Such a source would give an earlier dated figure for comparison. One is not needed for this snapshot.
- NJDG offers no year-by-year history of this figure on the dashboard, so no trend for 2020 to 2024 can be taken from it.
- High Court pendency of women-filed cases (on the separate High Court NJDG) was not collected.
