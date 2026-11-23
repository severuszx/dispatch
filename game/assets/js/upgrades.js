import { career, saveCareer } from './career.js';
import { profile, saveProfile } from './profile.js';
import { operatingLock } from './review.js';

const CATS = {
  track: '股道不够', signal: '信号办理慢', platform: '站台接不了长编组', freight: '货场装不下',
  crew: '人手不够', power: '停电/接触网', weather: '天气一坏就瘫', service: '客流留不住',
  safety: '一出事就赔', info: '看不见邻站', biz: '没有副业收入',
};

export const UPGRADES = [
  { id: 'track_1', cat: 'track', name: '到发线 +1', cost: 120000, maint: 800, days: 3, effect: '待避/会让 +1 股', sim: '站场图多一股，可同时多接一列', need: '' },
  { id: 'track_2', cat: 'track', name: '货物线 +1', cost: 90000, maint: 620, days: 2, effect: '装卸线 +1', sim: '货列可并行装卸，货场占用下降', need: 'freight' },
  { id: 'track_3', cat: 'track', name: '安全线/避难线', cost: 55000, maint: 320, days: 1, effect: '溜逸事故率 -35%', sim: '调车溜逸事件概率下降', need: '' },
  { id: 'track_4', cat: 'track', name: '到发线延长 1050m', cost: 180000, maint: 900, days: 4, effect: '可接长编组', sim: '长编组不再因股道长度拒接', need: 'track_1' },
  { id: 'sig_1', cat: 'signal', name: '信号机 LED 化', cost: 45000, maint: 260, days: 1, effect: '灭灯故障 -40%', sim: '信号灭灯事件概率下降', need: '' },
  { id: 'sig_2', cat: 'signal', name: '计算机联锁', cost: 260000, maint: 1600, days: 5, effect: '进路办理 30s→8s', sim: '联锁办理反馈更快，敌对进路检查更准', need: 'sig_1' },
  { id: 'sig_3', cat: 'signal', name: '轨道电路加装', cost: 150000, maint: 1100, days: 3, effect: '红光带误报 -50%', sim: '红光带故障概率下降，占用显示更准', need: '' },
  { id: 'sig_4', cat: 'signal', name: '信号电源双路', cost: 80000, maint: 500, days: 2, effect: '停电影响减半', sim: '供电中断时信号可维持，恢复更快', need: '' },
  { id: 'sig_5', cat: 'signal', name: '调度集中 CTC', cost: 480000, maint: 3200, days: 7, effect: '可远程控制邻站', sim: '解锁区域视图，可操作邻站进路', need: 'sig_2' },
  { id: 'plat_1', cat: 'platform', name: '站台加长', cost: 95000, maint: 600, days: 2, effect: '接长编组办客', sim: '长编组可停靠办客，不再拒接', need: '' },
  { id: 'plat_2', cat: 'platform', name: '站台加高', cost: 70000, maint: 420, days: 2, effect: '乘降 -1 分', sim: '客运乘降作业时间缩短', need: '' },
  { id: 'plat_3', cat: 'platform', name: '候车室扩建', cost: 85000, maint: 500, days: 2, effect: '客流上限 +40%', sim: '大客流投诉/踩踏事件概率下降', need: '' },
  { id: 'fr_1', cat: 'freight', name: '货场扩建', cost: 150000, maint: 900, days: 3, effect: '装卸能力 +1 档', sim: '货列可多停，装卸积压下降', need: 'freight' },
  { id: 'fr_2', cat: 'freight', name: '门式起重机', cost: 220000, maint: 1300, days: 3, effect: '装卸 -1 分/车', sim: '装卸作业时间缩短', need: 'fr_1' },
  { id: 'fr_3', cat: 'freight', name: '汽车衡（地磅）', cost: 60000, maint: 300, days: 1, effect: '超载罚款收入 +', sim: '超载车拦截，增加罚款收入', need: '' },
  { id: 'crew_1', cat: 'crew', name: '值班员 +1', cost: 110000, maint: 1800, days: 1, effect: '并发事件 +1', sim: '同时可处理事件数 +1', need: '' },
  { id: 'crew_2', cat: 'crew', name: '维修工 +1', cost: 95000, maint: 1600, days: 1, effect: '故障恢复 -1 分', sim: '故障恢复等待时间缩短', need: '' },
  { id: 'crew_3', cat: 'crew', name: '引导员', cost: 80000, maint: 1400, days: 1, effect: '信号故障可接车', sim: '信号故障时可人工引导接车', need: '' },
  { id: 'pow_1', cat: 'power', name: '备用发电机', cost: 70000, maint: 450, days: 1, effect: '停电不停站', sim: '市电中断后 30 分钟内维持基本信号', need: '' },
  { id: 'pow_2', cat: 'power', name: '接触网工区', cost: 130000, maint: 900, days: 3, effect: '接触网故障恢复 -2 分', sim: '接触网故障恢复加快', need: 'electrified' },
  { id: 'wx_1', cat: 'weather', name: '股道融雪装置', cost: 65000, maint: 400, days: 1, effect: '冬季道岔冻结 -60%', sim: '雪天道岔故障概率下降', need: '' },
  { id: 'wx_2', cat: 'weather', name: '排水改造', cost: 50000, maint: 260, days: 1, effect: '雨天积水 -50%', sim: '暴雨积水限速概率下降', need: '' },
  { id: 'wx_3', cat: 'weather', name: '防风网', cost: 55000, maint: 300, days: 1, effect: '大风限速 -30%', sim: '大风天气限速概率下降', need: '' },
  { id: 'srv_1', cat: 'service', name: '电子引导屏', cost: 35000, maint: 220, days: 1, effect: '投诉 -15%', sim: '旅客投诉事件概率下降', need: '' },
  { id: 'srv_2', cat: 'service', name: '无障碍电梯', cost: 90000, maint: 600, days: 2, effect: '好评 +，客伤 -', sim: '重点旅客事件成功率提高', need: '' },
  { id: 'srv_3', cat: 'service', name: '母婴室', cost: 30000, maint: 180, days: 1, effect: '好评 +', sim: '母婴旅客事件成功率提高', need: '' },
  { id: 'saf_1', cat: 'safety', name: '消防系统升级', cost: 75000, maint: 480, days: 2, effect: '火灾损失 -40%', sim: '火灾事件损失与恢复时间下降', need: '' },
  { id: 'saf_2', cat: 'safety', name: '应急预案库', cost: 40000, maint: 240, days: 1, effect: '处置成功率 +15%', sim: '事件处置成功率提高', need: '' },
  { id: 'saf_3', cat: 'safety', name: 'CCTV 监控', cost: 50000, maint: 300, days: 1, effect: '取证/防破坏', sim: '治安事件破案率提高', need: '' },
  { id: 'info_1', cat: 'info', name: '调度信息系统', cost: 120000, maint: 700, days: 3, effect: '邻站信息延迟 -50%', sim: '邻站占用显示更快', need: '' },
  { id: 'info_2', cat: 'info', name: '数据分析平台', cost: 90000, maint: 550, days: 2, effect: '自动提示瓶颈', sim: '经营面板瓶颈建议更准', need: 'info_1' },
  { id: 'biz_1', cat: 'biz', name: '站内商铺', cost: 45000, maint: 200, days: 2, effect: '+¥300/班', sim: '每班固定租金收入', need: '' },
  { id: 'biz_2', cat: 'biz', name: '广告位', cost: 35000, maint: 150, days: 1, effect: '+¥240/班', sim: '每班固定广告收入', need: '' },
  { id: 'biz_3', cat: 'biz', name: '停车场', cost: 60000, maint: 350, days: 2, effect: '+¥420/班', sim: '客流相关停车收入', need: '' },
  { id: 'biz_4', cat: 'biz', name: '光伏发电', cost: 180000, maint: 900, days: 4, effect: '电费 -30%', sim: '每班能耗支出下降', need: '' },
];

export const CATEGORIES = CATS;

function key(station, id) {
  return `${station || career.data.currentStation || 'qinglan'}:${id}`;
}

export function catalog(station) {
  const st = station || career.data.currentStation || 'qinglan';
  return UPGRADES.map((u) => {
    const built = isBuilt(u.id, st);
    const queued = (career.data.builds || []).find((b) => b.station === st && b.id === u.id);
    return { ...u, built, queued };
  });
}

export function getUpgrade(id) {
  return UPGRADES.find((u) => u.id === id) || null;
}

export function isBuilt(id, station) {
  return (career.data.built || []).includes(key(station, id));
}

export function isQueued(id, station) {
  return (career.data.builds || []).some((b) => b.station === key(station, '').split(':')[0] && b.id === id);
}

export function canBuild(id, station) {
  const st = station || career.data.currentStation || 'qinglan';
  const u = getUpgrade(id);
  if (!u) return { ok: false, msg: '没有这个项目' };
  const lock = operatingLock();
  if (lock.active) return { ok: false, msg: lock.text };
  if (isBuilt(id, st)) return { ok: false, msg: '已经建成' };
  if (isQueued(id, st)) return { ok: false, msg: '已经在建' };
  if (u.need === 'freight' && !career.data.business) return { ok: false, msg: '本站不是货运办理站' };
  if (u.need === 'electrified' && !career.data.electrified) return { ok: false, msg: '本站未电气化' };
  if (u.need && !isBuilt(u.need, st)) {
    const p = getUpgrade(u.need);
    return { ok: false, msg: `需要先建：${p ? p.name : u.need}` };
  }
  if ((career.data.builds || []).length >= 1 + (career.data.crews || 0)) return { ok: false, msg: '工程队已占满，等一项完工' };
  if (profile.data.credits < u.cost) return { ok: false, msg: `资金不足，还差 ¥${u.cost - profile.data.credits}` };
  return { ok: true, msg: '可以开工' };
}

export function startBuild(id, station) {
  const st = station || career.data.currentStation || 'qinglan';
  const u = getUpgrade(id);
  const c = canBuild(id, st);
  if (!c.ok) return c;
  career.data.builds = career.data.builds || [];
  career.data.builds.push({ id, station: st, name: u.name, left: u.days, total: u.days, at: Date.now() });
  profile.data.credits -= u.cost;
  saveProfile();
  saveCareer();
  return { ok: true, msg: `${u.name} 已开工，${u.days} 班后完工` };
}

export function tickBuilds() {
  const done = [];
  const left = [];
  for (const b of career.data.builds || []) {
    b.left -= 1;
    if (b.left <= 0) done.push(b);
    else left.push(b);
  }
  career.data.builds = left;
  for (const b of done) {
    career.data.built = career.data.built || [];
    const k = key(b.station, b.id);
    if (!career.data.built.includes(k)) career.data.built.push(k);
    const u = getUpgrade(b.id);
    if (u) career.data.maint = (career.data.maint || 0) + u.maint;
  }
  if (done.length) saveCareer();
  return done;
}

export function trackBonus(station) {
  return isBuilt('track_1', station) ? 1 : 0;
}

export function platformExtra(station) {
  return isBuilt('plat_1', station) ? 1 : 0;
}

export function platformHeight(station) {
  return isBuilt('plat_2', station) ? 1 : 0;
}

export function faultFactor(station) {
  let f = 1;
  if (isBuilt('sig_1', station)) f -= 0.18;
  if (isBuilt('sig_3', station)) f -= 0.25;
  if (isBuilt('wx_1', station)) f -= 0.12;
  if (isBuilt('info_1', station)) f -= 0.05;
  if (isBuilt('saf_2', station)) f -= 0.08;
  return Math.max(0.15, f);
}

export function crewExtra(station) {
  return isBuilt('crew_1', station) ? 1 : 0;
}

export function incomeExtra(station) {
  let v = 0;
  if (isBuilt('biz_1', station)) v += 300;
  if (isBuilt('biz_2', station)) v += 240;
  if (isBuilt('biz_3', station)) v += 420;
  return v;
}

export function maintenanceFor(station) {
  return (career.data.maint || 0);
}
