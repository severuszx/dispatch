import { hhmmToMin } from './util.js';

export const SCHEMA_VERSION = 1;

const KINDS = ['tutorial', 'story', 'daily', 'sandbox', 'pack', 'hub'];

function arr(v) { return Array.isArray(v) ? v : []; }
function num(v, d = 0) { const n = Number(v); return Number.isFinite(n) ? n : d; }
function cleanStationList(v) {
  return arr(v).map(Number).filter((n) => Number.isInteger(n) && n > 0);
}

export function migrateScene(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('场景不是对象');
  const s = { ...raw };
  const from = num(s.schemaVersion, 0);
  if (!KINDS.includes(s.kind)) s.kind = s.kind === 'pack' ? 'pack' : s.hub ? 'hub' : 'sandbox';
  s.schemaVersion = SCHEMA_VERSION;
  s.id = String(s.id || `sc-${Math.abs(Number(s.title && s.title.length) || 1)}-${Date.now().toString(36)}`);
  s.title = String(s.title || '未命名场景');
  s.line = String(s.line || 'qinglan');
  s.brief = String(s.brief || s.note || '');
  s.weather = String(s.weather || '晴');
  s.difficulty = Math.max(1, Math.min(6, Math.round(num(s.difficulty, 2))));
  s.duration = Math.max(30, Math.min(1440, Math.round(num(s.duration, 240))));
  s.trains = Math.max(0, Math.min(80, Math.round(num(s.trains, 8))));
  s.start = Math.round(num(s.start, 360));
  s.lateLimit = Math.max(1, Math.round(num(s.lateLimit, 15)));
  s.waitLimit = Math.max(1, Math.round(num(s.waitLimit, 12)));
  s.meta = {
    author: String((s.meta && s.meta.author) || s.author || '本机'),
    desc: String((s.meta && s.meta.desc) || s.brief || ''),
    thumbnail: String((s.meta && s.meta.thumbnail) || ''),
    tags: arr((s.meta && s.meta.tags) || s.tags).map(String).slice(0, 8),
    ...(s.meta || {}),
  };
  s.dependencies = {
    packs: arr(s.dependencies && s.dependencies.packs).map(String),
    trains: arr(s.dependencies && s.dependencies.trains).map(String),
    events: arr(s.dependencies && s.dependencies.events).map(String),
  };
  s.constraints = {
    allowFreightOnly: s.constraints ? s.constraints.allowFreightOnly !== false : true,
    forbidAutoRoute: !!(s.constraints && s.constraints.forbidAutoRoute),
    fixedWeather: !!(s.constraints && s.constraints.fixedWeather),
    ...(s.constraints || {}),
  };
  s.operations = {
    passenger: s.operations ? s.operations.passenger !== false : true,
    freight: s.operations ? s.operations.freight !== false : true,
    shunting: s.operations ? s.operations.shunting !== false : true,
    construction: !!(s.operations && s.operations.construction),
    ...(s.operations || {}),
  };
  s.schedule = arr(s.schedule).map((x) => ({
    ...x,
    arr: x.arr == null ? null : (typeof x.arr === 'string' ? hhmmToMin(x.arr) : num(x.arr, null)),
    dep: x.dep == null ? null : (typeof x.dep === 'string' ? hhmmToMin(x.dep) : num(x.dep, null)),
    station: String(x.station || x.yard || x.st || ''),
  }));
  if (s.schemaVersion !== from && from > 0 && from > SCHEMA_VERSION) {
    throw new Error(`场景版本 ${from} 高于当前支持 ${SCHEMA_VERSION}`);
  }
  if (from === 0 && s.format === 'tst-dispatch-scene') {
    s.kind = s.kind || 'pack';
    s.trains = Math.max(s.trains || 0, arr(s.trains).length ? 0 : s.trains || 8);
  }
  return s;
}

export function normalizeStation(conf, id) {
  const c = { ...(conf || {}) };
  c.id = c.id || id;
  c.tracks = Math.max(1, Math.min(40, Math.round(num(c.tracks, 1))));
  c.platforms = Math.max(0, Math.min(c.tracks, Math.round(num(c.platforms, c.platform ? 2 : 1))));
  c.throat = Math.max(0, Math.min(12, Math.round(num(c.throat, 2))));
  c.km = num(c.km, 0);
  c.type = String(c.type || '中间站');
  c.passenger = c.passenger !== false && !/货运|货场|物流/.test(c.type);
  c.platform = Array.isArray(c.platform) ? cleanStationList(c.platform) : cleanStationList(c.platform || []);
  c.freight = Array.isArray(c.freight) ? cleanStationList(c.freight) : cleanStationList(c.freight || []);
  if (!c.platform.length && !c.freight.length && c.passenger) {
    c.platform = Array.from({ length: Math.max(1, Math.min(c.tracks, c.platforms || 2)) }, (_, i) => i + 1);
    c.freight = Array.from({ length: Math.max(0, c.tracks - c.platform.length) }, (_, i) => c.platform.length + i + 1);
  }
  return c;
}

export function validateScene(scene, network, timetable) {
  const errors = [];
  const warnings = [];
  const s = migrateScene(scene);
  if (s.kind === 'hub') {
    if (!s.hub) errors.push('枢纽场景缺少 hub 字段');
    if (!s.stationName && !s.title) warnings.push('枢纽场景没有车站名');
  } else {
    const line = network && network.lines.find((l) => l.id === s.line);
    if (!line) errors.push(`线路 ${s.line} 不存在`);
    else {
      const focus = s.focus || line.stations[0];
      const st = network.stations[focus];
      if (!st) errors.push(`车站 ${focus} 不存在`);
      else if (!normalizeStation(st, focus).passenger && !s.constraints.allowFreightOnly) errors.push(`${st.name || focus} 无客运业务，已拒绝导入`);
    }
  }
  const rows = s.schedule.length ? s.schedule : arr(timetable && timetable[s.line]);
  const occupied = {};
  rows.forEach((t, i) => {
    const key = `${t.station || t.yard || ''}:${t.track || t.trackNo || 0}`;
    if (!t.track && !t.trackNo) return;
    const a = t.arr == null ? t.dep : t.arr;
    const b = t.dep == null ? t.arr : t.dep;
    if (a == null || b == null) return;
    for (const x of occupied[key] || []) {
      if (a < x.b && b > x.a) {
        errors.push(`同股道时刻冲突：${t.no || `第 ${i + 1}`} 与 ${x.no} 在 ${key}`);
      }
    }
    (occupied[key] = occupied[key] || []).push({ a, b, no: t.no || `第 ${i + 1} 趟` });
  });
  rows.forEach((t, i) => {
    if (t.arr != null && t.dep != null && t.dep < t.arr) errors.push(`${t.no || `第 ${i + 1}`} 的发车早于到达`);
    if (s.start && t.arr != null && t.arr < s.start - 120) warnings.push(`${t.no || `第 ${i + 1}`} 到达早于开班 2 小时`);
  });
  return { ok: !errors.length, errors, warnings, scene: s };
}

export function packageScene(scene, trains, sandbox) {
  return {
    format: 'tst-dispatch-scene',
    schemaVersion: SCHEMA_VERSION,
    version: SCHEMA_VERSION,
    name: scene.title,
    line: scene.line,
    scene: migrateScene(scene),
    sandbox: sandbox || {},
    trains: arr(trains).map((t) => ({
      no: t.no, type: t.type, from: t.from, to: t.to, arr: t.planArr, dep: t.planDep,
      dwell: t.dwell, coaches: t.coaches, track: t.trackNo, tasks: t.tasks || [],
    })),
  };
}

export function parseSceneFile(text, network, timetable) {
  const raw = JSON.parse(String(text));
  const pack = raw && raw.scene ? raw : { scene: raw };
  const scene = migrateScene(pack.scene);
  const report = validateScene(scene, network, timetable);
  return { pack, report };
}
