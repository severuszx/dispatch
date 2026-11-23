import { career, saveCareer } from './career.js';
import { SEGMENTS, STATIONS } from './stations.js';
import { policyMod } from './review.js';
import { linePackCount, expansionLoad } from './dlc.js';
import { emuService } from './emu.js';
import { portDemand } from './port.js';

const DEMAND = {
  'qing-bai': { pax: 38, freight: 22, cap: 70 },
  'bai-he': { pax: 26, freight: 16, cap: 62 },
  'he-ling': { pax: 20, freight: 15, cap: 52 },
};

const DEFAULT = {
  'qing-bai': { pax: 62, freight: 38, priority: '均衡' },
  'bai-he': { pax: 55, freight: 45, priority: '均衡' },
  'he-ling': { pax: 48, freight: 52, priority: '货运' },
};

export function allocations() {
  const raw = career.data.traffic || {};
  const out = {};
  for (const seg of SEGMENTS) {
    const d = DEFAULT[seg.id];
    const v = raw[seg.id] || {};
    let pax = Number.isFinite(v.pax) ? Math.round(v.pax) : d.pax;
    pax = Math.max(10, Math.min(90, pax));
    out[seg.id] = { pax, freight: 100 - pax, priority: v.priority || d.priority };
  }
  return out;
}

export function setAllocation(segId, pax, priority) {
  if (!DEMAND[segId]) return false;
  if (!career.data.traffic) career.data.traffic = {};
  const p = Math.max(10, Math.min(90, Math.round(Number(pax) || 50)));
  career.data.traffic[segId] = { pax: p, freight: 100 - p, priority: priority || (career.data.traffic[segId] || {}).priority || '均衡' };
  saveCareer();
  return true;
}

export function evaluateTraffic() {
  const alloc = allocations();
  const rows = SEGMENTS.map((seg) => {
    const d = DEMAND[seg.id];
    const a = alloc[seg.id];
    const lineDemand = linePackCount() * 2;
    const exp = expansionLoad();
    const emu = emuService();
    const demand = Math.round((d.pax + exp.pax + emu.pax) * (1 + policyMod('pax'))) + Math.round((d.freight + exp.freight + portDemand()) * (1 + policyMod('freight'))) + lineDemand;
    const cap = d.cap + (career.data.built || []).filter((x) => x.includes(`${seg.from}:track_1`) || x.includes(`${seg.to}:track_1`)).length * 2;
    const pressure = demand / Math.max(1, cap);
    const overflow = Math.max(0, demand - cap);
    const baseDelay = Math.round(overflow * 3 + Math.max(0, pressure - 0.95) * 18);
    const paxDelay = baseDelay + (a.pax < 40 ? 3 : 0) + (a.priority === '货运' ? 2 : 0);
    const freightDelay = baseDelay + (a.freight < 30 ? 3 : 0) + (a.priority === '客运' ? 2 : 0);
    const risk = pressure > 1.15 ? '挤占' : pressure > 0.95 ? '饱和' : '可控';
    return {
      ...seg, ...d, pax: a.pax, freight: a.freight, priority: a.priority,
      demand, cap, pressure, overflow, paxDelay, freightDelay, risk,
      note: overflow ? `本班约 ${overflow} 列排不进去，压向邻站` : `还能吃 ${Math.max(0, cap - demand)} 列`,
    };
  });
  const stationDelay = { qinglan: 0, baishu: 0, heyuan: 0, lingkou: 0 };
  rows.forEach((r, i) => {
    const to = r.to;
    const add = Math.round((r.paxDelay + r.freightDelay) / 4);
    stationDelay[to] = (stationDelay[to] || 0) + add;
    if (i > 0) stationDelay[r.from] = Math.max(stationDelay[r.from] || 0, Math.round(rows[i - 1].paxDelay / 2));
  });
  stationDelay.lingkou += Math.round(rows[2].freightDelay / 3);
  const worst = rows.slice().sort((a, b) => b.pressure - a.pressure)[0];
  return { rows, stationDelay, worst, totalDelay: rows.reduce((a, r) => a + r.paxDelay + r.freightDelay, 0) };
}

export function applyTraffic(sim) {
  if (!sim || !sim.stationOrder) return;
  const ev = evaluateTraffic();
  const carry = career.data.carryDelay || {};
  const combined = {};
  for (const id of Object.keys(ev.stationDelay)) combined[id] = (carry[id] || 0) + ev.stationDelay[id];
  sim.trafficDelay = {};
  sim.trafficDelayMap = combined;
  const known = sim.stationOrder.some((id) => STATIONS[id]);
  const fallback = Math.max(0, ...Object.values(combined));
  for (const id of sim.stationOrder) {
    sim.trafficDelay[id] = known && STATIONS[id] ? (combined[id] || 0) : fallback;
  }
  if (!Object.keys(sim.trafficDelay).length && sim.focusStation) sim.trafficDelay[sim.focusStation] = fallback;
  sim.trafficSummary = ev;
  sim.pushLog?.(`车流分配：最紧 ${STATIONS[ev.worst.from].name}—${STATIONS[ev.worst.to].name}，压力 ${Math.round(ev.worst.pressure * 100)}%`);
  return ev;
}

export function carryTraffic() {
  const ev = evaluateTraffic();
  const prev = career.data.carryDelay || {};
  const next = {};
  for (const id of Object.keys(ev.stationDelay)) next[id] = Math.round((prev[id] || 0) * 0.5 + ev.stationDelay[id]);
  career.data.carryDelay = next;
  saveCareer();
  return next;
}

export function trafficDelayAt(id) {
  return evaluateTraffic().stationDelay[id] || 0;
}
