import { career, saveCareer } from './career.js';

export const MODS = [
  { id: 'clear', name: '设备状态良好', tone: 'buff', desc: '本班随机故障率 -25%，准点压力小', effect: { fault: -0.25 } },
  { id: 'surge', name: '临时加开', tone: 'risk', desc: '本班多 2 趟车，收入 +15%', effect: { extra: 2, income: 0.15 } },
  { id: 'old', name: '信号老化', tone: 'risk', desc: '故障率 +20%，但维修补贴收入 +10%', effect: { fault: 0.2, income: 0.1 } },
  { id: 'fog', name: '大雾封区', tone: 'debuff', desc: '区间限速，站外待接红线 -2 分钟', effect: { wait: -2, weather: '大雾' } },
  { id: 'crowd', name: '节假日客流', tone: 'risk', desc: '客运乘降 +2 分钟，收入 +12%', effect: { board: 2, income: 0.12 } },
  { id: 'quiet', name: '平峰窗口', tone: 'buff', desc: '站内作业每项 -1 分钟', effect: { task: -1 } },
  { id: 'single', name: '3 道临时封锁', tone: 'debuff', desc: '本班 3 道封锁 60 分钟', effect: { block: 3 } },
  { id: 'night', name: '夜间施工', tone: 'debuff', desc: '天窗提前 20 分钟，故障率 +10%', effect: { fault: 0.1, window: -20 } },
  { id: 'rain', name: '连续降雨', tone: 'debuff', desc: '全线临时限速 45 km/h，待接红线 -1 分钟', effect: { limit: 45, wait: -1 } },
  { id: 'inspect', name: '上级抽查', tone: 'risk', desc: '命令校验更严，收入 +8%', effect: { income: 0.08, strict: 1 } },
];

const KEY = 'tst-dispatch-mod';

function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i += 1) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

export function rollMods(seed) {
  const base = seed == null ? new Date().toISOString().slice(0, 10) : String(seed);
  const start = hash(base) % MODS.length;
  return [0, 1, 2].map((i) => MODS[(start + i) % MODS.length]);
}

export function activeMod() {
  try {
    const id = localStorage.getItem(KEY);
    return MODS.find((m) => m.id === id) || null;
  } catch (e) { return null; }
}

export function setMod(id) {
  try {
    if (id) localStorage.setItem(KEY, id);
    else localStorage.removeItem(KEY);
  } catch (e) { /* ignored */ }
  const m = MODS.find((x) => x.id === id);
  if (m) {
    career.data.lastMod = id;
    career.data.unlocked = career.data.unlocked || [];
    if (!career.data.unlocked.includes(id)) career.data.unlocked.push(id);
    saveCareer();
  }
  return m || null;
}

export function modValue(key, base = 0) {
  const m = activeMod();
  if (!m || !m.effect) return base;
  const v = m.effect[key];
  return v == null ? base : v;
}

export function modTotal(key) {
  const m = activeMod();
  return m && m.effect && m.effect[key] != null ? m.effect[key] : 0;
}

export function modSnapshot() {
  const m = activeMod();
  return { id: m ? m.id : '', name: m ? m.name : '常规班', desc: m ? m.desc : '没有额外词条', tone: m ? m.tone : '', effect: m ? m.effect : {} };
}
