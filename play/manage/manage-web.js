const CLOUD_TOKEN_KEY = 'tst-dispatch-cloud-token';
function cloudToken() {
  try { return localStorage.getItem(CLOUD_TOKEN_KEY) || ''; } catch (e) { return ''; }
}
function setCloudToken(t) {
  try { if (t) localStorage.setItem(CLOUD_TOKEN_KEY, String(t).trim()); else localStorage.removeItem(CLOUD_TOKEN_KEY); return true; } catch (e) { return false; }
}
function parseCloudInput(text) {
  const s = String(text || '').trim();
  if (!s) return '';
  const m = s.match(/gist\.github\.com\/[^/]+\/([a-f0-9]+)/i) || s.match(/^([a-f0-9]{12,})$/i);
  return m ? m[1] : '';
}
function uploadCloud(code, meta) { return import('https://severuszx.github.io/dispatch/play/assets/js/cloud.js').then((m) => m.uploadCloud(code, meta)); }
function downloadCloud(id) { return import('https://severuszx.github.io/dispatch/play/assets/js/cloud.js').then((m) => m.downloadCloud(id)); }

const KEY = 'dispatch-manage-v1';
const SLOT = (n) => `dispatch-manage-slot-${n}`;
const TERM = 60;

const STATIONS = [
  { id: 'qinglan', name: '宝鸡', code: '44801', grade: '一等站', km: 0, tracks: 8, platforms: 3, sidings: 3, staff: 36, need: 31, facility: 91, baseTraffic: 140, revenueBase: 18600, costBase: 12100 },
  { id: 'baishu', name: '秦岭', code: '44802', grade: '三等站', km: 45, tracks: 3, platforms: 1, sidings: 1, staff: 14, need: 10, facility: 83, baseTraffic: 42, revenueBase: 7800, costBase: 5200 },
  { id: 'heyuan', name: '凤县', code: '44803', grade: '三等站', km: 108, tracks: 3, platforms: 1, sidings: 2, staff: 12, need: 11, facility: 78, baseTraffic: 50, revenueBase: 8200, costBase: 5600 },
  { id: 'lingkou', name: '略阳', code: '44804', grade: '二等站', km: 200, tracks: 5, platforms: 2, sidings: 2, staff: 24, need: 20, facility: 87, baseTraffic: 88, revenueBase: 12400, costBase: 8800 },
];

const SEGMENTS = [
  { id: 'qing-bai', from: 'qinglan', to: 'baishu', km: 45, capacity: 120, demand: 102, limit: 70 },
  { id: 'bai-he', from: 'baishu', to: 'heyuan', km: 63, capacity: 90, demand: 63, limit: 65 },
  { id: 'he-ling', from: 'heyuan', to: 'lingkou', km: 92, capacity: 75, demand: 55, limit: 60 },
];

const GROUPS = [
  { id: 'signal', name: '信号联锁', cost: 9000, offset: 6 },
  { id: 'track', name: '线路股道', cost: 12000, offset: 0 },
  { id: 'platform', name: '站台雨棚', cost: 6000, offset: 2 },
  { id: 'building', name: '站房候车', cost: 5000, offset: 3 },
  { id: 'power', name: '供电照明', cost: 7000, offset: 1 },
];

const BUILDS = [
  { id: 'track', name: '到发线扩建', desc: '股道 +2，能力 +36 列/日', cost: 120000, days: 12 },
  { id: 'platform', name: '站台改造', desc: '站台 +1，能力 +12 列/日', cost: 90000, days: 9 },
  { id: 'siding', name: '存车线增设', desc: '侧线 +1，能力 +8 列/日', cost: 60000, days: 7 },
  { id: 'facility', name: '设施整修', desc: '五组设施各 +8 状态', cost: 70000, days: 5 },
];

const POLICIES = [
  { id: 'safe', name: '安全整顿', desc: '安全 +6，成本 +2%，准点 -2', effect: { safety: 6, cost: 0.02, punc: -2 } },
  { id: 'income', name: '增收会战', desc: '收入 +8%，安全 -5', effect: { revenue: 0.08, safety: -5 } },
  { id: 'flow', name: '保畅通', desc: '准点 +6，成本 +3%', effect: { punc: 6, cost: 0.03 } },
  { id: 'maint', name: '设备养护', desc: '设施老化减半，成本 +2%', effect: { maintain: 0.5, cost: 0.02 } },
  { id: 'save', name: '节支降耗', desc: '成本 -8%，准点 -5', effect: { cost: -0.08, punc: -5 } },
];

const CONTRACT_POOL = [
  { name: '陕煤电煤', kind: 'freight', station: 'qinglan', add: 16, reward: 4200, penalty: 1600, days: 5 },
  { name: '宝鸡钢材', kind: 'freight', station: 'qinglan', add: 12, reward: 3400, penalty: 1400, days: 6 },
  { name: '秦岭砂石', kind: 'freight', station: 'baishu', add: 8, reward: 2200, penalty: 900, days: 4 },
  { name: '凤县矿石', kind: 'freight', station: 'heyuan', add: 10, reward: 2600, penalty: 1000, days: 5 },
  { name: '略阳水泥', kind: 'freight', station: 'lingkou', add: 14, reward: 3600, penalty: 1500, days: 6 },
  { name: '西安局通勤', kind: 'pax', station: 'baishu', add: 6, reward: 2100, penalty: 700, days: 5 },
  { name: '汉中旅游专列', kind: 'pax', station: 'lingkou', add: 10, reward: 3200, penalty: 1100, days: 4 },
  { name: '宝成线普速', kind: 'pax', station: 'heyuan', add: 8, reward: 2800, penalty: 900, days: 5 },
  { name: '秦岭避暑客流', kind: 'pax', station: 'qinglan', add: 12, reward: 3800, penalty: 1300, days: 4 },
  { name: '略阳集装箱', kind: 'freight', station: 'lingkou', add: 12, reward: 4000, penalty: 1700, days: 7 },
];

let state = null;
let tab = 'overview';
let selected = 'qinglan';

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fm = (n) => `¥${Math.round(n).toLocaleString('zh-CN')}`;
const num = (n, d = 0) => Number(n).toLocaleString('zh-CN', { maximumFractionDigits: d, minimumFractionDigits: d });
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pct = (v) => `${Math.round(v * 100)}%`;
const st = (id) => state.stations[id];
const seg = (id) => SEGMENTS.find((s) => s.id === id);
const stationDef = (id) => STATIONS.find((s) => s.id === id);


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


function makeEvent() {
  const pool = [
    {
      id: 'signal', station: 'qinglan', kicker: '设备故障', title: '宝鸡站 3 道信号机红灯',
      body: '<p>电务值班员报：3 道出站信号机点不亮，可能是电缆盒进水。今晚还有 6 列客车要发。</p><p>抢修要停一条股道，不修就得靠引导信号放行。</p>',
      choices: [
        { label: '立即抢修', tone: 'warn', apply: { cash: -15000, facility: 8, safety: 4 } },
        { label: '引导信号放行', apply: { safety: -7, punc: -4, effect: { label: '信号带病运行', days: 2, safety: -3 } } },
      ],
    },
    {
      id: 'inspection', kicker: '上级检查', title: '路局安全科突查',
      body: '<p>安全科到站，重点看接发列车记录、施工作业和消防台账。值班员把两个月的记录都搬了出来。</p>',
      choices: [
        { label: '全员配合检查', tone: 'warn', apply: { cash: -10000, superior: 8, punc: 3 } },
        { label: '按日常口径应付', apply: { safety: -8, superior: -5 } },
      ],
    },
    {
      id: 'coal', kicker: '货主加车', title: '陕煤要求临时加开两列',
      body: '<p>货主说电厂库存见底，今晚必须再加两列电煤。站内空车够，但会让 1 道紧张两天。</p>',
      choices: [
        { label: '接这两列', tone: 'good', apply: { cash: 9000, punc: -4, effect: { label: '电煤加车', days: 2, punc: -3 } } },
        { label: '推给邻站', apply: { reputation: -3, superior: -2 } },
      ],
    },
    {
      id: 'storm', kicker: '天气', title: '秦岭区段暴雨预警',
      body: '<p>工务报：秦岭—凤县间连续降雨，边坡有落石风险。调度所要求客车限速 45 km/h。</p>',
      choices: [
        { label: '客车降速', tone: 'warn', apply: { punc: -5, safety: 6, effect: { label: '限速运行', days: 1, punc: -2 } } },
        { label: '按图定速度跑', apply: { safety: -9, punc: 2 } },
      ],
    },
    {
      id: 'sick', kicker: '人员', title: '凤县站两名值班员请假',
      body: '<p>凤县站夜班两名值班员同时请病假，站里只剩一个能盯信号的人。要么从宝鸡调人，要么让站长顶班。</p>',
      choices: [
        { label: '从宝鸡调两名', tone: 'warn', apply: { cash: -8000, punc: 3 } },
        { label: '站长顶班', apply: { cash: -2000, morale: -5, punc: -3, effect: { label: '疲劳顶班', days: 2, punc: -2 } } },
      ],
    },
  ];
  return pool[Math.floor(Math.random() * pool.length)];
}

function save(silent) {
  try {
    state.selected = selected;
    localStorage.setItem(KEY, JSON.stringify(state));
    if (!silent) toast('已保存到本机');
  } catch (e) { toast('本机存储不可用'); }
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || s.v !== 1 || !s.stations) return null;
    return s;
  } catch (e) { return null; }
}

function normalize(s) {
  STATIONS.forEach((d) => {
    if (!s.stations[d.id]) s.stations[d.id] = { tracks: d.tracks, platforms: d.platforms, sidings: d.sidings, staff: d.staff, need: d.need, morale: 70, backlog: 0, build: null, groups: {} };
    const x = s.stations[d.id];
    if (!x.groups || !GROUPS.every((g) => Number.isFinite(x.groups[g.id]))) {
      x.groups = {};
      GROUPS.forEach((g) => { x.groups[g.id] = clamp(d.facility + (4 - g.offset), 35, 100); });
    }
  });
  if (!Number.isFinite(s.ap)) s.ap = 2;
  s.effects = s.effects || [];
  s.ledger = s.ledger || [];
  s.contracts = s.contracts || [];
  s.offers = s.offers || [];
  return s;
}

function toast(text) {
  const t = $('mToast');
  t.textContent = text;
  t.classList.remove('hidden');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.add('hidden'), 2200);
}

function modal(kicker, title, body, actions) {
  $('mModalKicker').textContent = kicker;
  $('mModalTitle').textContent = title;
  $('mModalBody').innerHTML = body;
  const box = $('mModalActions');
  box.innerHTML = '';
  actions.forEach((a) => {
    const b = document.createElement('button');
    b.className = `m-btn ${a.tone || ''}`;
    b.textContent = a.label;
    b.addEventListener('click', a.fn);
    box.appendChild(b);
  });
  $('mModal').classList.remove('hidden');
}

function closeModal() { $('mModal').classList.add('hidden'); }

function rating() {
  const avgNet = state.ledger.length ? state.ledger.slice(-7).reduce((a, x) => a + x.net, 0) / Math.min(7, state.ledger.length) : 0;
  if (avgNet > 12000 && state.reputation >= 65) return 'A';
  if (avgNet > 6000) return 'B';
  if (avgNet > 0) return 'C';
  return 'D';
}

function decideList(p) {
  const out = [];
  p.rows.forEach((r) => {
    if (r.load > 1.02) out.push(`${r.name}能力负荷 ${pct(r.load)}，压车 ${Math.round(r.traffic - r.cap)} 列`);
    else if (r.load > 0.9) out.push(`${r.name}接近满图，扩建或分流`);
    if (r.facility < 60) out.push(`${r.name}设施状态 ${Math.round(r.facility)}，安排整修`);
    if (st(r.id).need > st(r.id).staff) out.push(`${r.name}缺员 ${st(r.id).need - st(r.id).staff} 人`);
  });
  if (!state.policy || state.policy.left <= 0) out.push('本周政策未定，去政策页选一项');
  if (state.ap <= 0) out.push('今日动作已用完，推进一天再办');
  const ending = state.contracts.filter((c) => c.left <= 1);
  if (ending.length) out.push(`${ending[0].name}今天到期，注意兑现`);
  if (!out.length) out.push('设备与人手都在控，按当前节奏推进');
  return out.slice(0, 6);
}


function renderTop() {
  $('mDay').textContent = `第 ${state.day} 日`;
  $('mCash').textContent = fm(state.cash);
  $('mRep').textContent = Math.round(state.reputation);
  $('mSup').textContent = Math.round(state.superior);
  $('mActs').textContent = `${state.ap}/2`;
  $('mCash').style.color = state.cash < 0 ? '#e0665c' : '';
}

function segColor(load) { return load > 0.98 ? 'bad' : load > 0.86 ? 'warn' : ''; }

function renderMap(p) {
  const xs = [90, 360, 630, 900];
  const y = 118;
  const nodeW = 120;
  const nodeH = 58;
  let svg = `<svg viewBox="0 0 1000 246" preserveAspectRatio="xMidYMid meet">
  <defs><pattern id="grid" width="25" height="25" patternUnits="userSpaceOnUse"><path d="M 25 0 L 0 0 0 25" fill="none" stroke="#162126" stroke-width="1"/></pattern></defs>
  <rect width="1000" height="246" fill="url(#grid)"/>`;
  SEGMENTS.forEach((s, i) => {
    const x1 = xs[i] + nodeW / 2;
    const x2 = xs[i + 1] - nodeW / 2;
    const sr = p.segRows[i];
    const c = segColor(sr.load);
    svg += `<line class="map-line" x1="${x1}" y1="${y}" x2="${x2}" y2="${y}"/>`;
    svg += `<line class="map-line-hot" x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke-dasharray="3 7" opacity="${sr.load > 0.86 ? 0.75 : 0.2}"/>`;
    svg += `<text class="seg-label" x="${(x1 + x2) / 2}" y="${y - 18}" text-anchor="middle">${s.km} km · 限 ${s.limit}</text>`;
    svg += `<text class="seg-label" x="${(x1 + x2) / 2}" y="${y + 18}" text-anchor="middle">${Math.round(sr.demand)}/${s.capacity} 列</text>`;
    svg += `<rect class="seg-bar" x="${(x1 + x2) / 2 - 34}" y="${y + 27}" width="68" height="4"/>`;
    svg += `<rect class="seg-fill ${c}" x="${(x1 + x2) / 2 - 34}" y="${y + 27}" width="${68 * Math.min(1, sr.load)}" height="4"/>`;
  });
  STATIONS.forEach((d, i) => {
    const r = p.rows[i];
    const on = selected === d.id;
    const c = r.load > 0.98 ? 'bad' : r.load > 0.9 ? 'warn' : '';
    svg += `<g class="map-station" data-id="${d.id}" style="cursor:pointer">
      <rect class="map-node ${on ? 'on' : ''}" x="${xs[i] - nodeW / 2}" y="${y - nodeH / 2}" width="${nodeW}" height="${nodeH}"/>
      <text class="map-title" x="${xs[i]}" y="${y - 10}" text-anchor="middle">${d.name}</text>
      <text class="map-sub" x="${xs[i]}" y="${y + 7}" text-anchor="middle">${d.grade} · ${d.tracks} 道</text>
      <text class="map-ratio" x="${xs[i]}" y="${y + 23}" text-anchor="middle" fill="${c === 'bad' ? '#e0665c' : c === 'warn' ? '#d6a14a' : '#8c9a97'}">负荷 ${pct(r.load)} · ${Math.round(r.traffic)} 列</text>
    </g>`;
  });
  svg += `<text class="map-sub" x="24" y="226">宝成线 · 四站三区段 · 单线半自动闭塞</text>
  <text class="map-sub" x="976" y="226" text-anchor="end">第 ${state.week} 周 / 第 ${state.day} 日</text></svg>`;
  $('mMap').innerHTML = svg;
  $('mMap').querySelectorAll('.map-station').forEach((g) => {
    g.addEventListener('click', () => { selected = g.dataset.id; tab = 'station'; setNav(); renderAll(); });
  });
}

function setNav() {
  document.querySelectorAll('#mNav [data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
}

function renderInspector(p) {
  const d = stationDef(selected);
  const r = p.rows.find((x) => x.id === selected);
  const s = st(selected);
  const facility = facAvg(selected);
  const c = s.build ? `施工中 · ${s.build.name} · 剩 ${s.build.left} 天` : '无施工';
  $('mInspector').innerHTML = `
    <h3>本站 / ${d.name}</h3>
    <div class="m-ins-row"><span>站等</span><b>${d.grade}</b></div>
    <div class="m-ins-row"><span>里程</span><b>K${d.km}</b></div>
    <div class="m-ins-row"><span>股道 / 站台</span><b>${s.tracks} / ${s.platforms}</b></div>
    <div class="m-ins-row"><span>人员</span><b>${s.staff} / 需 ${s.need}</b></div>
    <div class="m-ins-row"><span>设施状态</span><b>${Math.round(facility)}</b></div>
    <div class="m-ins-row"><span>今日通过</span><b>${Math.round(r.traffic)} 列</b></div>
    <div class="m-ins-row"><span>能力负荷</span><b>${pct(r.load)}</b></div>
    <div class="m-ins-row"><span>日净利</span><b style="color:${r.net >= 0 ? '#8dbb9c' : '#e0665c'}">${fm(r.net)}</b></div>
    <div class="m-ins-row"><span>施工</span><b style="font-size:10px">${c}</b></div>
    <div class="m-ins-note">${d.name}是${d.grade}，日通过 ${Math.round(r.traffic)} 列。当前${r.load > 0.98 ? '已经压车，先扩建或分流' : r.load > 0.9 ? '接近满图，留不出余量' : '还有余量'}。</div>
    <h3 style="margin-top:16px">四站负荷</h3>
    ${STATIONS.map((d2) => {
      const rr = p.rows.find((x) => x.id === d2.id);
      return `<button class="m-ins-station ${d2.id === selected ? 'on' : ''}" data-ins="${d2.id}"><b>${d2.name} <span style="float:right;color:${rr.load > 0.98 ? '#e0665c' : rr.load > 0.9 ? '#d6a14a' : '#8dbb9c'}">${pct(rr.load)}</span></b><span>${d2.grade} · ${st(d2.id).staff} 人 · 设施 ${Math.round(rr.facility)}</span></button>`;
    }).join('')}`;
  $('mInspector').querySelectorAll('[data-ins]').forEach((b) => b.addEventListener('click', () => { selected = b.dataset.ins; tab = 'station'; setNav(); renderAll(); }));
}

function stat(label, value, note) {
  return `<div class="m-stat"><span>${label}</span><b>${value}</b><em>${note || ''}</em></div>`;
}

function renderOverview(p) {
  const list = decideList(p);
  const last = state.ledger.slice(-7);
  const max = Math.max(1, ...last.map((x) => Math.abs(x.net)));
  const bars = last.length ? last.map((x) => `<div style="flex:1;display:flex;flex-direction:column;justify-content:flex-end;height:70px"><i style="display:block;height:${Math.max(2, Math.abs(x.net) / max * 52)}px;background:${x.net >= 0 ? '#5f9e76' : '#d4544a'}"></i><span style="font:8px var(--mono);color:#5f6d6a;text-align:center;margin-top:3px">${x.day}</span></div>`).join('') : '<span style="color:#5f6d6a">还没有日结数据</span>';
  return `<div class="m-page-head"><h2>经营总览</h2><span>第 ${state.day} / ${TERM} 日 · 第 ${state.week} 周 · 评级 ${rating()}</span></div>
  <div class="m-grid-4">
    ${stat('现金', fm(state.cash), state.cash < 0 ? '已经透支' : '可周转')}
    ${stat('预计日净利', fm(p.net), '按当前车流与合同')}
    ${stat('准点率', `${p.punc}%`, '低于 75 会被点名')}
    ${stat('安全值', `${p.safety}`, '低于 50 要停业整顿')}
  </div>
  <div class="m-block"><h3>今天要决定的事</h3>${list.map((x) => `<div class="m-row"><b>·</b><span>${esc(x)}</span></div>`).join('')}</div>
  <div class="m-block"><h3>四站经营</h3><div class="m-list">
    ${p.rows.map((r) => {
      const d = stationDef(r.id);
      const bad = r.load > 0.98 ? 'bad' : r.load > 0.9 ? 'warn' : '';
      return `<div class="m-cell"><b>${d.name} <span style="float:right;color:${r.net >= 0 ? '#8dbb9c' : '#e0665c'};font:10px var(--mono)">${fm(r.net)}</span></b><span>通过 ${Math.round(r.traffic)} 列 · 能力 ${r.cap}</span><span>负荷 ${pct(r.load)} · 设施 ${Math.round(r.facility)}</span><div class="m-bar ${bad ? `m-bar-${bad}` : ''}"><i style="width:${Math.min(100, r.load * 100)}%"></i></div></div>`;
    }).join('')}
  </div></div>
  <div class="m-block"><h3>最近 7 日净利</h3><div style="display:flex;gap:6px;align-items:flex-end">${bars}</div></div>
  <div class="m-block"><h3>当前合同</h3>
    ${state.contracts.length ? state.contracts.map((c) => `<div class="m-row"><b>${esc(c.name)}</b><span>${stationDef(c.station).name} · +${c.add} 列 · 日奖 ${fm(c.reward)}</span><span class="mono">剩 ${c.left} 天</span></div>`).join('') : '<div class="m-ins-note">还没有签合同。合同能补车流和现金，但会把车站压得更紧。</div>'}
  </div>`;
}


function renderStation(p) {
  const d = stationDef(selected);
  const s = st(selected);
  const r = p.rows.find((x) => x.id === selected);
  const options = BUILDS.map((b) => {
    const disabled = !!s.build || state.cash < b.cost;
    return `<div class="m-row"><div style="flex:1"><b>${b.name}</b><span>${b.desc} · ${fm(b.cost)} · ${b.days} 天</span></div><button class="m-btn ${state.cash >= b.cost ? 'good' : ''}" data-build="${b.id}" ${disabled ? 'disabled' : ''}>${s.build ? '施工占用' : '开工'}</button></div>`;
  }).join('');
  return `<div class="m-page-head"><h2>${d.name}站</h2><span>${d.grade} · K${d.km} · ${d.code}</span></div>
  <div class="m-grid-4">
    ${stat('日通过', `${Math.round(r.traffic)} 列`, `能力 ${r.cap}`)}
    ${stat('负荷', pct(r.load), r.load > 0.98 ? '压车' : r.load > 0.9 ? '接近满图' : '有余量')}
    ${stat('设施', `${Math.round(r.facility)}`, '低于 60 进整修')}
    ${stat('人员', `${s.staff} 人`, `需求 ${s.need} 人`)}
  </div>
  <div class="m-block"><h3>扩建与整修</h3>${options}</div>
  <div class="m-block"><h3>车站底账</h3>
    <div class="m-row"><span>到发线 / 站台 / 侧线</span><b class="mono">${s.tracks} / ${s.platforms} / ${s.sidings}</b></div>
    <div class="m-row"><span>基础车流</span><b class="mono">${d.baseTraffic} 列/日</b></div>
    <div class="m-row"><span>基础收入 / 成本</span><b class="mono">${fm(d.revenueBase)} / ${fm(d.costBase)}</b></div>
    <div class="m-row"><span>待清积压</span><b class="mono">${Math.round(s.backlog)} 列</b></div>
    <div class="m-row"><span>施工</span><b class="mono">${s.build ? `${s.build.name} 剩 ${s.build.left} 天` : '无'}</b></div>
  </div>
  <div class="m-block"><h3>本站设施</h3>${GROUPS.map((g) => `<div class="m-row"><span>${g.name}</span><b class="mono">${Math.round(groupsOf(selected)[g.id])}</b><div style="width:120px" class="m-bar ${groupsOf(selected)[g.id] < 60 ? 'm-bar-bad' : groupsOf(selected)[g.id] < 80 ? 'm-bar-warn' : ''}"><i style="width:${groupsOf(selected)[g.id]}%"></i></div></div>`).join('')}</div>`;
}

function renderAssets(p) {
  return `<div class="m-page-head"><h2>资产设施</h2><span>五组设施分别老化，整修按站按组计费</span></div>
  ${STATIONS.map((d) => {
    const rows = GROUPS.map((g) => {
      const v = groupsOf(d.id)[g.id];
      const cls = v < 55 ? 'm-bar-bad' : v < 75 ? 'm-bar-warn' : '';
      return `<div class="m-row"><span style="width:78px">${g.name}</span><div style="flex:1" class="m-bar ${cls}"><i style="width:${v}%"></i></div><b class="mono" style="width:30px;text-align:right">${Math.round(v)}</b><button class="m-btn ${v < 75 ? 'warn' : ''}" data-repair="${d.id}:${g.id}" ${state.cash < g.cost ? 'disabled' : ''}>整修 ${fm(g.cost)}</button></div>`;
    }).join('');
    return `<div class="m-block"><h3>${d.name} · 设施均分 ${Math.round(facAvg(d.id))}</h3>${rows}</div>`;
  }).join('')}`;
}

function renderStaff() {
  const rows = STATIONS.map((d) => {
    const s = st(d.id);
    const short = Math.max(0, s.need - s.staff);
    return `<div class="m-block"><h3>${d.name} · ${s.staff} 人 / 需 ${s.need} 人 ${short ? `<span style="color:#d6a14a">缺 ${short}</span>` : '<span style="color:#8dbb9c">齐</span>'}</h3>
      <div class="m-row"><span>士气</span><div style="flex:1" class="m-bar ${s.morale < 60 ? 'm-bar-bad' : s.morale < 75 ? 'm-bar-warn' : ''}"><i style="width:${s.morale}%"></i></div><b class="mono">${Math.round(s.morale)}</b></div>
      <div class="m-row"><span>日工资</span><b class="mono">${fm(s.staff * 70)}</b><span>缺员会拉低准点率</span></div>
      <div class="m-row"><div style="flex:1"><b>补员</b><span>签约 ${fm(12000)}，日工资 +70</span></div><button class="m-btn ${state.cash >= 12000 ? 'good' : ''}" data-hire="${d.id}" ${state.cash < 12000 ? 'disabled' : ''}>招 1 人</button><button class="m-btn" data-train="${d.id}" ${state.cash < 6000 || s.morale >= 92 ? 'disabled' : ''}>培训 ${fm(6000)}</button></div>
    </div>`;
  }).join('');
  return `<div class="m-page-head"><h2>人员</h2><span>补员解决缺岗，培训拉士气；缺员会直接拉低准点率</span></div>${rows}`;
}

function renderContracts(p) {
  const offers = state.offers.map((c) => `<div class="m-cell"><b>${esc(c.name)} <span style="float:right;color:#d6a14a;font:10px var(--mono)">${fm(c.reward)}/日</span></b><span>${stationDef(c.station).name} · +${c.add} 列/日 · ${c.days} 天</span><span>违约 ${fm(c.penalty)}/日 · 车站负荷需 ≤122%</span><div style="margin-top:8px"><button class="m-btn good" data-sign="${c.id}">签下 · ${fm(5000)}</button></div></div>`).join('');
  const active = state.contracts.length ? state.contracts.map((c) => {
    const load = p.rows.find((r) => r.id === c.station).load;
    const ok = load <= 1.22;
    return `<div class="m-row"><b>${esc(c.name)}</b><span>${stationDef(c.station).name} · +${c.add} 列 · 剩 ${c.left} 天</span><span class="mono" style="color:${ok ? '#8dbb9c' : '#e0665c'}">${ok ? '可兑现' : '要违约'}</span><button class="m-btn" data-drop="${c.id}">解约</button></div>`;
  }).join('') : '<div class="m-ins-note">还没签合同。</div>';
  return `<div class="m-page-head"><h2>合同</h2><span>合同加车流和现金，但会把对应车站压紧；每天结算一次</span></div>
  <div class="m-block"><h3>货主与开行方案</h3><div class="m-list">${offers}</div></div>
  <div class="m-block"><h3>执行中</h3>${active}</div>`;
}

function renderTraffic(p) {
  const cards = SEGMENTS.map((s) => {
    const load = p.segRows.find((x) => x.id === s.id).load;
    const cls = load > 0.98 ? 'bad' : load > 0.86 ? 'warn' : '';
    return `<div class="m-seg-card"><div class="m-row"><b>${stationDef(s.from).name}—${stationDef(s.to).name}</b><span class="mono">${s.km} km · 限 ${s.limit}</span></div>
      <div class="m-slider"><span>客车</span><input type="range" min="20" max="85" value="${state.segments[s.id].pax}" data-share="${s.id}"><b>${state.segments[s.id].pax}%</b></div>
      <div class="m-row"><span>需求 ${Math.round(p.segRows.find((x) => x.id === s.id).demand)} 列 · 能力 ${s.capacity}</span><b class="mono" style="color:${load > 0.98 ? '#e0665c' : load > 0.86 ? '#d6a14a' : '#8dbb9c'}">${pct(load)}</b></div>
      <div class="m-bar ${cls ? `m-bar-${cls}` : ''}"><i style="width:${Math.min(100, load * 100)}%"></i></div>
    </div>`;
  }).join('');
  return `<div class="m-page-head"><h2>车流组织</h2><span>客车比例影响收入结构；区段负荷超过 100% 会压车</span></div>${cards}
  <div class="m-block"><h3>口径</h3><div class="m-ins-note">客车单列收入高，货车单列收入低但合同奖励稳定。区段需求按当前市场指数和合同叠加，滑杆只决定客车占比，不改变总需求。</div></div>`;
}


function renderFinance() {
  const rows = state.ledger.slice(-15).reverse().map((x) => `<div class="m-row"><b class="mono">D${x.day}</b><span>收 ${fm(x.revenue)} · 支 ${fm(x.cost)} · 合同 ${fm(x.contract)}</span><b class="mono" style="margin-left:auto;color:${x.net >= 0 ? '#8dbb9c' : '#e0665c'}">${fm(x.net)}</b></div>`).join('');
  const total = state.ledger.reduce((a, x) => a + x.net, 0);
  return `<div class="m-page-head"><h2>财务</h2><span>现金 ${fm(state.cash)} · 累计净利 ${fm(total)}</span></div>
  <div class="m-grid-4">
    ${stat('累计收入', fm(state.ledger.reduce((a, x) => a + x.revenue, 0)), '含合同')}
    ${stat('累计支出', fm(state.ledger.reduce((a, x) => a + x.cost, 0)), '工资、维护、施工')}
    ${stat('累计净利', fm(total), '不含初始现金')}
    ${stat('日均净利', fm(state.ledger.length ? total / state.ledger.length : 0), `${state.ledger.length} 天`)}
  </div>
  <div class="m-block"><h3>日结流水</h3>${rows || '<div class="m-ins-note">还没有流水，推进一天后生成。</div>'}</div>`;
}

function renderPolicy() {
  const active = state.policy && state.policy.left > 0 ? `<div class="m-ins-note">当前：<b>${esc(state.policy.name)}</b>，剩 ${state.policy.left} 天。</div>` : '<div class="m-ins-note">本周还没有政策。</div>';
  const cards = POLICIES.map((p) => `<div class="m-cell"><b>${p.name}</b><span>${p.desc}</span><div style="margin-top:8px"><button class="m-btn good" data-policy="${p.id}" ${state.cash < 5000 ? 'disabled' : ''}>${state.policy ? '调整（¥5,000）' : '定下本周'}</button></div></div>`).join('');
  return `<div class="m-page-head"><h2>政策</h2><span>每 7 天可定一项，调整花 ¥5,000</span></div>${active}<div class="m-block"><h3>可选口径</h3><div class="m-list">${cards}</div></div>`;
}


function renderSave() {
  const slots = [1, 2, 3].map((n) => {
    let meta = '空';
    try {
      const raw = localStorage.getItem(SLOT(n));
      if (raw) {
        const s = JSON.parse(raw);
        meta = `第 ${s.day} 日 · ${fm(s.cash)}`;
      }
    } catch (e) { meta = '损坏'; }
    return `<div class="m-row"><b>槽位 ${n}</b><span>${meta}</span><button class="m-btn" data-save-slot="${n}">存</button><button class="m-btn" data-load-slot="${n}" ${meta === '空' ? 'disabled' : ''}>读</button></div>`;
  }).join('');
  return `<div class="m-page-head"><h2>存档与云</h2><span>本地、导出码、GitHub Gist</span></div>
  <div class="m-block"><h3>本地槽位</h3>${slots}<div class="m-ins-note">每次推进一天会自动覆盖自动存档。</div></div>
  <div class="m-block"><h3>导出码</h3><textarea id="mCode" style="width:100%;height:92px;background:#0d1316;border:1px solid #2f3e44;color:#c9d3cf;font:10px var(--mono);padding:8px" readonly>${saveCode()}</textarea><div style="margin-top:6px"><button class="m-btn" id="mCopy">复制导出码</button></div></div>
  <div class="m-block"><h3>导入</h3><textarea id="mImport" placeholder="粘贴 MGV1:..." style="width:100%;height:70px;background:#0d1316;border:1px solid #2f3e44;color:#c9d3cf;font:10px var(--mono);padding:8px"></textarea><div style="margin-top:6px"><button class="m-btn" id="mImportGo">载入</button></div></div>
  <div class="m-block"><h3>云端</h3><div class="m-row"><span>GitHub 令牌</span><input id="mToken" type="password" value="${esc(cloudToken())}" placeholder="gist 权限令牌" style="flex:1;height:25px;background:#0d1316;border:1px solid #2f3e44;color:#c9d3cf;padding:0 6px"></div><div class="m-row"><button class="m-btn good" id="mUp">上传云存档</button><span>把当前导出码写入私有 Gist</span></div><div class="m-row"><button class="m-btn" id="mDown">按编号载入</button><span>填 Gist 编号或链接</span></div></div>`;
}

function renderPage(p) {
  const fn = { overview: renderOverview, station: renderStation, assets: renderAssets, staff: renderStaff, contracts: renderContracts, traffic: renderTraffic, finance: renderFinance, policy: renderPolicy, save: renderSave }[tab] || renderOverview;
  $('mPage').innerHTML = fn(p);
  if (tab === 'station') {
    $('mPage').querySelectorAll('[data-build]').forEach((b) => b.addEventListener('click', () => startBuild(b.dataset.build)));
  }
  if (tab === 'assets') {
    $('mPage').querySelectorAll('[data-repair]').forEach((b) => b.addEventListener('click', () => repair(b.dataset.repair)));
  }
  if (tab === 'staff') {
    $('mPage').querySelectorAll('[data-hire]').forEach((b) => b.addEventListener('click', () => hire(b.dataset.hire)));
    $('mPage').querySelectorAll('[data-train]').forEach((b) => b.addEventListener('click', () => trainStaff(b.dataset.train)));
  }
  if (tab === 'contracts') {
    $('mPage').querySelectorAll('[data-sign]').forEach((b) => b.addEventListener('click', () => sign(b.dataset.sign)));
    $('mPage').querySelectorAll('[data-drop]').forEach((b) => b.addEventListener('click', () => drop(b.dataset.drop)));
  }
  if (tab === 'traffic') {
    $('mPage').querySelectorAll('[data-share]').forEach((input) => input.addEventListener('input', () => {
      state.segments[input.dataset.share].pax = Number(input.value);
      input.nextElementSibling.textContent = `${input.value}%`;
      renderTop(); renderMap(project()); renderInspector(project());
    }));
  }
  if (tab === 'policy') {
    $('mPage').querySelectorAll('[data-policy]').forEach((b) => b.addEventListener('click', () => choosePolicy(b.dataset.policy)));
  }
  if (tab === 'save') {
    $('mPage').querySelectorAll('[data-save-slot]').forEach((b) => b.addEventListener('click', () => saveSlot(Number(b.dataset.saveSlot))));
    $('mPage').querySelectorAll('[data-load-slot]').forEach((b) => b.addEventListener('click', () => loadSlot(Number(b.dataset.loadSlot))));
    $('mCopy').addEventListener('click', () => { $('mCode').select(); navigator.clipboard.writeText(saveCode()).then(() => toast('导出码已复制')).catch(() => toast('复制失败，手动选中')); });
    $('mImportGo').addEventListener('click', () => {
      try { applyLoaded(readCode($('mImport').value)); toast('导入成功'); } catch (e) { toast(e.message); }
    });
    $('mToken').addEventListener('change', () => setCloudToken($('mToken').value));
    $('mUp').addEventListener('click', cloudSave);
    $('mDown').addEventListener('click', cloudLoad);
  }
}

function renderFoot(p) {
  const todo = decideList(p)[0] || '按当前节奏推进';
  $('mTodo').textContent = state.over ? `本局已结束：${state.over}` : todo;
  $('mForecast').textContent = `预计日净利 ${fm(p.net)} / 准点 ${p.punc}%`;
  $('mNext').disabled = false;
  $('mNext').textContent = state.over ? '查看结算' : state.event ? '处理事件' : `推进到第 ${state.day + 1} 日`;
}

function renderAll() {
  const p = project();
  renderTop();
  renderMap(p);
  renderPage(p);
  renderInspector(p);
  renderFoot(p);
}


function saveCode() {
  const s = { ...state, selected };
  return `MGV1:${btoa(unescape(encodeURIComponent(JSON.stringify(s))))}`;
}

function readCode(code) {
  const t = String(code || '').trim();
  if (!t.startsWith('MGV1:')) throw new Error('不是站长台存档');
  const s = JSON.parse(decodeURIComponent(escape(atob(t.slice(5)))));
  if (!s || s.v !== 1) throw new Error('存档版本不对');
  return normalize(s);
}

function setTab(next) { tab = next; setNav(); renderAll(); }

function useAction() {
  if (state.ap <= 0) { toast('今天的管理动作已用完，推进一天再办'); return false; }
  state.ap -= 1;
  return true;
}

function startBuild(id) {
  const o = BUILDS.find((b) => b.id === id);
  const s = st(selected);
  if (!o || s.build || state.cash < o.cost) return;
  if (!useAction()) return;
  state.cash -= o.cost;
  s.build = { id: o.id, name: o.name, left: o.days };
  save(true); renderAll(); toast(`${o.name}开工，${o.days} 天完成`);
}

function repair(key) {
  const [id, gid] = key.split(':');
  const g = GROUPS.find((x) => x.id === gid);
  if (!g || state.cash < g.cost) return;
  if (!useAction()) return;
  state.cash -= g.cost;
  groupsOf(id)[gid] = clamp(groupsOf(id)[gid] + 14, 0, 100);
  save(true); renderAll(); toast(`${stationDef(id).name}${g.name}整修完成`);
}

function hire(id) {
  if (state.cash < 12000) return;
  if (!useAction()) return;
  const s = st(id);
  state.cash -= 12000;
  s.staff += 1;
  s.morale = clamp(s.morale + 2, 0, 100);
  save(true); renderAll(); toast(`${stationDef(id).name}补员 1 人`);
}

function trainStaff(id) {
  if (state.cash < 6000) return;
  if (!useAction()) return;
  state.cash -= 6000;
  st(id).morale = clamp(st(id).morale + 6, 0, 100);
  save(true); renderAll(); toast(`${stationDef(id).name}培训完成，士气 +6`);
}

function sign(id) {
  const offer = state.offers.find((c) => c.id === id);
  if (!offer) return;
  if (!useAction()) return;
  state.cash -= 5000;
  state.contracts.push({ ...offer, left: offer.days, active: true });
  state.offers = makeOffers(state, 3);
  save(true); renderAll(); toast(`签下${offer.name}，签约费 ¥5,000`);
}

function drop(id) {
  const c = state.contracts.find((x) => x.id === id);
  if (!c) return;
  if (!useAction()) return;
  state.cash -= c.penalty;
  state.contracts = state.contracts.filter((x) => x.id !== id);
  save(true); renderAll(); toast(`解除${c.name}，赔付 ${fm(c.penalty)}`);
}

function choosePolicy(id) {
  const p = POLICIES.find((x) => x.id === id);
  if (!p) return;
  if (!useAction()) return;
  if (state.policy && state.policy.left > 0) state.cash -= 5000;
  state.policy = { id: p.id, name: p.name, left: 7 };
  state.policyDue = false;
  save(true); renderAll(); toast(`本周政策：${p.name}`);
}

function advance() {
  if (state.over) { openOver(); return; }
  if (state.event) { openEvent(); return; }
  const p = project();
  const net = p.net;
  state.cash += net;
  state.ledger.push({ day: state.day, revenue: p.revenue, cost: p.cost, contract: p.contractNet, net, punc: p.punc, safety: p.safety });
  if (state.ledger.length > 120) state.ledger.shift();
  state.demandIndex *= 1.004;
  state.effects.forEach((e) => { e.days -= 1; });
  state.effects = state.effects.filter((e) => e.days > 0);
  state.contracts.forEach((c) => { c.left -= 1; });
  state.contracts = state.contracts.filter((c) => c.left > 0);
  if (state.policy) {
    state.policy.left -= 1;
    if (state.policy.left <= 0) state.policy = null;
  }
  STATIONS.forEach((d) => {
    const s = st(d.id);
    const g = groupsOf(d.id);
    GROUPS.forEach((x) => { s.groups[x.id] = clamp(s.groups[x.id] - (0.7 + Math.random() * 0.9) * (state.policy && state.policy.id === 'maint' ? 0.5 : 1), 20, 100); });
    if (s.build) {
      s.build.left -= 1;
      if (s.build.left <= 0) {
        const b = BUILDS.find((x) => x.id === s.build.id);
        if (b.id === 'track') s.tracks += 2;
        if (b.id === 'platform') s.platforms += 1;
        if (b.id === 'siding') s.sidings += 1;
        if (b.id === 'facility') GROUPS.forEach((x) => { s.groups[x.id] = clamp(s.groups[x.id] + 8, 0, 100); });
        s.build = null;
      }
    }
    const load = p.rows.find((x) => x.id === d.id).load;
    if (load > 1) s.backlog = clamp(s.backlog + (load - 1) * 12, 0, 30);
    else s.backlog = clamp(s.backlog - Math.min(2, s.backlog * 0.2), 0, 30);
    s.morale = clamp(s.morale - 0.4 + (p.punc > 85 ? 0.5 : -0.4), 0, 100);
    s.need = Math.round(d.baseTraffic * state.demandIndex / 4.5);
  });
  state.reputation = clamp(state.reputation + (p.punc - 80) / 9 + (p.safety - 85) / 20, 0, 100);
  state.superior = clamp(state.superior + (net > 9000 ? 0.4 : net > 3000 ? -0.2 : -1.4) + (p.punc > 88 ? 0.2 : -0.5), 0, 100);
  state.day += 1;
  state.ap = 2;
  state.week = Math.floor((state.day - 1) / 7) + 1;
  if (state.day % 7 === 0) state.policyDue = true;
  if (state.day % 4 === 0) state.event = makeEvent();
  if (state.cash < -80000) state.over = '资金链断裂';
  if (state.reputation <= 0) state.over = '声誉归零，被路局免职';
  if (state.superior <= 0) state.over = '上级评价归零，被调离';
  if (state.day > TERM && !state.over) state.over = '任期结束';
  if (state.over) state.event = null;
  save(true);
  renderAll();
  if (state.over) openOver();
  else if (state.event) openEvent();
  else toast(`第 ${state.day - 1} 日结：净利 ${fm(net)} · 准点 ${p.punc}%`);
}


function openEvent() {
  const e = state.event;
  if (!e) return;
  modal(e.kicker, e.title, e.body, e.choices.map((c) => ({ label: c.label, tone: c.tone, fn: () => resolveEvent(c, e.station) })));
}

function resolveEvent(choice, stationId) {
  const a = choice.apply || {};
  const target = stationId || selected;
  if (a.cash) state.cash += a.cash;
  if (a.reputation) state.reputation = clamp(state.reputation + a.reputation, 0, 100);
  if (a.superior) state.superior = clamp(state.superior + a.superior, 0, 100);
  if (a.facility) {
    GROUPS.forEach((g) => { groupsOf(target)[g.id] = clamp(groupsOf(target)[g.id] + a.facility, 0, 100); });
  }
  if (a.morale) STATIONS.forEach((d) => { st(d.id).morale = clamp(st(d.id).morale + a.morale, 0, 100); });
  if (a.safety) state.effects.push({ label: choice.label, days: 2, safety: a.safety });
  if (a.punc) state.effects.push({ label: choice.label, days: 2, punc: a.punc });
  if (a.effect) state.effects.push(a.effect);
  state.event = null;
  save(true); closeModal(); renderAll();
  toast('事件已处置，继续推进');
}

function openOver() {
  const total = state.ledger.reduce((a, x) => a + x.net, 0);
  const avgP = state.ledger.length ? Math.round(state.ledger.reduce((a, x) => a + x.punc, 0) / state.ledger.length) : 0;
  modal('任期结束', state.over, `<p>现金 <b>${fm(state.cash)}</b>，累计净利 <b>${fm(total)}</b>，平均准点 <b>${avgP}%</b>，最终评级 <b>${rating()}</b>。</p><p>这局结束了。可以导出结算码留档，或者回入口重开。</p>`, [
    { label: '导出结算码', tone: 'good', fn: () => { navigator.clipboard.writeText(saveCode()); toast('结算码已复制'); } },
    { label: '重开一局', fn: () => { state = fresh(); selected = 'qinglan'; closeModal(); save(true); renderAll(); } },
    { label: '留在本站', fn: closeModal },
  ]);
}

function saveSlot(n) {
  localStorage.setItem(SLOT(n), JSON.stringify({ ...state, selected }));
  toast(`已写入槽位 ${n}`);
  renderAll();
}

function loadSlot(n) {
  try {
    const raw = localStorage.getItem(SLOT(n));
    if (!raw) return;
    applyLoaded(normalize(JSON.parse(raw)));
    toast(`已读取槽位 ${n}`);
  } catch (e) { toast('槽位读取失败'); }
}

function applyLoaded(s) {
  state = normalize(s);
  selected = state.selected || 'qinglan';
  tab = 'overview';
  setNav(); save(true); renderAll();
}

async function cloudSave() {
  try {
    setCloudToken($('mToken').value);
    const r = await uploadCloud(saveCode(), { name: `站长台 D${state.day}` });
    toast(`已上传：${r.id}`);
  } catch (e) { toast(e.message); }
}

function cloudLoad() {
  const id = prompt('填 Gist 编号或链接');
  const clean = parseCloudInput(id || '');
  if (!clean) return;
  downloadCloud(clean).then((r) => { applyLoaded(readCode(r.code)); toast(`已读取云端 ${clean}`); }).catch((e) => toast(e.message));
}

function exportCsv() {
  const rows = ['day,revenue,cost,contract,net,punc,safety'];
  state.ledger.forEach((x) => rows.push([x.day, Math.round(x.revenue), Math.round(x.cost), Math.round(x.contract), Math.round(x.net), x.punc, x.safety].join(',')));
  const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `dispatch-manage-D${state.day}.csv`;
  a.click();
}

document.querySelectorAll('#mNav [data-tab]').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));
$('mNext').addEventListener('click', advance);
$('mSave').addEventListener('click', () => save(false));
$('mBack').addEventListener('click', () => { save(true); location.href = '../index.html'; });
$('mModal').querySelector('.m-modal-shade').addEventListener('click', () => { if (!state.event) closeModal(); });

state = normalize(load() || fresh());
selected = state.selected || 'qinglan';
tab = 'overview';
setNav();
renderAll();
if (!load()) toast('新局开始：接手宝成线四站，撑过 60 天');
