# Extraction of NCRB 2014 to 2019

These scripts read NCRB's crime against women tables for 2014 to 2019 and
wrote `data/raw/old/ncrb_2014_2015.csv` and `data/raw/old/ncrb_2016_2019.csv`.
They were run once, on 9 October 2026, against the PDFs listed with their
addresses and checksums in `data/raw/old/sources.json`. The text NCRB's tables
were extracted to (`pdftotext -layout`) is in `data/raw/old/txt/`.

The paths inside the scripts point at the folder they ran in. To run them
again, download the PDFs from the addresses in `sources.json`, check each
checksum, and change the paths at the top of each script.

Every count column was checked against NCRB's own printed totals, and every
printed rate against cases over population. The results are in
`data/raw/old/checks_2014_2015.json` and `checks_2016_2019.json`, and what
differs from the 2020 to 2024 coding is written out in the two `notes_*.md`
files. `scripts/build_data.py` reads the two CSVs, renames the 2016 headings
whose definition differs, and adds Dadra and Nagar Haveli to Daman and Diu so
every year has the same 36 states and union territories.
