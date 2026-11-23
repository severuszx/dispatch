import { career, saveCareer } from './career.js';
import { profile, saveProfile } from './profile.js';
import { applyLedger } from './economy.js';
import { settleShift } from './profile.js';
import { choosePolicy } from './review.js';

function fakeShift(i, quality) {
  const total = 10;
  const lateCount = Math.max(0, Math.round((1 - quality) * total * 0.55));
  const trains = [];
  for (let k = 0; k < total; k += 1) {
    trains.push({
      id: `B${i}-${k}`, no: k % 3 === 0 ? `K${100 + i * 2 + k}` : `X${200 + i + k}`,
      type: k % 3 === 0 ? 'K' : 'X', freight: k % 3 !== 0, coaches: 36 + (k % 5) * 6,
      status: k < 7 ? 'terminated' : 'running', late: k < lateCount ? 4 + (k % 7) : (k % 4 === 0 ? 2 : 0),
    });
  }
  const incidents = i % 19 === 0 ? 1 : 0;
  return {
    trains, alarms: incidents ? [{ level: 'danger' }] : [], decisions: [],
    metrics: { total, incidents }, focusStation: 'qinglan',
    stationOrder: ['qinglan', 'baishu', 'heyuan', 'lingkou'],
    startClock: 360, clock: 600, line: { name: '沙盒线' }, trafficDelay: {},
  };
}

export function runBalance(n = 100) {
  profile.data.credits = 1200;
  profile.data.reputation = 50;
  profile.data.xp = 0;
  profile.data.stats = { shifts: 0, onTime: 0, late: 0, income: 0, incidents: 0, cleanStreak: 0, nightShifts: 0, bestPunctuality: 0, exports: 0, totalMinutes: 0, stars: 0 };
  career.data.shiftIndex = 0;
  career.data.ledger = [];
  career.data.weeks = [];
  career.data.rating = '';
  career.data.policies = [];
  career.data.policyPending = null;
  career.data.rectify = { active: false, left: 0 };
  career.data.superior = 70;
  career.data.equipmentAge = 0;
  career.data.contracts = [];
  career.data.builds = [];
  career.data.built = [];
  career.data.staff = [];
  career.data.dlc = {};
  career.data.traffic = {};
  career.data.carryDelay = {};
  career.data.daily = [];
  career.data.yard = null;
  saveCareer();
  saveProfile();

  const rows = [];
  const ratings = [];
  let rectifies = 0;
  let minCredits = profile.data.credits;
  let maxDebt = 0;
  for (let i = 0; i < n; i += 1) {
    const quality = 0.72 + (i % 7) * 0.035;
    const sim = fakeShift(i, Math.min(0.94, quality));
    const L = applyLedger(sim, { title: '百班沙盒', difficulty: 2, duration: 300 });
    settleShift(sim, { title: '百班沙盒', difficulty: 2, duration: 300 }, L.net);
    const pending = career.data.policyPending;
    if (pending) {
      const pick = pending.options.find((x) => x !== 'renew') || pending.options[0];
      const r = choosePolicy(pick);
      if (r.ok) ratings.push(`${career.data.rating}:${r.policy.name}`);
    }
    if (career.data.rectify && career.data.rectify.active) rectifies += 1;
    minCredits = Math.min(minCredits, profile.data.credits);
    maxDebt = Math.min(maxDebt, profile.data.credits);
    rows.push({ shift: i + 1, net: L.net, p: L.punctuality, credits: profile.data.credits, rating: career.data.rating });
  }
  const avgNet = Math.round(rows.reduce((a, x) => a + x.net, 0) / rows.length);
  const avgP = Math.round(rows.reduce((a, x) => a + x.p, 0) / rows.length);
  const endCredits = profile.data.credits;
  const weekRatings = (career.data.weeks || []).map((x) => x.rating);
  return {
    shifts: n, startCredits: 1200, endCredits, minCredits, maxDebt, avgNet, avgP,
    weeks: careers(), weekRatings, ratings, rectifyShifts: rectifies,
    finalSuperior: career.data.superior, finalAge: career.data.equipmentAge,
    rows: rows.filter((_, i) => i % 10 === 0 || i === n - 1),
  };
}

function careers() {
  return (career.data.weeks || []).length;
}
