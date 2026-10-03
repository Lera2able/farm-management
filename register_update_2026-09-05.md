Khumotaka register update for `05-09-2026`

Confirmed missing adult tags added to `master_stock.xlsx`:
- `152-23`
- `20-75`
- `56183`

Confirmed calf tags added under calves in `master_stock.xlsx`:
- `8`, `0`, `6`, `2`, `5`, `4`, `3`, `L`
- `AA`, `7`, `G`, `M`, `N`
- `B`, `Z`, `1`, `J`, `CC`, `BB`, `H`, `E`, `T`, `R`, `W`, `DD`, `F`, `A`

Attendance sheet created:
- `05-09-2026`

Code updates completed:
- `owner-ui.js` now supports the editable photo review flow for scanned rows.
- New scanned rows can be marked as `Cow` or `Calf` before applying.
- Unmatched scanned rows can be added into the registry flow from the app UI.
- Voice/photo scan classification now handles calf tags more reliably.

Important note:
- The live Supabase database could not be updated from this session because the environment could not reach the Supabase host or function endpoint.
- The workbook and code are updated locally in the project folder, ready for the next live sync or deployment step.
