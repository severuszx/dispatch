import fs from 'node:fs';

const stations = JSON.parse(fs.readFileSync('tools/stations-55.json', 'utf8'));
const rail = JSON.parse(fs.readFileSync('data/rail-2026-11-22.json', 'utf8'));
const DATE = rail.date;
const LEVEL_NAME = { 0: '特等站', 1: '一等站', 2: '二等站', 3: '三等站' };
const CROSS = {
  '洛阳东': ['陇海线'], '关林': ['陇海线'], '南阳': ['宁西线'], '襄阳北': ['汉丹线', '襄渝线'], '襄阳': ['汉丹线', '襄渝线'],
  '怀化': ['沪昆线'], '柳州': ['湘桂线', '黔桂线'], '信阳': ['京广线'], '潢川': ['京九线'], '合肥': ['淮南线', '合九线'],
  '西安': ['陇海线'], '新丰镇': ['陇海线'], '南京': ['京沪线'], '月山': ['太焦线'], '洛阳北': ['陇海线']
};
const BUREAU = { jiaoliu: ['郑局', '武局', '广局'], ningxi: ['西局', '郑局', '武局', '上局'] };
const LOCO = { jiaoliu: ['HXD3C', 'HXD3D', 'HXD1'], ningxi: ['HXD2B', 'HXD3C', 'HXD1D'] };

function timeMin(v) {
  if (!v || v === '----') return null;
  const [h, m] = v.split(':').map(Number);
  return h * 60 + m;
}
function trainType(code) {
  const c = String(code)[0].toUpperCase();
  if ('GDCZTK'.includes(c)) return c;
  if (/^\d/.test(String(code))) return '普快';
  return '普快';
}
function trainClass(code) {
  const c = String(code)[0].toUpperCase();
  if (c === 'G') return '高速';
  if (c === 'D') return '动车';
  if (c === 'C') return '城际';
  if (c === 'Z') return '直达';
  if (c === 'T') return '特快';
  if (c === 'K') return '快速';
  return '普快';
}
function coaches(type, code) {
  if (type === '货') return 40 + (Number(String(code).slice(-2)) || 0) % 8;
  if (type === 'G') return 8;
  if (type === 'D') return 16;
  if (type === 'Z') return 19;
  if (type === 'T') return 18;
  return 17;
}
function priority(type) {
  if (type === 'G') return 2;
  if (type === 'D') return 3;
  if (type === 'Z') return 3;
  if (type === 'T') return 4;
  if (type === 'K') return 5;
  if (type === '货') return 7;
  return 6;
}
function normStops(train) {
  let day = 0;
  let prev = null;
  return train.stops.map((s) => {
    const a = timeMin(s.arr);
    const d = timeMin(s.dep);
    const base = a == null ? d : a;
    if (base != null && prev != null && base < prev - 600) day += 1;
    const arr = a == null ? null : a + day * 1440;
    const dep = d == null ? null : d + day * 1440;
    if (dep != null) prev = dep;
    else if (arr != null) prev = arr;
    return { ...s, arrMin: arr, depMin: dep };
  });
}

const routeStations = {};
for (const line of ['jiaoliu', 'ningxi']) routeStations[line] = stations.filter((s) => (line === 'jiaoliu' ? s.line === 'jiaoliu' || s.line === 'both' : s.line === 'ningxi' || s.line === 'both'));
const orderIndex = {};
for (const line of ['jiaoliu', 'ningxi']) routeStations[line].forEach((s, i) => { orderIndex[`${line}:${s.name}`] = i; });

function makeTrain(e, st, taken, sceneStart, line) {
  const { stop, stops, code, idx } = e;
  const first = stops[0]?.name || '';
  const last = stops[stops.length - 1]?.name || '';
  const next = stops[idx + 1]?.name;
  const dir = next && orderIndex[`${line}:${next}`] != null && orderIndex[`${line}:${st.name}`] != null
    ? (orderIndex[`${line}:${next}`] > orderIndex[`${line}:${st.name}`] ? 1 : 0)
    : ((Number(String(code).replace(/\D/g, '')) || 0) % 2 === 0 ? 1 : 0);
  const arrT = stop.arrMin == null ? (stop.depMin ?? sceneStart) - 12 : stop.arrMin;
  const depT = stop.depMin == null ? arrT + 18 : stop.depMin;
  const arr = Math.max(0, arrT - sceneStart);
  const dep = arr + Math.max(4, depT - arrT);
  const arrAbs = sceneStart + arr;
  const type = trainType(code);
  const tasks = [];
  const n = taken.length;
  if (st.level <= 2 && dep - arr >= 8 && n % 7 === 3) {
    tasks.push({ kind: 'swap', title: '站内换挂', min: 8, loco: LOCO[line][n % 3], bureau: BUREAU[line][n % 3] });
  }
  if (!tasks.length && dep - arr >= 12 && n % 4 === 1) {
    tasks.push({ kind: 'inspect', title: '列检', min: 12 });
  }
  let turnback = null;
  if (st.level <= 1 && (idx === 0 || idx === stops.length - 1) && n % 6 === 2) {
    const mate = taken.find((x) => x.dir !== dir && Math.abs((x.arr ?? sceneStart) - arrT) < 120);
    if (mate && mate.last !== st.name) {
      tasks.push({ kind: 'turnback', title: '换向整备', min: 15 });
      turnback = { no: mate.code, dest: mate.last, section: mate.next };
    }
  }
  if (type === '货' && n % 3 === 1) tasks.push({ kind: 'cars', title: '摘挂作业', min: 10, cars: 12 });
  const wait = taken.length % 9 === 4 ? taken.find((x) => x.priority < priority(type) && x.arr <= arrAbs + 25) : null;
  return {
    id: `${st.slug}-${String(taken.length + 1).padStart(2, '0')}`,
    no: code, type, yard: 'main', arr: sceneStart + arr, dep: sceneStart + dep, coaches: coaches(type, code),
    priority: priority(type), crew: 1, dir,
    origin: first, dest: last, trainClass: trainClass(code),
    waitFor: wait ? wait.no : undefined,
    turnback,
    tasks
  };
}

function synthetic(st, line) {
  const list = [];
  const start = 360;
  const count = st.level <= 1 ? 10 : 6;
  for (let i = 0; i < count; i += 1) {
    const arr = start + 18 + i * 47;
    const dep = arr + (i % 3 === 0 ? 32 : 14);
    list.push({
      id: `${st.slug}-x${i + 1}`, no: `${line === 'jiaoliu' ? 'X' : 'N'}${1001 + i}`, type: '货', yard: 'main',
      arr, dep, coaches: 40 + (i % 6), priority: 7, crew: 1, dir: i % 2,
      origin: i % 2 ? routeStations[line][0].name : routeStations[line][routeStations[line].length - 1].name,
      dest: i % 2 ? routeStations[line][routeStations[line].length - 1].name : routeStations[line][0].name,
      tasks: i % 3 === 0 ? [{ kind: 'cars', title: '摘挂作业', min: 10, cars: 12 }] : []
    });
  }
  return list;
}

const packs = { jiaoliu: {}, ningxi: {} };
const scenes = [];
for (const line of ['jiaoliu', 'ningxi']) {
  for (const st of routeStations[line]) {
    const events = [];
    for (const [no, tr] of Object.entries(rail.trains)) {
      const idx = tr.stops.findIndex((x) => x.name === st.name);
      if (idx < 0) continue;
      const stops = normStops(tr);
      events.push({ code: tr.code, stops, stop: stops[idx], idx, no });
    }
    const points = events.map((e) => (e.stop.arrMin ?? e.stop.depMin)).sort((a, b) => a - b);
    let win = 360;
    let best = -1;
    for (const p of points) {
      let count = 0;
      for (const q of points) if (q >= p && q - p <= 600) count += 1;
      if (count > best) { best = count; win = p; }
    }
    if (!points.length) win = 360;
    const inWin = events.filter((e) => {
      const p = (e.stop.arrMin ?? e.stop.depMin);
      return p >= win && p - win <= 600;
    });
    const picked = (inWin.length ? inWin : events).sort((a, b) => (a.stop.arrMin ?? a.stop.depMin) - (b.stop.arrMin ?? b.stop.depMin)).slice(0, st.level <= 1 ? 14 : 10);
    const sceneStart = Math.max(0, win - 5);
    const taken = [];
    const trains = [];
    for (const e of picked) {
      const t = makeTrain(e, st, taken, sceneStart, line);
      taken.push({ ...t, code: t.no, last: t.dest, next: t.dest, arr: t.arr, priority: t.priority });
      trains.push(t);
    }
    if (!trains.length) {
      trains.push(...synthetic(st, line));
      win = 360;
    } else if (trains[0]) {
      const savedDep = trains[0].dep;
      trains[0].arr = Math.max(0, sceneStart - 4);
      if (savedDep <= trains[0].arr) trains[0].dep = trains[0].arr + 12;
    }
    const tracks = st.level === 0 ? 10 : st.level === 1 ? 8 : st.level === 2 ? 6 : 4;
    const cross = CROSS[st.name] || [];
    const stationLines = [`${line === 'jiaoliu' ? '焦柳线' : '宁西线'}`, ...cross];
    const title = `${st.name}站 · ${LEVEL_NAME[st.level]}`;
    const hubId = `${line === 'jiaoliu' ? 'jl' : 'nx'}-${st.slug}`;
    packs[line][hubId] = {
      station: { id: st.slug, name: `${st.name}站`, code: st.code || st.slug.toUpperCase(), line: stationLines.join(' / ') },
      yards: [{ id: 'main', name: '站场', type: `${LEVEL_NAME[st.level]}复线站`, tracks, platform: Math.min(3, tracks), freight: Math.min(4, tracks), note: `${tracks} 道，含正线；${stationLines.join('、')}交汇` }],
      trains
    };
    scenes.push({
      id: `${line === 'jiaoliu' ? 'jl' : 'nx'}-${st.slug}`,
      kind: 'pack', pack: line, title, stationName: `${st.name}站`, line, hub: hubId, hubYards: ['main'], yard: 'main',
      brief: events.length
        ? `${stationLines.join('、')} · ${LEVEL_NAME[st.level]} · ${trains.length} 列真实车次（12306 ${DATE}）`
        : `${stationLines.join('、')} · ${LEVEL_NAME[st.level]} · 无客运电报码，按货运/编组站运行`,
      terms: ['hub', 'track', 'task'], duration: 600, difficulty: st.level <= 1 ? 3 : st.level === 2 ? 2 : 1,
      weather: '晴', trains: trains.length, start: sceneStart, lines: stationLines, level: st.level,
      source: `12306 ${DATE}`, passenger: events.length > 0
    });
  }
}

fs.writeFileSync('data/hub-jl.json', JSON.stringify(packs.jiaoliu, null, 1));
fs.writeFileSync('data/hub-nx.json', JSON.stringify(packs.ningxi, null, 1));
fs.writeFileSync('data/scenes-55.json', JSON.stringify(scenes, null, 1));
console.log('JL', Object.keys(packs.jiaoliu).length, 'NX', Object.keys(packs.ningxi).length, 'SCENES', scenes.length);
console.log('ZERO', scenes.filter((s) => !s.passenger).map((s) => s.stationName).join(','));

