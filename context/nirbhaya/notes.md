# Nirbhaya Fund, State-wise: notes

Retrieved 2026-10-09. Every figure in `data.csv` is read from a Ministry of Women and Child Development answer in Parliament. Nothing is estimated or filled in.

## What the files hold

- `NIR_CUM_REL_UTIL`: amount released and utilised since the fund began (2013) up to FY 2025-26, for all 36 States/UTs, in Rs crore. Source: Rajya Sabha Unstarred Question 2873, answered 12.08.2026 by Smt. Savitri Thakur, Minister of State for Women and Child Development, Annexure-I.
- `NIR_FY2526_REL_UTIL`: amount released/utilised during FY 2025-26, for all 36 States/UTs, in Rs crore. Source: Rajya Sabha Unstarred Question 2870, answered 12.08.2026, same Minister, Annexure.
- `NIR_ALLOC_ALL` and `NIR_REL_UTIL_ALL` (All India): Rs 7,990.85 crore allocated and Rs 6,703.02 crore released/utilised up to FY 2025-26, from the text of RS 2873.
- `NIR_CUM_REL_UTIL_MP_LS3294`: Madhya Pradesh's Rs 320.71 crore from Lok Sabha Unstarred Question 3294 (07.08.2026), kept as a cross-check.

## Definitions and limits

- The State tables give one combined column, "Amount released and utilized" (RS 2873) or "Amount Released/ utilized" (RS 2870). Released and utilised are not given separately by State, so the site cannot show a utilisation rate per State from these answers. Allocation is given only for the country as a whole.
- RS 2870's question asked for the amount "sanctioned and utilised"; the Ministry answered with released/utilised. The indicator is labelled as the annexure labels it.
- The All India figures are not the sum of the State rows. The answer says some projects (Ministry of External Affairs, Housing and Urban Affairs, MeitY, Railways) are not implemented State-wise, and the Ministry does not keep their spending by State. The 36 State rows add up to Rs 5,970.78 crore against Rs 6,703.02 crore for all projects.
- The Ministry also says year-wise State figures are not maintained, so there is no State-wise series for 2020-21 to 2024-25 in this answer. Only the cumulative figure and the single year 2025-26 are available.
- The figures cover all Nirbhaya-funded projects in a State (for example One Stop Centres, Women Helpline, Emergency Response Support System, cyber crime, forensic labs, Fast Track Special Courts, Safe City). They are not broken down by project except for Madhya Pradesh in LS 3294.

## State names mapped

- "Jammu and Kashmir" to Jammu & Kashmir (RS 2873); "Jammu & Kashmir" already matched in RS 2870.
- "DNH & DD" (RS 2873) and "Dadra and Nagar Haveli and Daman and Diu" (RS 2870) to D&N Haveli and Daman & Diu.
- "Andaman & Nicobar Islands" (RS 2870) to A&N Islands.

## Checks run and results

- Neither annexure prints a total row, so a sum-to-total check was not possible. Sums computed instead: 5,970.78 crore cumulative; 548.06 crore for FY 2025-26.
- Both annexures list exactly the 36 States/UTs: pass.
- For every State/UT the FY 2025-26 figure is at or below the cumulative figure: pass.
- Madhya Pradesh: 320.71 crore in RS 2873 equals the figure in the text of LS 3294 and the total column of its annexure: pass. The project columns in LS 3294's annexure were garbled by PDF extraction and were not used.
- Every State name in `data.csv` is in the agreed list: pass.

## Gaps

- No State-wise split of released against utilised in the latest answers.
- No State-wise allocation.
- No State-wise year-wise figures for 2020-21 to 2024-25; the Ministry says it does not maintain them.
- Older answers (MHA Lok Sabha Unstarred 1271 of 30.07.2024, covering MHA projects only; PIB 1776818 of 2021) were seen in search and not used, because RS 2873 supersedes them.
