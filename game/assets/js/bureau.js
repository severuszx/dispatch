import { el, toast } from './util.js';
import { career, saveCareer } from './career.js';
import { profile, saveProfile } from './profile.js';
import { STATIONS, stationList, SEGMENTS, bottleneck } from './stations.js';
import { weeklySummary } from './review.js';

function region() {
  career.data.region = career.data.region || { relief: null, meetings: [] };
  return career.data.region;
}

export function applyRegionRelief() {
  const r = region().relief;
  if (!r || r.left <= 0) return 0;
  return 0.08;
}

export function tickRegion() {
  const r = region().relief;
  if (r) {
    r.left -= 1;
    if (r.left <= 0) region().relief = null;
    saveCareer();
  }
}

export function mountBureau(body, ctx) {
  body.classList.add('bureau-pane');
  const root = el('div', 'bureau');
  body.append(root);

  function draw() {
    const r = region();
    const list = Object.values(STATIONS);
    const totalTrains = list.reduce((a, s) => a + s.trainsDay, 0);
    const totalBottleneck = list.reduce((a, s) => a + bottleneck(s.id), 0) / list.length;
    const week = weeklySummary()[0];
    root.innerHTML = `<div class="bur-head"><div><b>区域调度中心</b><span>宝成线宝鸡—略阳 · 4 站 3 区段 · 西安局集团</span></div><div class="bur-kpi"><div><span>日车流</span><b>${totalTrains}</b></div><div><span>平均瓶颈</span><b>${Math.round(totalBottleneck * 100)}%</b></div><div><span>周评级</span><b>${week ? week.rating : '—'}</b></div><div><span>上级</span><b>${career.data.superior}</b></div></div></div>
      <div class="bur-map">${list.map((s, i) => {
        const b = Math.round(bottleneck(s.id) * 100);
        const relief = r.relief && r.relief.station === s.id ? `<em>区域支援 ${r.relief.left} 班</em>` : '';
        return `<div class="bur-station ${s.id === career.data.currentStation ? 'on' : ''}"><div class="bur-st-head"><b>${s.name}</b><span>${s.grade} · ${s.tech}</span>${relief}</div><div class="bur-st-num"><span>${s.adTracks} 股道</span><span>${s.trainsDay} 列/日</span><span>瓶颈 ${b}%</span></div><div class="bur-bar"><i style="width:${b}%"></i></div><div class="bur-st-act"><button data-act="relief:${s.id}" ${profile.data.credits < 3000 || (r.relief && r.relief.station === s.id) ? 'disabled' : ''}>派支援 3 班 / ¥3000</button><button data-act="focus:${s.id}">接管本站</button></div></div>${i < list.length - 1 ? `<div class="bur-seg"><b>${SEGMENTS[i].km} km</b><span>${SEGMENTS[i].runMin} 分 · 追踪 ${SEGMENTS[i].capacity}</span></div>` : ''}`;
      }).join('')}</div>
      <div class="bur-foot"><div><h3>区域资源</h3><p>${r.relief ? `${STATIONS[r.relief.station].name} 正在接受区域支援，瓶颈按 -8% 计，还剩 ${r.relief.left} 班。` : '没有正在执行的区域支援。派一名替班值班员到瓶颈站，3 班内降低该站股道/人手压力。'}</p></div><div><h3>近四周</h3>${weeklySummary().length ? weeklySummary().map((w) => `<div class="bur-week"><b>第 ${w.week} 周 ${w.rating}</b><span>${w.net >= 0 ? '+' : ''}${Math.round(w.net)} · 准点 ${w.punctuality}%</span></div>`).join('') : '<p>还没出周评级。</p>'}</div></div>`;
  }

  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    if (act.startsWith('relief:')) {
      const id = act.slice(7);
      if (profile.data.credits < 3000) return toast('资金不足 3000', 'err');
      profile.data.credits -= 3000;
      saveProfile();
      region().relief = { station: id, left: 3, at: Date.now() };
      saveCareer();
      toast(`已向 ${STATIONS[id].name} 派区域支援，3 班内瓶颈下降`, 'ok');
    } else if (act.startsWith('focus:')) {
      const id = act.slice(6);
      career.data.currentStation = id;
      saveCareer();
      toast(`当前经营站切到 ${STATIONS[id].name}`, 'ok');
    }
    draw();
  });

  draw();
  return { refresh: draw };
}
