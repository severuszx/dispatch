import { career, saveCareer, STAFF } from './career.js';
import { profile, saveProfile } from './profile.js';
import { incomeExtra, maintenanceFor, isBuilt } from './upgrades.js';
import { settleWeek, checkRectify, policyMod } from './review.js';
import { yardCost } from './yard.js';
import { carryTraffic } from './traffic.js';
import { tickRegion } from './bureau.js';
import { linePackCount, dlcOn } from './dlc.js';
import { emuService, tickEmu } from './emu.js';
import { portSnapshot, tickPort } from './port.js';
import { tickStaff } from './staff.js';

export const PRICING = {
  passenger: 1.2,
  freight: 0.2,
  transit: 60,
  subsidy: 3000,
  fineLate: 120,
  fineDanger: 350,
  fineIncident: 900,
};

function seed(str) {
  let h = 0;
  for (let i = 0; i < str.length; i += 1) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

export function ledgerFor(sim, scene) {
  const lines = [];
  const terminated = (sim.trains || []).filter((t) => t.status === 'terminated');
  const passenger = terminated.filter((t) => ['K', 'T', 'Z', 'D', 'G'].includes(t.type) || /^[KTZ]$/.test(t.no || ''));
  const freight = terminated.filter((t) => ['X', '货', 'N', 'G'].includes(t.type));
  let board = 0;
  passenger.forEach((t) => {
    const n = 40 + (seed(t.no || t.id) % 140);
    board += n;
    lines.push({ kind: 'in', type: '客运分成', name: `${t.no} 停靠分成`, amount: Math.round(n * PRICING.passenger), ref: t.no });
  });
  freight.forEach((t) => {
    const tons = (t.coaches || 40) * 58;
    lines.push({ kind: 'in', type: '货运装卸', name: `${t.no} 装卸 ${tons}t`, amount: Math.round(tons * PRICING.freight), ref: t.no });
  });
  const transit = (sim.trains || []).length - terminated.length;
  if (transit > 0) lines.push({ kind: 'in', type: '过路费', name: `通过/待接 ${transit} 列`, amount: transit * PRICING.transit });
  const subsidyBase = PRICING.subsidy + (scene.difficulty || 2) * 800;
  lines.push({ kind: 'in', type: '上级拨款', name: '按站等定额', amount: subsidyBase });
  const rent = incomeExtra(sim.focusStation) + (career.data.staff.includes('clerk') ? 180 : 0);
  if (rent) lines.push({ kind: 'in', type: '副业收入', name: '商铺/广告/停车', amount: rent });
  const linePacks = linePackCount();
  if (linePacks) lines.push({ kind: 'in', type: '线路通行', name: `${linePacks} 条接入线`, amount: linePacks * 900 });
  if (dlcOn('emu')) { const em = emuService(); lines.push({ kind: 'in', type: '动车组服务', name: `可用 ${em.ready}/${em.total} 组`, amount: em.revenue }); }
  if (dlcOn('port')) { const pt = portSnapshot(); lines.push({ kind: 'in', type: '口岸联运', name: `换装 ${pt.cleared}/${pt.queue} 车`, amount: pt.revenue }); }

  const yardFee = yardCost();
  if (yardFee > 0) lines.push({ kind: 'out', type: '编组滞车', name: `四场积压 ${yardFee / 18} 车`, amount: yardFee });
  const staffCost = 2400 + (career.data.staff || []).length * 520;
  lines.push({ kind: 'out', type: '工资', name: `在岗 ${2 + (career.data.staff || []).length} 人`, amount: staffCost });
  const maint = Math.max(200, 1800 + Math.round(maintenanceFor(sim.focusStation) / 3) + Math.round((career.data.equipmentAge || 0) * 12) + policyMod('maint'));
  lines.push({ kind: 'out', type: '设备维护', name: '信号/道岔/股道/站台', amount: maint });
  const utilities = 760 + Math.round(board * 0.9) + (isBuilt('biz_4', sim.focusStation) ? -220 : 0);
  lines.push({ kind: 'out', type: '水电暖', name: '固定 + 客流', amount: Math.max(200, utilities) });
  const late = (sim.trains || []).filter((t) => (t.late || 0) > 3).length;
  const danger = (sim.alarms || []).filter((a) => a.level === 'danger').length;
  const incidents = sim.metrics.incidents || 0;
  if (late) lines.push({ kind: 'out', type: '晚点罚款', name: `${late} 列超 3 分`, amount: late * PRICING.fineLate });
  if (danger) lines.push({ kind: 'out', type: '安全罚款', name: `${danger} 条紧急报警`, amount: danger * PRICING.fineDanger });
  if (incidents) lines.push({ kind: 'out', type: '事故罚款', name: `${incidents} 起责任事故`, amount: incidents * PRICING.fineIncident });
  if (dlcOn('emergency') && incidents) lines.push({ kind: 'out', type: '联合处置', name: '安监/公安/救援联合调查', amount: incidents * 1500 });
  const builtCost = (career.data.builds || []).reduce((a, b) => a + 12000, 0);
  lines.push({ kind: 'out', type: '投资折旧', name: '已建设施分摊', amount: Math.round(builtCost * 0.03) });
  for (const c of career.data.contracts || []) {
    if (c.reward && !c.failed) lines.push({ kind: 'in', type: '合同收入', name: c.name, amount: c.reward });
  }
  const income = lines.filter((l) => l.kind === 'in').reduce((a, l) => a + l.amount, 0);
  const cost = lines.filter((l) => l.kind === 'out').reduce((a, l) => a + l.amount, 0);
  const net = income - cost;
  const punctuality = Math.round(((sim.trains || []).filter((t) => (t.late || 0) <= 3).length / Math.max(1, (sim.trains || []).length)) * 100);
  return { lines, income, cost, net, punctuality, board, late, incidents, at: Date.now() };
}

export function applyLedger(sim, scene) {
  const L = ledgerFor(sim, scene);
  if (L.net < 0) profile.data.reputation = Math.max(0, profile.data.reputation - 2);
  else if (L.punctuality >= 95 && !L.incidents) profile.data.reputation = Math.min(100, profile.data.reputation + 2);
  profile.data.stats.income += Math.max(0, L.net);
  saveProfile();
  const p = career.data;
  p.equipmentAge = Math.min(100, (p.equipmentAge || 0) + (L.incidents ? 5 : 2));
  p.superior = Math.max(0, Math.min(100, (p.superior == null ? 70 : p.superior) + (L.net >= 0 ? 2 : -5) - L.incidents * 3));
  p.dayNet = (p.dayNet || 0) + L.net;
  p.shiftIndex = (p.shiftIndex || 0) + 1;
  p.ledger = p.ledger || [];
  p.ledger.unshift({ ...L, scene: scene.title, shift: p.shiftIndex });
  p.ledger = p.ledger.slice(0, 60);
  p.daily = p.daily || [];
  if (p.shiftIndex % 3 === 0) {
    const last = p.ledger.slice(0, 3);
    p.daily.unshift({
      at: Date.now(), day: Math.floor(p.shiftIndex / 3), net: last.reduce((a, x) => a + x.net, 0),
      income: last.reduce((a, x) => a + x.income, 0), cost: last.reduce((a, x) => a + x.cost, 0),
      punctuality: Math.round(last.reduce((a, x) => a + x.punctuality, 0) / Math.max(1, last.length)),
    });
    p.daily = p.daily.slice(0, 30);
    p.dayNet = 0;
  }
  tickStaff();
  tickRegion();
  tickEmu();
  tickPort();
  carryTraffic();
  const review = settleWeek(L.net, L.punctuality, L.incidents);
  const rectify = checkRectify();
  L.review = review;
  L.rectify = rectify;
  saveCareer();
  return L;
}

export function bankruptcyRisk() {
  const p = career.data;
  if (p.rectify && p.rectify.active) return { level: 'warn', text: `整改期，还剩 ${p.rectify.left} 班` };
  if (profile.data.credits >= 0) return { level: 'ok', text: '资金正常' };
  const need = Math.abs(profile.data.credits);
  const turns = Math.ceil(need / Math.max(1, 4));
  if (profile.data.credits < -20000) return { level: 'dead', text: '已触发撤职线' };
  return { level: 'warn', text: `资金为负，约 ${Math.max(1, turns)} 班内需扭转` };
}

export function dailyReport() {
  const last = (career.data.ledger || []).slice(0, 3);
  const income = last.reduce((a, x) => a + x.income, 0);
  const cost = last.reduce((a, x) => a + x.cost, 0);
  return { income, cost, net: income - cost, punctuality: Math.round(last.reduce((a, x) => a + x.punctuality, 0) / Math.max(1, last.length)) };
}

export function trend() {
  return (career.data.ledger || []).slice(0, 7).reverse().map((x) => ({ net: x.net, p: x.punctuality, at: x.at }));
}
