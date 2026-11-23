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
