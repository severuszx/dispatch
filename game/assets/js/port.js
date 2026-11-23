import { el, toast } from './util.js';
import { career, saveCareer } from './career.js';
import { profile, saveProfile } from './profile.js';
import { dlcOn } from './dlc.js';

const LINES = [
  ['std', '准轨 1435', '境内主线，装卸最快'],
  ['broad', '宽轨 1520', '北向联运，换装重车'],
  ['narrow', '米轨 1000', '南向支线，吨位小'],
];
const BASE_CAP = 18;
const CAR_REV = 420;

function store() {
  career.data.port = career.data.port || {};
  const p = career.data.port;
  p.lines = p.lines || { std: true, broad: false, narrow: false };
  p.customs = p.customs || 0;
  p.pending = p.pending || 0;
  p.lastRevenue = p.lastRevenue || 0;
  p.settled = p.settled || 0;
  return p;
}

export function portDemand() {
  const p = store();
  return Object.values(p.lines).filter(Boolean).length * 6;
}

export function portSnapshot() {
  const p = store();
  const incoming = portDemand();
  const cap = BASE_CAP + p.customs * 4;
  const queue = p.pending + incoming;
  const cleared = Math.min(queue, cap);
  return { ...p, incoming, cap, queue, cleared, revenue: cleared * CAR_REV, backlog: queue - cleared, active: Object.values(p.lines).filter(Boolean).length };
}

export function toggleGauge(id) {
  const p = store();
  if (!p.lines[id] && Object.values(p.lines).filter(Boolean).length >= 2) return { ok: false, msg: '最多同时开两条换装线，先关一条' };
  p.lines[id] = !p.lines[id];
  saveCareer();
  return { ok: true, msg: `${id === 'std' ? '准轨' : id === 'broad' ? '宽轨' : '米轨'}换装线${p.lines[id] ? '开' : '关'}` };
}

export function upgradeCustoms() {
  const p = store();
  if (p.customs >= 4) return { ok: false, msg: '报关厅已到顶' };
  const cost = 3200 + p.customs * 900;
  if (profile.data.credits < cost) return { ok: false, msg: `资金不足，还差 ${cost - profile.data.credits}` };
  profile.data.credits -= cost;
  p.customs += 1;
  saveProfile();
  saveCareer();
  return { ok: true, msg: `报关厅扩到 ${p.customs} 级，支出 ¥${cost}` };
}

export function tickPort() {
  if (!dlcOn('port')) return;
  const p = store();
  const s = portSnapshot();
  p.pending = s.backlog > 0 ? Math.round(s.backlog * 0.5) : 0;
  p.lastRevenue = s.revenue;
  p.settled = (p.settled || 0) + s.cleared;
  saveCareer();
}

export function mountPort(body) {
  body.classList.add('port-pane');
  const root = el('div', 'port');
  body.append(root);

  function render() {
    const s = portSnapshot();
    root.innerHTML = `<div class="port-head"><div><b>口岸站</b><span>换装线 ${s.active} 条 · 报关厅 ${s.customs} 级</span></div><div class="port-kpi"><div><span>本班到达</span><b>${s.incoming} 车</b></div><div><span>可换装</span><b>${s.cleared} 车</b></div><div><span>联运收入</span><b>¥${s.revenue}</b></div></div></div>
      <p class="port-note">每条换装线每班进 6 车；基础换装 18 车，报关厅每级加 4 车。换不完的车下一班折半压着。</p>
      <div class="port-lines">${LINES.map(([id, name, note]) => `<div class="port-line ${s.lines[id] ? 'on' : ''}"><div><b>${name}</b><span>${note}</span></div><em>${s.lines[id] ? '使用中' : '未开'}</em><button data-act="line:${id}">${s.lines[id] ? '关闭' : '开启'}</button></div>`).join('')}</div>
      <div class="port-foot"><div><span>换装队列</span><b>${s.queue} 车</b></div><div><span>压线</span><b>${s.backlog} 车</b></div><div><span>累计换装</span><b>${s.settled} 车</b></div><button data-act="customs" ${s.customs >= 4 ? 'disabled' : ''}>扩建报关厅 ¥${3200 + s.customs * 900}</button></div>
      <p class="port-mini">准轨与宽轨同时开最吃能力；米轨车小，但南向货源单独算。</p>`;
  }

  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    if (b.dataset.act === 'customs') {
      const r = upgradeCustoms();
      toast(r.msg, r.ok ? 'ok' : 'err');
    } else {
      const r = toggleGauge(b.dataset.act.split(':')[1]);
      toast(r.msg, r.ok ? 'ok' : 'err');
    }
    render();
  });
  render();
}
