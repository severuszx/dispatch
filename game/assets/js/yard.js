import { el, toast } from './util.js';
import { career, saveCareer } from './career.js';
import { profile, saveProfile } from './profile.js';

const DESTS = ['郑州北', '襄阳北', '柳州南', '西安东', '成都北', '兰州西'];
const HAZ = ['汽油', '液氯', '电石', '硝酸铵'];
const SHIFT_MIN = 600;

function rnd(seed) {
  let x = seed || 1;
  return () => {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    return x / 0x7fffffff;
  };
}

function ensure() {
  const p = career.data;
  const shift = p.shiftIndex || 0;
  if (!p.yard) p.yard = { shift: -1, clock: SHIFT_MIN, inbound: [], keep: [], pools: {}, outbound: [], departed: 0, income: 0, auto: 0, seq: 0, backlog: 0 };
  const y = p.yard;
  y.keep = y.keep || [];
  if (y.shift !== shift) {
    const carry = (y.inbound || []).length + (y.keep || []).length;
    const lateCars = Object.values(y.pools || {}).reduce((a, b) => a + b, 0);
    y.backlog = Math.max(0, carry * 6 + Math.max(0, lateCars - 140));
    y.shift = shift;
    y.clock = SHIFT_MIN;
    y.inbound = [];
    y.keep = [];
    const r = rnd(shift * 97 + 13);
    const n = 4 + Math.floor(r() * 3) + Math.min(2, Math.floor(y.backlog / 30));
    for (let i = 0; i < n; i += 1) addInbound(y, r);
    if (y.auto) autoPush(y, 99);
    saveCareer();
  }
  return y;
}

function addInbound(y, r) {
  const pick = r();
  const cut = {
    id: `C${y.seq += 1}`,
    dest: DESTS[Math.floor(r() * DESTS.length)],
    cars: 8 + Math.floor(r() * 13),
    haz: pick > 0.82 ? HAZ[Math.floor(r() * HAZ.length)] : '',
    at: Date.now(),
  };
  y.inbound.push(cut);
  return cut;
}

function pushOne(y, cut) {
  y.pools[cut.dest] = (y.pools[cut.dest] || 0) + cut.cars;
  y.inbound = y.inbound.filter((x) => x.id !== cut.id);
  const cost = Math.max(4, 14 - (y.auto || 0) * 4 + (cut.haz ? 3 : 0));
  y.clock = Math.max(0, y.clock - cost);
  if (cut.haz) y.haz = (y.haz || 0) + 1;
  return cost;
}

function autoPush(y, limit) {
  let n = 0;
  while (y.inbound.length && n < limit && y.clock > 6) {
    const cut = y.inbound.find((x) => !x.haz);
    if (!cut) break;
    pushOne(y, cut);
    n += 1;
  }
  return n;
}

function keepOne(y, cut) {
  y.inbound = y.inbound.filter((x) => x.id !== cut.id);
  y.keep.push(cut);
  y.clock = Math.max(0, y.clock - 10);
  return 10;
}

function pullKeep(y) {
  if (!y.keep.length || y.clock < 8) return 0;
  const n = y.keep.length;
  y.clock -= 8;
  for (const cut of y.keep) {
    y.pools[cut.dest] = (y.pools[cut.dest] || 0) + cut.cars;
    y.haz = (y.haz || 0) + 1;
  }
  y.keep = [];
  return n;
}

function assemble(y, dest) {
  const pool = y.pools[dest] || 0;
  if (pool < 40) return null;
  if (y.clock < 18) return null;
  y.pools[dest] = pool - 40;
  y.clock -= 18;
  const t = { id: `X${y.seq += 1}`, dest, cars: 40, ready: true, at: Date.now() };
  y.outbound.push(t);
  return t;
}

function depart(y, id) {
  const t = y.outbound.find((x) => x.id === id);
  if (!t || y.clock < 8) return null;
  y.outbound = y.outbound.filter((x) => x.id !== id);
  y.clock -= 8;
  y.departed += 1;
  const money = Math.round(t.cars * 4.8 * 1.35);
  y.income += money;
  profile.data.credits += money;
  profile.data.stats.income += money;
  saveProfile();
  saveCareer();
  return { ...t, money };
}

export function yardBacklog() {
  const y = career.data.yard;
  if (!y) return 0;
  const cars = Object.values(y.pools || {}).reduce((a, b) => a + b, 0);
  return Math.max(0, (y.backlog || 0) + Math.max(0, cars - 140));
}

export function yardCost() {
  return Math.round(yardBacklog() * 18);
}

export function mountYard(body, ctx) {
  body.classList.add('yard-pane');
  const root = el('div', 'yard');
  body.append(root);

  function draw() {
    const y = ensure();
    const pools = Object.entries(y.pools || {}).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
    const cols = [
      ['到达场', `${y.inbound.length} 个车组待推峰 · 禁溜线 ${y.keep.length} 组`, `${y.inbound.map((c) => `<div class="yard-cut ${c.haz ? 'haz' : ''}"><div><b>${c.id}</b><span>到 ${c.dest} · ${c.cars} 车</span>${c.haz ? `<em>${c.haz} 危险品</em>` : ''}</div>${c.haz ? `<button data-act="keep:${c.id}" ${y.clock < 10 ? 'disabled' : ''}>送禁溜线</button>` : `<button data-act="push:${c.id}" ${y.clock < 6 ? 'disabled' : ''}>推峰</button>`}</div>`).join('') || '<p class="yard-empty">到达场空，等下一批。</p>'}${y.keep.length ? `<div class="yard-keep"><span>禁溜线暂存 ${y.keep.length} 组，需调机取回</span><button data-act="pull" ${y.clock < 8 ? 'disabled' : ''}>取回分解</button></div>` : ''}`
      ],
      ['驼峰/调车场', `${pools.reduce((a, [, n]) => a + n, 0)} 车已分解`, pools.map(([d, n]) => `<div class="yard-pool"><div><b>${d}</b><span>${n} 车</span>${bar(n, 120)}</div><button data-act="make:${d}" ${n < 40 || y.clock < 18 ? 'disabled' : ''}>编组</button></div>`).join('') || '<p class="yard-empty">还没有分解的车组。</p>'
      ],
      ['编发场', `${y.outbound.length} 列待发`, y.outbound.map((t) => `<div class="yard-out"><div><b>${t.id}</b><span>去 ${t.dest} · ${t.cars} 车</span></div><button data-act="depart:${t.id}" ${y.clock < 8 ? 'disabled' : ''}>发车</button></div>`).join('') || '<p class="yard-empty">没有编好的车列。</p>'
      ],
      ['出发场', `本班已发 ${y.departed} 列`, `<div class="yard-stat"><span>出发收入</span><b>¥${y.income || 0}</b></div><div class="yard-stat"><span>积压</span><b>${yardBacklog()} 车</b></div><div class="yard-stat"><span>危险品暂存</span><b>${y.haz || 0} 组</b></div><p class="yard-note">积压会按每车 18 元计滞车费，并拖下一班到达。</p>`]
    ];
    root.innerHTML = `<div class="yard-head"><div><b>编组站四场</b><span>襄阳北 / 郑州北 / 柳州南 · 到达—驼峰—编发—出发</span></div><div class="yard-clock"><span>剩余作业</span><b>${y.clock} 分</b><span>第 ${(y.shift || 0) + 1} 班</span></div></div>
      <div class="yard-tools"><button data-act="auto">自动推峰 ${y.auto ? `开 · ${y.auto} 档` : '关'}</button><button data-act="add">要一批到达</button><span>推峰 14 分/组，编组 18 分/列，发车 8 分/列。自动化每档省 4 分。</span></div>
      <div class="yard-grid">${cols.map(([t, sub, inner]) => `<div class="yard-col"><div class="yard-col-head"><b>${t}</b><span>${sub}</span></div>${inner}</div>`).join('')}</div>`;
  }

  function bar(n, max) {
    return `<div class="yard-bar"><i style="width:${Math.min(100, n / max * 100)}%"></i></div>`;
  }

  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    const y = ensure();
    if (act.startsWith('keep:')) {
      const cut = y.inbound.find((x) => x.id === act.slice(5));
      if (!cut) return;
      keepOne(y, cut);
      toast(`${cut.id} 送禁溜线，${cut.haz} 不直接过驼峰`, 'ok');
    } else if (act === 'pull') {
      const n = pullKeep(y);
      toast(n ? `调机取回 ${n} 组，进入驼峰分解` : '作业时间不够或禁溜线为空', n ? 'ok' : 'err');
    } else if (act.startsWith('push:')) {
      const cut = y.inbound.find((x) => x.id === act.slice(5));
      if (!cut) return;
      const cost = pushOne(y, cut);
      toast(`${cut.id} 推峰，${cut.dest} +${cut.cars} 车，耗 ${cost} 分`, 'ok');
    } else if (act.startsWith('make:')) {
      const t = assemble(y, act.slice(5));
      toast(t ? `${t.id} 编成，去 ${t.dest}` : '车数不足 40 或作业时间不够', t ? 'ok' : 'err');
    } else if (act.startsWith('depart:')) {
      const r = depart(y, act.slice(7));
      toast(r ? `${r.id} 发车，收入 ¥${r.money}` : '作业时间不够', r ? 'ok' : 'err');
      if (r && ctx && ctx.audio) ctx.audio.announce(`${r.id} 次，编组完成，出发。`);
    } else if (act === 'auto') {
      y.auto = ((y.auto || 0) + 1) % 3;
      if (y.auto) autoPush(y, y.auto);
      toast(y.auto ? `驼峰自动化 ${y.auto} 档，已推 ${y.auto} 组` : '自动推峰关闭', 'ok');
    } else if (act === 'add') {
      const r = rnd(Date.now() % 9999);
      addInbound(y, r); addInbound(y, r);
      toast('一批到达车组已接入', 'ok');
    }
    if (y.auto && act !== 'auto') autoPush(y, 1);
    saveCareer();
    draw();
    saveCareer();
  });

  draw();
  return { refresh: draw };
}
