const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fm = (n) => `¥${Math.round(n).toLocaleString('zh-CN')}`;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pad = (h) => String(h).padStart(2, '0');

const BUILDS = {
  track: { name: '到发线', key: 'tracks', add: 2, cost: 120000, days: 3, note: '咽喉按 16 道预留，扩建只点亮既有岔位，不重构咽喉。新线从咽喉铺到车挡。' },
  platform: { name: '站台', key: 'platforms', add: 1, cost: 90000, days: 3, note: '在两股到发线之间增设站台，站台面直接出现在站场里。' },
  hall: { name: '候车厅', key: 'hall', add: 1, cost: 60000, days: 3, note: '候车厅向东扩建，增加候车面积与检票口，大客流不再压到站台。' }
};

let stationName = localStorage.getItem('ui-v2-station') || '宝鸡';
let state = null;

function fresh() {
  return {
    day: 1, cash: 300000, rep: 52, sup: 70, ap: 2,
    tracks: 8, platforms: 3, hall: 1, facility: 91,
    selected: 'track',
    construction: { track: 0, platform: 0, hall: 0 },
    issues: [],
    seen: [],
    pending: [],
    flags: {},
    log: [{ t: '06:00', text: '夜班交接：站场无封锁，3 道 K102 待整备，5 道货装 14 车。' }],
    settings: { anim: 'mid', crowd: 'mid', env: 'on', scale: '75', aa: 'on', fps: '60', motion: 'off' }
  };
}

const ISSUE_POOL = [
  { id: 'hall', tag: '候车厅', title: '早高峰旅客积压', text: '候车厅挤到站台通道，K105 开始检票，旅客在楼梯口对冲。', deadline: '还剩 18 分', choices: [
    { label: '先限流，分批放行', effect: { rep: -1, facility: 1 }, result: '站台恢复秩序，旅客抱怨，但没出安全问题。', flags: { hallLimit: true } },
    { label: '开临时候车区', effect: { cash: -1800, rep: 1 }, result: '腾出货运间作临时候车区，旅客情绪稳住。', flags: { hallTemp: true } }
  ] },
  { id: 'prep', tag: '3 道', title: 'K102 整备超时', text: '车底未回送，K102 图定 06:22 开，整备还剩 12 分。司机已在等。', deadline: '还剩 12 分', choices: [
    { label: '换班司机，压缩交接', effect: { cash: -800, sup: 1 }, result: '换班后正点开出，K102 没有晚点。', flags: { k102OnTime: true } },
    { label: '等原班，晚点 8 分', effect: { rep: -2, facility: -1 }, result: 'K102 晚点 8 分，后面货车被压，明天要还点。', flags: { k102Late: true } }
  ] },
  { id: 'freight', tag: '5 道', title: '货装积压 14 车', text: '装卸班只剩半个班，5 道还有 14 车没装完，货主在货运室等回话。', deadline: '今日 18:00 前', choices: [
    { label: '加夜班装完', effect: { cash: -1500, rep: 1, facility: -1 }, result: '夜班把 14 车装完，货主签了回单。', flags: { cargoDone: true } },
    { label: '压到明日再装', effect: { rep: -2, facility: -2 }, result: '车底继续占 5 道，明天早班要腾线，货主不满意。', flags: { cargoLate: true } }
  ] },
  { id: 'signal', tag: '咽喉', title: '3 号道岔反馈不稳', text: '3 号道岔连续两次反馈不到位，电务已到场，天窗还有 25 分。', deadline: '天窗 25 分', choices: [
    { label: '登记慢行，先保接发', effect: { facility: -2, sup: -1 }, result: '列车限速过岔，接发没断，但安全值掉了。', flags: { slowSwitch: true } },
    { label: '封锁 25 分处理', effect: { cash: -2200, facility: 2 }, result: '电务换完反馈杆，天窗用满，两列货车改点。', flags: { switchFixed: true } }
  ] },
  { id: 'staff', tag: '客运', title: '站台缺一名值班员', text: '客运值班员临时请假，K107 到达前 2 站台无人接车。', deadline: 'K107 12:20 到', choices: [
    { label: '从货场抽一人', effect: { rep: 1, facility: -1 }, result: '货场抽人顶岗，客运接车正常，货装慢了一拍。', flags: { staffBorrow: true } },
    { label: '站长自己顶', effect: { facility: 1, ap: -1 }, result: '站长去 2 站台接车，本日少一个管理动作。', flags: { stationMasterOnPlatform: true } }
  ] },
  { id: 'water', tag: '1 站台', title: '雨棚漏水', text: '1 站台雨棚两处漏水，旅客躲雨挤到站台边，客运员报修。', deadline: '下一班雨前', choices: [
    { label: '立即封锁半边整修', effect: { cash: -3000, rep: 1, facility: 3 }, result: '半边站台封锁，漏水止住，接发慢了一点。', flags: { roofFixed: true } },
    { label: '先摆桶接水，等天晴', effect: { rep: -2, facility: -2 }, result: '桶摆上了，旅客仍在抱怨，雨一大就会更糟。', flags: { roofLeak: true } }
  ] }
];

function setView(name) {
  document.querySelectorAll('.view').forEach((v) => v.classList.toggle('hidden', v.dataset.view !== name));
  if (name === 'manage') renderManage();
  if (name === 'dispatch') drawDispatch();
  window.scrollTo(0, 0);
}

function syncStation() {
  const name = stationName.endsWith('站') ? stationName : stationName + '站';
  $('entryStation').textContent = name;
  $('mTitleStation').textContent = name;
  if ($('settingsPanel') && !$('settingsPanel').classList.contains('hidden')) $('setStation').value = stationName;
}

function toast(text) {
  const el = $('toast');
  el.textContent = text;
  el.classList.remove('hidden');
  clearTimeout(window.__toast);
  window.__toast = setTimeout(() => el.classList.add('hidden'), 3200);
}

function dispatchYardSvg() {
  const y1 = 175, y2 = 242, y3 = 345, y4 = 405;
  return `<svg viewBox="0 0 1000 500" preserveAspectRatio="xMidYMid meet">
  <defs><pattern id="dgrid" width="22" height="22" patternUnits="userSpaceOnUse"><path d="M 22 0 L 0 0 0 22" fill="none" stroke="#c8bfa8" stroke-width="1" opacity=".55"/></pattern></defs>
  <rect width="1000" height="500" fill="#efe8d6"/><rect width="1000" height="500" fill="url(#dgrid)"/>
  <g>
    <rect class="svg-hall" x="300" y="48" width="200" height="58"/>
    <text class="svg-name" x="314" y="68">实训站 站房</text>
    <text class="svg-dim" x="314" y="84">值班室 · 信号楼</text>
    <line x1="400" y1="106" x2="400" y2="175" stroke="#7c7663" stroke-width="1.5"/>
  </g>
  <g>
    <rect class="svg-platform" x="170" y="198" width="600" height="18"/>
    <rect class="svg-platform-edge" x="170" y="198" width="600" height="3"/>
    <text class="svg-label" x="180" y="211">3 站台 · 450 m</text>
    <rect class="svg-platform" x="170" y="365" width="600" height="18"/>
    <rect class="svg-platform-edge" x="170" y="365" width="600" height="3"/>
    <text class="svg-label" x="180" y="378">4 站台 · 450 m</text>
  </g>
  ${[y1, y2, y3, y4].map((y, i) => `<line class="svg-rail" x1="70" y1="${y}" x2="930" y2="${y}"/>
    ${Array.from({ length: 22 }, (_, k) => `<line class="svg-sleeper" x1="${90 + k * 38}" y1="${y - 4}" x2="${90 + k * 38}" y2="${y + 4}"/>`).join('')}
    <text class="svg-label" x="34" y="${y + 3}">${i + 1} 道</text>
    <line x1="8" y1="${y - 26}" x2="70" y2="${y}" stroke="#4d5149" stroke-width="2"/>
    <line x1="8" y1="${y + 26}" x2="70" y2="${y}" stroke="#4d5149" stroke-width="2"/>
    <line x1="930" y1="${y}" x2="992" y2="${y - 30}" stroke="#4d5149" stroke-width="2"/>
    <line x1="930" y1="${y}" x2="992" y2="${y + 30}" stroke="#4d5149" stroke-width="2"/>
    <circle cx="66" cy="${y}" r="3" fill="${i === 0 ? '#a63a2e' : '#436b50'}"/>`).join('')}
  <g>
    <line x1="70" y1="${y1}" x2="930" y2="${y1}" stroke="#b88a2f" stroke-width="2" stroke-dasharray="7 5"/>
    <rect class="svg-train-pax" x="610" y="${y1 - 9}" width="78" height="18"/>
    <text x="620" y="${y1 + 4}" fill="#f2ead6" font-family="Roboto Mono,monospace" font-size="9">K101</text>
    <text class="svg-dim" x="610" y="${y1 - 15}">K101 · 1 道 · 待发</text>
  </g>
  <g>
    <rect class="svg-train-pax" x="550" y="${y2 - 9}" width="70" height="18"/>
    <text x="560" y="${y2 + 4}" fill="#f2ead6" font-family="Roboto Mono,monospace" font-size="9">K102</text>
    <text class="svg-dim" x="550" y="${y2 - 15}">K102 · 2 道 · 待避</text>
  </g>
  <g>
    <rect class="svg-train-freight" x="30" y="${y4 - 9}" width="70" height="18"/>
    <text x="40" y="${y4 + 4}" fill="#f2ead6" font-family="Roboto Mono,monospace" font-size="9">货1</text>
    <text class="svg-dim" x="30" y="${y4 - 15}">站外 · 待入</text>
  </g>
  <text class="svg-dim" x="18" y="480">宝成线实训段 · 复线中间站 · 上下行正线</text>
  <text class="svg-dim" x="982" y="480" text-anchor="end">4 道 · 2 站台</text>
  </svg>`;
}

function drawDispatch() {
  const y = $('dispatchYard');
  if (!y) return;
  y.innerHTML = dispatchYardSvg();
  $('dTitleStation').textContent = '实训站';
}

function trackYs() {
  const gap = state.tracks > 12 ? 34 : 40;
  const start = 145;
  return Array.from({ length: state.tracks }, (_, i) => start + i * gap);
}

function platformYs() {
  const ys = trackYs();
  return Array.from({ length: state.platforms }, (_, i) => {
    const idx = i === 0 ? 0 : i * 3;
    const a = ys[Math.min(idx, ys.length - 1)];
    const b = ys[Math.min(idx + 1, ys.length - 1)];
    return (a + b) / 2;
  });
}

function trainMap() {
  const ys = trackYs();
  const list = [
    { no: 'K101', track: 1, type: 'pax', x: 610 },
    { no: 'K105', track: 2, type: 'pax', x: 430 },
    { no: 'K102', track: 3, type: 'pax', x: 560 },
    { no: '货1', track: 5, type: 'freight', x: 650 },
    { no: '货3', track: 7, type: 'freight', x: 380 },
    { no: 'K107', track: 8, type: 'pax', x: 520 }
  ];
  if (state.tracks >= 10) {
    list.push({ no: 'K109', track: 9, type: 'pax', x: 700 });
    list.push({ no: '货5', track: 10, type: 'freight', x: 330 });
  }
  if (state.tracks >= 12) {
    list.push({ no: 'K111', track: 11, type: 'pax', x: 470 });
    list.push({ no: '货7', track: 12, type: 'freight', x: 600 });
  }
  if (state.tracks >= 16) {
    list.push({ no: 'K113', track: 13, type: 'pax', x: 380 });
    list.push({ no: 'K115', track: 14, type: 'pax', x: 650 });
    list.push({ no: '货9', track: 15, type: 'freight', x: 450 });
    list.push({ no: 'K117', track: 16, type: 'pax', x: 720 });
  }
  return list.filter((t) => t.track <= ys.length);
}

function manageYardSvg() {
  const ys = trackYs();
  const pys = platformYs();
  const hallW = 110 + state.hall * 24;
  const rows = tankRowWidth();
  let svg = `<svg viewBox="0 0 1000 792" preserveAspectRatio="xMidYMid meet">
  <defs>
    <pattern id="hatch2" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" fill="#d8c9a2"/><line x1="0" y1="0" x2="0" y2="8" stroke="#b88a2f" stroke-width="2"/></pattern>
  </defs>
  <rect width="1000" height="792" fill="#efe8d6"/>
  <g>
    <rect class="svg-hall" x="268" y="38" width="250" height="66"/>
    <text class="svg-name" x="282" y="60">${esc(stationName.endsWith('站') ? stationName : stationName + '站')} 站房</text>
    <text class="svg-dim" x="282" y="76">售票 · 行包 · 值班室</text>
    <line x1="380" y1="104" x2="380" y2="${ys[0]}" stroke="#7c7663" stroke-width="1.5"/>
  </g>
  <g>
    <rect class="svg-hall" x="548" y="38" width="${hallW}" height="66"/>
    <text class="svg-name" x="560" y="60">候车厅 ${state.hall} 层</text>
    <text class="svg-dim" x="560" y="76">检票口 4 · 候车 1,200 人</text>
    ${Array.from({ length: 5 }, (_, i) => `<rect class="svg-hall-win" x="${560 + i * 20}" y="86" width="10" height="5"/>`).join('')}
  </g>
  <line x1="56" y1="120" x2="944" y2="120" stroke="#8f8873" stroke-width="1"/>
  <text class="svg-dim" x="58" y="115">到发场 · 咽喉按 16 道预留</text>
  ${ys.map((y, i) => `<line class="svg-rail" x1="58" y1="${y}" x2="942" y2="${y}"/>
    ${Array.from({ length: 30 }, (_, k) => `<line class="svg-sleeper" x1="${74 + k * 29}" y1="${y - 3}" x2="${74 + k * 29}" y2="${y + 3}"/>`).join('')}
    <text class="svg-label" x="18" y="${y + 3}">${i + 1} 道</text>
    <line x1="8" y1="${y - 22}" x2="58" y2="${y}" stroke="#6c7063" stroke-width="2"/>
    <line x1="8" y1="${y + 22}" x2="58" y2="${y}" stroke="#6c7063" stroke-width="2"/>
    <line x1="942" y1="${y}" x2="992" y2="${y - 22}" stroke="#6c7063" stroke-width="2"/>
    <line x1="942" y1="${y}" x2="992" y2="${y + 22}" stroke="#6c7063" stroke-width="2"/>
    <rect x="58" y="${y - 9}" width="884" height="18" fill="transparent" data-part="track"/>
    <rect x="${rows.x}" y="${y + 8}" width="14" height="10" fill="${i < 6 ? '#a63a2e' : 'none'}" stroke="${i < 6 ? '#7f2d24' : '#afa68f'}" data-part="track"/>
    ${i < 6 ? `<text class="svg-dim" x="${rows.x + 18}" y="${y + 17}">占用</text>` : ''}
  </g>`).join('')}
  ${pys.map((y, i) => `<g data-part="platform-${i + 1}" style="cursor:pointer">
    <rect class="svg-platform" x="120" y="${y - 10}" width="780" height="20"/>
    <rect class="svg-platform-edge" x="120" y="${y - 10}" width="780" height="3"/>
    <text class="svg-label" x="130" y="${y + 3}">${i + 1} 站台 · 450 m</text>
    <text class="svg-label" x="890" y="${y + 3}" text-anchor="end">${i + 1} 台</text>
    <rect x="880" y="${y - 10}" width="120" height="20" fill="transparent"/>
  </g>`).join('')}
  <g data-part="hall" style="cursor:pointer">
    <rect class="svg-hall" x="300" y="640" width="220" height="54"/>
    <text class="svg-name" x="314" y="662">货场 · 仓库</text>
    <text class="svg-dim" x="314" y="678">装卸线 2 条 · 待装 14 车</text>
  </g>
  <g data-part="hall" style="cursor:pointer">
    <rect x="560" y="640" width="330" height="58" fill="none" stroke="#a9a18b" stroke-dasharray="5 5"/>
    <text class="svg-dim" x="570" y="662">预留存车线 / 装卸线</text>
    <text class="svg-dim" x="570" y="678">待扩建</text>
  </g>
  ${trainMap().map((t) => {
    const y = ys[t.track - 1];
    if (y == null) return '';
    return `<g>
      <rect class="${t.type === 'pax' ? 'svg-train-pax' : 'svg-train-freight'}" x="${t.x}" y="${y - 9}" width="${t.type === 'pax' ? 78 : 92}" height="18"/>
      <text x="${t.x + 8}" y="${y + 4}" fill="#f2ead6" font-family="Roboto Mono,monospace" font-size="8">${t.no}</text>
      <text class="svg-dim" x="${t.x}" y="${y - 15}">${t.no} · ${t.track} 道</text>
    </g>`;
  }).join('')}
  ${Object.keys(state.construction).filter((k) => state.construction[k] > 0).map((k, i) => `<g>
    <rect x="${880 - i * 8}" y="${ys[ys.length - 1] - 10 + i * 46}" width="52" height="28" fill="url(#hatch2)" stroke="#b88a2f"/>
    <text class="svg-dim" x="906" y="${ys[ys.length - 1] + 32 + i * 46}" text-anchor="middle">${BUILDS[k].name} ${state.construction[k]} 日</text>
  </g>`).join('')}
  <text class="svg-dim" x="18" y="772">宝成线 · ${esc(stationName.endsWith('站') ? stationName : stationName + '站')} · 单线半自动闭塞</text>
  <text class="svg-dim" x="982" y="772" text-anchor="end">${state.tracks} 道 · ${state.platforms} 台 · 有效长 450 m</text>
  </svg>`;
  return svg;
}

function tankRowWidth() {
  return { x: 56 };
}

function renderManage() {
  syncStation();
  $('mDay').textContent = state.day;
  $('mCash').textContent = fm(state.cash);
  $('mRep').textContent = Math.round(state.rep);
  $('mSup').textContent = Math.round(state.sup);
  $('mAp').textContent = `${state.ap}/2`;
  $('mAdvance').textContent = `推进到第 ${state.day + 1} 日`;
  const yard = $('manageYard');
  if (yard.dataset.station !== stationName || !yard.querySelector('.smap')) {
    yard.dataset.station = stationName;
    yard.innerHTML = '';
    window.__yardApi = window.createStationMap(yard, { station: stationName, tracks: state.tracks });
  } else if (window.__yardApi && window.__yardApi.tracks() !== state.tracks) {
    window.__yardApi.setTracks(state.tracks);
  }
  $('mDesk').innerHTML = deskHtml();
  $('mDesk').querySelectorAll('[data-choice]').forEach((b) => b.addEventListener('click', () => resolveIssue(Number(b.dataset.issue), Number(b.dataset.choice))));
  $('mDesk').querySelectorAll('[data-build]').forEach((b) => b.addEventListener('click', () => startBuild(b.dataset.build)));
  $('mDesk').querySelectorAll('[data-desk]').forEach((b) => b.addEventListener('click', () => toast('人员、合同、财务在正式版展开；这版先验证站场与建设。')));
  renderTimeline();
}

function issueHtml() {
  if (!state.issues.length) state.issues = pickIssues();
  return state.issues.map((x, i) => {
    if (x.done) return `<div class="m-issue done"><div class="m-issue-top"><span class="tag">${esc(x.tag)}</span><b>${esc(x.title)}</b><em>已处置</em></div><div class="m-issue-result">${esc(x.result)}</div></div>`;
    return `<div class="m-issue"><div class="m-issue-top"><span class="tag">${esc(x.tag)}</span><b>${esc(x.title)}</b><em>${esc(x.deadline)}</em></div><p>${esc(x.text)}</p><div class="m-choices">${x.choices.map((c, j) => `<button data-choice="${i}" data-idx="${j}">${esc(c.label)}</button>`).join('')}</div></div>`;
  }).join('');
}

function pickIssues() {
  const pending = state.pending.splice(0, 2);
  const unseen = ISSUE_POOL.filter((x) => !state.seen.includes(x.id));
  const picked = [];
  pending.forEach((p) => {
    const base = ISSUE_POOL.find((x) => x.id === p.id) || ISSUE_POOL[0];
    picked.push({ ...base, title: p.title || base.title, text: p.text || base.text, done: '', result: '' });
  });
  unseen.forEach((x) => {
    if (picked.length < 3) {
      picked.push({ ...x, done: '', result: '' });
      state.seen.push(x.id);
    }
  });
  while (picked.length < 3) {
    const base = ISSUE_POOL[(state.day + picked.length) % ISSUE_POOL.length];
    picked.push({ ...base, id: `${base.id}-v${state.day}`, title: `${base.title}（重复出现）`, done: '', result: '' });
  }
  return picked;
}

function deskHtml() {
  const sel = state.selected;
  let build = '';
  if (sel === 'hall') {
    const active = state.construction.hall;
    build = `<div class="m-build"><div class="m-build-head"><b>候车厅 ${state.hall} 层</b><em>检票口 4</em></div><p>${BUILDS.hall.note}</p><button class="m-build-btn" data-build="hall" ${active || state.cash < BUILDS.hall.cost ? 'disabled' : ''}>${active ? `施工中 · 剩 ${active} 日` : `扩建一层 <span>${fm(BUILDS.hall.cost)} · 3 日</span>`}</button></div>`;
  } else if (sel.startsWith('platform')) {
    const active = state.construction.platform;
    build = `<div class="m-build"><div class="m-build-head"><b>${sel.split('-')[1]} 站台 · 450 m</b><em>雨棚完好</em></div><p>${BUILDS.platform.note}</p><button class="m-build-btn" data-build="platform" ${active || state.cash < BUILDS.platform.cost ? 'disabled' : ''}>${active ? `施工中 · 剩 ${active} 日` : `增设一座站台 <span>${fm(BUILDS.platform.cost)} · 3 日</span>`}</button></div>`;
  } else {
    const active = state.construction.track;
    build = `<div class="m-build"><div class="m-build-head"><b>到发线 ${state.tracks} 条</b><em>有效长 450 m</em></div><p>${BUILDS.track.note}</p><button class="m-build-btn" data-build="track" ${active || state.cash < BUILDS.track.cost ? 'disabled' : ''}>${active ? `施工中 · 剩 ${active} 日` : `扩建两条 <span>${fm(BUILDS.track.cost)} · 3 日</span>`}</button></div>`;
  }
  return `<div class="m-desk-head"><div><span>值班桌 · 站长</span><b>第 ${state.day} 日</b><em>08:12 / 白班</em></div><span class="m-stamp">在岗</span></div>
  <div class="m-sec"><h3>今日三件事</h3>${issueHtml()}</div>
  <div class="m-sec"><h3>建设</h3>${build}</div>
  <div class="m-sec"><h3>本站底账</h3><div class="m-rows">
    <div class="m-row"><span>现金</span><b>${fm(state.cash)}</b></div>
    <div class="m-row"><span>声誉 / 上级</span><b>${Math.round(state.rep)} / ${Math.round(state.sup)}</b></div>
    <div class="m-row"><span>人员</span><b>36 / 需 31</b></div>
    <div class="m-row"><span>设施状态</span><b>${Math.round(state.facility)}</b></div>
    <div class="m-row"><span>股道 / 站台</span><b>${state.tracks} / ${state.platforms}</b></div>
    <div class="m-row"><span>今日动作</span><b>${state.ap} / 2</b></div>
  </div></div>
  <div class="m-sec"><h3>值班记录</h3><div class="m-log">${state.log.slice(0, 7).map((x) => `<div class="m-log-line"><time>${esc(x.t)}</time><span>${esc(x.text)}</span></div>`).join('')}</div></div>`;
}

function resolveIssue(i, j) {
  const issue = state.issues[i];
  if (!issue || issue.done) return;
  const c = issue.choices[j];
  if (!c) return;
  applyEffect(c.effect);
  if (c.flags) Object.assign(state.flags, c.flags);
  issue.done = c.label;
  issue.result = c.result;
  if (c.flags && c.flags.k102Late) state.pending.push({ id: 'prep', title: 'K102 晚点连锁', text: '昨天压下的 K102 今天还要还点，3 道整备时间被挤掉。' });
  if (c.flags && c.flags.roofLeak) state.pending.push({ id: 'water', title: '雨棚漏水加重', text: '昨天没修的雨棚今天漏得更厉害，旅客已经绕开 1 站台。' });
  state.log.unshift({ t: '08:12', text: `${issue.title}：${c.label}。${c.result}` });
  toast(c.result);
  renderManage();
}

function applyEffect(e) {
  if (!e) return;
  if (e.cash) state.cash += e.cash;
  if (e.rep) state.rep = clamp(state.rep + e.rep, 0, 100);
  if (e.sup) state.sup = clamp(state.sup + e.sup, 0, 100);
  if (e.facility) state.facility = clamp(state.facility + e.facility, 20, 100);
  if (e.ap) state.ap = clamp(state.ap + e.ap, 0, 2);
}

function startBuild(key) {
  const b = BUILDS[key];
  if (!b) return;
  if (state.construction[key] > 0 || state.cash < b.cost) return;
  state.cash -= b.cost;
  state.construction[key] = b.days;
  state.log.unshift({ t: '08:12', text: `${b.name}开工：${fm(b.cost)}，工期 3 日。${b.note}` });
  toast(`${b.name}已开工，3 日后交付`);
  renderManage();
}

function advance() {
  Object.keys(state.construction).forEach((k) => {
    if (state.construction[k] > 0) {
      state.construction[k] -= 1;
      if (state.construction[k] === 0) {
        state[BUILDS[k].key] += BUILDS[k].add;
        state.log.unshift({ t: '06:00', text: `${BUILDS[k].name}交付，站场已更新。` });
        toast(`${BUILDS[k].name}交付`);
      }
    }
  });
  state.day += 1;
  state.ap = 2;
  state.cash += 3021;
  state.facility = clamp(state.facility - 0.8, 20, 100);
  state.issues = pickIssues();
  state.log.unshift({ t: '06:00', text: `第 ${state.day} 日开班：日净利 +¥3,021，今日三件事已更新。` });
  renderManage();
  toast(`已推进到第 ${state.day} 日`);
}

function renderTimeline() {
  const start = 6, end = 24;
  let html = '<div class="m-tl-head"><span>今日运行</span><span>06:00—24:00</span></div><div class="m-tl-body">';
  for (let h = start; h <= end; h += 2) {
    const left = ((h - start) / (end - start)) * 100;
    html += `<div class="m-tl-mark" style="left:${left}%"></div><span class="m-tl-lab" style="left:${left}%">${pad(h)}:00</span>`;
  }
  const trains = trainMap();
  trains.forEach((t, i) => {
    const h = 6.1 + i * 1.55;
    const left = ((h - start) / (end - start)) * 100;
    html += `<div class="m-tl-train" style="left:${left}%"><i></i><b>${t.no}</b></div>`;
  });
  html += `<div class="m-tl-now" style="left:${((8.2 - start) / (end - start)) * 100}%"></div></div>`;
  $('mTimeline').innerHTML = html;
}

function openSettings() {
  $('settingsPanel').classList.remove('hidden');
  $('setStation').value = stationName;
}

function closeSettings() {
  $('settingsPanel').classList.add('hidden');
}

document.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => setView(b.dataset.go)));
document.querySelectorAll('[data-toast]').forEach((b) => b.addEventListener('click', () => toast(b.dataset.toast)));
$('mAdvance').addEventListener('click', advance);
$('settingsOpen').addEventListener('click', openSettings);
$('settingsClose').addEventListener('click', closeSettings);
$('setStation').addEventListener('input', (e) => {
  stationName = e.target.value.trim() || '宝鸡';
  localStorage.setItem('ui-v2-station', stationName);
  syncStation();
  if (state) renderManage();
});
document.querySelectorAll('.set-seg').forEach((seg) => {
  seg.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
    seg.querySelectorAll('button').forEach((x) => x.classList.remove('on'));
    b.classList.add('on');
    if (state) state.settings[seg.dataset.key] = b.dataset.v;
    if (seg.dataset.key === 'scale') $('manageYard').style.filter = b.dataset.v === '75' ? 'contrast(1.02)' : 'none';
    toast(`${seg.previousElementSibling ? seg.parentElement.querySelector('span').textContent : '设置'}：${b.textContent}`);
  }));
});

state = fresh();
state.issues = pickIssues();
syncStation();
drawDispatch();
setView('entry');
