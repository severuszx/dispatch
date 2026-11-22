import { clamp, fmtClock, hash, rnd } from './util.js';

const BASE_SECTION_MIN = { qinglan: 28, jiangwan: 12, linhe: 4 };
const PRIORITY_LABEL = { 1: 'G', 2: 'D', 3: 'Z/T', 4: 'K', 5: '普快', 6: '货', 7: '路用', 8: '救援', 9: '专运' };

export const REALISM_DEFAULT = {
  autoRoute: 1, routeTimeout: 1, orderCheck: 1, localControl: 0, phoneBlock: 0,
  crewLimit: 1, stockChain: 1, hotLimit: 1, weather: 1, propagation: 1, reviewDetail: 2,
};

export const MODES = [
  { id: 'arcade', name: '教学', desc: '提示全开，不计分。先把台面、报文和发车流程走一遍。' },
  { id: 'standard', name: '标准', desc: '默认规章，命令需校验，复盘记录到每个决策点。' },
  { id: 'realism', name: '拟真', desc: '非常站控、电话闭塞、乘务超劳全开，不给白话提示。' },
  { id: 'story', name: '剧本', desc: '七章连续值班，上一章的处置决定下一章开局。' },
  { id: 'sandbox', name: '自定', desc: '规则、车次、天气自行设定，可导出为关卡。' },
];

class Sim {
  constructor() {
    this.listeners = new Set();
    this.scene = null;
    this.mode = 'standard';
    this.realism = { ...REALISM_DEFAULT };
    this.network = null;
    this.timetable = null;
    this.eventPool = [];
    this.glossary = [];
    this.sandbox = {};
    this.timer = null;
    this.speed = 1;
    this.paused = false;
    this.reset();
  }

  reset() {
    this.clock = 360;
    this.startClock = 360;
    this.running = false;
    this.finished = false;
    this.trains = [];
    this.sections = new Map();
    this.tracks = new Map();
    this.alarms = [];
    this.decisions = [];
    this.activeEvents = [];
    this.eventHistory = [];
    this.log = [];
    this.conditions = { speedLimits: [], blockSections: [], blockTracks: [], extraDwell: 0, crewStress: 0, phoneBlock: false, localControl: false };
    this.control = new Set();
    this.hubMode = false;
    this.hub = null;
    this.resources = { hotEmu: 2, hotLoco: 2, rescue: 1, power: 1, pway: 1 };
    this.metrics = { total: 0, onTime: 0, delaySum: 0, safety: 100, compliance: 100, effort: 100, resource: 100, emotion: 62, budget: 1200, incidents: 0, branchCount: 0, propagationDepth: 0 };
    this.eventCursor = 0;
    this.nextEventAt = 0;
    this.nextEventReal = 0;
    this.orderFeed = [];
    this.radioFeed = [];
    this.orderCursor = 0;
    this.nextOrderAt = 0;
    this.nextRadioAt = 0;
    this.weather = '晴';
    this.accident = null;
    this.routeTimer = 0;
  }

  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }

  emit(evt = 'tick') {
    this.listeners.forEach((fn) => {
      try { fn(this, evt); } catch (e) { }
    });
  }

  loadData({ network, timetable, timetable2, events, glossary, scenarios, orders, hub, hubt1, hubdc, hubveh, hubmar }) {
    this.network = network;
    this.timetables = { old: timetable, new: timetable2 || timetable };
    this.timetable = timetable;
    this.eventsData = events;
    this.scenarios = scenarios;
    this.eventPool = events.events;
    this.glossary = glossary.terms;
    this.ordersData = orders || { orders: {} };
    this.hubData = hub || null;
    this.hubDatas = { t1: hubt1, bengbu: hub, dc: hubdc, veh: hubveh, mar: hubmar };
  }

  setup(scene, mode, realism, sandbox, difficulty, ttVersion) {
    this.scene = scene;
    this.mode = mode;
    this.difficulty = difficulty || 'standard';
    this.ttVersion = ttVersion || 'old';
    this.timetable = (this.timetables && this.timetables[this.ttVersion]) || this.timetable;
    this.realism = { ...REALISM_DEFAULT, ...(realism || {}) };
    this.sandbox = sandbox || {};
    this.reset();
    if (scene.hub && this.hubDatas && this.hubDatas[scene.hub]) return this.setupHub(scene);
    this.weather = scene.weather || '晴';
    const lineId = scene.line;
    this.lineId = lineId;
    const net = this.network;
    this.line = net.lines.find((l) => l.id === lineId);
    this.stationOrder = this.line.stations;
    this.stations = net.stations;
    const trains = this.timetable[lineId].slice(0, scene.trains || 10);
    this.trains = trains.map((t) => this.makeTrain(t));
    this.metrics.total = this.trains.length;
    for (const st of this.stationOrder) {
      const conf = this.stations[st];
      const list = [];
      for (let i = 1; i <= conf.tracks; i += 1) list.push({ no: i, train: null, blocked: false, reserved: false, until: null });
      this.tracks.set(st, list);
    }
    for (const t of this.trains) {
      if (t.status !== 'pending') continue;
      const ft = this.freeTrack(t.station);
      if (ft) { ft.train = t.id; t.trackNo = ft.no; }
    }
    this.startClock = 360;
    this.clock = 360;
    this.eventPool = this.eventsForScene(scene);
    this.nextEventAt = 360 + Math.round((6 + Math.floor(rnd(hash(scene.id))() * 8)) / this.diffFactor());
    this.nextEventReal = Date.now() + 90000;
    this.orderPool = (this.ordersData.orders && this.ordersData.orders[lineId]) || [];
    this.orderCursor = Math.floor(rnd(hash(scene.id + 'o'))() * Math.max(1, this.orderPool.length));
    this.nextOrderAt = 362;
    this.nextRadioAt = 363;
    this.running = true;
    this.finished = false;
    this.log.push({ t: this.clock, text: `【开班】${scene.title} 开始，${this.line.name}，${this.weather}` });
    this.emit('setup');
  }

  setupHub(scene) {
    this.hubMode = true;
    this.hub = (this.hubDatas && this.hubDatas[scene.hub]) || this.hubData;
    const all = this.hub.yards || [];
    const picked = scene.hubYards && scene.hubYards.length ? scene.hubYards : all.map((y) => y.id);
    const yardIds = picked.filter((id) => all.some((y) => y.id === id));
    this.stationOrder = yardIds;
    this.stations = {};
    all.forEach((y) => {
      if (!yardIds.includes(y.id)) return;
      this.stations[y.id] = { ...y, km: 0, unmanned: false, code: y.id.toUpperCase() };
    });
    this.lineId = 'hub';
    this.line = {
      id: 'hub', name: scene.stationName || this.hub.station.name,
      kind: '综合枢纽', block: '站内联锁', length: 0, stations: yardIds,
    };
    this.weather = scene.weather || '晴';
    this.tracks = new Map();
    yardIds.forEach((id) => {
      const conf = this.stations[id];
      const list = [];
      for (let i = 1; i <= (conf.tracks || 1); i += 1) list.push({ no: i, train: null, blocked: false, reserved: false, until: null });
      this.tracks.set(id, list);
    });
    this.startClock = 360;
    this.clock = 360;
    this.trains = (this.hub.trains || [])
      .filter((t) => yardIds.includes(t.yard))
      .slice(0, scene.trains || 99)
      .map((t) => this.makeHubTrain(t));
    for (const t of this.trains) {
      if (t.status !== 'station') continue;
      const ft = this.freeTrack(t.station);
      if (ft) { ft.train = t.id; t.trackNo = ft.no; }
    }
    this.metrics.total = this.trains.length;
    this.control = new Set(yardIds);
    this.eventPool = this.eventsForScene(scene);
    this.eventCursor = 0;
    this.nextEventAt = this.startClock + Math.round((6 + Math.floor(rnd(hash(scene.id))() * 8)) / this.diffFactor());
    this.nextEventReal = Date.now() + 90000;
    this.orderPool = [];
    this.running = true;
    this.finished = false;
    this.log.push({ t: this.clock, text: `【开班】${scene.title} 开始，${this.line.name}，${this.stationOrder.length} 个场` });
    this.emit('setup');
  }

  makeHubTrain(raw) {
    const start = this.startClock;
    const arr = raw.arr == null ? start : raw.arr;
    const dep = raw.dep == null ? arr + 10 : raw.dep;
    const inYard = raw.arr == null || raw.arr <= start;
    return {
      id: raw.id, no: raw.no, type: raw.type, priority: raw.priority || 5,
      from: raw.yard, to: raw.yard, dir: 1, station: raw.yard,
      planArr: arr, planDep: dep, dep, arr, dwell: Math.max(1, dep - arr),
      coaches: raw.coaches || (raw.type === '货' ? 40 : 16), stock: raw.stockGroup || '', crew: raw.crew || 1,
      stops: [{ st: raw.yard, arr: raw.arr, dep: raw.dep }], stopIdx: 0, trace: [],
      status: inYard ? 'station' : 'pending', section: null, late: 0, progress: 0,
      departAt: null, arriveAt: null, trackNo: null, nextTrack: null, originTrack: null,
      holdOutside: 0, notes: [], release: false, hold: false, special: raw.special || false,
    };
  }

  tickHub() {
    for (const t of this.trains) {
      if (t.status === 'pending') {
        if (this.clock < t.planArr) continue;
        const ft = this.freeTrack(t.station);
        if (!ft) { t.holdOutside = this.clock; t.late = Math.max(t.late, this.clock - t.planArr); continue; }
        ft.train = t.id;
        t.trackNo = ft.no;
        t.status = 'station';
        t.arriveReal = this.clock;
        t.late = Math.max(t.late, this.clock - t.planArr);
        t.holdOutside = 0;
        this.pushLog(`${t.no} 接入 ${this.stations[t.station].name} ${ft.no} 道`);
        continue;
      }
      if (t.status !== 'station') continue;
      if (this.clock < t.planDep) continue;
      if (this.isStationControlled(t.station) && !t.release) {
        t.hold = true;
        t.late = Math.max(t.late, this.clock - t.planDep);
        continue;
      }
      this.leaveHub(t);
    }
  }

  leaveHub(t) {
    t.status = 'terminated';
    t.late = Math.max(t.late, this.clock - t.planDep);
    this.releaseTrack(t);
    this.metrics.onTime += t.late <= 3 ? 1 : 0;
    this.metrics.delaySum += t.late;
    this.metrics.terminated = (this.metrics.terminated || 0) + 1;
    this.pushLog(`${t.no} ${this.stations[t.station].name} 出清`);
    if (this.trains.every((x) => x.status === 'terminated')) this.finish('all');
  }

  makeTrain(t) {
    const fromIdx = this.stationOrder.indexOf(t.from);
    const toIdx = this.stationOrder.indexOf(t.to);
    const dir = toIdx > fromIdx ? 1 : -1;
    const broken = !Array.isArray(t.stops) || !t.stops.length
      || t.stops.some((s) => !s.st || this.stationOrder.indexOf(s.st) < 0)
      || t.stops[0].st !== t.from
      || t.stops[t.stops.length - 1].st !== t.to;
    let stops;
    if (broken) {
      const legs = Math.abs(toIdx - fromIdx);
      const dur = Math.max(legs, (t.arr || t.dep + legs * 8) - t.dep);
      stops = [{ st: t.from, arr: null, dep: t.dep }];
      for (let k = 1; k < legs; k += 1) {
        const arr = t.dep + Math.round((dur * k) / legs);
        stops.push({ st: this.stationOrder[fromIdx + dir * k], arr, dep: arr + (t.dwell || 2) });
      }
      stops.push({ st: t.to, arr: t.dep + dur, dep: null });
    } else {
      stops = t.stops.map((s) => ({ st: s.st, arr: s.arr, dep: s.dep }));
    }
    return {
      id: t.id, no: t.no, type: t.type, priority: t.priority, from: t.from, to: t.to,
      fromIdx, toIdx, dir, dep: stops[0].dep, arr: stops[stops.length - 1].arr,
      planDep: stops[0].dep, planArr: stops[stops.length - 1].arr,
      dwell: t.dwell || 2, coaches: t.coaches, stock: t.stockGroup, crew: t.crew,
      stops, stopIdx: 0, trace: [],
      status: 'pending', station: stops[0].st, section: null, late: 0, progress: 0,
      departAt: null, arriveAt: null, trackNo: null, holdOutside: 0, notes: [],
      release: false, hold: false,
      special: t.special || false,
    };
  }

  clockOf(m) { return m; }

  speedFactor() {
    if (this.conditions.phoneBlock) return 1.4;
    if (this.conditions.localControl) return 1.25;
    return 1;
  }

  sectionKey(a, b) {
    const i = this.stationOrder.indexOf(a);
    const j = this.stationOrder.indexOf(b);
    return `${Math.min(i, j)}-${Math.max(i, j)}`;
  }

  sectionMin(a, b) {
    const base = BASE_SECTION_MIN[this.lineId] || 8;
    const f = this.speedFactor();
    const limit = this.conditions.speedLimits.find((s) => this.sectionKey(s.a, s.b) === this.sectionKey(a, b) && s.until > this.clock);
    const extra = limit ? Math.max(2, base * 0.4) : 0;
    return Math.round((base + extra) * f);
  }

  sectionBlocked(a, b) {
    return this.conditions.blockSections.some((s) => this.sectionKey(s.a, s.b) === this.sectionKey(a, b) && s.until > this.clock);
  }

  sectionOccupant(a, b) {
    const key = this.sectionKey(a, b);
    return this.trains.find((t) => t.status === 'running' && t.section && this.sectionKey(t.section.a, t.section.b) === key);
  }

  freeTrack(station) {
    const list = this.tracks.get(station) || [];
    return list.find((tr) => !tr.train && !tr.blocked && !tr.reserved) || null;
  }

  occupiedCount(station) {
    const list = this.tracks.get(station) || [];
    return list.filter((tr) => tr.train).length;
  }

  getTrain(id) { return this.trains.find((t) => t.id === id); }

  start() {
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => {
      if (!this.paused && !this.finished) {
        for (let i = 0; i < this.speed; i += 1) this.step();
      }
    }, 700);
    this.running = true;
  }

  stop() { if (this.timer) clearInterval(this.timer); this.timer = null; }

  setSpeed(n) { this.speed = n; this.emit('speed'); }
  setPaused(p) { this.paused = p; this.emit('pause'); }

  step() {
    this.clock += 1;
    if (this.hubMode) this.tickHub();
    else this.tickTrains();
    this.tickSections();
    this.tickEvents();
    this.tickFeed();
    this.tickAlarms();
    this.evaluate();
    if (this.clock >= this.startClock + (this.scene.duration || 300)) this.finish('time');
    this.emit('tick');
  }

  tickTrains() {
    for (const t of this.trains) {
      if (t.status === 'pending') {
        if (this.clock < t.planDep) continue;
        if (this.isStationControlled(t.from) && !t.release) continue;
        if (t.stops.length === 1) { this.parkSingle(t); continue; }
        const free = this.sectionFreeFor(t.from, t.dir);
        const trackOk = this.hasTrack(t.station, t);
        if (trackOk && free) this.depart(t);
        continue;
      }
      if (t.status === 'running') {
        const dur = Math.max(1, t.arriveAt - t.departAt);
        t.progress = clamp((this.clock - t.departAt) / dur, 0, 1);
        if (this.clock >= t.arriveAt) this.arrive(t);
        continue;
      }
      if (t.status === 'waiting') {
        if (this.occupiedCount(t.station) < this.stations[t.station].tracks) {
          const ft = this.freeTrack(t.station);
          if (ft) {
            ft.train = t.id;
            t.trackNo = ft.no;
            t.holdOutside = 0;
            t.status = 'station';
            const st = t.stops[t.stopIdx];
            t.dwellLeft = Math.max(1, st.dep - st.arr) + this.conditions.extraDwell;
            this.pushLog(`${t.no} 站外停车结束，接入 ${this.stations[t.station].name} ${ft.no} 道`);
          }
        } else {
          t.late += 1;
        }
        continue;
      }
      if (t.status === 'station') {
        if (t.stopIdx >= t.stops.length - 1) { this.terminate(t); continue; }
        if (!t.dwellLeft) t.dwellLeft = Math.max(1, t.stops[t.stopIdx].dep - t.stops[t.stopIdx].arr) + this.conditions.extraDwell;
        if (t.dwellLeft > 0) t.dwellLeft -= 1;
        if (this.isStationControlled(t.station) && !t.release) { t.hold = true; continue; }
        t.hold = false;
        if (t.dwellLeft > 0) continue;
        if (this.sectionFreeFor(t.station, t.dir)) this.depart(t);
        else t.late += 1;
      }
    }
  }

  parkSingle(t) {
    const ft = this.freeTrack(t.station);
    if (!ft) { t.status = 'waiting'; t.holdOutside = this.clock; this.alarm('股道不足', `${t.no} 无空余股道`, 'warn'); return; }
    ft.train = t.id;
    t.trackNo = ft.no;
    t.status = 'station';
    t.dwellLeft = Math.max(1, t.arr - t.planDep) + this.conditions.extraDwell;
    t.trace.push({ m: this.clock, i: 0 });
    this.pushLog(`${t.no} 入 ${this.stations[t.station].name} ${ft.no} 道占用`);
  }

  hasTrack(station, train) {
    const list = this.tracks.get(station) || [];
    if (train.trackNo) {
      const tr = list.find((x) => x.no === train.trackNo);
      return !!tr && !tr.blocked;
    }
    return list.some((tr) => !tr.blocked);
  }

  nextStation(t) {
    const idx = this.stationOrder.indexOf(t.station);
    return this.stationOrder[idx + t.dir];
  }

  sectionFreeFor(station, dir) {
    const next = this.stationOrder[this.stationOrder.indexOf(station) + dir];
    if (!next) return false;
    if (this.sectionBlocked(station, next)) return false;
    const occ = this.sectionOccupant(station, next);
    if (occ) return false;
    const sameDir = this.trains.filter((x) => x.status === 'running' && x.section && this.sectionKey(x.section.a, x.section.b) === this.sectionKey(station, next));
    return sameDir.length === 0;
  }

  depart(t) {
    let trackNo = t.trackNo;
    const list = this.tracks.get(t.station) || [];
    if (!trackNo) {
      const ft = list.find((x) => !x.blocked && !x.train);
      if (!ft) {
        t.status = 'waiting';
        t.holdOutside = this.clock;
        this.alarm('站外停车', `${t.no} 在 ${this.stations[t.station].name} 无可用股道`, 'warn');
        return;
      }
      trackNo = t.trackNo = ft.no;
      ft.train = t.id;
    }
    const next = t.stops[t.stopIdx + 1].st;
    t.originTrack = trackNo;
    t.departAt = this.clock;
    t.arriveAt = this.clock + this.sectionMin(t.station, next);
    t.status = 'running';
    t.release = false;
    t.hold = false;
    t.section = { a: t.station, b: next, progress: 0 };
    t.late = Math.max(0, this.clock - t.stops[t.stopIdx].dep);
    t.trace.push({ m: this.clock, i: t.stopIdx });
    const destList = this.tracks.get(next) || [];
    const reserve = destList.find((x) => !x.train && !x.blocked && !x.reserved);
    if (reserve) { reserve.train = t.id; t.nextTrack = reserve.no; }
    this.releaseTrack(t);
    this.pushLog(`${t.no} ${this.stations[t.station].name} 发车，开往 ${this.stations[next].name}`);
  }

  releaseTrack(t) {
    const list = this.tracks.get(t.station) || [];
    const tr = list.find((x) => x.no === t.trackNo);
    if (tr && tr.train === t.id) tr.train = null;
    t.trackNo = null;
  }

  arrive(t) {
    const station = t.section.b;
    const arrDelay = Math.max(0, this.clock - t.planArr);
    t.arriveReal = this.clock;
    const list = this.tracks.get(station) || [];
    let ft = t.nextTrack ? list.find((x) => x.no === t.nextTrack) : null;
    if (ft && ft.train !== t.id) ft = null;
    if (!ft) ft = this.freeTrack(station);
    if (!ft) {
      t.status = 'waiting';
      t.station = station;
      t.section = null;
      t.holdOutside = this.clock;
      t.late = arrDelay;
      this.alarm('站外停车', `${t.no} 到达 ${this.stations[station].name}，股道已满`, 'danger');
      this.pushLog(`${t.no} 到达 ${this.stations[station].name}，无股道，站外停车`);
      return;
    }
    ft.train = t.id;
    t.trackNo = ft.no;
    t.nextTrack = null;
    t.station = station;
    t.section = null;
    t.status = 'station';
    t.late = arrDelay;
    t.dwellLeft = t.to === station ? 0 : t.dwell + this.conditions.extraDwell;
    t.arriveAt = this.clock;
    this.pushLog(`${t.no} 到达 ${this.stations[station].name} ${ft.no} 道，晚点 ${arrDelay} 分`);
    if (this.clock - t.planArr > 10) this.alarm('晚点', `${t.no} 晚点 ${this.clock - t.planArr} 分`, 'warn');
    if (t.to === station) this.terminate(t);
  }

  terminate(t) {
    t.status = 'terminated';
    this.releaseTrack(t);
    t.trackNo = null;
    this.metrics.onTime += t.late <= 3 ? 1 : 0;
    this.metrics.delaySum += t.late;
    this.pushLog(`${t.no} 终到 ${this.stations[t.to].name}，晚点 ${t.late} 分`);
    if (this.trains.every((x) => x.status === 'terminated')) this.finish('all');
  }

  tickSections() {
    const now = this.clock;
    this.conditions.blockSections = this.conditions.blockSections.filter((s) => s.until > now);
    this.conditions.speedLimits = this.conditions.speedLimits.filter((s) => s.until > now);
    this.conditions.blockTracks = this.conditions.blockTracks.filter((b) => b.until > now);
    for (const [, list] of this.tracks) {
      for (const tr of list) {
        if (tr.until && tr.until <= now) { tr.until = null; tr.blocked = false; }
      }
    }
  }

  tickFeed() {
    if (this.clock >= this.nextOrderAt && this.orderPool.length) {
      const o = this.orderPool[this.orderCursor % this.orderPool.length];
      this.orderCursor += 1;
      this.orderFeed.push({ t: this.clock, kind: 'order', speaker: '调度台', text: o.text });
      if (this.orderFeed.length > 400) this.orderFeed.shift();
      this.nextOrderAt = this.clock + 2 + Math.floor(Math.random() * 6);
    }
    if (this.clock >= this.nextRadioAt) {
      const t = this.trains.find((x) => x.status === 'running') || this.trains.find((x) => x.status === 'waiting' || x.status === 'station');
      if (t) {
        const st = this.stations[t.station] ? this.stations[t.station].name : t.station;
        const sec = t.sections && t.sections[0];
        const a = sec ? this.stations[sec.from].name : st;
        const b = sec ? this.stations[sec.to].name : st;
        const tk = t.track ? `${t.track} 道` : '站内待避';
        const lines = t.status === 'running'
          ? [
            { speaker: '司机', text: `${st} 站，${t.no} 次接近` },
            { speaker: '车站', text: `${t.no} 次，${st} 站明白，进 ${tk}` },
            { speaker: '司机', text: `${t.no} 次明白，进 ${tk}` },
            { speaker: '司机', text: `调度，${t.no} 次 ${a}—${b} 间运行正常` },
            { speaker: '调度', text: `${t.no} 次，注意前方限速，加强瞭望` },
            { speaker: '司机', text: `${t.no} 次收到` },
          ]
          : [
            { speaker: '司机', text: `调度，${t.no} 次在 ${st} 站请求发车` },
            { speaker: '调度', text: `${t.no} 次，${st} 站，发车进路已好，凭信号发车` },
            { speaker: '车站', text: `${t.no} 次，${st} 站 ${t.track ? t.track + ' 道' : '股道'}出站信号好了` },
            { speaker: '司机', text: `${t.no} 次明白，${st} 站发车` },
          ];
        const line = lines[Math.floor(Math.random() * lines.length)];
        this.radioFeed.push({ t: this.clock, kind: 'radio', speaker: line.speaker, text: line.text });
        if (this.radioFeed.length > 400) this.radioFeed.shift();
      }
      this.nextRadioAt = this.clock + 2 + Math.floor(Math.random() * 4);
    }
  }

  diffFactor() {
    return { easy: 0.68, standard: 1, hard: 1.3, expert: 1.55 }[this.difficulty] || 1;
  }

  tickEvents() {
    if (!this.eventPool.length) return;
    if (Date.now() < this.nextEventReal) return;
    if (this.activeEvents.length >= 1) { this.nextEventReal = Date.now() + 5000; return; }
    this.triggerEvent();
    this.nextEventReal = Date.now() + 300000;
  }

  eventsForScene(scene) {
    const all = (this.eventsData && this.eventsData.events) || [];
    const words = (ev) => `${ev.title} ${(ev.tags || []).join(' ')} ${ev.desc || ''}`;
    let keys = [];
    if (scene.kind === 'hub') {
      const yards = (scene.hubYards || []).join(' ');
      if (scene.hub === 'mar' || yards.includes('驼峰')) keys = ['调车', '编组', '驼峰', '解体', '股道'];
      else if (scene.hub === 'dc' || scene.hub === 'veh') keys = ['检修', '车底', '整备', '出所', '动车', '车辆', '镟轮'];
      else if (yards.includes('hy') || yards.includes('hc')) keys = ['货', '装卸', '调车', '编组', '超限', '货运'];
      else if (scene.hub === 'bengbu') keys = ['旅客', '客运', '客调', '临客', '货', '装卸', '调车', '编组'];
    } else if (scene.line === 'qinglan' || scene.line === 'jiangwan') {
      keys = ['旅客', '客运', '客调', '临客', '晚点', '客流'];
    }
    if (!keys.length) return all;
    const hit = all.filter((ev) => keys.some((k) => words(ev).includes(k)));
    return hit.length >= 8 ? hit : all;
  }

  triggerEvent() {
    const r = rnd(hash(this.scene.id) + this.eventCursor * 977 + Math.floor(this.clock));
    const size = this.eventPool.length;
    let ev = this.eventPool[Math.floor(r() * size)];
    const weatherBias = this.weather === '雨' || this.weather === '暴雨' ? 'N' : this.weather === '雪' || this.weather === '冻雨' ? 'N' : null;
    if (weatherBias && r() < 0.55) {
      const pool = this.eventPool.filter((e) => e.family === weatherBias);
      ev = pool[Math.floor(r() * pool.length)];
    }
    const targetTrain = this.pickAffectedTrain();
    const inst = {
      ...ev, instId: `${ev.id}#${this.eventCursor}`, at: this.clock, resolved: false,
      targetTrain: targetTrain ? targetTrain.id : null, deadline: this.clock + Math.max(3, Math.round((4 + d3(this.scene.difficulty)) / this.diffFactor())),
    };
    this.eventCursor += 1;
    this.activeEvents.push(inst);
    this.alarm('事件', `${ev.title}${targetTrain ? ` · ${targetTrain.no}` : ''}`, ev.severity >= 4 ? 'danger' : 'warn');
    this.pushLog(`【事件】${ev.title}${targetTrain ? `（${targetTrain.no}）` : ''}：${ev.desc}`);
    if (this.mode !== 'realism' && this.scene.kind === 'tutorial') this.showTermForEvent(ev);
    this.emit('event');
  }

  pickAffectedTrain() {
    const running = this.trains.filter((t) => t.status === 'running' || t.status === 'waiting' || t.status === 'station');
    if (!running.length) return null;
    const sorted = running.slice().sort((a, b) => b.priority - a.priority);
    return sorted[0];
  }

  showTermForEvent(ev) {
    const map = { P: 'order', E: 'switchlost', N: 'section', M: 'track' };
    const term = this.glossary.find((g) => g.id === map[ev.family]);
    if (term && this.onTerm) this.onTerm(term);
  }

  resolveEvent(instId, branchId) {
    const idx = this.activeEvents.findIndex((e) => e.instId === instId);
    if (idx < 0) return null;
    const ev = this.activeEvents[idx];
    const br = ev.branches.find((b) => b.id === branchId);
    if (!br) return null;
    ev.resolved = true;
    ev.branch = br;
    ev.resolvedAt = this.clock;
    this.activeEvents.splice(idx, 1);
    this.eventHistory.push({ ...ev, outcome: br.label });
    this.metrics.branchCount += 1;
    const t = ev.targetTrain ? this.getTrain(ev.targetTrain) : null;
    const before = {
      compliance: this.metrics.compliance, safety: this.metrics.safety,
      resource: this.metrics.resource, emotion: this.metrics.emotion,
      effort: this.metrics.effort, late: t ? t.late : 0,
    };
    const risky = br.risk === '高';
    const roll = Math.random();
    const fail = risky && roll < (0.22 + (ev.severity || 3) * 0.05);
    let note = br.effect;
    if (br.tone === 'safe') this.metrics.compliance = Math.min(100, this.metrics.compliance + 2);
    if (br.tone === 'danger') this.metrics.compliance = Math.max(0, this.metrics.compliance - 5);
    const scoreDelta = br.score + (fail ? -18 : 0);
    this.metrics.effort = clamp(this.metrics.effort + scoreDelta, 0, 120);
    if (br.label.includes('封锁') || br.label.includes('封闭')) {
      const a = t ? t.station : this.stationOrder[0];
      const b = t ? this.nextStation(t) : this.stationOrder[1];
      if (a && b) this.conditions.blockSections.push({ a, b, until: this.clock + 8 + Math.floor(Math.random() * 8) });
    }
    if (br.label.includes('限速') || br.label.includes('降速')) {
      const a = this.stationOrder[0];
      const b = this.stationOrder[this.stationOrder.length - 1];
      this.conditions.speedLimits.push({ a, b, until: this.clock + 20 });
    }
    if (br.label.includes('热备') || br.label.includes('救援')) {
      if (this.resources.rescue > 0) this.resources.rescue -= 1;
      else this.resources.hotEmu = Math.max(0, this.resources.hotEmu - 1);
      this.metrics.resource = clamp(this.metrics.resource - 6, 0, 100);
    }
    if (br.label.includes('扣车') && t) {
      t.dwellLeft = (t.dwellLeft || 0) + 3;
      t.late += 3;
    }
    if (br.label.includes('全部接入')) {
      this.metrics.emotion = clamp(this.metrics.emotion - 8, 0, 100);
    }
    if (fail) {
      this.metrics.incidents += 1;
      this.metrics.safety = Math.max(0, this.metrics.safety - 22);
      this.accident = { at: this.clock, event: ev.title, branch: br.label, train: t ? t.no : '—' };
      note = `处置失败：${br.label}。${ev.title} 演变为险性事件。`;
      this.alarm('事故', `${t ? t.no : ''} ${ev.title} 处置失败`, 'danger');
      this.pushLog(`【险性事件】${note}`);
    } else {
      if (t) t.late += Math.min(6, br.time || 0);
      this.pushLog(`【处置】${ev.title} → ${br.label}（${br.risk}风险）`);
    }
    this.decisions.push({ t: this.clock, event: ev.code, title: ev.title, branch: br.label, risk: br.risk, fail, note, train: t ? t.no : null });
    this.metrics.propagationDepth = Math.max(this.metrics.propagationDepth, (ev.severity || 1));
    const deltas = {
      compliance: Math.round(this.metrics.compliance - before.compliance),
      safety: Math.round(this.metrics.safety - before.safety),
      resource: Math.round(this.metrics.resource - before.resource),
      emotion: Math.round(this.metrics.emotion - before.emotion),
      effort: Math.round(this.metrics.effort - before.effort),
      late: t ? Math.round(t.late - before.late) : 0,
    };
    this.emit('resolve');
    return {
      fail, note,
      branch: { label: br.label, risk: br.risk, tone: br.tone, why: br.why, effect: br.effect, time: br.time || 0 },
      event: { code: ev.code, title: ev.title, severity: ev.severity, propagate: ev.propagate || [] },
      train: t ? { no: t.no, lateDelta: deltas.late } : null,
      deltas,
    };
  }

  assignTrack(trainId, station, trackNo) {
    const t = this.getTrain(trainId);
    const list = this.tracks.get(station) || [];
    const tr = list.find((x) => x.no === trackNo);
    if (!t || !tr) return false;
    if (tr.train && tr.train !== trainId) return false;
    if (tr.blocked) return false;
    if (t.trackNo) this.releaseTrack(t);
    tr.train = trainId;
    t.trackNo = trackNo;
    this.decisions.push({ t: this.clock, event: 'route', title: '指派股道', branch: `${this.stations[station].name} ${trackNo} 道`, risk: '低', train: t.no });
    this.emit('route');
    return true;
  }

  isStationControlled(id) {
    return this.control.has(id);
  }

  setStationControl(id, on) {
    if (!this.stations || !this.stations[id]) return false;
    if (on) this.control.add(id);
    else this.control.delete(id);
    this.pushLog(`${on ? '接管' : '交回'} ${this.stations[id].name} 站控`);
    this.emit('control');
    return true;
  }

  toggleStationControl(id) {
    return this.setStationControl(id, !this.control.has(id));
  }

  controlAll(on) {
    if (!this.stationOrder) return;
    this.stationOrder.forEach((id) => {
      if (on) this.control.add(id);
      else this.control.delete(id);
    });
    this.pushLog(`${on ? '全部车站转站控' : '全部车站转自律'}`);
    this.emit('control');
  }

  releaseTrain(id) {
    const t = this.getTrain(id);
    if (!t) return false;
    t.release = true;
    this.pushLog(`${t.no} 放行`);
    this.emit('control');
    return true;
  }

  openRoute(station, trackNo) {
    const list = this.tracks.get(station) || [];
    const tr = list.find((x) => x.no === trackNo);
    if (!tr) return false;
    tr.blocked = false;
    tr.until = null;
    this.pushLog(`开放 ${this.stations[station].name} ${trackNo} 道`);
    this.emit('route');
    return true;
  }

  blockTrack(station, trackNo, minutes) {
    const list = this.tracks.get(station) || [];
    const tr = list.find((x) => x.no === trackNo);
    if (!tr) return false;
    tr.blocked = true;
    tr.until = this.clock + minutes;
    this.pushLog(`封锁 ${this.stations[station].name} ${trackNo} 道 ${minutes} 分`);
    this.emit('route');
    return true;
  }

  reserveTrack(station, trackNo) {
    const list = this.tracks.get(station) || [];
    const tr = list.find((x) => x.no === trackNo);
    if (!tr) return false;
    tr.reserved = !tr.reserved;
    this.pushLog(`${tr.reserved ? '预留' : '解除预留'} ${this.stations[station].name} ${trackNo} 道`);
    this.emit('route');
    return true;
  }

  issueCommand(cmd) {
    const ok = this.validateCommand(cmd);
    this.decisions.push({ t: this.clock, event: 'order', title: `命令 ${cmd.type}`, branch: ok.ok ? '合规' : ok.reason, risk: ok.ok ? '低' : '高', train: cmd.train || null });
    if (!ok.ok) {
      this.metrics.compliance = clamp(this.metrics.compliance - 10, 0, 100);
      this.alarm('命令', `命令校验不通过：${ok.reason}`, 'danger');
      this.pushLog(`【命令退回】${cmd.type}：${ok.reason}`);
      return ok;
    }
    this.metrics.compliance = Math.min(100, this.metrics.compliance + 1);
    if (cmd.type === '限速') this.conditions.speedLimits.push({ a: this.stationOrder[0], b: this.stationOrder[this.stationOrder.length - 1], until: this.clock + cmd.minutes });
    if (cmd.type === '封锁') this.conditions.blockSections.push({ a: cmd.a, b: cmd.b, until: this.clock + cmd.minutes });
    if (cmd.type === '电话闭塞') { this.conditions.phoneBlock = true; this.speedFactor(); }
    if (cmd.type === '非常站控') { this.conditions.localControl = true; this.controlAll(true); }
    if (cmd.type === '救援' || cmd.type === '热备') {
      this.resources.rescue = Math.max(0, this.resources.rescue - 1);
      this.metrics.resource = clamp(this.metrics.resource - 4, 0, 100);
    }
    this.pushLog(`【命令】${cmd.type} 已下发 ${cmd.train || ''}，受令：${cmd.receiver || '车站/司机'}`);
    this.emit('order');
    return ok;
  }

  validateCommand(cmd) {
    if (!this.realism.orderCheck) return { ok: true };
    if (!cmd.receiver) return { ok: false, reason: '未指定受令者' };
    if (!cmd.no) return { ok: false, reason: '命令号缺失' };
    if ((cmd.type === '封锁' || cmd.type === '限速') && !cmd.train && !cmd.a) return { ok: false, reason: '缺少区间/地点' };
    if (cmd.type === '限速' && (!cmd.minutes || cmd.minutes <= 0)) return { ok: false, reason: '限速时长无效' };
    if (cmd.type === '救援' && this.resources.rescue <= 0) return { ok: false, reason: '无可用救援列车' };
    return { ok: true };
  }

  useHotStandby() {
    if (this.resources.hotEmu <= 0) return false;
    this.resources.hotEmu -= 1;
    this.metrics.resource = clamp(this.metrics.resource - 8, 0, 100);
    const delayed = this.trains.filter((t) => t.status !== 'terminated').sort((a, b) => b.late - a.late)[0];
    if (delayed) delayed.late = Math.max(0, delayed.late - 12);
    this.pushLog('启用热备动车组，替换最晚交路，晚点 -12 分');
    this.emit('resource');
    return true;
  }

  callRescue() {
    if (this.resources.rescue <= 0) return false;
    this.resources.rescue -= 1;
    this.metrics.resource = clamp(this.metrics.resource - 10, 0, 100);
    this.metrics.budget -= 180;
    this.pushLog('救援列车出动，区间封锁与抢修同步');
    this.emit('resource');
    return true;
  }

  alarm(kind, text, level) {
    const a = { id: `al${this.alarms.length + 1}`, t: this.clock, kind, text, level, ack: false };
    this.alarms.unshift(a);
    this.lastAlarm = a;
  }

  ackAlarm(id) {
    const a = this.alarms.find((x) => x.id === id);
    if (a) a.ack = true;
    this.emit('alarm');
  }

  tickAlarms() {
    if (this.alarms.length > 220) this.alarms.length = 220;
  }

  evaluate() {
    const total = this.trains.length || 1;
    const terminated = this.trains.filter((t) => t.status === 'terminated');
    const onTime = terminated.filter((t) => t.late <= 3).length;
    this.metrics.punctual = total ? Math.round((onTime / total) * 100) : 100;
    this.metrics.avgLate = terminated.length ? Math.round(terminated.reduce((s, t) => s + t.late, 0) / terminated.length) : 0;
    this.metrics.emotion = clamp(this.metrics.emotion, 0, 100);
    this.metrics.total = total;
    this.metrics.terminated = terminated.length;
    if (this.metrics.safety <= 0) this.finish('safety');
  }

  scoreTotal() {
    const m = this.metrics;
    const punctual = m.punctual || 0;
    const safety = m.safety;
    const compliance = m.compliance;
    const effort = m.effort;
    const resource = m.resource;
    const coef = (1 + (this.scene.difficulty || 3) * 0.05);
    const raw = punctual * 0.42 + safety * 0.22 + compliance * 0.16 + effort * 0.1 + resource * 0.1;
    return Math.round(raw * coef * 10) / 10;
  }

  finish(reason) {
    if (this.finished) return;
    this.finished = true;
    this.finishReason = reason;
    this.stop();
    this.emit('finish');
  }

  pushLog(text) {
    this.log.push({ t: this.clock, text });
    if (this.log.length > 600) this.log.shift();
  }

  getSnapshot() {
    return {
      clock: this.clock, clockText: fmtClock(this.clock), scene: this.scene, mode: this.mode,
      startClock: this.startClock,
      trains: this.trains, tracks: this.tracks, sections: this.sections, alarms: this.alarms,
      metrics: this.metrics, resources: this.resources, conditions: this.conditions,
      control: [...this.control],
      events: this.activeEvents, decisions: this.decisions, log: this.log,
      orderFeed: this.orderFeed, radioFeed: this.radioFeed,
      score: this.scoreTotal(), weather: this.weather, stations: this.stations,
      stationOrder: this.stationOrder, line: this.line, lineId: this.lineId,
      hub: this.hubMode ? { station: this.line.name, yards: [...this.stationOrder] } : null,
      finished: this.finished, finishReason: this.finishReason, accident: this.accident,
      budget: this.metrics.budget, priorityLabel: PRIORITY_LABEL,
    };
  }
}

function d3(x) { return Math.max(1, Math.round((x || 3) / 2)); }

export const sim = new Sim();

