import { el, toast } from './util.js';
import { career, saveCareer } from './career.js';
import { profile, saveProfile } from './profile.js';
import { dlcOn } from './dlc.js';

const MODELS = [
  ['CRH-01', 'CR400AF', 860],
  ['CRH-02', 'CR400AF', 1420],
  ['CRH-03', 'CRH380A', 2350],
  ['CRH-04', 'CRH2A', 3600],
];
const FIRST = 1200;
const SECOND = 4000;

function store() {
  career.data.emu = career.data.emu || {};
  career.data.emu.sets = career.data.emu.sets || {};
  for (const [id, model, km] of MODELS) {
    if (!career.data.emu.sets[id]) career.data.emu.sets[id] = { id, model, km, since: km % FIRST, level: 0, fixes: 0 };
  }
  return career.data.emu;
}

export function emuSets() {
  return MODELS.map(([id, model]) => {
    const s = store().sets[id];
    const due = s.since >= SECOND ? 2 : s.since >= FIRST ? 1 : 0;
    return { ...s, model, due, until: SECOND - s.since, firstLeft: Math.max(0, FIRST - s.since) };
  });
}

export function emuService() {
  const list = emuSets();
  const ready = list.filter((s) => s.due === 0).length;
  const ratio = ready / list.length;
  return { ready, total: list.length, pax: Math.round(8 * ratio), revenue: Math.round(2000 * ratio), ratio };
}

export function tickEmu() {
  if (!dlcOn('emu')) return;
  const st = store();
  for (const key of Object.keys(st.sets)) {
    const s = st.sets[key];
    s.km += 318 + (s.id.charCodeAt(s.id.length - 1) % 5) * 9;
    s.since += 318;
  }
  saveCareer();
}

export function serviceEmu(id, level) {
  const set = store().sets[id];
  if (!set) return { ok: false, msg: '没有这台车组' };
  const cost = level === 2 ? 2400 : 600;
  if (profile.data.credits < cost) return { ok: false, msg: `资金不足，还差 ${cost - profile.data.credits}` };
  if (level === 2 && set.since < SECOND) return { ok: false, msg: '还没到二级修里程' };
  if (level === 1 && set.since < FIRST) return { ok: false, msg: '还没到一级修里程' };
  profile.data.credits -= cost;
  set.since = 0;
  set.level = Math.max(set.level, level);
  set.fixes = (set.fixes || 0) + 1;
  saveProfile();
  saveCareer();
  return { ok: true, msg: `${id} ${level === 2 ? '二级修' : '一级修'}完成，支出 ¥${cost}` };
}

export function mountEmu(body) {
  body.classList.add('emu-pane');
  const root = el('div', 'emu');
  body.append(root);

  function render() {
    const list = emuSets();
    const svc = emuService();
    root.innerHTML = `<div class="emu-head"><div><b>动车所</b><span>配属 4 组 · 可用 ${svc.ready}</span></div><div class="emu-kpi"><div><span>高铁客流</span><b>+${svc.pax}</b></div><div><span>服务收入</span><b>¥${svc.revenue}</b></div><div><span>可用率</span><b>${Math.round(svc.ratio * 100)}%</b></div></div></div>
      <div class="emu-note">一级修 1,200 公里或 600 元，二级修 4,000 公里或 2,400 元。到期不修，车组扣在库里，客流与收入按可用率打折。</div>
      <div class="emu-grid">${list.map((s) => `<div class="emu-card ${s.due ? 'due' : ''}">
        <div class="emu-top"><b>${s.id}</b><span>${s.model}</span><em>${s.level === 2 ? '二级修过' : s.level === 1 ? '一级修过' : '未修'}</em></div>
        <div class="emu-km"><span>走行 ${s.km} km</span><span>距二级修 ${Math.max(0, SECOND - s.since)} km</span></div>
        <div class="emu-bar"><i style="width:${Math.min(100, Math.round(s.since / SECOND * 100))}%"></i></div>
        <div class="emu-st">${s.due === 2 ? '二级修到期，禁止出所' : s.due === 1 ? '一级修到期，可短交路' : `距一级修 ${s.firstLeft} km`}</div>
        <div class="emu-act"><button data-act="fix:${s.id}:1" ${s.since < FIRST ? 'disabled' : ''}>一级修 ¥600</button><button data-act="fix:${s.id}:2" ${s.since < SECOND ? 'disabled' : ''}>二级修 ¥2,400</button></div>
      </div>`).join('')}</div>
      <p class="emu-foot">里程按班累加。二级修后 since 清零，下一次仍从一级修开始计。</p>`;
  }

  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    const [_, id, lv] = b.dataset.act.split(':');
    const r = serviceEmu(id, Number(lv));
    toast(r.msg, r.ok ? 'ok' : 'err');
    render();
  });
  render();
}
