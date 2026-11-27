# MakerLoan — Prototype (Milestone 1)

A vibe-coded, clickable prototype of MakerLoan that demonstrates the five features (F1–F5) and fifteen requirements (R01–R15) of `../SRS.md`.
It needs **no build, no server and no internet**: plain HTML, CSS and JavaScript. Data is stored in the browser (`localStorage`); sign-in and e-mail are simulated.

## How to run
**Option A (recommended, works with two tabs everywhere):**
```bash
cd M1/prototype
python3 -m http.server 8000
# open http://localhost:8000 in Chrome, Edge or Firefox
```
**Option B:** double-click `index.html` (works in Chrome and Edge).

Use **Reset demo data** (bottom bar) to return to the starting state at any time.

## How it is organised
- **Sign-in screen** — pick a simulated university account (R12). Each browser tab has its own signed-in user, so two tabs can be two people.
- **Bottom bar (demo controls)** — a *simulated clock* (+1 hour, +6 hours, +1 day, +7 days) so time-based requirements (R06, R13, R14) can be shown in seconds, and **Show requirement tags**, which marks every UI element with the requirement it demonstrates (red labels R01–R15).

| Account | ID | Role | Notes |
|---|---|---|---|
| Mona Hassan | s1001 | Student | Has a valid Power-tools briefing; holds an item due in 30 h |
| Karim Adel | s1002 | Student | No valid briefings (VR briefing expired); has a reservation that is about to lapse |
| Lena Weber | s1003 | Student | Has an overdue loan |
| Dr. Anna Klein | t2001 | Staff | Loan overdue by 17 days |
| Prof. Lea Hoffmann | l3001 | Lecturer | Has a course reservation; briefings for power tools and VR |
| Tarek Mansour | a4001 | Loan desk assistant | Designated by the safety officer to record briefings |
| Nora Fischer | a4002 | Loan desk assistant | Not designated |
| Ms. Grace Okafor | o5001 | Safety officer | |
| Mr. Jonas Richter | m6001 | Manager | |

Business rules used by the prototype (SRS Section 5.5): student loan 7 days, staff and lecturers 14 days, in-makerspace-only items due 17:00 the same day (BR-01); reservations at most 14 days ahead, pickup 09:00, released 24 h after pickup time (BR-02); course reservations at most 10 units (BR-03); Power tools and VR headsets need a briefing valid 12 months (BR-04); reminder 24 h before due and overdue notice every 3 days (BR-05); presumed lost after 14 days overdue (BR-06); return conditions good / damaged / incomplete (BR-07). All values are in the `RULES` object at the top of `app.js`.

## Demo script — requirement by requirement
Turn on **Show requirement tags** first; each step names the tag you will see.

| # | Req | Steps |
|---|---|---|
| 1 | **R12** | Open the app: the sign-in screen offers only university accounts and asks for no password. |
| 2 | **R01** | Sign in as **Mona**. In *Catalog* search `camera`; filter by category *Power tools*, by loan type, by availability *On loan*. Each row has a status and, if on loan, an expected return date. |
| 3 | **R03** | Mona's catalog has no holder information. Sign out, sign in as **Tarek**: *Holder* and *Due* columns appear. |
| 4 | **R04** | As Mona click **Reserve** on *ML-0011* (Canon). Keep the default dates (tomorrow, return the day after) → accepted. Try pickup in 20 days → refused (BR-02). Try the same dates again → refused (overlap). Try a 10-day return → refused (BR-01). |
| 5 | **R11** | As Mona reserve a *Meta Quest* (VR) → refused, "no valid safety briefing". Reserve a *Bosch Cordless Drill* → accepted (she has a briefing). |
| 6 | **R05** | Sign in as **Prof. Hoffmann** → *Course reservation*. Reserve 2 *Electronics kits* → accepted. Ask for 11 units → refused (BR-03). Ask for 5 *Cameras* → refused: only 4 exist, nothing is reserved. |
| 7 | **R07** | Sign in as **Tarek** → *Desk*. Check out `ML-0009` to `s1001` → due date 7 days later. Check out `ML-0011` to `l3001` → 14 days. Check out `ML-0014` (oscilloscope) → due 17:00 today. Check out `ML-0002` to `s1001` → refused, it is reserved by the lecturer in the loan period. |
| 8 | **R09** | The timer starts when you type in the check-out form and shows **Last transaction: n s (target ≤ 60 s)** after confirmation. |
| 9 | **R11** (desk) | Check out `ML-0022` (drill) to `s1002` (Karim) → refused, no valid briefing. |
| 10 | **R10** | Still as Tarek → *Briefings*: record *Power tools* for Karim → accepted. Repeat the desk check-out of `ML-0022` to `s1002` → now accepted. Sign in as **Nora** → *Briefings*: recording is refused (not designated). Sign in as **Ms. Okafor**: she can record. |
| 11 | **R08** | As Tarek → *Desk → Check-in*: choose a loan, condition **damaged** → the item becomes *Unavailable* and appears in the *Inspection list*; click **Inspected — clear flag** → available again. Check in another as **good** → available at once. |
| 12 | **R06** | As **Karim** open *My loans & reservations*: a reservation for the Sony camera whose pickup time has passed. Use **+1 day** in the bottom bar → it shows *released (not collected in time)*, the camera is *Available*, and *Notifications* holds the release e-mail. |
| 13 | **R13** | As **Mona**: *Notifications* has no reminder yet. Click **+6 hours** → a reminder for the Arduino kit due in 30 h. Use **+1 day**, then **+6 hours** (the loan is now overdue) → an overdue notice. **+7 days** → two more (every 3 days). |
| 14 | **R14** | As **Tarek** or **Mr. Richter** → *Overdue*: Lena (days overdue), and Dr. Klein flagged **presumed lost**. Use **+7 days** twice: Lena passes 14 days overdue, is flagged and the manager gets a notification. |
| 15 | **R15** | As **Mr. Richter** → *Reports*: loans per category, % returned late, damaged/incomplete, items with finance asset numbers. Change the period; click **Download CSV**. |
| 16 | **R02** | Open the app in two tabs. Tab 1: Mona, *Catalog*, search `ML-0020`. Tab 2: Tarek, *Desk*, check out `ML-0020` to `l3001`. Tab 1 shows *On loan* within 2–5 seconds (the *Live · last synced* label). |

## Automated check (optional)
Every scenario above was also run in a headless browser (70 checks, all passing). The page exposes `window.ML` for such scripts; the UI itself does not use it.

## Limits of the prototype (by design)
- Sign-in, e-mail and the finance export are **simulated** (R12, R13, Section 3.3 of the SRS describe the real interfaces).
- Data lives in the browser only; there is no server, so "real-time" works between tabs of one browser.
- 28 seeded items stand in for the ~300 of the real inventory (SRS assumption A1).
- Features outside the five (loan limits, overdue blocking, fines) are intentionally absent (SRS Appendix C).

## Files
- `index.html` — page shell and the reservation dialog
- `styles.css` — styling and the requirement-tag overlay
- `app.js` — business rules, data, all views and behaviour
