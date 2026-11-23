import { career, saveCareer } from './career.js';
import { profile, saveProfile } from './profile.js';

export const POLICIES = [
  { id: 'extra', name: '增开临客', desc: '本周期客运需求 +12%，声誉 +2，股道压力上升', tone: 'warn' },
  { id: 'safe', name: '安全整治', desc: '故障率 -18%，维护费每班 +900，上级 +3', tone: 'good' },
  { id: 'cost', name: '压减成本', desc: '维护费每班 -1400，声誉 -3，故障率 +8%', tone: 'bad' },
  { id: 'renew', name: '设备更新', desc: '一次性 1.8 万，设备老化 -15，故障率下降', tone: 'plain' },
  { id: 'freight', name: '货运倾斜', desc: '货运需求 +10%，客运侧晚点 +2 分', tone: 'good' },
  { id: 'service', name: '服务提升', desc: '投诉类事件成功率 +10%，副业收入 +6%', tone: 'plain' },
];

function pickPolicies(week) {
  const start = (week * 2) % POLICIES.length;
  return [0, 2, 4].map((k) => POLICIES[(start + k) % POLICIES.length]);
}

export function activePolicies() {
  return (career.data.policies || []).filter((x) => x.left > 0);
}

export function policyMod(key) {
  let v = 0;
  for (const p of activePolicies()) {
    if (key === 'fault' && p.id === 'safe') v -= 0.18;
    if (key === 'fault' && p.id === 'cost') v += 0.08;
    if (key === 'fault' && p.id === 'renew') v -= 0.1;
    if (key === 'pax' && p.id === 'extra') v += 0.12;
    if (key === 'freight' && p.id === 'freight') v += 0.1;
    if (key === 'maint' && p.id === 'safe') v += 900;
    if (key === 'maint' && p.id === 'cost') v -= 1400;
    if (key === 'service' && p.id === 'service') v += 0.1;
  }
  return v;
}

export function settleWeek(net, punctuality, incidents) {
  const p = career.data;
  const n = p.shiftIndex || 0;
  if (n % 21 !== 0) return null;
  const last = (p.ledger || []).slice(0, 21);
  const weekNet = last.reduce((a, x) => a + x.net, 0);
  const weekP = Math.round(last.reduce((a, x) => a + x.punctuality, 0) / Math.max(1, last.length));
  const weekInc = last.reduce((a, x) => a + (x.incidents || 0), 0);
  const score = Math.round(50 + weekNet / 1800 + (weekP - 90) * 1.2 - weekInc * 6 + ((p.superior || 70) - 70) * 0.45);
  const rating = score >= 78 ? 'A' : score >= 62 ? 'B' : score >= 46 ? 'C' : 'D';
  const grant = rating === 'A' ? 15000 : rating === 'B' ? 7000 : rating === 'C' ? 1000 : 0;
  if (grant) {
    profile.data.credits += grant;
    saveProfile();
  }
  const week = Math.floor(n / 21);
  const report = {
    week, rating, score, net: weekNet, punctuality: weekP, incidents: weekInc, grant,
    note: rating === 'A' ? '路局通报表扬，拨款到账。'
      : rating === 'B' ? '完成基本指标，没有额外追责。'
      : rating === 'C' ? '被点名，下一次周期要压晚点。'
      : '上级约谈，连续两周期 D 会撤职。',
  };
  p.weeks = p.weeks || [];
  p.weeks.unshift({ ...report, at: Date.now() });
  p.weeks = p.weeks.slice(0, 12);
  p.rating = rating;
  p.policyPending = { week, options: pickPolicies(week).map((x) => x.id) };
  saveCareer();
  return report;
}

export function choosePolicy(id) {
  const pending = career.data.policyPending;
  if (!pending) return { ok: false, msg: '没有待定政策' };
  if (!pending.options.includes(id)) return { ok: false, msg: '这项不在本周选项里' };
  const pol = POLICIES.find((x) => x.id === id);
  if (!pol) return { ok: false, msg: '政策不存在' };
  if (id === 'renew') {
    if (profile.data.credits < 18000) return { ok: false, msg: '设备更新需要 1.8 万' };
    profile.data.credits -= 18000;
    career.data.equipmentAge = Math.max(0, (career.data.equipmentAge || 0) - 15);
    saveProfile();
  }
  if (id === 'extra') profile.data.reputation = Math.min(100, profile.data.reputation + 2);
  if (id === 'safe') career.data.superior = Math.min(100, (career.data.superior || 70) + 3);
  if (id === 'cost') profile.data.reputation = Math.max(0, profile.data.reputation - 3);
  career.data.policies = career.data.policies || [];
  career.data.policies.push({ id, name: pol.name, left: 21, week: pending.week });
  career.data.policyPending = null;
  saveCareer();
  return { ok: true, msg: `已执行：${pol.name}，21 班内有效`, policy: pol };
}

export function operatingLock() {
  const r = career.data.rectify;
  if (r && r.active) return { active: true, text: `整改期还剩 ${r.left} 班，停止新投资和签约` };
  return { active: false, text: '' };
}

export function checkRectify() {
  const p = career.data;
  let r = p.rectify || { active: false, left: 0 };
  if (r.active) {
    r.left -= 1;
    if (r.left <= 0) {
      if (profile.data.credits >= 0 || (p.superior || 0) >= 50) {
        r.active = false;
        r.result = '整改通过，恢复经营权限';
        p.superior = Math.max(50, p.superior || 50);
      } else {
        r.active = false;
        r.result = '整改未通过，上级注资 1.5 万，降一级留用';
        profile.data.credits += 15000;
        p.level = Math.max(1, (p.level || 1) - 1);
        p.superior = 50;
        profile.data.reputation = Math.max(0, profile.data.reputation - 6);
        saveProfile();
      }
      p.lastRectify = r;
      saveCareer();
      return { started: false, ended: true, result: r.result };
    }
    saveCareer();
    return { started: false, ended: false, left: r.left };
  }
  if (profile.data.credits < -20000 || (p.superior || 70) < 25) {
    r = { active: true, left: 3, reason: profile.data.credits < -20000 ? '连续亏损，资金穿底' : '上级评价过低', result: '' };
    p.rectify = r;
    saveCareer();
    return { started: true, active: true, left: 3, reason: r.reason };
  }
  return { started: false, ended: false };
}

export function weeklySummary() {
  return (career.data.weeks || []).slice(0, 4);
}
