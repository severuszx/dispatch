import { storage, hash, fmtClock } from './util.js';

import { career, careerFactor, importCareer } from './career.js';
import { modTotal } from './mods.js';

const KEY = 'tst-dispatch-profile';
const CODE_PREFIX = 'TSTD1-';

const RANKS = [
  { id: 0, name: '学员', xp: 0, license: '见习', factor: 0.8 },
  { id: 1, name: '值班员', xp: 600, license: '车站值班员', factor: 1 },
  { id: 2, name: '调度员', xp: 1800, license: '列车调度员', factor: 1.2 },
  { id: 3, name: '值班主任', xp: 4200, license: '值班主任', factor: 1.45 },
];

const ACHIEVEMENTS = [
  { id: 'first', name: '第一次交班', desc: '完成一个值班班次', check: (p) => p.stats.shifts >= 1 },
  { id: 'clean', name: '零晚点', desc: '单班准点率 100%', check: (p) => p.stats.bestPunctuality >= 100 },
  { id: 'safe', name: '安全底线', desc: '累计 10 班无责任事故', check: (p) => p.stats.cleanStreak >= 10 },
  { id: 'rich', name: '经营上手', desc: '累计收入达到 5000', check: (p) => p.stats.income >= 5000 },
  { id: 'night', name: '夜班老手', desc: '完成 5 个夜班', check: (p) => p.stats.nightShifts >= 5 },
  { id: 'editor', name: '排图的人', desc: '导出一个自编场景', check: (p) => p.stats.exports >= 1 },
];

function fresh() {
  return {
    version: 1,
    createdAt: Date.now(),
    name: '值班员',
    xp: 0,
    credits: 1200,
    reputation: 50,
    rank: 0,
    stats: {
      shifts: 0, onTime: 0, late: 0, income: 0, incidents: 0, cleanStreak: 0, nightShifts: 0,
      bestPunctuality: 0, exports: 0, totalMinutes: 0, stars: 0,
    },
    achievements: [],
    history: [],
    settings: {
      theme: 'control', font: 1, contrast: 'normal', colorblind: false,
      volumes: { ambient: 62, voice: 78, sfx: 82 },
    },
    autosave: true,
  };
}

function clean(raw) {
  const base = fresh();
  if (!raw || typeof raw !== 'object') return base;
  return {
    ...base, ...raw,
    stats: { ...base.stats, ...(raw.stats || {}) },
    settings: { ...base.settings, ...(raw.settings || {}), volumes: { ...base.settings.volumes, ...((raw.settings || {}).volumes || {}) } },
    achievements: Array.isArray(raw.achievements) ? raw.achievements : [],
    history: Array.isArray(raw.history) ? raw.history.slice(0, 24) : [],
  };
}

export const profile = { data: clean(storage(KEY)) };

export function loadProfile() {
  profile.data = clean(storage(KEY));
  return profile.data;
}

export function saveProfile() {
  storage(KEY, profile.data);
}

export function rankOf(xp) {
  let r = RANKS[0];
  for (const x of RANKS) if (xp >= x.xp) r = x;
  return r;
}

export function nextRank(xp) {
  return RANKS.find((x) => x.xp > xp) || null;
}

export function settleShift(sim, scene, netIncome) {
  const p = profile.data;
  const total = Math.max(1, sim.metrics.total || sim.trains.length || 1);
  const onTime = sim.trains.filter((t) => t.status === 'terminated' && (t.late || 0) <= 3).length;
  const punctuality = Math.round((onTime / total) * 100);
  const late = sim.trains.filter((t) => (t.late || 0) > 3).length;
  const incidents = sim.metrics.incidents || 0;
  const safety = Math.max(0, 100 - incidents * 18 - sim.alarms.filter((a) => a.level === 'danger').length * 4);
  const income = netIncome == null ? Math.max(0, Math.round((onTime * 42 + punctuality * 8 + safety * 6 - late * 18 + (scene.duration || 240) * 0.8) * rankOf(p.xp).factor * careerFactor('income') * (1 + modTotal('income')))) : Math.round(netIncome);
  const xp = Math.max(30, Math.round(onTime * 18 + punctuality * 4 + safety * 2 - incidents * 20));
  const stars = (punctuality >= 96 && safety >= 96 && incidents === 0) ? 3 : (punctuality >= 85 && safety >= 85) ? 2 : 1;
  p.credits += income;
  p.xp += xp;
  p.rank = rankOf(p.xp).id;
  p.reputation = Math.max(0, Math.min(100, p.reputation + (stars === 3 ? 3 : stars === 2 ? 1 : -2)));
  p.stats.shifts += 1;
  p.stats.onTime += onTime;
  p.stats.late += late;
  p.stats.income += income;
  p.stats.incidents += incidents;
  p.stats.cleanStreak = incidents ? 0 : p.stats.cleanStreak + 1;
  p.stats.bestPunctuality = Math.max(p.stats.bestPunctuality, punctuality);
  p.stats.stars += stars;
  p.stats.totalMinutes += Math.max(0, sim.clock - sim.startClock);
  if (sim.clock < 360 || sim.clock >= 1260) p.stats.nightShifts += 1;
  p.history.unshift({
    at: Date.now(), scene: scene.title, station: sim.line ? sim.line.name : '',
    punctuality, safety, income, xp, stars, incidents, minutes: Math.max(0, sim.clock - sim.startClock),
  });
  p.history = p.history.slice(0, 24);
  for (const a of ACHIEVEMENTS) {
    if (!p.achievements.includes(a.id) && a.check(p)) {
      p.achievements.push(a.id);
      p.credits += 150;
    }
  }
  saveProfile();
  return { punctuality, safety, income, xp, stars, incidents, late, onTime, total };
}

export function award(id, credits = 0) {
  const p = profile.data;
  if (!p.achievements.includes(id)) p.achievements.push(id);
  p.credits += credits;
  saveProfile();
}

export function achievementList() {
  return ACHIEVEMENTS.map((a) => ({ ...a, got: profile.data.achievements.includes(a.id) }));
}

export function dailyChallenge() {
  const d = new Date();
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const seed = hash(`dispatch-${key}`);
  const rules = [
    { id: 'dense', label: '车流加密', desc: '本班车次 +20%，事件间隔缩短' },
    { id: 'rain', label: '雨雪天气', desc: '区间限速，能见度下降' },
    { id: 'failure', label: '设备多故障', desc: '红光带与道岔失表概率提高' },
    { id: 'window', label: '天窗压点', desc: '施工窗口提前 20 分钟' },
    { id: 'honest', label: '电话闭塞', desc: '区间能力下降，禁止自动进路' },
  ];
  return { key, seed, rule: rules[seed % rules.length], rules };
}

function encode(obj) {
  const json = JSON.stringify(obj);
  return CODE_PREFIX + btoa(unescape(encodeURIComponent(json))).replace(/=+/g, '');
}

function decode(code) {
  const body = String(code || '').trim().replace(CODE_PREFIX, '');
  const b = body + '='.repeat((4 - (body.length % 4)) % 4);
  return JSON.parse(decodeURIComponent(escape(atob(b))));
}

export function exportArchive() {
  return encode({
    format: 'tst-dispatch-archive',
    version: 1,
    profile: profile.data,
    saves: storage('tst-dispatch-saves') || [],
    workshop: storage('tst-dispatch-workshop') || [],
    career: career.data,
    exportedAt: Date.now(),
  });
}

export function importArchive(code, replace = false) {
  const pack = decode(code);
  if (!pack || pack.format !== 'tst-dispatch-archive') throw new Error('不是调度台存档码');
  if (!pack.profile) throw new Error('存档码缺少经营档案');
  profile.data = clean(pack.profile);
  if (replace) {
    storage('tst-dispatch-saves', (pack.saves || []).slice(0, 12));
    storage('tst-dispatch-workshop', (pack.workshop || []).slice(0, 20));
  }
  saveProfile();
  if (pack.career) importCareer(pack.career);
  return { saves: (pack.saves || []).length, workshop: (pack.workshop || []).length };
}

export function archiveMeta(code) {
  try {
    const p = decode(code);
    return {
      name: p.profile.name, rank: rankOf(p.profile.xp).name, credits: p.profile.credits,
      saves: (p.saves || []).length, at: p.exportedAt, format: p.format,
    };
  } catch (e) { return null; }
}

export function setSetting(key, val) {
  profile.data.settings[key] = val;
  saveProfile();
  applySettings();
}

export function applySettings() {
  const s = profile.data.settings;
  document.body.dataset.theme = s.theme || 'control';
  document.body.dataset.contrast = s.contrast || 'normal';
  document.body.dataset.colorblind = s.colorblind ? '1' : '0';
  document.body.style.setProperty('--font-scale', String(s.font || 1));
  document.documentElement.style.setProperty('--font-scale', String(s.font || 1));
  document.documentElement.style.setProperty('--vol-ambient', String((s.volumes || {}).ambient ?? 62));
  document.documentElement.style.setProperty('--vol-voice', String((s.volumes || {}).voice ?? 78));
  document.documentElement.style.setProperty('--vol-sfx', String((s.volumes || {}).sfx ?? 82));
}

export function historyLine(h) {
  return `${h.scene} · ${fmtClock(0)} · 准点 ${h.punctuality}% · ${h.stars}★`;
}
