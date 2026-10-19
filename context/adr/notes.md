# ADR: sitting legislators with declared cases related to crimes against women

Retrieved 2026-10-09. No legislator is named anywhere in these files. The reports name them; we kept counts only.

## Sources

1. **Analysis of sitting MPs/MLAs with Declared Cases Related to Crimes against Women 2024.** ADR and National Election Watch, press release dated 21 August 2024, 300 pages. This is the report behind the "151 MPs/MLAs, 16 with rape cases" figure. Rows `adr2024_*`.
2. **Analysis of Sitting MLAs from 28 State Assemblies and 3 Union Territories of India 2025.** ADR and NEW, dated 17 March 2025, 373 pages. It is a general report on sitting MLAs. One table gives, by state, the MLAs with declared cases related to crimes against women and related to rape. Rows `adr2025_*`. MLAs only.

I found no newer dedicated ADR report on crimes against women for 2025 or 2026. Searches turned up ADR state reports (for example the West Bengal 2026 winners, where the press reported 63 winners with such cases) and a June 2026 Rajya Sabha report. None of these is an all-India state-wise table on the same basis, so none was used.

## Basis and definitions

- **2024 report.** ADR analysed 755 of 776 sitting MPs' affidavits and 3,938 of 4,033 sitting MLAs' affidavits, covering 28 states and 8 UTs. Each affidavit is the Form 26 a member filed when contesting an election held from 2019 to 2024, bye-elections included. So each state's MLA count reflects its last assembly election in that window. For Delhi that was 2020, and for Maharashtra and Jharkhand it was 2019. Each MP is counted under the state of their constituency.
- **2025 report.** ADR analysed 4,092 of 4,123 sitting MLAs in 28 state assemblies and 3 UTs (Delhi, Jammu & Kashmir, Puducherry), using the affidavit each MLA filed before their last election. The assembly election year for each state is recorded in the `note` column. For Delhi that is 2025 and for Maharashtra 2024, which is why those counts differ sharply from the 2024 report (Delhi 13 to 2, Maharashtra 12 to 10).
- **"Crimes against women".** The 2024 report lists the IPC sections it covers. These are 326A and 326B (acid attack); 375, 376, 376A to 376E and 376(2)(n) (rape); 354, 354A, 354B, 354C and 354D; 366B, 372, 373, 498A, 498, 493, 304B, 494 and 509. The narrative also names 366 among the charges found. The 2025 report states no section list for this category. It is presumably the same, but the report does not say so.
- **"Rape".** Both reports define this as declared cases under IPC Section 376 and Section 376(2)(n).
- **Unit.** Each value counts legislators. A legislator with several cases counts once.

## Limits

- These are cases the legislators declared themselves in their affidavits. Every one of them is pending, and none is a conviction. ADR says the current status of the cases "is not known and may vary from case to case basis".
- The counts are of legislators facing charges. They are not counts of crimes, and they cannot be compared with NCRB figures.
- Both tables list only the states that have at least one such legislator (the 2025 table also lists a few states with zero in this column because they have murder cases). A state that is absent from a table has no row in `data.csv`. No zero was written for it. In the 2024 report, a state in the crimes-against-women table that does not appear in the rape table has no rape row either. Where the report prints a zero in a listed row, for example the MP column, that zero is recorded.
- States and UTs absent from the 2024 crimes-against-women table: Arunachal Pradesh, Chhattisgarh, Haryana, Meghalaya, Mizoram, Nagaland, Sikkim, Tripura, Uttarakhand, A&N Islands, Chandigarh, Jammu & Kashmir, Ladakh, Lakshadweep and Puducherry. States and UTs absent from the 2025 table: Arunachal Pradesh, Chhattisgarh, Mizoram, Nagaland, Sikkim, Uttarakhand.
- Party figures are from the 2024 report only, as national totals by party (`state` = All India, with the party in `note` and the label). Parties are as ADR recorded them at the time of the affidavit. The 2025 report has no party table for this category. I did not derive one from its name list.
- The 2025 report has no MP figures. No state-wise MP figures on crimes against women newer than August 2024 were found.

## Checks run (all passed)

1. 2024 state table: the MLA, MP and total columns each sum to the Total row (135, 16, 151).
2. 2024 rape state table: the columns sum to 14, 2 and 16.
3. 2024 party tables: the columns sum to the same totals, for both crimes against women and rape.
4. Every row satisfies MLAs + MPs = total, for both state and party tables.
5. Independent recount of the 2024 report's name-level detail lists, counting states only and recording no names. The detail list of 16 MPs gives Bihar 1, D&N Haveli and Daman & Diu 1, Jharkhand 1, Kerala 2, Maharashtra 1, Odisha 1, Tamil Nadu 1, Telangana 3, Uttar Pradesh 1 and West Bengal 4. This equals the MP column. The detail list of 135 MLAs equals the MLA column in every state. The rape lists (14 MLAs, 2 MPs) equal the rape table in every state.
6. 2025 table: the crimes-against-women column sums to 127 and the rape column to 13, matching the report's text. An independent recount of the 2025 name list by state equals the column in every state. Rape never exceeds crimes against women in any state.
7. All 70 data lines of the 2024 tables (state and party, both offences, with totals) and all 25 lines of the 2025 table were re-read from the PDF text and compared with `data.csv`. There were no mismatches.

## Gaps

- No ADR source with state-wise crimes-against-women counts for MPs elected in 2024 was located in this pass. The 2024 report already uses 2024 Lok Sabha affidavits for MPs, because it covers elections up to 2024.
- ADR's state name for the UT is "Dadra Nagar Haveli and Daman Diu". It is written here as "D&N Haveli and Daman & Diu". The 2025 report's "Jammu Kashmir" is written as "Jammu & Kashmir".
