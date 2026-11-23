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
