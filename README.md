# incs508-ws26-makerloan

**Course:** INCS508 Requirements Engineering, Winter 2026 — German International University
**Assigned case:** **MakerLoan** — Equipment Loans for a University Makerspace
**Milestone:** 1 (Iteration 1, branch `Itr1`) — SRS and vibe-coded prototype

## Team members

| # | Student ID | Full name | GitHub username |
|---|---|---|---|
| 1 | 13005321 | Youssef Mahmoud |  |
| 2 | 10004611 | Ahmed Mohamed | Askary1 |
| 3 | 10000885 | Saeed Mahmoud | Saeedxz1 |
| 4 | 10003458 | Ahmed Walid | AhmedWalid778 |
| 5 | 10001636 | Jana Harfouche | janaharfoucheee  |

## Contents of this submission

```
README.md              this file (case and team)
AI-USE.md              log of AI usage (SRS and prototype)
M1/
  SRS.md               Software Requirements Specification: 5 features (F1–F5), 15 requirements (R01–R15), PDRE
  prototype/           vibe-coded prototype (index.html, styles.css, app.js, README.md)
```

## What was built
- **`M1/SRS.md`** follows the IEEE-830-based template (Week 7) and applies PDRE (Week 8). It has exactly **5 features** (F1–F5) and **15 requirements** (R01–R15). Each requirement has a unique ID, one feature, a classification (FR / NFR / C), traceability to the MakerLoan case description (Section 7.1) and to the prototype (Section 7.2). Appendix D documents the PDRE checks.
- **`M1/prototype/`** is a no-build web prototype that demonstrates all five features and all fifteen requirements, with a "Show requirement tags" switch that labels each UI element with its requirement ID.

## How to run the prototype
```bash
cd M1/prototype
python3 -m http.server 8000     # then open http://localhost:8000
```
(or double-click `M1/prototype/index.html`). The full demonstration script, the list of demo accounts and the requirement-by-requirement walkthrough are in [`M1/prototype/README.md`](M1/prototype/README.md).

## Feature overview
| Feature | Requirements |
|---|---|
| F1 Equipment Catalog and Availability | R01, R02, R03 |
| F2 Reservations | R04, R05, R06 |
| F3 Desk Check-out and Check-in | R07, R08, R09 |
| F4 Safety Briefing and Access Control | R10, R11, R12 |
| F5 Overdue Follow-up and Manager Reporting | R13, R14, R15 |
