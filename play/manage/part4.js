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
