/* MakerLoan prototype — Milestone 1 (INCS508).
 * Single-page app, no build step, no server. Data lives in the browser's localStorage so that
 * two tabs behave like two users of one system (see R02). The clock is simulated so that the
 * time-based requirements (R06, R13, R14) can be demonstrated in seconds.
 * Requirement IDs (R01–R15) and business rules (BR-01…BR-07) refer to M1/SRS.md.
 */
(function () {
  'use strict';

  const HOUR = 3600e3, DAY = 24 * HOUR;

  /* ---------- Business rules (SRS Section 5.5) — the single place for these values ---------- */
  const RULES = {
    loanDays: { student: 7, staff: 14, lecturer: 14 }, // BR-01
    inHouseDueHour: 17,                                 // BR-01
    reserveAheadDays: 14, pickupHour: 9, holdHours: 24, // BR-02
    courseMax: 10,                                      // BR-03
    briefingCats: ['Power tools', 'VR headsets'],       // BR-04
    briefingValidDays: 365,                             // BR-04
    reminderHours: 24, overdueEveryHours: 72,           // BR-05
    lostAfterDays: 14,                                  // BR-06
    conditions: ['good', 'damaged', 'incomplete']       // BR-07
  };

  /* ---------- Simulated university accounts (R12: sign-in only through university accounts) ---------- */
  const USERS = [
    { id: 's1001', name: 'Mona Hassan', group: 'student', role: 'borrower', title: 'Student' },
    { id: 's1002', name: 'Karim Adel', group: 'student', role: 'borrower', title: 'Student (no briefings)' },
    { id: 's1003', name: 'Lena Weber', group: 'student', role: 'borrower', title: 'Student (has an overdue loan)' },
    { id: 't2001', name: 'Dr. Anna Klein', group: 'staff', role: 'borrower', title: 'University staff' },
    { id: 'l3001', name: 'Prof. Lea Hoffmann', group: 'lecturer', role: 'lecturer', title: 'Lecturer' },
    { id: 'a4001', name: 'Tarek Mansour', role: 'assistant', designated: true, title: 'Loan desk assistant (designated for briefings)' },
    { id: 'a4002', name: 'Nora Fischer', role: 'assistant', designated: false, title: 'Loan desk assistant (not designated)' },
    { id: 'o5001', name: 'Ms. Grace Okafor', role: 'safety', title: 'Occupational safety officer' },
    { id: 'm6001', name: 'Mr. Jonas Richter', role: 'manager', title: 'Makerspace manager' }
  ];
  const ROLE_LABEL = { borrower: 'Borrower', lecturer: 'Lecturer', assistant: 'Loan desk assistant', safety: 'Safety officer', manager: 'Manager' };
  const userById = id => USERS.find(u => u.id === String(id).toLowerCase());
  const isBorrower = u => !!u && (u.role === 'borrower' || u.role === 'lecturer');
  const emailOf = u => u.name.toLowerCase().replace(/^(dr|prof|mr|ms)\.?\s+/, '').replace(/[^a-z]+/g, '.') + '@uni-makerspace.example';

  /* ---------- Helpers ---------- */
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const startOfDay = ms => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const localDate = (str, hour) => { const [y, m, d] = str.split('-').map(Number); return new Date(y, m - 1, d, hour || 0, 0, 0, 0).getTime(); };
  const toInput = ms => { const d = new Date(ms); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const fmtDate = ms => new Date(ms).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
  const fmtDT = ms => new Date(ms).toLocaleString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  const dayDiff = (a, b) => Math.round((startOfDay(a) - startOfDay(b)) / DAY);
  const err = msg => ({ ok: false, msg });
  const good = (msg, extra) => Object.assign({ ok: true, msg }, extra || {});

  /* ---------- State ---------- */
  const KEY = 'makerloan.v1';
  let S = null;
  let lastSync = Date.now();
  let me = null; // signed-in user of THIS tab (sessionStorage) — two tabs can be two different users

  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  function seed() {
    const t0 = new Date(); t0.setHours(10, 0, 0, 0);
    const now = t0.getTime();
    const st = { rev: 1, now, seq: 100, items: [], loans: [], reservations: [], briefings: [], outbox: [] };
    // Catalog (A1: the real inventory is ~300 items; 28 are seeded for the demo)
    const defs = [
      ['Arduino Starter Kit', 'Electronics kits', 4, 'take-home'],
      ['Raspberry Pi 5 Kit', 'Electronics kits', 3, 'take-home'],
      ['ESP32 Sensor Kit', 'Electronics kits', 2, 'take-home'],
      ['Canon EOS R50 Camera', 'Cameras', 2, 'take-home'],
      ['GoPro HERO12 Action Camera', 'Cameras', 1, 'take-home'],
      ['Sony ZV-E10 Camera', 'Cameras', 1, 'take-home'],
      ['Rigol Digital Oscilloscope', 'Measuring instruments', 2, 'in-makerspace only'],
      ['Fluke 117 Multimeter', 'Measuring instruments', 3, 'take-home'],
      ['Meta Quest 3 VR Headset', 'VR headsets', 3, 'take-home'],
      ['Bosch Cordless Drill', 'Power tools', 2, 'take-home'],
      ['Bosch Jigsaw', 'Power tools', 1, 'take-home'],
      ['Weller Soldering Station', 'Other', 1, 'in-makerspace only'],
      ['Dell XPS 15 Laptop', 'Laptops', 2, 'take-home'],
      ['Label Printer', 'Other', 1, 'in-makerspace only']
    ];
    let n = 0;
    defs.forEach(d => { for (let i = 0; i < d[2]; i++) { n++; st.items.push({ id: 'i' + n, tag: 'ML-' + String(n).padStart(4, '0'), name: d[0], category: d[1], loanType: d[3], finance: 'FIN-2024-' + String(3000 + n * 7), flag: null }); } });
    const byTag = t => st.items.find(i => i.tag === t);
    const nid = p => p + (++st.seq);

    // Briefings (R10/R11)
    const mkB = (uid, cat, daysAgo, by) => st.briefings.push({ uid, category: cat, at: now - daysAgo * DAY, by });
    mkB('s1001', 'Power tools', 60, 'o5001');
    mkB('s1002', 'VR headsets', 400, 'o5001'); // expired
    mkB('l3001', 'Power tools', 100, 'o5001');
    mkB('l3001', 'VR headsets', 100, 'o5001');

    // Active loans
    const loan = (tag, uid, outAt, due) => { const it = byTag(tag); st.loans.push({ id: nid('L'), itemId: it.id, uid, outAt, due, returnedAt: null, condition: null, reminderSent: true, lastOverdueAt: null, presumedLost: false, by: 'a4001' }); };
    loan('ML-0005', 's1003', now - 12 * DAY, now - 5 * DAY);                   // overdue 5 days
    loan('ML-0016', 't2001', now - 31 * DAY, now - 17 * DAY);                  // overdue 17 days → presumed lost
    loan('ML-0010', 's1002', now - 4 * DAY, now + 3 * DAY);                    // running normally
    loan('ML-0001', 's1001', now + 30 * HOUR - 7 * DAY, now + 30 * HOUR);      // due in 30 h → reminder after +6 h
    st.loans[3].reminderSent = false;

    // Reservations
    const res = (tag, uid, startMs, endMs, extra) => st.reservations.push(Object.assign({ id: nid('R'), itemId: byTag(tag).id, uid, start: startMs, end: endMs, status: 'active', course: null, groupId: null, createdAt: now }, extra || {}));
    const today = startOfDay(now);
    res('ML-0013', 's1002', today + RULES.pickupHour * HOUR, today + 2 * DAY + 17 * HOUR);   // pickup time already passed → released after +23 h
    res('ML-0012', 's1002', today + 3 * DAY + RULES.pickupHour * HOUR, today + 5 * DAY + 17 * HOUR);
    ['ML-0002', 'ML-0003', 'ML-0004'].forEach(t => res(t, 'l3001', today + 5 * DAY + RULES.pickupHour * HOUR, today + 6 * DAY + 17 * HOUR, { course: 'Embedded Systems Lab', groupId: 'G1' }));

    // Closed loan history for the report (R15): deterministic pseudo-random data
    const rnd = mulberry32(2026);
    const busy = new Set(st.loans.map(l => l.itemId).concat(st.reservations.map(r => r.itemId)));
    const pool = st.items.filter(i => i.loanType === 'take-home' && !busy.has(i.id) && !RULES.briefingCats.includes(i.category));
    const borrowers = USERS.filter(isBorrower);
    for (let k = 0; k < 70; k++) {
      const it = pool[Math.floor(rnd() * pool.length)], u = borrowers[Math.floor(rnd() * borrowers.length)];
      const outAt = startOfDay(now) - Math.floor(3 + rnd() * 47) * DAY + 9 * HOUR + Math.floor(rnd() * 6) * HOUR;
      const due = outAt + RULES.loanDays[u.group] * DAY;
      let ret = rnd() < 0.2 ? due + Math.ceil(rnd() * 5) * DAY : due - Math.floor(rnd() * 3) * DAY;
      ret = Math.min(Math.max(ret, outAt + 6 * HOUR), now - 2 * HOUR);
      const r = rnd();
      st.loans.push({ id: nid('L'), itemId: it.id, uid: u.id, outAt, due, returnedAt: ret, condition: r < 0.86 ? 'good' : r < 0.93 ? 'damaged' : 'incomplete', reminderSent: true, lastOverdueAt: null, presumedLost: false, by: 'a4001' });
    }
    // One item waiting for inspection after a damaged return yesterday
    const jig = byTag('ML-0024'); jig.flag = 'damaged';
    st.loans.push({ id: nid('L'), itemId: jig.id, uid: 'l3001', outAt: now - 4 * DAY, due: now - 3 * DAY, returnedAt: now - DAY, condition: 'damaged', reminderSent: true, lastOverdueAt: null, presumedLost: false, by: 'a4001' });
    S = st;
    tick(); // creates the first notices for the seeded overdue loans
    return st;
  }

  function save() { S.rev++; localStorage.setItem(KEY, JSON.stringify(S)); }
  function load() { const raw = localStorage.getItem(KEY); S = raw ? JSON.parse(raw) : null; if (!S) { seed(); save(); } }

  /* ---------- Domain queries ---------- */
  const itemById = id => S.items.find(i => i.id === id);
  const itemByTag = tag => S.items.find(i => i.tag.toLowerCase() === String(tag).trim().toLowerCase());
  const activeLoan = itemId => S.loans.find(l => l.itemId === itemId && !l.returnedAt);
  const activeRes = itemId => S.reservations.filter(r => r.itemId === itemId && r.status === 'active');
  const briefingRequired = cat => RULES.briefingCats.includes(cat);
  const validBriefing = (uid, cat) => S.briefings.some(b => b.uid === uid && b.category === cat && b.at + RULES.briefingValidDays * DAY > S.now);

  function statusOf(item) {
    if (item.flag) return 'Unavailable';
    if (activeLoan(item.id)) return 'On loan';
    if (activeRes(item.id).some(r => r.start <= S.now + 24 * HOUR && r.end >= S.now)) return 'Reserved';
    return 'Available';
  }
  const badge = s => '<span class="badge b-' + s.toLowerCase().replace(' ', '') + '">' + esc(s) + '</span>';
  const overlap = (a0, a1, b0, b1) => a0 < b1 && b0 < a1;

  function conflict(item, start, end, opt) {
    opt = opt || {};
    const l = activeLoan(item.id);
    if (l && overlap(start, end, l.outAt, Math.max(l.due, S.now))) return 'on loan until ' + fmtDT(l.due);
    const r = activeRes(item.id).find(x => x.id !== opt.ignoreId && x.uid !== opt.ignoreUid && overlap(start, end, x.start, x.end));
    if (r) return 'already reserved from ' + fmtDT(r.start) + ' to ' + fmtDT(r.end);
    return null;
  }

  function dueFor(user, item, from) {
    if (item.loanType === 'in-makerspace only') return startOfDay(from) + RULES.inHouseDueHour * HOUR;       // BR-01
    return from + RULES.loanDays[user.group] * DAY;                                                          // BR-01
  }

  /* ---------- Notifications (simulated university e-mail) ---------- */
  function notify(uid, type, subject, body) {
    const u = userById(uid);
    S.outbox.unshift({ id: 'N' + (++S.seq), at: S.now, to: uid, toName: u ? u.name : uid, toEmail: u ? emailOf(u) : '', type, subject, body });
  }

  /* ---------- Time-based behaviour: R06 (release), R13 (notices), R14 (presumed lost) ---------- */
  function tick() {
    S.reservations.forEach(r => {                                                       // R06 / BR-02
      if (r.status === 'active' && S.now > r.start + RULES.holdHours * HOUR) {
        r.status = 'released'; r.releasedAt = S.now;
        const it = itemById(r.itemId);
        notify(r.uid, 'released', 'Reservation released: ' + it.name, 'Your reservation of ' + it.name + ' (' + it.tag + ') for ' + fmtDT(r.start) + ' was not collected within ' + RULES.holdHours + ' hours and has been released.');
      }
    });
    S.loans.filter(l => !l.returnedAt).forEach(l => {
      const it = itemById(l.itemId), u = userById(l.uid);
      if (!l.reminderSent && S.now < l.due && S.now >= l.due - RULES.reminderHours * HOUR) {  // R13 / BR-05
        l.reminderSent = true;
        notify(l.uid, 'reminder', 'Reminder: ' + it.name + ' is due ' + fmtDT(l.due), 'Please return ' + it.name + ' (' + it.tag + ') by ' + fmtDT(l.due) + '.');
      }
      if (S.now > l.due) {
        if (!l.lastOverdueAt || S.now - l.lastOverdueAt >= RULES.overdueEveryHours * HOUR) {  // R13 / BR-05
          l.lastOverdueAt = S.now;
          const d = Math.floor((S.now - l.due) / DAY);
          notify(l.uid, 'overdue', 'Overdue: ' + it.name + ' (' + d + ' day' + (d === 1 ? '' : 's') + ')', 'Please return ' + it.name + ' (' + it.tag + '). It was due ' + fmtDT(l.due) + '.');
        }
        if (!l.presumedLost && S.now - l.due > RULES.lostAfterDays * DAY) {                    // R14 / BR-06
          l.presumedLost = true;
          notify('m6001', 'lost', 'Loan presumed lost: ' + it.name, it.name + ' (' + it.tag + ', finance no. ' + it.finance + ') held by ' + u.name + ' is overdue by more than ' + RULES.lostAfterDays + ' days and is flagged as presumed lost.');
        }
      }
    });
  }
  function advance(hours) { for (let h = 0; h < hours; h++) { S.now += HOUR; tick(); } save(); }

  /* ---------- Operations (each returns {ok,msg}) ---------- */
  function datesCheck(user, item, pickupStr, returnStr) {
    if (!pickupStr || !returnStr) return err('Please choose a pickup date and a return date.');
    const start = localDate(pickupStr, RULES.pickupHour), end = localDate(returnStr, RULES.inHouseDueHour);
    const ahead = dayDiff(start, S.now);
    if (ahead < 0) return err('The pickup date is in the past.');
    if (ahead > RULES.reserveAheadDays) return err('Pickup must be at most ' + RULES.reserveAheadDays + ' days ahead (BR-02).');
    const len = dayDiff(end, start);
    if (len < 0) return err('The return date is before the pickup date.');
    if (item.loanType === 'in-makerspace only' ? len > 0 : len > RULES.loanDays[user.group]) {
      return err(item.loanType === 'in-makerspace only' ? 'This item is for use in the makerspace only: return on the pickup date (BR-01).' : 'The loan period for ' + user.group + 's is ' + RULES.loanDays[user.group] + ' days (BR-01).');
    }
    return { ok: true, start, end };
  }

  function briefingCheck(user, item) {                                               // R11 / BR-04
    if (briefingRequired(item.category) && !validBriefing(user.id, item.category)) {
      return err(user.name + ' has no valid safety briefing for ' + item.category + ' (BR-04). Please attend a briefing first.');
    }
    return null;
  }

  function reserve(user, itemId, pickupStr, returnStr) {                             // R04
    if (!isBorrower(user)) return err('Only borrowers can reserve.');
    const item = itemById(itemId); if (!item) return err('Unknown item.');
    if (item.flag) return err('This item is unavailable (needs inspection).');
    const d = datesCheck(user, item, pickupStr, returnStr); if (!d.ok) return d;
    const b = briefingCheck(user, item); if (b) return b;                            // R11
    const c = conflict(item, d.start, d.end); if (c) return err('Not possible: the item is ' + c + '.');
    S.reservations.push({ id: 'R' + (++S.seq), itemId, uid: user.id, start: d.start, end: d.end, status: 'active', course: null, groupId: null, createdAt: S.now });
    save();
    return good('Reserved ' + item.name + ' (' + item.tag + ') for pickup on ' + fmtDate(d.start) + ' at ' + String(RULES.pickupHour).padStart(2, '0') + ':00. Collect it within ' + RULES.holdHours + ' hours of that time (BR-02).');
  }

  function courseReserve(user, o) {                                                  // R05
    if (user.role !== 'lecturer') return err('Only lecturers can make course reservations.');
    if (!o.course || !o.course.trim()) return err('Please enter the course name.');
    const qty = parseInt(o.qty, 10);
    if (!(qty >= 1)) return err('Please enter the number of units.');
    if (qty > RULES.courseMax) return err('A course reservation covers at most ' + RULES.courseMax + ' units (BR-03).');
    const sample = S.items.find(i => i.category === o.category); if (!sample) return err('Unknown category.');
    const b = briefingCheck(user, sample); if (b) return b;                          // R11
    const d = datesCheck(user, sample, o.pickup, o.ret); if (!d.ok) return d;
    const free = S.items.filter(i => i.category === o.category && !i.flag && !conflict(i, d.start, d.end));
    if (free.length < qty) return err('Only ' + free.length + ' unit' + (free.length === 1 ? ' is' : 's are') + ' available in ' + o.category + ' for those dates. Nothing was reserved.');
    const gid = 'G' + (++S.seq);
    free.slice(0, qty).forEach(i => S.reservations.push({ id: 'R' + (++S.seq), itemId: i.id, uid: user.id, start: d.start, end: d.end, status: 'active', course: o.course.trim(), groupId: gid, createdAt: S.now }));
    save();
    return good('Reserved ' + qty + ' × ' + o.category + ' for "' + o.course.trim() + '" (' + fmtDate(d.start) + ' – ' + fmtDate(d.end) + ').');
  }

  function checkout(actor, uid, tag) {                                               // R07
    if (actor.role !== 'assistant') return err('Only loan desk assistants record check-outs.');
    const b = userById(String(uid).trim()); if (!isBorrower(b)) return err('Unknown borrower ID "' + esc(uid) + '".');
    const item = itemByTag(tag); if (!item) return err('Unknown asset tag "' + esc(tag) + '".');
    if (item.flag) return err(item.tag + ' is unavailable: it needs inspection (' + item.flag + ').');
    const cur = activeLoan(item.id); if (cur) return err(item.tag + ' is already on loan to ' + userById(cur.uid).name + '.');
    const bc = briefingCheck(b, item); if (bc) return bc;                            // R11
    const due = dueFor(b, item, S.now);
    const c = conflict(item, S.now, due, { ignoreUid: b.id });
    if (c) return err('Not possible: the item is ' + c + ' (it overlaps the loan period until ' + fmtDT(due) + ').');
    activeRes(item.id).filter(r => r.uid === b.id && r.end >= S.now).forEach(r => { r.status = 'collected'; });
    S.loans.push({ id: 'L' + (++S.seq), itemId: item.id, uid: b.id, outAt: S.now, due, returnedAt: null, condition: null, reminderSent: (due - S.now) <= RULES.reminderHours * HOUR, lastOverdueAt: null, presumedLost: false, by: actor.id });
    save();
    return good('Checked out ' + item.name + ' (' + item.tag + ') to ' + b.name + '. Due: ' + fmtDT(due) + '.', { due });
  }

  function checkin(actor, loanId, cond) {                                            // R08
    if (actor.role !== 'assistant') return err('Only loan desk assistants record check-ins.');
    const l = S.loans.find(x => x.id === loanId && !x.returnedAt); if (!l) return err('Please choose a loan to check in.');
    if (!RULES.conditions.includes(cond)) return err('Please choose the condition of the item.');
    l.returnedAt = S.now; l.condition = cond;
    const it = itemById(l.itemId);
    if (cond !== 'good') it.flag = cond;                                             // unavailable until a staff member clears it
    save();
    return good('Checked in ' + it.name + ' (' + it.tag + ') as "' + cond + '".' + (cond !== 'good' ? ' The item is now unavailable until inspected.' : ' The item is available again.'));
  }

  function clearFlag(actor, itemId) {                                                // R08
    if (actor.role !== 'assistant' && actor.role !== 'manager') return err('Only staff can clear an inspection flag.');
    const it = itemById(itemId); if (!it) return err('Unknown item.');
    it.flag = null; save();
    return good(it.tag + ' is available again.');
  }

  function recordBriefing(actor, uid, cat) {                                         // R10
    if (!(actor.role === 'safety' || (actor.role === 'assistant' && actor.designated))) return err('Only the safety officer and assistants designated by the safety officer can record briefings (BR-04).');
    const b = userById(uid); if (!isBorrower(b)) return err('Please choose a borrower.');
    if (!briefingRequired(cat)) return err('Please choose a briefing-required category.');
    S.briefings.push({ uid: b.id, category: cat, at: S.now, by: actor.id }); save();
    return good('Recorded: ' + b.name + ' completed the ' + cat + ' briefing. Valid until ' + fmtDate(S.now + RULES.briefingValidDays * DAY) + '.');
  }

  function report(fromStr, toStr) {                                                  // R15 (basis: loans started in the period)
    const from = localDate(fromStr, 0), to = localDate(toStr, 0) + DAY;
    const loans = S.loans.filter(l => l.outAt >= from && l.outAt < to).sort((a, b) => a.outAt - b.outAt);
    const perCat = {}; loans.forEach(l => { const c = itemById(l.itemId).category; perCat[c] = (perCat[c] || 0) + 1; });
    const returned = loans.filter(l => l.returnedAt);
    const late = returned.filter(l => l.returnedAt > l.due);
    const problem = returned.filter(l => l.condition !== 'good');
    const lost = loans.filter(l => l.presumedLost);
    return { from, to, loans, perCat, returned: returned.length, late: late.length, problem, lost };
  }
  function csv(rep) {
    const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const rows = [['loan_id', 'asset_tag', 'finance_asset_no', 'item', 'category', 'borrower', 'check_out', 'due', 'returned', 'condition', 'returned_late', 'presumed_lost']];
    rep.loans.forEach(l => { const it = itemById(l.itemId); rows.push([l.id, it.tag, it.finance, it.name, it.category, userById(l.uid).name, new Date(l.outAt).toISOString(), new Date(l.due).toISOString(), l.returnedAt ? new Date(l.returnedAt).toISOString() : '', l.condition || '', l.returnedAt ? (l.returnedAt > l.due ? 'yes' : 'no') : '', l.presumedLost ? 'yes' : 'no']); });
    return rows.map(r => r.map(q).join(',')).join('\n');
  }

  /* ---------- UI ---------- */
  let view = 'catalog';
  const F = { q: '', cat: '', type: '', status: '' };
  const tx = { start: null, timer: null };

  const NAV = {
    borrower: [['catalog', 'Catalog'], ['my', 'My loans & reservations'], ['outbox', 'Notifications']],
    lecturer: [['catalog', 'Catalog'], ['course', 'Course reservation'], ['my', 'My loans & reservations'], ['outbox', 'Notifications']],
    assistant: [['desk', 'Desk'], ['catalog', 'Catalog'], ['overdue', 'Overdue'], ['briefings', 'Briefings'], ['outbox', 'Notifications']],
    safety: [['briefings', 'Briefings'], ['catalog', 'Catalog'], ['outbox', 'Notifications']],
    manager: [['reports', 'Reports'], ['overdue', 'Overdue'], ['catalog', 'Catalog'], ['outbox', 'Notifications']]
  };
  const staffSeesHolder = () => me && (me.role === 'assistant' || me.role === 'manager');

  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 3500); }
  const msgHtml = r => '<p class="msg ' + (r.ok ? 'okm' : 'err') + '" role="alert">' + (r.ok ? '✔ ' : '✖ ') + r.msg + '</p>';

  function render() {
    renderChrome();
    const main = $('#main');
    if (!me) { main.innerHTML = loginView(); return; }
    const allowed = NAV[me.role].map(n => n[0]);
    if (!allowed.includes(view)) view = allowed[0];
    const fn = { catalog: catalogView, my: myView, course: courseView, desk: deskView, overdue: overdueView, briefings: briefingsView, reports: reportsView, outbox: outboxView }[view];
    main.innerHTML = fn();
    if (view === 'catalog') renderCatalogRows();
    if (view === 'reports') runReport();
  }

  function renderChrome() {
    $('#clock').textContent = 'Demo clock: ' + fmtDT(S.now);
    $('#userbox').innerHTML = me ? '<span>' + esc(me.name) + ' · ' + ROLE_LABEL[me.role] + '</span><button data-action="logout">Sign out</button>' : '';
    $('#nav').innerHTML = me ? NAV[me.role].map(n => '<button data-view="' + n[0] + '"' + (n[0] === view ? ' aria-current="page"' : '') + '>' + n[1] + '</button>').join('') : '';
  }

  /* --- R12: sign-in screen (simulated university single sign-on) --- */
  function loginView() {
    return '<div class="card" data-req="R12"><h1>Sign in with your university account</h1>' +
      '<p class="muted">Simulated university single sign-on. MakerLoan has no passwords of its own and asks for none: identity and group (student, staff, lecturer) come from the university account.</p>' +
      '<div class="users">' + USERS.map(u => '<button data-action="login" data-id="' + u.id + '"><strong>' + esc(u.name) + '</strong><small>' + esc(u.title) + ' · ' + esc(u.id) + '</small></button>').join('') + '</div></div>' +
      '<div class="note">Tip: open a second browser tab and sign in as another user to see changes appear live (R02). Use "Show requirement tags" below to see which requirement each element demonstrates.</div>';
  }

  /* --- R01 / R02 / R03 / R04: catalog --- */
  function catalogView() {
    const cats = [...new Set(S.items.map(i => i.category))];
    return '<div class="card"><div class="row" style="justify-content:space-between"><h1>Equipment catalog</h1>' +
      '<span class="live" id="sync-indicator" data-req="R02"></span></div>' +
      '<div class="filters" data-req="R01">' +
      '<label>Search by name<br><input type="text" id="f-q" placeholder="e.g. camera" value="' + esc(F.q) + '"></label>' +
      '<label>Category<br><select id="f-cat"><option value="">All</option>' + cats.map(c => '<option' + (F.cat === c ? ' selected' : '') + '>' + esc(c) + '</option>').join('') + '</select></label>' +
      '<label>Loan type<br><select id="f-type"><option value="">All</option><option value="take-home"' + (F.type === 'take-home' ? ' selected' : '') + '>Take-home</option><option value="in-makerspace only"' + (F.type === 'in-makerspace only' ? ' selected' : '') + '>In-makerspace only</option></select></label>' +
      '<label>Availability<br><select id="f-status"><option value="">All</option>' + ['Available', 'Reserved', 'On loan', 'Unavailable'].map(s => '<option' + (F.status === s ? ' selected' : '') + '>' + s + '</option>').join('') + '</select></label>' +
      '<span class="muted small" id="f-count"></span></div>' +
      '<div class="tablewrap"><table id="catalog-table"><thead><tr><th>Asset tag</th><th>Item</th><th>Category</th><th>Loan type</th><th data-req="R01">Status</th><th data-req="R01">Expected return</th>' +
      (staffSeesHolder() ? '<th data-req="R03">Holder</th><th data-req="R03">Due</th>' : '') +
      (isBorrower(me) ? '<th>Action</th>' : '') + '</tr></thead><tbody id="catalog-body"></tbody></table></div></div>';
  }
  function renderCatalogRows() {
    const body = $('#catalog-body'); if (!body) return;
    const q = F.q.trim().toLowerCase();
    const rows = S.items.filter(i => (!q || i.name.toLowerCase().includes(q) || i.tag.toLowerCase().includes(q)) && (!F.cat || i.category === F.cat) && (!F.type || i.loanType === F.type) && (!F.status || statusOf(i) === F.status));
    $('#f-count').textContent = rows.length + ' of ' + S.items.length + ' items';
    body.innerHTML = rows.map(i => {
      const st = statusOf(i), l = activeLoan(i.id);
      const exp = l ? fmtDate(l.due) : '—';
      let h = '<tr><td>' + esc(i.tag) + '</td><td>' + esc(i.name) + (briefingRequired(i.category) ? ' <span class="badge b-grey" title="BR-04" data-req="R11">Briefing required</span>' : '') + '</td><td>' + esc(i.category) + '</td><td>' + esc(i.loanType) + '</td><td>' + badge(st) + '</td><td>' + exp + '</td>';
      if (staffSeesHolder()) h += '<td>' + (l ? esc(userById(l.uid).name) + ' <span class="muted small">' + esc(l.uid) + '</span>' : '—') + '</td><td>' + (l ? fmtDT(l.due) + (l.due < S.now ? ' <span class="badge b-bad">overdue</span>' : '') : '—') + '</td>';
      if (isBorrower(me)) h += '<td><button data-action="reserve" data-id="' + i.id + '"' + (i.flag ? ' disabled' : '') + '>Reserve</button></td>';
      return h + '</tr>';
    }).join('') || '<tr><td colspan="9">No items match.</td></tr>';
    updateSync();
  }
  function updateSync() { const el = $('#sync-indicator'); if (el) el.innerHTML = '<span class="dot"></span>Live · last synced ' + Math.max(0, Math.round((Date.now() - lastSync) / 1000)) + ' s ago'; }

  /* --- Reserve dialog (R04, R11) --- */
  let rdItem = null;
  function openReserve(itemId) {
    const it = itemById(itemId); rdItem = it;
    $('#rd-item').textContent = it.name + ' (' + it.tag + ')';
    const per = it.loanType === 'in-makerspace only' ? 'same day only' : RULES.loanDays[me.group] + ' days';
    $('#rd-rules').textContent = 'Pickup at most ' + RULES.reserveAheadDays + ' days ahead; loan period ' + per + ' (BR-01, BR-02). Collect within ' + RULES.holdHours + ' h of pickup time or the reservation is released.';
    const p = $('#rd-pickup'), r = $('#rd-return');
    p.value = toInput(S.now + DAY); r.value = toInput(S.now + 2 * DAY);
    $('#rd-msg').textContent = ''; $('#rd-msg').className = 'msg';
    $('#reserve-dialog').showModal();
  }

  /* --- My loans & reservations (R06 visible here) --- */
  function myView() {
    const loans = S.loans.filter(l => l.uid === me.id).sort((a, b) => b.outAt - a.outAt);
    const res = S.reservations.filter(r => r.uid === me.id && !r.groupId).sort((a, b) => b.start - a.start);
    return '<div class="grid two"><div class="card"><h2>My loans</h2>' + (loans.length ? '<div class="tablewrap"><table><thead><tr><th>Item</th><th>Out</th><th>Due</th><th>Status</th></tr></thead><tbody>' +
      loans.slice(0, 12).map(l => { const it = itemById(l.itemId); const st = l.returnedAt ? '<span class="badge b-grey">returned ' + fmtDate(l.returnedAt) + '</span>' : (l.due < S.now ? '<span class="badge b-bad">overdue ' + Math.floor((S.now - l.due) / DAY) + ' d</span>' : '<span class="badge b-onloan">on loan</span>'); return '<tr><td>' + esc(it.name) + ' <span class="muted small">' + it.tag + '</span></td><td>' + fmtDate(l.outAt) + '</td><td>' + fmtDT(l.due) + '</td><td>' + st + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<p class="muted">No loans yet.</p>') + '</div>' +
      '<div class="card" data-req="R06"><h2>My reservations</h2>' + (res.length ? '<div class="tablewrap"><table><thead><tr><th>Item</th><th>Pickup</th><th>Return</th><th>Status</th></tr></thead><tbody>' +
      res.map(r => { const it = itemById(r.itemId); const b = { active: 'b-reserved', collected: 'b-grey', released: 'b-bad' }[r.status] || 'b-grey'; const label = r.status === 'released' ? 'released (not collected in time)' : r.status; return '<tr><td>' + esc(it.name) + ' <span class="muted small">' + it.tag + '</span></td><td>' + fmtDT(r.start) + '</td><td>' + fmtDate(r.end) + '</td><td><span class="badge ' + b + '">' + label + '</span></td></tr>'; }).join('') + '</tbody></table></div>' : '<p class="muted">No reservations.</p>') +
      '<p class="muted small">An uncollected reservation is released ' + RULES.holdHours + ' hours after the pickup time (BR-02). Use "+1 day" in the demo controls to see it.</p></div></div>';
  }

  /* --- R05 + R11: course reservation (lecturer) --- */
  function courseView() {
    const cats = [...new Set(S.items.map(i => i.category))];
    const groups = {}; S.reservations.filter(r => r.uid === me.id && r.groupId).forEach(r => { (groups[r.groupId] = groups[r.groupId] || []).push(r); });
    return '<div class="grid two"><div class="card" data-req="R05"><h1>Course reservation</h1>' +
      '<p class="muted">Reserve several units of one category for a course session (at most ' + RULES.courseMax + ' units, BR-03). All units are reserved together or not at all.</p>' +
      '<form id="course-form"><label>Course name <input type="text" id="c-name" value="Embedded Systems Lab" required></label>' +
      '<label>Category <select id="c-cat">' + cats.map(c => '<option>' + esc(c) + '</option>').join('') + '</select></label>' +
      '<label>Units <input type="number" id="c-qty" min="1" max="99" value="3"></label>' +
      '<label>Pickup date <input type="date" id="c-pick" value="' + toInput(S.now + 8 * DAY) + '"></label>' +
      '<label>Return date <input type="date" id="c-ret" value="' + toInput(S.now + 9 * DAY) + '"></label>' +
      '<button class="primary" type="submit">Reserve for course</button><div id="c-msg"></div></form></div>' +
      '<div class="card"><h2>My course reservations</h2>' + (Object.keys(groups).length ? '<table><thead><tr><th>Course</th><th>Category</th><th>Units</th><th>Pickup</th><th>Status</th></tr></thead><tbody>' +
      Object.values(groups).map(g => { const it = itemById(g[0].itemId); return '<tr><td>' + esc(g[0].course) + '</td><td>' + esc(it.category) + '</td><td>' + g.length + '</td><td>' + fmtDate(g[0].start) + '</td><td>' + [...new Set(g.map(x => x.status))].join(', ') + '</td></tr>'; }).join('') + '</tbody></table>' : '<p class="muted">None yet.</p>') + '</div></div>';
  }

  /* --- R07 / R08 / R09: loan desk --- */
  function deskView() {
    const borrowers = USERS.filter(isBorrower);
    const active = S.loans.filter(l => !l.returnedAt).sort((a, b) => a.due - b.due);
    const flagged = S.items.filter(i => i.flag);
    const pick = S.reservations.filter(r => r.status === 'active' && r.start <= S.now + DAY).sort((a, b) => a.start - b.start);
    return '<div class="grid two"><div class="card" data-req="R07"><h2>Check-out</h2>' +
      '<form id="checkout-form" autocomplete="off"><label>Borrower ID <input type="text" id="co-user" list="dl-users" placeholder="e.g. s1001" required></label>' +
      '<datalist id="dl-users">' + borrowers.map(u => '<option value="' + u.id + '">' + esc(u.name) + ' (' + u.group + ')</option>').join('') + '</datalist>' +
      '<label>Asset tag <input type="text" id="co-tag" list="dl-tags" placeholder="e.g. ML-0012" required></label>' +
      '<datalist id="dl-tags">' + S.items.map(i => '<option value="' + i.tag + '">' + esc(i.name) + '</option>').join('') + '</datalist>' +
      '<div class="row"><button class="primary" type="submit">Confirm check-out</button><span class="timer" id="tx-timer" data-req="R09">Timer: ready (target ≤ 60 s)</span></div>' +
      '<div id="co-msg" data-req="R11"></div></form></div>' +
      '<div class="card" data-req="R08"><h2>Check-in</h2>' +
      '<form id="checkin-form"><label>Loan <select id="ci-loan"><option value="">— choose —</option>' + active.map(l => { const it = itemById(l.itemId); return '<option value="' + l.id + '">' + it.tag + ' ' + esc(it.name) + ' — ' + esc(userById(l.uid).name) + (l.due < S.now ? ' (OVERDUE)' : '') + '</option>'; }).join('') + '</select></label>' +
      '<fieldset><legend>Condition</legend>' + RULES.conditions.map((c, i) => '<label class="inline"><input type="radio" name="ci-cond" value="' + c + '"' + (i === 0 ? ' checked' : '') + '> ' + c + '</label> ').join('') + '</fieldset>' +
      '<p><button class="primary" type="submit">Confirm check-in</button></p><div id="ci-msg"></div></form></div></div>' +
      '<div class="grid two"><div class="card" data-req="R08"><h2>Inspection list</h2>' + (flagged.length ? '<table><thead><tr><th>Item</th><th>Reason</th><th></th></tr></thead><tbody>' + flagged.map(i => '<tr><td>' + i.tag + ' ' + esc(i.name) + '</td><td>' + esc(i.flag) + '</td><td><button data-action="clearflag" data-id="' + i.id + '">Inspected — clear flag</button></td></tr>').join('') + '</tbody></table>' : '<p class="muted">No item is waiting for inspection.</p>') + '</div>' +
      '<div class="card"><h2>Reservations to collect (next 24 h)</h2>' + (pick.length ? '<table><thead><tr><th>Item</th><th>Borrower</th><th>Pickup</th></tr></thead><tbody>' + pick.map(r => { const it = itemById(r.itemId); return '<tr><td>' + it.tag + ' ' + esc(it.name) + '</td><td>' + esc(userById(r.uid).name) + (r.course ? ' <span class="muted small">(' + esc(r.course) + ')</span>' : '') + '</td><td>' + fmtDT(r.start) + '</td></tr>'; }).join('') + '</tbody></table>' : '<p class="muted">Nothing to collect.</p>') + '</div></div>';
  }
  function txTick() {
    const el = $('#tx-timer'); if (!el || tx.start == null) return;
    const s = (Date.now() - tx.start) / 1000;
    el.textContent = 'Timer: ' + s.toFixed(1) + ' s (target ≤ 60 s)'; el.classList.toggle('over', s > 60);
  }

  /* --- R14: overdue list --- */
  function overdueView() {
    const rows = S.loans.filter(l => !l.returnedAt && l.due < S.now).sort((a, b) => a.due - b.due);
    return '<div class="card" data-req="R14"><h1>Overdue loans</h1><p class="muted">Loans overdue by more than ' + RULES.lostAfterDays + ' days are flagged "presumed lost" and the manager is notified (BR-06).</p>' +
      (rows.length ? '<div class="tablewrap"><table><thead><tr><th>Borrower</th><th>Contact</th><th>Item</th><th>Due</th><th>Days overdue</th><th>Flag</th></tr></thead><tbody>' +
        rows.map(l => { const it = itemById(l.itemId), u = userById(l.uid), d = Math.floor((S.now - l.due) / DAY); return '<tr><td>' + esc(u.name) + '</td><td>' + esc(emailOf(u)) + '</td><td>' + it.tag + ' ' + esc(it.name) + '</td><td>' + fmtDT(l.due) + '</td><td>' + d + '</td><td>' + (l.presumedLost ? '<span class="badge b-bad">presumed lost</span>' : '') + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<p class="muted">No overdue loans.</p>') + '</div>';
  }

  /* --- R10: briefings --- */
  function briefingsView() {
    const can = me.role === 'safety' || (me.role === 'assistant' && me.designated);
    const borrowers = USERS.filter(isBorrower);
    const rows = S.briefings.slice().sort((a, b) => b.at - a.at);
    return '<div class="grid two"><div class="card" data-req="R10"><h1>Record a safety briefing</h1>' +
      '<p class="muted">Signed in as ' + esc(me.name) + ': ' + (can ? 'you may record briefings.' : '<strong>you are not designated by the safety officer and cannot record briefings.</strong>') + '</p>' +
      '<form id="briefing-form"><label>Borrower <select id="b-user">' + borrowers.map(u => '<option value="' + u.id + '">' + esc(u.name) + ' (' + u.id + ')</option>').join('') + '</select></label>' +
      '<label>Category <select id="b-cat">' + RULES.briefingCats.map(c => '<option>' + c + '</option>').join('') + '</select></label>' +
      '<button class="primary" type="submit">Record briefing</button><div id="b-msg"></div></form>' +
      '<p class="muted small">A briefing is valid for ' + RULES.briefingValidDays / 365 * 12 + ' months per category (BR-04).</p></div>' +
      '<div class="card"><h2>Briefing records</h2><table><thead><tr><th>Borrower</th><th>Category</th><th>Date</th><th>Recorded by</th><th>Valid</th></tr></thead><tbody>' +
      rows.map(b => { const ok = b.at + RULES.briefingValidDays * DAY > S.now; return '<tr><td>' + esc(userById(b.uid).name) + '</td><td>' + esc(b.category) + '</td><td>' + fmtDate(b.at) + '</td><td>' + esc(userById(b.by).name) + '</td><td>' + (ok ? '<span class="badge b-available">valid</span>' : '<span class="badge b-bad">expired</span>') + '</td></tr>'; }).join('') + '</tbody></table></div></div>';
  }

  /* --- R15: manager report --- */
  function reportsView() {
    return '<div class="card" data-req="R15"><h1>Manager report</h1>' +
      '<div class="filters"><label>From<br><input type="date" id="rp-from" value="' + toInput(S.now - 60 * DAY) + '"></label><label>To<br><input type="date" id="rp-to" value="' + toInput(S.now) + '"></label>' +
      '<button class="primary" data-action="report">Generate report</button><button data-action="csv">Download CSV</button></div>' +
      '<p class="muted small">Basis: loans checked out in the chosen period. Default period: the last 60 days.</p><div id="report-out"></div></div>';
  }
  function runReport() {
    const f = $('#rp-from'), t = $('#rp-to'), out = $('#report-out'); if (!f || !out) return;
    const r = report(f.value, t.value);
    const max = Math.max(1, ...Object.values(r.perCat));
    out.innerHTML = '<div class="grid three"><div class="card"><div class="stat" id="rp-total">' + r.loans.length + '</div>loans in period</div>' +
      '<div class="card"><div class="stat" id="rp-late">' + (r.returned ? Math.round(100 * r.late / r.returned) : 0) + ' %</div>returned late (' + r.late + ' of ' + r.returned + ' returned loans)</div>' +
      '<div class="card"><div class="stat" id="rp-damaged">' + r.problem.length + '</div>returned damaged or incomplete</div></div>' +
      '<h3>Loans per category</h3><table id="rp-cat"><tbody>' + Object.keys(r.perCat).sort().map(c => '<tr><td style="width:200px">' + esc(c) + '</td><td style="width:60px">' + r.perCat[c] + '</td><td><div class="bar" style="width:' + Math.round(100 * r.perCat[c] / max) + '%"></div></td></tr>').join('') + '</tbody></table>' +
      '<h3>Damaged, incomplete or presumed-lost items (with finance asset numbers)</h3>' + ((r.problem.length || r.lost.length) ? '<table id="rp-items"><thead><tr><th>Asset tag</th><th>Finance no.</th><th>Item</th><th>Event</th></tr></thead><tbody>' +
        r.problem.map(l => { const it = itemById(l.itemId); return '<tr><td>' + it.tag + '</td><td>' + it.finance + '</td><td>' + esc(it.name) + '</td><td>returned ' + l.condition + '</td></tr>'; }).join('') +
        r.lost.map(l => { const it = itemById(l.itemId); return '<tr><td>' + it.tag + '</td><td>' + it.finance + '</td><td>' + esc(it.name) + '</td><td>presumed lost</td></tr>'; }).join('') + '</tbody></table>' : '<p class="muted">None.</p>');
  }
  function downloadCsv() {
    const rep = report($('#rp-from').value, $('#rp-to').value);
    const blob = new Blob([csv(rep)], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'makerloan-report-' + $('#rp-from').value + '_' + $('#rp-to').value + '.csv'; document.body.appendChild(a); a.click(); a.remove();
    toast('CSV downloaded (' + rep.loans.length + ' loans).');
  }

  /* --- R13 (and R06/R14 notices): simulated e-mails --- */
  function outboxView() {
    const all = me.role === 'assistant' || me.role === 'manager';
    const rows = S.outbox.filter(n => all || n.to === me.id);
    return '<div class="card" data-req="R13"><h1>Notifications (simulated university e-mail)</h1><p class="muted">Reminder ' + RULES.reminderHours + ' h before the due time; overdue notice when overdue and every ' + RULES.overdueEveryHours / 24 + ' days after (BR-05). ' + (all ? 'Staff see all messages.' : 'You see your own messages.') + '</p>' +
      (rows.length ? rows.slice(0, 60).map(n => '<div class="email"><div class="meta">' + fmtDT(n.at) + ' · to ' + esc(n.toName) + ' &lt;' + esc(n.toEmail) + '&gt; · ' + esc(n.type) + '</div><strong>' + esc(n.subject) + '</strong><div>' + esc(n.body) + '</div></div>').join('') : '<p class="muted">No messages.</p>') + '</div>';
  }

  /* ---------- Events ---------- */
  document.addEventListener('click', e => {
    const nav = e.target.closest('[data-view]'); if (nav) { view = nav.dataset.view; render(); return; }
    const a = e.target.closest('[data-action]'); if (!a) return;
    const act = a.dataset.action;
    if (act === 'login') { me = userById(a.dataset.id); sessionStorage.setItem('makerloan.user', me.id); view = NAV[me.role][0][0]; render(); }
    else if (act === 'logout') { me = null; sessionStorage.removeItem('makerloan.user'); render(); }
    else if (act === 'reserve') openReserve(a.dataset.id);
    else if (act === 'adv') { advance(parseInt(a.dataset.h, 10)); render(); toast('Clock advanced: ' + fmtDT(S.now)); }
    else if (act === 'reset') { if (confirm('Reset all demo data?')) { localStorage.removeItem(KEY); seed(); save(); render(); toast('Demo data reset.'); } }
    else if (act === 'clearflag') { const r = clearFlag(me, a.dataset.id); toast(r.msg); render(); }
    else if (act === 'report') runReport();
    else if (act === 'csv') downloadCsv();
  });

  document.addEventListener('input', e => {
    const id = e.target.id;
    if (id === 'f-q') { F.q = e.target.value; renderCatalogRows(); }
    else if ((id === 'co-user' || id === 'co-tag') && tx.start == null) { tx.start = Date.now(); clearInterval(tx.timer); tx.timer = setInterval(txTick, 200); }
  });
  document.addEventListener('change', e => {
    const id = e.target.id;
    if (id === 'f-cat') { F.cat = e.target.value; renderCatalogRows(); }
    else if (id === 'f-type') { F.type = e.target.value; renderCatalogRows(); }
    else if (id === 'f-status') { F.status = e.target.value; renderCatalogRows(); }
    else if (id === 'rp-from' || id === 'rp-to') runReport();
  });

  document.addEventListener('submit', e => {
    const id = e.target.id;
    if (id === 'reserve-form') {
      e.preventDefault();
      const r = reserve(me, rdItem.id, $('#rd-pickup').value, $('#rd-return').value);
      const m = $('#rd-msg'); m.textContent = (r.ok ? '✔ ' : '✖ ') + r.msg; m.className = 'msg ' + (r.ok ? 'okm' : 'err');
      if (r.ok) { render(); setTimeout(() => $('#reserve-dialog').close(), 1400); }
    } else if (id === 'course-form') {
      e.preventDefault();
      const r = courseReserve(me, { course: $('#c-name').value, category: $('#c-cat').value, qty: $('#c-qty').value, pickup: $('#c-pick').value, ret: $('#c-ret').value });
      if (r.ok) { render(); } $('#c-msg').innerHTML = msgHtml(r);
    } else if (id === 'checkout-form') {
      e.preventDefault();
      const r = checkout(me, $('#co-user').value, $('#co-tag').value);
      const secs = tx.start != null ? (Date.now() - tx.start) / 1000 : 0;
      clearInterval(tx.timer); tx.start = null;
      if (r.ok) { render(); $('#co-msg').innerHTML = msgHtml(r) + '<p class="timer ' + (secs > 60 ? 'over' : '') + '" id="tx-last" data-req="R09">Last transaction: ' + secs.toFixed(1) + ' s (target ≤ 60 s) ' + (secs <= 60 ? '✔' : '✖') + '</p>'; }
      else { $('#co-msg').innerHTML = msgHtml(r); $('#tx-timer').textContent = 'Timer: ready (target ≤ 60 s)'; }
    } else if (id === 'checkin-form') {
      e.preventDefault();
      const cond = (document.querySelector('input[name="ci-cond"]:checked') || {}).value;
      const r = checkin(me, $('#ci-loan').value, cond);
      if (r.ok) { render(); } $('#ci-msg').innerHTML = msgHtml(r);
    } else if (id === 'briefing-form') {
      e.preventDefault();
      const r = recordBriefing(me, $('#b-user').value, $('#b-cat').value);
      if (r.ok) { render(); } $('#b-msg').innerHTML = msgHtml(r);
    }
  });
  $('#rd-cancel').addEventListener('click', () => $('#reserve-dialog').close());
  $('#tags-toggle').addEventListener('change', e => { document.body.classList.toggle('show-tags', e.target.checked); try { sessionStorage.setItem('makerloan.tags', e.target.checked ? '1' : ''); } catch (x) { /* ignore */ } });

  /* ---------- R02: live status across tabs (storage events + 2 s polling) ---------- */
  function refreshExternal() {
    lastSync = Date.now();
    renderChrome();
    if (!me) return;
    if (view === 'catalog') { renderCatalogRows(); return; }
    const ae = document.activeElement;
    const typing = ae && /^(INPUT|SELECT|TEXTAREA)$/.test(ae.tagName) && $('#main').contains(ae);
    if (!typing && view !== 'reports') render();
  }
  window.addEventListener('storage', e => { if (e.key === KEY && e.newValue) { S = JSON.parse(e.newValue); refreshExternal(); } });
  setInterval(() => {
    const raw = localStorage.getItem(KEY);
    if (raw) { const rev = JSON.parse(raw).rev; if (rev !== S.rev) { S = JSON.parse(raw); refreshExternal(); } else lastSync = Date.now(); }
    updateSync();
  }, 2000);
  setInterval(updateSync, 1000);

  /* ---------- Boot ---------- */
  load();
  try { const u = sessionStorage.getItem('makerloan.user'); if (u) me = userById(u); if (sessionStorage.getItem('makerloan.tags')) { document.body.classList.add('show-tags'); $('#tags-toggle').checked = true; } } catch (x) { /* ignore */ }
  render();

  // Exposed for the automated tests in README (not used by the UI)
  window.ML = { RULES, state: () => S, users: USERS, ops: { reserve, courseReserve, checkout, checkin, clearFlag, recordBriefing, report, csv, advance, statusOf, userById, itemByTag, tick }, reset: () => { localStorage.removeItem(KEY); seed(); save(); render(); } };
})();
