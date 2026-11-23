const KEY = 'tst-dispatch-career';

export const UPGRADES = [
  { id: 'signal', name: '信号与联锁', effect: '随机设备故障率每级 -7%', max: 5, base: 450, step: 320 },
  { id: 'platform', name: '站台与乘降', effect: '客运乘降每级 -1 分钟', max: 5, base: 380, step: 260 },
  { id: 'track', name: '股道与道岔', effect: '调车、摘挂每级 -1 分钟', max: 5, base: 520, step: 300 },
  { id: 'crew', name: '班组与引导', effect: '站外待接红线每级 +2 分钟', max: 5, base: 620, step: 380 },
  { id: 'service', name: '客货服务', effect: '班末收入每级 +6%', max: 5, base: 700, step: 420 },
];

export const STAFF = [
  { id: 'dispatcher', name: '副调度', cost: 900, effect: '每 30 分钟提示一次最紧迫的列车' },
  { id: 'guide', name: '引导员', cost: 700, effect: '信号故障时可人工引导接车' },
  { id: 'shunter', name: '调车长', cost: 800, effect: '调车作业每趟少 1 分钟' },
  { id: 'clerk', name: '站务员', cost: 600, effect: '乘降作业少 1 分钟' },
];

const DEFAULT = {
  version: 1,
  station: '',
  name: '青岚站',
  level: 1,
  xp: 0,
  upgrades: { signal: 0, platform: 0, track: 0, crew: 0, service: 0 },
  staff: [],
  decor: [],
  unlocked: [],
  business: true,
  electrified: true,
  currentStation: 'qinglan',
  superior: 70,
  equipmentAge: 0,
  builds: [],
  built: [],
  maint: 0,
  crews: 0,
  contracts: [],
  ledger: [],
  daily: [],
  shiftIndex: 0,
  dayNet: 0,
  staffNames: {},
  staffState: {},
  lastShift: null,
  traffic: {},
  policies: [],
  policyPending: null,
  rectify: { active: false, left: 0 },
  weeks: [],
  rating: '',
  region: { relief: null },
  facilityFix: {},
  emu: { sets: {} },
  port: { lines: { std: true, broad: false, narrow: false }, customs: 0, pending: 0, lastRevenue: 0, settled: 0 },
};

function clean(raw) {
  const base = JSON.parse(JSON.stringify(DEFAULT));
  if (!raw || typeof raw !== 'object') return base;
  const out = { ...base, ...raw };
  out.upgrades = { ...base.upgrades, ...(raw.upgrades || {}) };
  out.staff = Array.isArray(raw.staff) ? raw.staff.filter((x) => STAFF.some((s) => s.id === x)) : [];
  out.decor = Array.isArray(raw.decor) ? raw.decor : [];
  out.unlocked = Array.isArray(raw.unlocked) ? raw.unlocked : [];
  out.builds = Array.isArray(raw.builds) ? raw.builds : [];
  out.built = Array.isArray(raw.built) ? raw.built : [];
  out.contracts = Array.isArray(raw.contracts) ? raw.contracts : [];
  out.ledger = Array.isArray(raw.ledger) ? raw.ledger : [];
  out.daily = Array.isArray(raw.daily) ? raw.daily : [];
  out.staffNames = raw.staffNames && typeof raw.staffNames === 'object' ? raw.staffNames : {};
  out.staffState = raw.staffState && typeof raw.staffState === 'object' ? raw.staffState : {};
  out.traffic = raw.traffic && typeof raw.traffic === 'object' ? raw.traffic : {};
  out.policies = Array.isArray(raw.policies) ? raw.policies : [];
  out.policyPending = raw.policyPending && typeof raw.policyPending === 'object' ? raw.policyPending : null;
  out.rectify = raw.rectify && typeof raw.rectify === 'object' ? raw.rectify : { active: false, left: 0 };
  out.weeks = Array.isArray(raw.weeks) ? raw.weeks : [];
  out.region = raw.region && typeof raw.region === 'object' ? raw.region : { relief: null };
  out.facilityFix = raw.facilityFix && typeof raw.facilityFix === 'object' ? raw.facilityFix : {};
  out.emu = raw.emu && typeof raw.emu === 'object' ? raw.emu : { sets: {} };
  out.port = raw.port && typeof raw.port === 'object' ? raw.port : { lines: { std: true, broad: false, narrow: false }, customs: 0, pending: 0, lastRevenue: 0, settled: 0 };
  return out;
}

function read() {
  try { return clean(JSON.parse(localStorage.getItem(KEY) || 'null')); } catch (e) { return clean(null); }
}

export const career = { data: read() };

export function loadCareer() {
  career.data = read();
  return career.data;
}

export function saveCareer() {
  try { localStorage.setItem(KEY, JSON.stringify(career.data)); } catch (e) { /* ignored */ }
}

export function importCareer(raw) {
  career.data = clean(raw);
  saveCareer();
  return career.data;
}

export function resetCareer() {
  career.data = clean(null);
  saveCareer();
}

export function upgradeCost(id) {
  const u = UPGRADES.find((x) => x.id === id);
  if (!u) return 0;
  const lv = Number(career.data.upgrades[id]) || 0;
  return u.base + u.step * lv;
}

export function canUpgrade(id) {
  const u = UPGRADES.find((x) => x.id === id);
  if (!u) return false;
  return (Number(career.data.upgrades[id]) || 0) < u.max;
}

export function buyUpgrade(id, credits) {
  const u = UPGRADES.find((x) => x.id === id);
  if (!u) return { ok: false, msg: '没有这项设备' };
  const lv = Number(career.data.upgrades[id]) || 0;
  if (lv >= u.max) return { ok: false, msg: '已到最高等级' };
  const cost = upgradeCost(id);
  if (credits < cost) return { ok: false, msg: `资金不足，还差 ¥${cost - credits}` };
  career.data.upgrades[id] = lv + 1;
  career.data.level = 1 + Object.values(career.data.upgrades).reduce((a, b) => a + Number(b || 0), 0);
  saveCareer();
  return { ok: true, msg: `${u.name} 升到 ${lv + 1} 级`, cost };
}

export function hireStaff(id, credits) {
  const s = STAFF.find((x) => x.id === id);
  if (!s) return { ok: false, msg: '没有这个岗位' };
  if (career.data.staff.includes(id)) return { ok: false, msg: '已在本站任职' };
  if (credits < s.cost) return { ok: false, msg: `资金不足，还差 ¥${s.cost - credits}` };
  career.data.staff.push(id);
  career.data.level = 1 + Object.values(career.data.upgrades).reduce((a, b) => a + Number(b || 0), 0) + career.data.staff.length;
  saveCareer();
  return { ok: true, msg: `${s.name} 已到岗`, cost: s.cost };
}

export function careerLevel(id) {
  return Number(career.data.upgrades[id]) || 0;
}

export function staffHas(id) {
  if (!career.data.staff.includes(id)) return false;
  const s = (career.data.staffState || {})[id];
  return !s || (!s.rest && s.fatigue < 90);
}

export function careerFactor(kind) {
  if (!career.data.business) return 0;
  if (kind === 'signal') return Math.min(0.35, careerLevel('signal') * 0.07);
  if (kind === 'platform') return careerLevel('platform') + (staffHas('clerk') ? 1 + Math.min(1, (career.data.staffState?.clerk?.trained || 0) > 0 ? 1 : 0) : 0);
  if (kind === 'track') return careerLevel('track') + (staffHas('shunter') ? 1 + Math.min(1, (career.data.staffState?.shunter?.trained || 0) > 0 ? 1 : 0) : 0);
  if (kind === 'crew') return careerLevel('crew') * 2;
  if (kind === 'income') return 1 + careerLevel('service') * 0.06;
  return 0;
}

export function careerSnapshot() {
  return {
    ...career.data,
    level: 1 + Object.values(career.data.upgrades).reduce((a, b) => a + Number(b || 0), 0) + career.data.staff.length,
    costs: Object.fromEntries(UPGRADES.map((u) => [u.id, upgradeCost(u.id)])),
  };
}

export function setStationName(name) {
  if (name) career.data.name = String(name).slice(0, 20);
  saveCareer();
}

export function settleCareer(info) {
  career.data.lastShift = { ...info, at: Date.now() };
  career.data.xp += Math.max(0, Math.round((info.punctuality || 0) / 4));
  saveCareer();
}
