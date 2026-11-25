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

