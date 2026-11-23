function groupsOf(id) {
  const s = st(id);
  if (!s.groups || !GROUPS.every((g) => Number.isFinite(s.groups[g.id]))) {
    s.groups = {};
    GROUPS.forEach((g) => { s.groups[g.id] = clamp(stationDef(id).facility + (4 - g.offset), 35, 100); });
  }
  return s.groups;
}

function facAvg(id) {
  const g = groupsOf(id);
  return GROUPS.reduce((a, x) => a + g[x.id], 0) / GROUPS.length;
}

function capacity(id) {
  const s = st(id);
  return s.tracks * 14 + s.platforms * 10 + s.sidings * 6;
}

function fresh() {
  const stations = {};
  STATIONS.forEach((s) => {
    stations[s.id] = {
      tracks: s.tracks, platforms: s.platforms, sidings: s.sidings,
      staff: s.staff, need: s.need, morale: 72, backlog: 0, build: null, groups: {},
    };
  });
  const segments = {};
  SEGMENTS.forEach((s) => { segments[s.id] = { pax: 62 }; });
  const now = {
    v: 1, day: 1, week: 1, cash: 300000, reputation: 52, superior: 70, ap: 2, demandIndex: 1,
    stations, segments, contracts: [], offers: [], policy: null, policyDue: false,
    ledger: [], effects: [], event: null, over: null, selected: 'qinglan', startedAt: Date.now(),
  };
  now.offers = makeOffers(now, 3);
  return now;
}

function contractAdd(stationId) {
  return state.contracts
    .filter((c) => c.station === stationId)
    .reduce((a, c) => a + (c.kind === 'freight' ? 0 : 0) + c.add, 0);
}

function effectSum(key) {
  let v = 0;
  state.effects.forEach((e) => { v += e[key] || 0; });
  if (state.policy) {
    const p = POLICIES.find((x) => x.id === state.policy.id);
    if (p && p.effect[key]) v += p.effect[key];
  }
  return v;
}

function paxMix() {
  const avg = SEGMENTS.reduce((a, s) => a + state.segments[s.id].pax, 0) / SEGMENTS.length;
  return (avg - 62) / 100 * 0.26;
}

function project() {
  const rows = [];
  let revenue = 0;
  let cost = 0;
  let contractNet = 0;
  let puncPressure = 0;
  let safetyPressure = 0;
  let trafficTotal = 0;
  STATIONS.forEach((def) => {
    const s = st(def.id);
    const cAdd = contractAdd(def.id);
    const traffic = def.baseTraffic * state.demandIndex + s.backlog + cAdd;
    const cap = capacity(def.id);
    const load = traffic / cap;
    const over = Math.max(0, load - 0.92);
    const rev = def.revenueBase * clamp(traffic / def.baseTraffic, 0.55, 1.35) * (1 - Math.max(0, load - 0.96) * 0.6) * (1 + effectSum('revenue') + paxMix());
    const facility = facAvg(def.id);
    const salary = s.staff * 70;
    const maint = (900 + (100 - facility) * 8 + (s.build ? 1200 : 0)) * (1 - (state.policy && state.policy.id === 'maint' ? 0.5 : 0));
    const rowCost = (def.costBase + salary + maint) * (1 + effectSum('cost'));
    revenue += rev;
    cost += rowCost;
    trafficTotal += traffic;
    puncPressure += over * (traffic / 100);
    safetyPressure += (100 - facility) * 0.16;
    rows.push({ id: def.id, name: def.name, traffic, cap, load, over, rev, cost: rowCost, facility, net: rev - rowCost });
  });
  const segRows = SEGMENTS.map((def) => {
    const demand = def.demand * state.demandIndex + state.contracts.reduce((a, c) => a + c.add * 0.45, 0);
    const load = demand / def.capacity;
    puncPressure += Math.max(0, load - 0.9) * 2.2;
    return { ...def, demand, load };
  });
  state.contracts.forEach((c) => {
    const load = rows.find((r) => r.id === c.station).load;
    const ok = load <= 1.22;
    contractNet += ok ? c.reward : -c.penalty;
  });
  const facilityAvg = STATIONS.reduce((a, d) => a + facAvg(d.id), 0) / STATIONS.length;
  const shortage = STATIONS.reduce((a, d) => a + Math.max(0, st(d.id).need - st(d.id).staff), 0);
  const morale = STATIONS.reduce((a, d) => a + st(d.id).morale, 0) / STATIONS.length;
  const punc = Math.round(clamp(94 - puncPressure * 0.7 - (100 - facilityAvg) * 0.22 - shortage * 0.7 - Math.max(0, 70 - morale) * 0.25 + effectSum('punc'), 20, 100));
  const safety = Math.round(clamp(96 - safetyPressure - shortage * 0.5 + effectSum('safety'), 25, 100));
  const net = revenue + contractNet - cost;
  return { rows, segRows, revenue, cost, contractNet, net, punc, safety, facilityAvg, shortage, trafficTotal };
}

function makeOffers(target, n) {
  const today = target.day || 1;
  const out = [];
  const used = new Set();
  for (let i = 0; i < n; i++) {
    let idx = (today * 3 + i * 5 + Math.floor(Math.random() * 7)) % CONTRACT_POOL.length;
    while (used.has(idx)) idx = (idx + 1) % CONTRACT_POOL.length;
    used.add(idx);
    const base = CONTRACT_POOL[idx];
    out.push({ ...base, id: `c-${today}-${i}-${idx}`, left: base.days, active: false });
  }
  return out;
}
