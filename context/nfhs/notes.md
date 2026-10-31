# NFHS-5 (2019-21): violence against women, state-wise

Retrieved 2026-10-09. Every figure in `data.csv` is copied from a published table or from the DHS Program API. Nothing is estimated, interpolated or computed from other figures.

## Files

- `data.csv`: long format, one row per state, round and indicator. 372 rows.
- `sources.json`: every document used, with URL, retrieval date and sha256 of the downloaded copy.
- `crosscheck_spousal_sources.csv`: for every state and each spousal violence indicator, the India report value, the DHS API value, the fact sheet value (physical or sexual only) and the difference between report and API.
- `checks.json`: the summary of that comparison.

## Who was asked

NFHS-5 asked the domestic violence module of one randomly selected woman age 18-49 per household, only in the subsample of households selected for the state module, and only where privacy could be obtained. 72,056 women completed it (FR375 p.640). NFHS-4 asked women age 15-49, so the report itself says comparisons over time cannot be made for exactly the same age group.

Fieldwork ran in two phases: Phase I from 17 June 2019 to 30 January 2020 (17 states, 5 UTs) and Phase II from 2 January 2020 to 30 April 2021 (11 states, 3 UTs) (FR375, foreword). Some state documents are therefore dated 2019-20 (for example Karnataka) and others 2019-21. All are labelled `NFHS-5 (2019-21)` in `data.csv`.

## Indicators

### Spousal violence: `NFHS5_SPV_*`

Source: India report FR375, Table 15.13 "Spousal violence by state/union territory", printed p.668 (pdf p.704). Covers all 36 states and UTs and India.

- Denominator: ever-married women age 18-49 who completed the module.
- "Husband" is the current husband for currently married women and the most recent husband for widowed, divorced, separated or deserted women. Earlier husbands are not counted.
- `NFHS5_SPV_ANY`: emotional, physical or sexual. `NFHS5_SPV_POS`: physical or sexual. Physical, sexual and emotional are also given separately.
- India: any 31.9, physical or sexual 29.2.

`NFHS5_FS_SPV_POS` is the same concept as printed in each state/UT fact sheet (indicator 125, "spousal violence is defined as physical and/or sexual violence"). 36 of 36 states/UTs found. The India national fact sheet was not found at any URL tried (dhsprogram.com OF43, rchiips.org, mohfw.gov.in), so the commonly quoted India fact sheet figure is not in this file and has not been verified here.

### Sexual violence by anyone : `NFHS5_SV_EVER`

Source: DHS Program API, indicator `DV_EXSV_W_EVR`, survey IA2020DHS. Denominator: all women 18-49 who completed the module, married or not, any perpetrator, at any age.

The India report has no state-wise table of this indicator. Table 15.4 gives India only: 6.0, which matches the API exactly. The state reports give it only as two components in Table 104 (sexual violence only, plus physical and sexual violence). The API is therefore the only direct state-wise source used.

The API labels the age group "Total 15-49". That label is generic: NFHS-5 interviewed only women 18-49 for this module (FR375 p.639-640), and the API's India denominator (72,320 weighted) is the module sample.

### Help seeking : `NFHS5_HS_*`

Source: DHS Program API indicators `DV_STPV_W_NTL` (never sought help, never told anyone), `DV_STPV_W_TLD` (never sought help, told someone) and `DV_STPV_W_HLP` (sought help from any source). Denominator: women 18-49 who ever experienced physical or sexual violence by anyone. The three add to 100 within 0.1 in every state (a small "missing or don't know" category accounts for the rest).

- India (API): 76.5 never told anyone, 9.5 told someone, 14.0 sought help.
- Chandigarh and Lakshadweep: no value. Their unweighted denominators are 7 and 3 women, below the 25-case threshold. Left blank in `data.csv`.
- Ladakh (38 unweighted cases), D&N Haveli and Daman & Diu (43), Goa (47) and Sikkim (41): values exist but rest on 25-49 unweighted cases. DHS prints such values in parentheses. Flagged in the note column.
- The weighted counts the API returns for states (`DV_STPV_W_NUM`) use national weights and are not state population sizes. They are not used.

`NFHS5_HS_NEVER_TOLD_REPORT` is the India figure as printed in FR375 Table 15.17, 77.2. That table is defective as published: the Total row sums to 100.9 (77.2 + 9.6 + 14.1), and other rows are impossible (Never married 85.5 + 13.7 + 15.6 = 114.8; Jain 106.2). The API figure 76.5 sums correctly. The key findings box on FR375 p.639 says only that 14 percent sought help. Prefer the API figure and do not quote 77.2 without this caveat.

### NFHS-4 India help seeking: `NFHS4_HS_NEVER_TOLD`

Verified. IIPS and ICF 2017 (FR339), section 16.9, printed page 572 (pdf p.604), reads: "Of all women in India who have ever experienced any type of physical or sexual violence, only 14 percent have sought help to stop the violence and 77 percent have never sought help nor told anyone about the violence they experienced (Table 16.17 and Figure 16.7)." The table itself (Table 16.17, Total row, printed p.596) gives 76.6, and the DHS API (IA2015DHS) also gives 76.6. So "77 per cent, p.572" is correct as the rounded text figure. NFHS-4 asked women 15-49.

## Boundaries

- Jammu & Kashmir and Ladakh are reported separately in every NFHS-5 source used (Table 15.13, fact sheets, API). The API also carries a combined "Jammu, Kashmir & Ladakh" row; it is not used.
- Dadra & Nagar Haveli and Daman & Diu is reported as one merged UT in every source. No separate figures exist.
- Telangana and Andhra Pradesh, Jharkhand and Bihar, Chhattisgarh and Madhya Pradesh, Uttarakhand and Uttar Pradesh are separate. The API also has combined "including" rows for the pre-2000 and pre-2014 boundaries, used for NFHS-4 comparisons; they are not used.
- Delhi is "Delhi" in the report, "NCT Delhi" in its fact sheet and "New Delhi" in the API. All three are the NCT.

## Checks run

1. Table 15.13 parsed for all 37 rows and all 5 columns. The parse asserts every one of the 36 states/UTs plus India is present.
2. Report Table 15.13 against the DHS API (`crosscheck_spousal_sources.csv`): emotional and physical agree within 0.1 in all 37 rows; physical or sexual within 0.1 in 32 of 37 (largest gap 0.2); any form within 0.1 in 33 of 37 (largest 0.3, Sikkim and Assam). Spousal sexual violence differs most: within 0.1 in only 27 of 37, report higher in every larger gap (Karnataka 10.8 against 10.3, Uttar Pradesh 6.6 against 6.2, Sikkim 3.1 against 2.7, J&K 3.9 against 3.5). The cause is not stated in either source. The report is used as primary for the spousal indicators because it is the published table for all 36 states.
3. Report Table 15.13 against the 36 state fact sheets (physical or sexual): 24 agree within 0.1; the largest gaps are Meghalaya (fact sheet 16.0, report 15.0), Mizoram (+0.6), Puducherry (+0.5), Ladakh (+0.4). Neither source explains the gap. Both values are in `data.csv` under different codes.
4. Four state reports (Karnataka, Bihar, Tamil Nadu, Assam) against the API and the India report:
   - Spousal, Table 106 "Ever" column. Karnataka: any 48.3, physical or sexual 44.4, sexual 10.2 (report 48.4, 44.4, 10.8; API 48.3, 44.3, 10.3). Bihar: 42.4, 40.0, 7.9 (report 42.5, 40.1, 8.1; API 42.4, 40.0, 7.8). Tamil Nadu: 39.6, 38.0, 2.2 (report 39.7, 38.1, 2.4; API 39.7, 38.1, 2.3). Assam: 34.0, 32.0, 7.0 (report 34.3, 32.2, 7.3; API 34.0, 32.0, 7.0). The state reports agree with the API more closely than with the India report.
   - Help seeking, Table 110 Total column (never told anyone / told someone / sought help). Karnataka 68.6 / 13.8 / 17.6 (API 68.6 / 13.9 / 17.5). Bihar 81.8 / 7.4 / 10.8 (API 81.8 / 7.4 / 10.9). Tamil Nadu 81.1 / 7.0 / 11.9 (API identical). Assam 81.2 / 9.3 / 9.5 (API 81.2 / 9.3 / 9.4). Differences of 0.1 are rounding.
   - Sexual violence by anyone, Table 104 components. Bihar 1.0 + 6.7 (API 7.7). Tamil Nadu 0.4 + 2.2 (API 2.7). Assam 0.9 + 6.0 (API 7.0). Karnataka 0.8 + 9.0 (API 10.1); the Karnataka report text says "10 percent". Summing rounded components loses up to 0.1, so these agree except Karnataka, where the gap is 0.3 and is unexplained.
5. Help-seeking components sum to 100 within 0.1 in all 35 published states/UTs.

## Problems found in the published sources

- FR375 Table 15.17 (help seeking) does not add up, as described above.
- FR375 Table 15.7 (experience of different types of violence by state) does not reconcile with Table 15.4 or with the state reports. Its India row gives sexual violence only 1.0 plus physical and sexual 5.5, which is 6.5 against 6.0 in Table 15.4. Its Karnataka physical or sexual figure is 48.5 against 43.3 in the Karnataka state report Table 104. It was not used.
- The DHS API labels NFHS-5 domestic violence indicators "Total 15-49" although the module covered women 18-49.

## Not found

- An India national NFHS-5 fact sheet (could not be downloaded; rchiips.org paths return 404 and the mohfw.gov.in copy was unreachable).
- A state-wise table of "ever experienced sexual violence" in a published PDF. Only the API gives it directly.
- State-wise help-seeking in the India report. It exists only in each state report (Table 110) and in the API; four state reports were checked, not all 36.

## Limits

These are survey estimates with sampling error. Small UTs rest on few interviews: Lakshadweep 88 and Chandigarh 74 ever-married women in the spousal denominators, and Ladakh 167. Under-reporting of violence in a face-to-face survey is expected and its size is unknown. Spousal figures cover only the current or most recent husband.

## NFHS-6 (2023-24): spousal violence, added 2026-10-31

`NFHS6_FS_SPV_POS`, `NFHS6_FS_SPV_POS_URBAN` and `NFHS6_FS_SPV_POS_RURAL` are indicator 95 of the NFHS-6 State/UT fact sheets, "Ever-married women age 18-49 years who have ever experienced spousal violence", which the sheets define in a footnote as physical and/or sexual violence. `NFHS6_FS_SPV_POS_PREV` is the NFHS-5 total printed beside it in the same sheet, labelled with the NFHS-5 round. 34 states and union territories and India have a figure (138 rows). Chandigarh has no rural figure.

Source: IIPS, National Family Health Survey (NFHS-6), 2023-24: India and State/UT Fact Sheets, May 2026, https://www.nfhsiips.in/nfhsuser/assets/National%20Family%20Health%20Survey%20(NFHS-6)%202023-2024%20Fact%20Sheets.pdf. The fact sheets are provisional.

**How the figures got here, and what was not done.** The compendium could not be downloaded in this session, because www.nfhsiips.in presents a certificate chain that this environment does not trust, and verification was not switched off. The figures come from `data/nfhs6/states.json` in Varnasr/how-india-lives (commit 2f7bff5), which reads the compendium by script. Thirteen of the 36 sheets have no text layer and were read by OCR there, so a digit could be wrong. They were checked here against the figures independently reported by The South First on 30 May 2026. 58 figures were compared: 32 for spousal violence (India, Kerala, Telangana, Bihar, Tamil Nadu, Uttar Pradesh, Andhra Pradesh, Karnataka, Assam, Odisha, Goa, and Dadra and Nagar Haveli and Daman and Diu, in the NFHS-6 column, the NFHS-5 column and urban and rural where the article gives them) and 26 for the two indicators not used here. All 56 that the extraction holds agree. The other two are Uttarakhand's indicator 97, which the extraction lacks. The compendium's own page was not read for the other states, so the figure for any state not named above rests on the extraction alone, 23 of 34 states and union territories in all. The SHA-256 of the compendium is not recorded here for the same reason.

**Left out.** Manipur has no NFHS-6 sheet. Lakshadweep has no figure in the extraction, although The South First reports 1.3% to 10.2%, so it is not shown. Indicators 96 (physical violence during pregnancy) and 97 (sexual violence by age 18) are in the same sheets and are not used.

**The NFHS-5 column is not the NFHS-5 sheet.** Across the 34 states and union territories, the NFHS-5 figure printed in the NFHS-6 sheet differs from the NFHS-5 state sheet (`NFHS5_FS_SPV_POS`) by 0.1 points at the median, by more than 0.3 in four (Meghalaya 15.0 and 16.0, Mizoram 10.3 and 10.9, Puducherry 30.0 and 30.5, Ladakh 17.7 and 18.1), and by 1.0 at the most. The page uses the NFHS-6 sheet's own NFHS-5 column so that both figures come from one tabulation. Why they differ is not stated in what was read.

**Read the changes with care.** 29 of the 34 fell and 5 rose. Karnataka fell from 44.4 to 14.1 and Assam from 32.2 to 16.2, and Kerala rose from 9.8 to 17.7. The sheets print the figures only, and the full report has not been published. A change this large in four years is shown as the survey's provisional estimate, and no cause is offered.
