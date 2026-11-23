import { career, saveCareer } from './career.js';
import { operatingLock } from './review.js';
import { profile, saveProfile } from './profile.js';

const POOL = [
  { id: 'lk1', type: '临客', name: '周末临客 K+', reward: 1800, cost: 0, days: 3, risk: '挤占股道，晚点罚款翻倍', kpi: '准点率', color: 'warn', extra: 1, grade: 'K' },
  { id: 'lk2', type: '临客', name: '节假日加班临客', reward: 3200, cost: 0, days: 2, risk: '客流骤增，投诉风险', kpi: '投诉数', color: 'warn', extra: 2, grade: 'K' },
  { id: 'fr1', type: '货运', name: '建材包车 20 车', reward: 2400, cost: 0, days: 4, risk: '占用货物线，装卸超时', kpi: '货运量', color: 'good', extra: 1, grade: 'X' },
  { id: 'fr2', type: '货运', name: '冷链包车 8 车', reward: 3600, cost: 0, days: 3, risk: '冷链断链，货损索赔', kpi: '货损率', color: 'good', extra: 1, grade: 'X' },
  { id: 'fr3', type: '货运', name: '煤炭直达 40 车', reward: 4200, cost: 0, days: 4, risk: '扬尘投诉，股道占用大', kpi: '环保', color: 'good', extra: 1, grade: 'X' },
  { id: 'zy1', type: '专运', name: '重点列车警卫任务', reward: 6000, cost: 0, days: 1, risk: '零容错，一次晚点即违约', kpi: '安全', color: 'bad', extra: 1, grade: 'Z' },
  { id: 'ad1', type: '广告', name: '站台灯箱广告', reward: 900, cost: 0, days: 7, risk: '内容违规，撤换损失', kpi: '声誉', color: 'plain', extra: 0, grade: '' },
  { id: 'sh1', type: '商铺', name: '便利店入驻', reward: 1200, cost: 0, days: 7, risk: '价格投诉', kpi: '投诉数', color: 'plain', extra: 0, grade: '' },
  { id: 'bl1', type: '保底', name: '铁路局保底车次', reward: 1500, cost: 0, days: 5, risk: '完不成扣拨款', kpi: '接发列数', color: 'plain', extra: 0, grade: '' },
  { id: 'zx1', type: '专运', name: '超限货物专列', reward: 5200, cost: 0, days: 2, risk: '限界校验失败，全线封锁', kpi: '安全', color: 'bad', extra: 1, grade: 'X' },
];

function rng(seed) {
  let x = seed;
  return () => {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    return x / 0x7fffffff;
  };
}

export function refreshOffers() {
  const day = Math.floor((career.data.shiftIndex || 0) / 3);
  const r = rng(day * 97 + 13);
  const arr = POOL.slice();
  const out = [];
  while (out.length < 3 && arr.length) {
    const i = Math.floor(r() * arr.length);
    out.push({ ...arr.splice(i, 1)[0] });
  }
  career.data.offers = out.map((o, i) => ({ ...o, slot: i }));
  saveCareer();
  return career.data.offers;
}

export function offers() {
  if (!career.data.offers || !career.data.offers.length) return refreshOffers();
  return career.data.offers;
}

export function sign(id) {
  const offer = offers().find((o) => o.id === id);
  if (!offer) return { ok: false, msg: '合同已刷新' };
  const lock = operatingLock();
  if (lock.active) return { ok: false, msg: lock.text };
  if ((career.data.contracts || []).some((c) => c.id === id)) return { ok: false, msg: '已签过这份合同' };
  if ((career.data.contracts || []).length >= 2 + (career.data.crews || 0)) return { ok: false, msg: '合同槽位已满，先完成或放弃一份' };
  career.data.contracts.push({ ...offer, left: offer.days, signedAt: Date.now() });
  career.data.offers = offers().filter((o) => o.id !== id);
  saveCareer();
  return { ok: true, msg: `已签：${offer.name}` };
}

export function drop(id) {
  career.data.contracts = (career.data.contracts || []).filter((c) => c.id !== id);
  saveCareer();
}

export function tickContracts(sim, ledger) {
  const keep = [];
  const expired = [];
  const punctual = ledger ? ledger.punctuality : 100;
  const incidents = ledger ? ledger.incidents : 0;
  for (const c of career.data.contracts || []) {
    c.left -= 1;
    let failed = false;
    if (c.type === '专运') failed = punctual < 100 || incidents > 0;
    else if (c.type === '临客') failed = punctual < 92;
    else if (c.type === '货运') failed = punctual < 88;
    if (failed) { c.failed = true; c.failNote = `${c.type}履约不达标：准点 ${punctual}%，事故 ${incidents}`; }
    if (c.left > 0) keep.push(c);
    else expired.push(c);
  }
  career.data.contracts = keep;
  const bad = expired.filter((c) => c.failed).length;
  if (bad) {
    profile.data.reputation = Math.max(0, profile.data.reputation - bad * 4);
    profile.data.credits -= bad * 1200;
    saveProfile();
  }
  if (expired.length) saveCareer();
  return expired;
}

export function contractTrains(lineId) {
  const active = (career.data.contracts || []).filter((c) => c.extra > 0);
  return active.slice(0, 3).map((c, idx) => {
    const base = 360 + idx * 55;
    return {
      id: `ct-${c.id}-${idx}`, no: `${c.grade || 'K'}${8800 + idx}`, type: c.grade || 'K',
      from: 'qinglan', to: 'lingkou', dep: base, arr: base + 120, dwell: 4, priority: 2,
      stockGroup: 'S1', crew: 1, coaches: c.type === '货运' ? 24 : 16, special: c.type === '专运',
      stops: [
        { st: 'qinglan', arr: null, dep: base },
        { st: 'baishu', arr: base + 42, dep: base + 46 },
        { st: 'heyuan', arr: base + 82, dep: base + 86 },
        { st: 'lingkou', arr: base + 120, dep: null },
      ],
      contract: c.id,
    };
  });
}
