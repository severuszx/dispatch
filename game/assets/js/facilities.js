import { career, saveCareer } from './career.js';
import { profile, saveProfile } from './profile.js';

const NAMES = { qinglan: '宝鸡', baishu: '秦岭', heyuan: '凤县', lingkou: '略阳' };

const PLAN = [
  ['道岔', 60, '转辙机'], ['信号机', 55, '灯列'], ['轨道电路', 40, '区段'], ['站台设施', 20, '雨棚/座椅'],
  ['货运设备', 20, '装卸机具'], ['站房建筑', 20, '房屋'], ['供电设备', 15, '变压器/电缆'],
  ['气象设施', 10, '融雪/排水'], ['安全设施', 10, '消防/防溜'],
];

function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function make() {
  const out = [];
  for (const [id, name] of Object.entries(NAMES)) {
    for (const [kind, count, sub] of PLAN) {
      for (let i = 1; i <= count; i += 1) {
        const h = hash(`${id}-${kind}-${i}`);
        const status = h % 97 === 0 ? '停用' : h % 23 === 0 ? '待修' : h % 7 === 0 ? '观察' : '正常';
        out.push({
          id: `${id}-${kind}-${i}`.replace(/\s/g, ''),
          station: id,
          name: `${name}${kind} ${i}`, kind, sub,
          status,
          age: 3 + (h % 28),
          grade: h % 5 === 0 ? 'A' : h % 3 === 0 ? 'B' : 'C',
        });
      }
    }
  }
  return out;
}

export const FACILITIES = make();

export function facilitiesFor(station) {
  return FACILITIES.filter((x) => x.station === (station || career.data.currentStation));
}

function fixed(id) {
  return (career.data.facilityFix || {})[id] === true;
}

export function facilityCost(id) {
  const f = FACILITIES.find((x) => x.id === id);
  if (!f) return 0;
  return f.grade === 'A' ? 1800 : f.grade === 'B' ? 1200 : 800;
}

export function repairFacility(id) {
  const f = FACILITIES.find((x) => x.id === id);
  if (!f) return { ok: false, msg: '没有这项设施' };
  if (f.status === '正常' || fixed(id)) return { ok: false, msg: '不用修' };
  const cost = facilityCost(id);
  if (profile.data.credits < cost) return { ok: false, msg: `资金不足，还差 ${cost - profile.data.credits}` };
  profile.data.credits -= cost;
  career.data.facilityFix = career.data.facilityFix || {};
  career.data.facilityFix[id] = true;
  saveProfile();
  saveCareer();
  return { ok: true, msg: `${f.name} 已修复，支出 ¥${cost}` };
}

export function facilityStats(station) {
  const all = facilitiesFor(station);
  const live = all.filter((x) => !fixed(x.id));
  const bad = live.filter((x) => x.status === '待修' || x.status === '停用');
  return { total: all.length, live: live.length, bad: bad.length, watch: live.filter((x) => x.status === '观察').length, list: bad.slice(0, 8) };
}

export function facilityRisk(station) {
  const s = facilityStats(station);
  return s.total ? Math.min(0.08, s.bad / s.total * 0.22) : 0;
}

export function globalFacilityStats() {
  const live = FACILITIES.filter((x) => !fixed(x.id));
  const bad = live.filter((x) => x.status === '待修' || x.status === '停用').length;
  return { total: FACILITIES.length, bad, watch: live.filter((x) => x.status === '观察').length };
}
