# Fast Track Special Courts (FTSCs), State-wise: notes

Retrieved 2026-10-09. The scheme is the Department of Justice's Centrally Sponsored Scheme for FTSCs, including exclusive POCSO (e-POCSO) courts, launched in October 2019 for rape and POCSO Act cases. All answers are by Shri Arjun Ram Meghwal, Minister of State (Independent Charge), Law and Justice. Court and case figures are "as per the information made available by the High Courts".

## What the files hold, by as-on date

| indicator_code | as on / period | source |
|---|---|---|
| FTSC_FUNC, FTSC_FUNC_EPOCSO | 30.04.2026 | RS Starred Q 56 (23.07.2026), Annexure-I |
| FTSC_PEND_RAPE_COMBINED, FTSC_PEND_POCSO_COMBINED, FTSC_PEND_COMBINED_TOTAL, FTSC_PEND_EPOCSO, FTSC_PEND_CUM | 30.04.2026 (pending at end of month) | RS Starred Q 56, Annexure-I |
| FTSC_CONV_RATE_2023/2024/2025 | calendar years | RS Starred Q 56, Annexure-II |
| FTSC_FUNC_20251231, FTSC_DISP_2023/2024/2025 | 31.12.2025; calendar years | RS Unstarred Q 749 (05.02.2026), Annexure-II |
| FTSC_FUNC_20250630, FTSC_FUNC_EPOCSO_20250630, FTSC_INST_CUM, FTSC_DISP_CUM | 30.06.2025 | LS Unstarred Q 2215 (01.08.2025), Annexure-I |
| FTSC_DISP_CUM_NONEXCL, FTSC_DISP_CUM_EPOCSO | 30.06.2025 | PIB 2154103 (08.08.2025), Annexure-I |
| FTSC_CS_REL_2019_20 to FTSC_CS_REL_2024_25 | financial years | LS Unstarred Q 2215, Annexure-III |
| FTSC_CS_REL_2025_26 | FY 2025-26 | RS Unstarred Q 588 (23.07.2026), Annexure-II |
| FTSC_CS_REL_CUM_COMPUTED | FY 2019-20 to 2025-26 | computed sum of the two rows above; labelled as computed |
| FTSC_CS_REL_CUM (All India) | to 23.07.2026 | RS Q 588 text: Rs 1,259.51 crore |
| FTSC_DISP_CUM_DASHBOARD | undated | Department of Justice dashboard |

## Definitions

- "Functional FTSCs including exclusive POCSO courts" counts all courts; the e-POCSO count is a subset of it.
- Pendency in RS 56: "Combined FTSCs" are the non-exclusive courts, which hear both rape and POCSO cases; e-POCSO courts hear POCSO cases only. Cumulative pendency is combined total plus e-POCSO.
- Cases instituted and disposed "since the inception of the Scheme" run from October 2019 to 30.06.2025. Jharkhand left the scheme by letter dated 07.07.2025; its 9,114 disposals up to May 2025 stay in the totals, as the source footnote says.
- Funds are the central share only (60:40, or 90:10 for special category States), reimbursed against expenditure statements. State share is not reported.
- The conviction rate is "Average Conviction rate (%)" as printed. The answer does not state the denominator.

## Most recent date for each measure

- Functional courts and pending cases: 30.04.2026 (latest State-wise in Parliament found).
- Cases disposed since inception, State-wise: 30.06.2025 is the latest parliamentary figure found. Later answers (RS 56 and RS 588, July 2026) give yearly totals but no State-wise cumulative disposal. The Department of Justice dashboard gives State-wise cumulative disposal totalling 407,661, but shows no as-on date, so it is kept as a separate, flagged indicator and should not be presented with a date.
- Cases disposed by year, State-wise: calendar 2023, 2024 and 2025 (RS 749).

## State names mapped

- "J&K" and "Jammu and Kashmir" to Jammu & Kashmir.
- "Andaman and Nicobar" (dashboard) and "A&N Islands**" to A&N Islands.
- Footnote asterisks were stripped (Jharkhand*, A&N Islands**, Arunachal Pradesh***). The footnotes are kept in the `note` column.

## Checks run and results

All results are in `checks_log.txt` in this folder.

- RS 56 Annexure-I: every column sums to its printed total (775 courts, 398 e-POCSO, 22,545 rape and 84,823 POCSO pending in combined courts, 107,368 combined, 141,841 e-POCSO, 249,209 cumulative): pass. For every row, rape plus POCSO equals combined total, combined plus e-POCSO equals cumulative, and e-POCSO courts do not exceed all courts: pass.
- RS 588 Annexure-I equals RS 56 Annexure-I in all 30 rows: pass. PIB 2289464 prints the same table.
- RS 588 Annexure-II: each year sums to 200.00: pass.
- LS 2215 Annexure-I: columns sum to 725, 392, 538,772 instituted and 334,213 disposed: pass. Disposed never exceeds instituted: pass.
- PIB 2154103 split: non-exclusive plus e-POCSO disposal equals the LS 2215 total for every row; columns sum to 119,392 and 214,821: pass.
- LS 2215 Annexure-III: each year sums to its printed State total (140.00, 159.706, 134.5573, 199.92155, 200.00, 200.00): pass. The printed GRAND TOTAL adds a third-party evaluation cost of 0.29 (2020-21) and 0.07788 (2022-23).
- LS 2215 and RS 588 agree on 2023-24 and 2024-25 central share for every State: pass.
- RS 749 Annexure-II: columns sum to 774 courts and 76,319, 85,595 and 66,500 disposals: pass. These also match the yearly totals in RS 588 text.
- Dashboard: State rows sum to the headline 407,661: pass. Every State's dashboard figure is at or above its 30.06.2025 figure: pass.
- Funds reconciliation: LS 2215 gives 1,034.55 crore to 2024-25; LS 3476 (13.03.2026) gives 1,210.91 crore, which is 1,034.55 plus the 176.36 crore it says was released so far in 2025-26; adding the full 200.00 crore for 2025-26 gives 1,234.55. RS 588 gives 1,259.51 crore on 23.07.2026. The difference of 24.96 crore is presumably releases in FY 2026-27, which are not given State-wise. PIB 2289464 says the table covers "the last three years including FY 2026-27", but the table itself stops at 2025-26.

## Things in the sources worth knowing

- RS 588 prints 2025 pendency as "2,45.579", a typo for 2,45,579.
- RS 588 says courts were functional "in 29 States/UTs" while Annexure-I lists 30 rows; Jharkhand is the 30th row with zero courts.
- Maharashtra is 2 courts on 30.06.2025, 37 on 31.12.2025 and 38 on 30.04.2026, as printed.
- The scheme target is 790 courts (extended to 31.03.2026, then temporarily to 30.09.2026). The Cabinet's original approval was 1,023 courts.

## Gaps

- Courts sanctioned by State: not found in any primary document. The answers give only the national target (790), and say the original allocation used a norm of one court per 65 to 165 pending cases. No figure was filled in.
- Cases disposed since inception by State after 30.06.2025: only the undated dashboard.
- Cases pending by State before 30.04.2026 were not collected.
- Arunachal Pradesh opted out and A&N Islands has no court operational; Sikkim, Ladakh, Lakshadweep and D&N Haveli and Daman & Diu do not appear in any FTSC table and have no rows.
- The Department of Justice dashboard could not be fetched with curl because its certificate chain is incomplete; it was read through Firecrawl, so there is no stored file or hash for it.
