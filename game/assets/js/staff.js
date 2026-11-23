import { career, saveCareer, STAFF } from './career.js';
import { profile, saveProfile } from './profile.js';

export const ROLES = STAFF;

function state() {
  career.data.staffState = career.data.staffState || {};
  return career.data.staffState;
}

export function ensureStaff() {
  const s = state();
  for (const id of career.data.staff || []) {
    if (!s[id]) s[id] = { fatigue: 24, rest: 0, trained: 0, shifts: 0, since: Date.now() };
  }
  return s;
}

export function tickStaff() {
  const s = ensureStaff();
  for (const id of Object.keys(s)) {
    const x = s[id];
    if (!(career.data.staff || []).includes(id)) { delete s[id]; continue; }
    if (x.rest > 0) {
      x.rest -= 1;
      x.fatigue = Math.max(0, x.fatigue - 42);
      if (x.rest <= 0) x.fatigue = Math.max(8, x.fatigue);
    } else {
      x.shifts += 1;
      x.fatigue = Math.min(100, x.fatigue + 15 + (x.shifts % 4 === 0 ? 4 : 0));
      if (x.fatigue >= 90) x.rest = 2;
    }
  }
  saveCareer();
  return s;
}

export function staffRow(id) {
  const s = ensureStaff()[id] || { fatigue: 30, rest: 0, trained: 0, shifts: 0 };
  return { ...s, id, role: ROLES.find((x) => x.id === id) || { name: id, effect: '' } };
}

export function restStaff(id, days = 2) {
  const s = ensureStaff()[id];
  if (!s) return { ok: false, msg: '不在岗' };
  if (s.rest) return { ok: false, msg: '已经在休班' };
  s.rest = Math.max(1, days);
  saveCareer();
  return { ok: true, msg: `已安排休班 ${s.rest} 班` };
}

export function recallStaff(id) {
  const s = ensureStaff()[id];
  if (!s || !s.rest) return { ok: false, msg: '没有在休班' };
  s.rest = 0;
  s.fatigue = Math.max(30, s.fatigue);
  saveCareer();
  return { ok: true, msg: '提前归队，疲劳没有完全恢复' };
}

export function trainStaff(id) {
  const s = ensureStaff()[id];
  if (!s) return { ok: false, msg: '不在岗' };
  if (s.rest) return { ok: false, msg: '休班期间不能培训' };
  if (s.trained >= 3) return { ok: false, msg: '已经到顶' };
  if (profile.data.credits < 2000) return { ok: false, msg: '培训需要 ¥2000' };
  profile.data.credits -= 2000;
  s.trained += 1;
  s.fatigue = Math.min(100, s.fatigue + 4);
  saveProfile();
  saveCareer();
  return { ok: true, msg: `培训完成，等级 ${s.trained}/3，下一班效率略升` };
}

export function staffReady(id) {
  const s = ensureStaff()[id];
  return !!s && !s.rest && s.fatigue < 90;
}

export function staffEfficiency() {
  const rows = (career.data.staff || []).map((id) => staffRow(id));
  if (!rows.length) return 1;
  const ready = rows.filter((x) => !x.rest && x.fatigue < 90).length;
  return Math.max(0.5, ready / rows.length);
}
