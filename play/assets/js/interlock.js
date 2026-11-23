import { fmtClock } from './util.js';

const ASPECT = {
  red: { label: '红灯', code: 'H', color: '#e84b30' },
  yellow: { label: '黄灯', code: 'U', color: '#d5891f' },
  green: { label: '绿灯', code: 'L', color: '#2e9e6b' },
  double: { label: '双黄', code: 'UU', color: '#d5891f' },
  call: { label: '引导', code: 'YD', color: '#ffffff' },
  dark: { label: '灭灯', code: '—', color: '#536170' },
};

class Interlock {
  constructor() {
    this.stations = {};
    this.routes = [];
    this.faults = [];
    this.seq = 1;
  }

  init(sim) {
    this.sim = sim;
    this.stations = {};
    this.routes = [];
    this.faults = [];
    (sim.stationOrder || []).forEach((id) => {
      const conf = sim.stations[id] || {};
      const list = sim.tracks.get(id) || [];
      const switches = list.map((tr) => ({ no: tr.no, pos: 'normal', locked: false, failed: false }));
      const signals = [
        { id: `${id}-up`, dir: 1, aspect: 'red', locked: false },
        { id: `${id}-down`, dir: -1, aspect: 'red', locked: false },
      ];
      this.stations[id] = { id, name: conf.name || id, switches, signals, tracks: list.length, throatLock: { 1: null, '-1': null } };
    });
    this.sync(sim);
  }

  signalOf(station, dir) {
    const st = this.stations[station];
    if (!st) return null;
    return st.signals.find((x) => x.dir === (dir > 0 ? 1 : -1)) || st.signals[0];
  }

  routeConflict(station, track, type, dir) {
    const st = this.stations[station];
    if (!st) return '车站不在联锁范围';
    if (type !== 'through') {
      const same = this.routes.find((r) => r.station === station && r.track === track && r.state === 'locked');
      if (same) return `${track} 道已被 ${same.no} 进路锁闭`;
    }
    const throat = this.routes.find((r) => r.station === station && r.dir === dir && r.state === 'locked' && r.type !== 'shunt');
    if (throat && type !== 'through') return `${dir > 0 ? '上行' : '下行'}咽喉已被 ${throat.no} 占用`;
    const tr = (this.sim.tracks.get(station) || []).find((x) => x.no === track);
    if (!tr) return `${track} 道不存在`;
    if (tr.blocked) return `${track} 道封锁中`;
    if (tr.train && tr.train !== this.currentTrain) return `${track} 道有车占用`;
    return '';
  }

  request(station, track, type, trainId) {
    const sim = this.sim;
    const t = trainId ? sim.getTrain(trainId) : null;
    const dir = t ? t.dir : 1;
    this.currentTrain = trainId;
    const block = this.routeConflict(station, track, type, dir);
    this.currentTrain = null;
    if (block) return { ok: false, msg: block };
    const st = this.stations[station];
    if (!st) return { ok: false, msg: '车站不在联锁范围' };
    const sw = st.switches.find((x) => x.no === track);
    if (sw && sw.failed) return { ok: false, msg: `${track} 道道岔失表，不能办理进路` };
    const sig = this.signalOf(station, dir);
    if (sig && sig.aspect === 'dark') return { ok: false, msg: `${dir > 0 ? '上行' : '下行'}信号灭灯，需引导接车` };
    const route = {
      id: `R${this.seq += 1}`, station, track, type, dir, trainId: trainId || '',
      no: t ? t.no : '', state: 'locked', at: sim.clock, by: 'manual',
    };
    this.routes.push(route);
    if (sw) { sw.pos = 'reverse'; sw.locked = true; }
    if (sig) { sig.aspect = 'green'; sig.locked = true; }
    st.throatLock[dir] = route.id;
    if (t) {
      const ok = sim.assignTrack(t.id, station, track);
      if (!ok) {
        this.clear(route.id);
        return { ok: false, msg: '股道条件不满足' };
      }
      route.trainId = t.id;
      t.routeId = route.id;
    }
    sim.pushLog(`${this.stations[station].name} ${track} 道 ${type === 'through' ? '通过' : type === 'depart' ? '发车' : '接车'}进路锁闭`);
    sim.emit('route');
    return { ok: true, msg: `${track} 道进路锁闭，信号开放`, route };
  }

  clear(routeId, reason = '') {
    const r = this.routes.find((x) => x.id === routeId);
    if (!r) return false;
    r.state = 'clear';
    r.clearAt = this.sim ? this.sim.clock : 0;
    const st = this.stations[r.station];
    if (st) {
      const sw = st.switches.find((x) => x.no === r.track);
      if (sw) { sw.locked = false; sw.pos = 'normal'; }
      const sig = this.signalOf(r.station, r.dir);
      if (sig) { sig.locked = false; sig.aspect = 'red'; }
      if (st.throatLock[r.dir] === r.id) st.throatLock[r.dir] = null;
    }
    if (reason && this.sim) this.sim.pushLog(`进路 ${r.id} 解锁：${reason}`);
    if (this.sim) this.sim.emit('route');
    return true;
  }

  autoClear(sim) {
    for (const r of this.routes) {
      if (r.state !== 'locked' || !r.trainId) continue;
      const t = sim.getTrain(r.trainId);
      if (!t || t.status === 'terminated' || t.status === 'running' || (t.status === 'station' && t.trackNo !== r.track && r.type !== 'receive')) {
        this.clear(r.id, `${r.no || '列车'} 已离开 ${r.track} 道`);
      }
    }
  }

  sync(sim) {
    this.sim = sim;
    if (!this.stations || !Object.keys(this.stations).length) this.init(sim);
    this.autoClear(sim);
    for (const id of sim.stationOrder || []) {
      const st = this.stations[id];
      if (!st) continue;
      for (const tr of sim.tracks.get(id) || []) {
        const sw = st.switches.find((x) => x.no === tr.no);
        if (sw) sw.failed = !!tr.faultSwitch;
      }
      for (const sig of st.signals) {
        if (sig.locked) continue;
        const approach = (sim.trains || []).some((t) => t.station === id && (t.status === 'approach' || t.status === 'pending') && t.dir === sig.dir);
        const occupied = (sim.tracks.get(id) || []).some((tr) => tr.train);
        sig.aspect = sig.faultDark ? 'dark' : sig.faultCall ? 'call' : approach ? 'yellow' : occupied ? 'red' : 'red';
      }
    }
  }

  inject(station, kind, trackNo) {
    const st = this.stations[station];
    if (!st) return { ok: false, msg: '车站不在联锁范围' };
    const tr = (this.sim.tracks.get(station) || []).find((x) => x.no === trackNo);
    const sig = this.signalOf(station, 1);
    if (kind === 'redband' && tr) {
      tr.blocked = true;
      tr.until = this.sim.clock + 20;
      this.sim.alarm('红光带', `${st.name} ${trackNo} 道红光带`, 'danger');
    }
    if (kind === 'switch' && tr) {
      tr.faultSwitch = true;
      tr.blocked = true;
      this.sim.alarm('道岔失表', `${st.name} ${trackNo} 道道岔失表`, 'danger');
    }
    if (kind === 'signal' && sig) {
      sig.faultDark = true;
      this.sim.alarm('信号灭灯', `${st.name} 上行信号灭灯`, 'danger');
    }
    if (kind === 'power') {
      this.sim.conditions.powerOut = true;
      this.sim.alarm('供电中断', `${st.name} 接触网停电`, 'danger');
    }
    if (kind === 'comm') {
      this.sim.conditions.commOut = true;
      this.sim.alarm('通信中断', `${st.name} 调度电话中断`, 'danger');
    }
    this.sim.pushLog(`${st.name} 注入故障：${kind}`);
    this.sim.emit('fault');
    return { ok: true, msg: '故障已注入' };
  }

  recover(station, kind, trackNo) {
    const st = this.stations[station];
    if (!st) return false;
    const tr = (this.sim.tracks.get(station) || []).find((x) => x.no === trackNo);
    if (kind === 'redband' && tr) { tr.blocked = false; tr.until = null; }
    if (kind === 'switch' && tr) { tr.faultSwitch = false; tr.blocked = false; }
    if (kind === 'signal') {
      for (const sig of st.signals) sig.faultDark = false;
    }
    if (kind === 'power') this.sim.conditions.powerOut = false;
    if (kind === 'comm') this.sim.conditions.commOut = false;
    this.sim.pushLog(`${st.name} 故障恢复：${kind}`);
    this.sim.emit('fault');
    return true;
  }

  snapshot() {
    const routes = this.routes.filter((r) => r.state === 'locked').map((r) => ({
      id: r.id, station: r.station, track: r.track, type: r.type, dir: r.dir, no: r.no, at: r.at,
    }));
    const stations = {};
    for (const [id, st] of Object.entries(this.stations)) {
      stations[id] = {
        signals: st.signals.map((x) => ({ dir: x.dir, aspect: x.aspect, color: ASPECT[x.aspect] ? ASPECT[x.aspect].color : '#536170', label: ASPECT[x.aspect] ? ASPECT[x.aspect].label : '' })),
        switches: st.switches.map((x) => ({ no: x.no, pos: x.pos, locked: x.locked, failed: x.failed })),
        throat: st.throatLock,
      };
    }
    return { routes, stations };
  }
}

export { Interlock, ASPECT };
