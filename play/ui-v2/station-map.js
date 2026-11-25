(function () {
  const W = 2200, H = 1500;
  const C = { paper: '#efe8d6', ink: '#2b2d27', mute: '#6f6a58', red: '#a63a2e', blue: '#2f5d7c', yellow: '#b88a2f', green: '#436b50', line: '#5f5c4e', faint: '#b9b09a' };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const range = (n) => Array.from({ length: n }, (_, i) => i);
  const paxYs = range(16).map((i) => 306 + i * 42);
  const platYs = [paxYs[2] + 21, paxYs[5] + 21, paxYs[8] + 21, paxYs[11] + 21];
  const freightYs = [1040, 1084, 1128, 1172, 1216];
  const engineYs = [470, 520, 570];
  const storeYs = [1030, 1080, 1130, 1180];

  function rail(x1, y1, x2, y2, cls, w) {
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${cls || C.line}" stroke-width="${w || 2.2}" stroke-linecap="square"/>`;
  }

  function sleepers(x1, y1, x2, y2, gap, cls) {
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    const n = Math.max(2, Math.floor(len / gap));
    const nx = -dy / len * 4, ny = dx / len * 4;
    return range(n).map((i) => {
      const t = i / n;
      const x = x1 + dx * t, y = y1 + dy * t;
      return `<line x1="${x - nx}" y1="${y - ny}" x2="${x + nx}" y2="${y + ny}" stroke="#9b927d" stroke-width="1" class="${cls || 'lod-mid'}"/>`;
    }).join('');
  }

  function switchAt(x, y, dir, no) {
    return `<g class="lod-mid"><line x1="${x}" y1="${y}" x2="${x + 18}" y2="${y + dir * 10}" stroke="${C.ink}" stroke-width="2"/><line x1="${x}" y1="${y}" x2="${x + 18}" y2="${y}" stroke="${C.ink}" stroke-width="1.2"/><circle cx="${x}" cy="${y}" r="2.2" fill="${C.ink}"/><text x="${x - 4}" y="${y - 7}" class="smap-dim lod-near">${no}</text></g>`;
  }

  function signalAt(x, y, green, label) {
    return `<g class="lod-mid"><line x1="${x}" y1="${y}" x2="${x}" y2="${y - 15}" stroke="#4a4a3e" stroke-width="1.4"/><circle cx="${x}" cy="${y - 18}" r="3.2" fill="${green ? '#436b50' : '#a63a2e'}" stroke="#2b2d27" stroke-width=".8"/><text x="${x + 5}" y="${y - 17}" class="smap-dim lod-near">${label || ''}</text></g>`;
  }

  function trainBlock(x, y, no, cars, color) {
    const w = 8, gap = 3;
    let s = '';
    for (let i = 0; i < cars; i++) {
      const cx = x + i * (w + gap);
      s += `<rect x="${cx}" y="${y - 7}" width="${w}" height="14" fill="${i === 0 ? C.ink : (color || '#6c6655')}" stroke="#24251f" stroke-width=".7"/>`;
      if (i > 0) s += `<line x1="${cx + 2}" y1="${y - 5}" x2="${cx + 2}" y2="${y + 5}" stroke="#c9c0a8" stroke-width=".8"/>`;
    }
    return `<g class="lod-far"><rect x="${x - 2}" y="${y - 10}" width="${cars * 11 + 2}" height="20" fill="rgba(255,250,235,.16)" stroke="none"/><text x="${x}" y="${y - 12}" class="smap-track-label">${no}</text>${s}</g>`;
  }

  function occupancy(x, y, filled) {
    return `<g class="lod-far"><rect x="${x}" y="${y}" width="16" height="9" fill="${filled ? C.red : 'none'}" stroke="${filled ? '#7d2c23' : '#aaa189'}" stroke-width=".8"/>${filled ? `<rect x="${x + 18}" y="${y + 1}" width="22" height="7" fill="rgba(166,58,46,.22)"/>` : ''}</g>`;
  }

  function stationSvg(name, activeTracks) {
    const active = activeTracks || 16;
    const pax = paxYs.map((y, i) => {
      const on = i < active;
      const main = i < 2;
      const occupied = on && [0, 1, 2, 3, 4, 5, 7, 8, 10, 12, 14].includes(i);
      if (!on) return `<g class="lod-mid"><line x1="478" y1="${y}" x2="1542" y2="${y}" stroke="#b5ab93" stroke-width="1.2" stroke-dasharray="9 7"/><text x="430" y="${y + 3}" class="smap-dim">${i + 1} 预留</text></g>`;
      return `<g>
        ${rail(478, y, 1542, y, main ? C.ink : '#6d6857', main ? 4 : 2.2)}
        ${sleepers(478, y, 1542, y, 24)}
        <text x="410" y="${y + 4}" class="smap-index">${i + 1}</text>
        <text x="430" y="${y + 3}" class="smap-track-label">${main ? '正线' : '到发'}</text>
        ${occupancy(478, y + 8, occupied)}
        ${occupied ? `<text x="526" y="${y + 16}" class="smap-dim">占用</text>` : ''}
      </g>`;
    }).join('');

    const future = '';

    const platCount = active >= 12 ? 4 : 3;
    const platforms = platYs.slice(0, platCount).map((y, i) => `<g data-focus="passenger">
      <rect x="510" y="${y - 32}" width="1010" height="15" fill="rgba(180,164,128,.28)" stroke="#8e8570" stroke-width=".8"/>
      <line x1="520" y1="${y - 32}" x2="1510" y2="${y - 32}" stroke="#6f6a58" stroke-width="1"/>
      <rect x="510" y="${y - 11}" width="1010" height="22" fill="#d9cdb1" stroke="#7c7563" stroke-width="1"/>
      <rect x="510" y="${y - 11}" width="1010" height="3" fill="#8e8570"/>
      <text x="522" y="${y + 3}" class="smap-track-label">${i + 1} 站台 · 450 m · 雨棚</text>
      <text x="1500" y="${y + 3}" text-anchor="end" class="smap-dim">${i + 1} 台</text>
      ${range(3).map((k) => `<rect x="${560 + k * 300}" y="${y - 26}" width="18" height="9" fill="none" stroke="#8e8570" stroke-width=".7"/>`).join('')}
    </g>`).join('');

    const paxTrains = [
      { t: 0, no: 'K101', cars: 6 }, { t: 1, no: 'K102', cars: 5 }, { t: 2, no: 'K105', cars: 4 },
      { t: 3, no: 'K107', cars: 6 }, { t: 4, no: 'K109', cars: 4 }, { t: 5, no: '货1', cars: 5, c: '#6b5a43' },
      { t: 7, no: '货3', cars: 6, c: '#6b5a43' }, { t: 8, no: 'K111', cars: 5 }, { t: 10, no: 'K113', cars: 4 },
      { t: 11, no: 'K115', cars: 6 }, { t: 12, no: '货7', cars: 5, c: '#6b5a43' }, { t: 13, no: 'K117', cars: 4 },
      { t: 14, no: 'K119', cars: 5 }, { t: 15, no: 'K121', cars: 4 }
    ].filter((x) => x.t < active).map((x) => trainBlock(760 + (x.t % 3) * 90, paxYs[x.t], x.no, x.cars, x.c)).join('');

    const freight = freightYs.map((y, i) => `<g data-focus="freight">
      ${rail(1600, y, 2050, y, '#6d6857', 2)}
      ${sleepers(1600, y, 2050, y, 26)}
      <text x="1552" y="${y + 3}" class="smap-track-label">货${i + 1}</text>
      ${occupancy(1600, y + 8, i < 3)}
    </g>`).join('') + trainBlock(1710, freightYs[0], '货1', 6, '#6b5a43') + trainBlock(1770, freightYs[1], '货5', 4, '#6b5a43');

    const engine = engineYs.map((y, i) => `<g data-focus="engine">
      ${rail(1620, y, 2030, y, '#5b584a', 2)}
      ${sleepers(1620, y, 2030, y, 24)}
      <text x="1578" y="${y + 3}" class="smap-track-label">机${i + 1}</text>
      ${i === 0 ? trainBlock(1770, y, 'DF4', 2, '#4f5d46') : ''}
    </g>`).join('');

    const store = storeYs.map((y, i) => `<g data-focus="storage">
      ${rail(120, y, 400, y, '#77705d', 1.8)}
      ${sleepers(120, y, 400, y, 26)}
      <text x="84" y="${y + 3}" class="smap-track-label">存${i + 1}</text>
      ${occupancy(120, y + 8, i < 2)}
    </g>`).join('') + trainBlock(180, storeYs[0], '存车', 5, '#5c5848');

    const depot = `<g data-focus="passenger">
      <text x="620" y="1012" class="smap-yard-label">客技站</text>
      ${[1062, 1110, 1158].map((y, i) => `<line x1="650" y1="${y}" x2="1010" y2="${y}" stroke="#6d6857" stroke-width="1.8"/><text x="620" y="${y + 3}" class="smap-dim">技${i + 1}</text>`).join('')}
      <rect x="740" y="1182" width="280" height="72" fill="#ddd0b3" stroke="${C.ink}" stroke-width="1.2"/>
      <text x="754" y="1205" class="smap-yard-label">客车整备</text>
      <text x="754" y="1223" class="smap-dim">洗车 · 上水 · 吸污</text>
      <rect x="1090" y="1030" width="400" height="280" fill="none" stroke="#b5ab93" stroke-width="1.2" stroke-dasharray="7 5"/>
      <text x="1104" y="1054" class="smap-dim">预留发展用地</text>
      <text x="1104" y="1072" class="smap-dim">远期客技站 / 存车场扩建</text>
    </g>`;
    const switches = range(10).map((i) => switchAt(260 + i * 22, 300 + i * 8, i % 2 ? -1 : 1, String(21 + i))).join('') +
      range(10).map((i) => switchAt(1560 + i * 22, 300 + i * 8, i % 2 ? -1 : 1, String(31 + i))).join('');

    const route = `<path class="lod-far" d="M 70 590 L 400 590 L 478 ${paxYs[2]} L 760 ${paxYs[2]}" fill="none" stroke="${C.yellow}" stroke-width="2.4" stroke-dasharray="8 5" opacity=".9"/>`;

    const leftThroat = `<g data-focus="throat">
      <text x="196" y="250" class="smap-yard-label">下行咽喉</text>
      <line x1="70" y1="590" x2="478" y2="590" stroke="${C.ink}" stroke-width="4"/>
      <line x1="70" y1="710" x2="478" y2="710" stroke="${C.ink}" stroke-width="4"/>
      <text x="38" y="582" class="smap-port">宝成线</text>
      <text x="38" y="732" class="smap-port">陇海线</text>
      ${paxYs.map((y, i) => { const tx = 430 - ((y <= 590 ? i : i - 8) * 14); const ty = y <= 590 ? 590 : 710; return `<line x1="478" y1="${y}" x2="${tx}" y2="${ty}" stroke="#5f5c4e" stroke-width="1.6"/>${switchAt(tx, ty, i % 2 ? 1 : -1, String(20 + i))}`; }).join('')}
      <line x1="478" y1="710" x2="548" y2="768" stroke="${C.ink}" stroke-width="1.4"/>
      <rect x="548" y="768" width="52" height="9" fill="none" stroke="${C.red}" stroke-width="1"/>
      <text x="552" y="792" class="smap-emg">安全线</text>
      ${signalAt(270, 590, true, 'S1')}${signalAt(270, 710, false, 'S2')}
    </g>`;
    const rightThroat = `<g data-focus="throat">
      <text x="1742" y="250" class="smap-yard-label">上行咽喉</text>
      <line x1="1542" y1="570" x2="1880" y2="570" stroke="${C.ink}" stroke-width="4"/>
      <line x1="1542" y1="700" x2="1880" y2="700" stroke="${C.ink}" stroke-width="4"/>
      <text x="2128" y="562" text-anchor="end" class="smap-port">宝成线</text>
      <text x="2128" y="722" text-anchor="end" class="smap-port">陇海线</text>
      ${paxYs.map((y, i) => { const tx = 1600 + ((y <= 570 ? i : i - 7) * 14); const ty = y <= 570 ? 570 : 700; return `<line x1="1542" y1="${y}" x2="${tx}" y2="${ty}" stroke="#5f5c4e" stroke-width="1.6"/>${switchAt(tx, ty, i % 2 ? -1 : 1, String(40 + i))}`; }).join('')}
      <path d="M 1880 570 C 1940 630 1980 700 2000 780" fill="none" stroke="#5f5c4e" stroke-width="1.6" stroke-dasharray="6 4"/>
      <text x="1900" y="804" class="smap-dim">联络线 · 机务段</text>
      ${signalAt(1880, 570, true, 'S11')}${signalAt(1880, 700, true, 'S12')}
    </g>`;
    return `<svg viewBox="0 0 2200 1500" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <pattern id="grain" width="26" height="26" patternUnits="userSpaceOnUse"><path d="M 26 0 L 0 0 0 26" fill="none" stroke="#cfc5ad" stroke-width="1" opacity=".5"/></pattern>
      <pattern id="hatch" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="12" height="12" fill="#e3d4ae"/><line x1="0" y1="0" x2="0" y2="12" stroke="#b88a2f" stroke-width="2"/></pattern>
    </defs>
    <rect width="2200" height="1500" fill="${C.paper}"/>
    <rect width="2200" height="1500" fill="url(#grain)"/>
    <rect x="26" y="26" width="2148" height="1448" fill="none" stroke="#928a74" stroke-width="1.4"/>
    
    <g data-focus="station">
      <rect x="800" y="108" width="330" height="88" fill="#ddd0b3" stroke="${C.ink}" stroke-width="1.6"/>
      <line x1="800" y1="128" x2="1130" y2="128" stroke="${C.ink}" stroke-width="2"/>
      <text x="818" y="154" class="smap-yard-label">站房 · 售票 / 行包</text>
      <text x="818" y="174" class="smap-dim">站长室 · 信号楼 · 客运值班</text>
      <rect x="1142" y="108" width="330" height="88" fill="#e4d8bd" stroke="${C.ink}" stroke-width="1.6"/>
      <text x="1160" y="138" class="smap-yard-label">候车厅 · 2 层</text>
      <text x="1160" y="156" class="smap-dim">候车 1,800 人 · 检票口 6</text>
      ${range(8).map((i) => `<rect x="${1162 + i * 26}" y="168" width="12" height="7" fill="#8c8168"/>`).join('')}
      <line x1="960" y1="196" x2="1400" y2="196" stroke="#6f6a58" stroke-width="2"/>
      <line x1="1000" y1="196" x2="1000" y2="320" stroke="#6f6a58" stroke-width="1.2"/>
      <line x1="1360" y1="196" x2="1360" y2="320" stroke="#6f6a58" stroke-width="1.2"/>
      <text x="1006" y="190" class="smap-dim">天桥</text>
    </g>

    <text x="510" y="300" class="smap-yard-label">客运场</text>
    <text x="1582" y="410" class="smap-yard-label">机务段</text>
    <text x="1600" y="1000" class="smap-yard-label">货场</text>
    <text x="92" y="1000" class="smap-yard-label">存车场</text>
    <text x="246" y="250" class="smap-dim" transform="rotate(90 246 250)">下行咽喉</text>
    <text x="1870" y="250" class="smap-dim" transform="rotate(90 1870 250)">上行咽喉</text>

    <rect x="466" y="238" width="1088" height="700" fill="none" stroke="#9e957f" stroke-width="1" stroke-dasharray="3 4"/>
    <rect x="1572" y="392" width="512" height="404" fill="none" stroke="#9e957f" stroke-width="1" stroke-dasharray="3 4"/>
    <rect x="1572" y="982" width="512" height="320" fill="none" stroke="#9e957f" stroke-width="1" stroke-dasharray="3 4"/>
    <rect x="70" y="966" width="392" height="326" fill="none" stroke="#9e957f" stroke-width="1" stroke-dasharray="3 4"/>

    ${leftThroat}
    ${rightThroat}
    ${pax}
    ${future}
    ${active < 16 ? `<text x="560" y="${paxYs[active] + 46}" class="smap-yard-label">预留 ${active + 1}—16 道</text><text x="562" y="${paxYs[active] + 68}" class="smap-port">扩建区 · 咽喉岔位已预留</text>` : ''}
    ${platforms}
    ${depot}
    ${paxTrains}
    ${freight}
    ${engine}
    ${store}
    ${switches}
    ${route}

    <g data-focus="station">
      <rect x="1650" y="610" width="250" height="110" fill="#ddd0b3" stroke="${C.ink}" stroke-width="1.4"/>
      <text x="1666" y="636" class="smap-yard-label">机务折返段</text>
      <text x="1666" y="654" class="smap-dim">整备线 3 · 机待线 2 · 三角线</text>
      <path d="M 1700 720 L 1810 790 L 1930 720" fill="none" stroke="#5b584a" stroke-width="2"/>
      <circle cx="1810" cy="790" r="26" fill="none" stroke="#5b584a" stroke-width="1.6"/>
      <text x="1790" y="830" class="smap-dim">三角线 / 转盘</text>
    </g>

    <g data-focus="freight">
      <rect x="1710" y="1250" width="300" height="64" fill="#ddd0b3" stroke="${C.ink}" stroke-width="1.4"/>
      <text x="1724" y="1272" class="smap-yard-label">货场仓库</text>
      <text x="1724" y="1290" class="smap-dim">装卸线 3 · 待装 14 车</text>
      <rect x="1590" y="986" width="420" height="16" fill="#d9cdb1" stroke="#7c7563" stroke-width="1"/>
      <path d="M 1830 1030 L 2010 1030" stroke="#4f5d46" stroke-width="2"/>
      <path d="M 1840 1010 L 2000 1010" stroke="#4f5d46" stroke-width="1.4"/>
      <path d="M 1850 1050 L 1990 1050" stroke="#4f5d46" stroke-width="1.4"/>
      <rect x="1850" y="1012" width="120" height="36" fill="none" stroke="#4f5d46" stroke-width="1"/>
      <text x="1862" y="1036" class="smap-dim">龙门吊</text>
      ${range(4).map((i) => `<rect x="${1950 - i * 34}" y="${1058 + (i % 2) * 12}" width="24" height="9" fill="#b08a5e" stroke="#6f5a3f" stroke-width=".7"/>`).join('')}
    </g>

    <g data-focus="storage">
      <rect x="96" y="1240" width="300" height="36" fill="#ddd0b3" stroke="${C.ink}" stroke-width="1.2"/>
      <text x="110" y="1262" class="smap-dim">存车场值班房 · 4 线</text>
    </g>

    <g data-focus="throat">
      <line x1="80" y1="860" x2="210" y2="860" stroke="#7c7563" stroke-width="1.6"/>
      <path d="M 80 860 L 80 790" fill="none" stroke="#7c7563" stroke-width="1.6"/>
      <rect x="62" y="760" width="36" height="30" fill="url(#hatch)" stroke="#a79054"/>
      <text x="66" y="812" class="smap-emg">避难线 · 砂道</text>
      <text x="48" y="884" class="smap-port">秦岭方向</text>
    </g>

    <g class="lod-mid">
      <rect x="24" y="1408" width="2140" height="24" fill="none" stroke="#c2b8a0"/>
      <text x="40" y="1426" class="smap-dim">图例：粗线正线 · 细线到发/货物/机务/存车 · 虚线预留 · 红格占用 · 黄线列车进路 · 红圈安全线/避难线</text>
    </g>
    </svg>`;
  }

  function create(container, opts) {
    opts = opts || {};
    const name = opts.station || '宝鸡';
    let activeTracks = opts.tracks || 16;
    container.innerHTML = `<div class="smap">
      <div class="smap-viewport">
        <div class="smap-canvas" data-lod="far">${stationSvg(name, activeTracks)}</div>
        <div class="smap-hint">拖动地图 · 滚轮缩放 · 点角落书签定位</div>
        <div class="smap-locators"></div>
        <div class="smap-zoom"><button data-zoom="out">−</button><button data-zoom="in">＋</button><button data-zoom="fit">全</button></div>
        <div class="smap-minimap"><svg viewBox="0 0 2200 1500">${miniSvg()}<rect id="mmRect" x="0" y="0" width="2200" height="1500" fill="rgba(43,45,39,.18)" stroke="#2b2d27" stroke-width="8"/></svg></div>
        <div class="smap-scale">450 m 站台 · 逻辑图 2200×1500</div>
      </div>
    </div>`;
    const root = container.querySelector('.smap');
    const vp = root.querySelector('.smap-viewport');
    const canvas = root.querySelector('.smap-canvas');
    const loc = root.querySelector('.smap-locators');
    const mm = root.querySelector('.smap-minimap');
    const mmRect = root.querySelector('#mmRect');
    const targets = [
      { id: 'all', name: '全景', rect: [0, 0, 2200, 1500], z: 0 },
      { id: 'station', name: '站房 / 候车厅', rect: [760, 80, 760, 180], z: 1.15 },
      { id: 'passenger', name: '客运场', rect: [380, 260, 1200, 690], z: 0.82 },
      { id: 'freight', name: '货场', rect: [1540, 950, 560, 360], z: 1.0 },
      { id: 'engine', name: '机务段', rect: [1550, 370, 550, 430], z: 1.0 },
      { id: 'storage', name: '存车场', rect: [50, 930, 430, 380], z: 1.0 },
      { id: 'throat', name: '咽喉 / 安全线', rect: [40, 240, 500, 720], z: 0.95 },
      { id: 'throat', name: '上咽喉 / 联络线', rect: [1480, 240, 640, 720], z: 0.95 }
    ];
    loc.innerHTML = targets.map((t, i) => `<button data-i="${i}" class="${i === 0 ? 'on' : ''}${t.name.includes('安全线') ? ' alert' : ''}"><span>${t.name}</span><i></i></button>`).join('');
    let view = { x: 0, y: 0, z: 0.4, ready: false };
    let pointers = new Map();
    let drag = null;
    let pinch = null;
    let moved = false;

    function dims() {
      return { w: vp.clientWidth || 1000, h: vp.clientHeight || 700 };
    }
    function clampView() {
      const { w, h } = dims();
      const mw = W * view.z, mh = H * view.z;
      if (mw <= w) view.x = (w - mw) / 2;
      else view.x = Math.min(0, Math.max(w - mw, view.x));
      if (mh <= h) view.y = (h - mh) / 2;
      else view.y = Math.min(0, Math.max(h - mh, view.y));
    }
    function apply() {
      canvas.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.z})`;
      canvas.dataset.lod = view.z < 0.55 ? 'far' : (view.z < 0.98 ? 'mid' : 'near');
      const mw = W * view.z, mh = H * view.z;
      const { w, h } = dims();
      mmRect.setAttribute('x', (-view.x / view.z).toFixed(1));
      mmRect.setAttribute('y', (-view.y / view.z).toFixed(1));
      mmRect.setAttribute('width', (Math.min(W, w / view.z)).toFixed(1));
      mmRect.setAttribute('height', (Math.min(H, h / view.z)).toFixed(1));
    }
    function fit() {
      const { w, h } = dims();
      view.z = Math.min(w / W, h / H) * 0.99;
      view.x = (w - W * view.z) / 2;
      view.y = (h - H * view.z) / 2;
      apply();
    }
    function focusRect(rect, z, animate) {
      const { w, h } = dims();
      const target = z || view.z;
      const cx = rect[0] + rect[2] / 2;
      const cy = rect[1] + rect[3] / 2;
      view.z = target;
      view.x = w / 2 - cx * target;
      view.y = h / 2 - cy * target;
      clampView();
      if (animate) canvas.style.transition = 'transform .25s cubic-bezier(.2,.7,.2,1)';
      apply();
      if (animate) setTimeout(() => { canvas.style.transition = ''; }, 280);
    }
    function focusIndex(i) {
      const t = targets[i];
      if (!t) return;
      if (t.id === 'all') fit();
      else focusRect(t.rect, Math.max(t.z || view.z, 0.75), true);
      loc.querySelectorAll('button').forEach((b, j) => b.classList.toggle('on', j === i));
    }
    loc.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-i]');
      if (b) focusIndex(Number(b.dataset.i));
    });
    root.querySelectorAll('[data-zoom]').forEach((b) => b.addEventListener('click', () => {
      if (b.dataset.zoom === 'fit') { fit(); loc.querySelectorAll('button').forEach((x, j) => x.classList.toggle('on', j === 0)); return; }
      zoomAt(dims().w / 2, dims().h / 2, b.dataset.zoom === 'in' ? 1.25 : 0.8);
    }));
    function zoomAt(px, py, factor) {
      const old = view.z;
      const z = Math.max(0.25, Math.min(2.2, old * factor));
      if (z === old) return;
      view.x = px - (px - view.x) * (z / old);
      view.y = py - (py - view.y) * (z / old);
      view.z = z;
      clampView();
      apply();
    }
    vp.addEventListener('wheel', (e) => {
      e.preventDefault();
      const r = vp.getBoundingClientRect();
      zoomAt(e.clientX - r.left, e.clientY - r.top, e.deltaY > 0 ? 0.84 : 1.18);
    }, { passive: false });
    vp.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.smap-locators,.smap-zoom,.smap-minimap')) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      vp.setPointerCapture(e.pointerId);
      if (pointers.size === 1) {
        drag = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
        moved = false;
        vp.classList.add('dragging');
      }
      if (pointers.size === 2) {
        const pts = [...pointers.values()];
        pinch = { d: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y), z: view.z, vx: view.x, vy: view.y, mx: (pts[0].x + pts[1].x) / 2, my: (pts[0].y + pts[1].y) / 2 };
      }
    });
    vp.addEventListener('pointermove', (e) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && pointers.size >= 2) {
        const pts = [...pointers.values()];
        const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        const r = vp.getBoundingClientRect();
        const mx = (pts[0].x + pts[1].x) / 2 - r.left, my = (pts[0].y + pts[1].y) / 2 - r.top;
        const z = Math.max(0.25, Math.min(2.2, pinch.z * d / Math.max(1, pinch.d)));
        view.z = z;
        view.x = mx - (mx - pinch.vx) * (z / pinch.z);
        view.y = my - (my - pinch.vy) * (z / pinch.z);
        clampView();
        apply();
        moved = true;
        return;
      }
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) { moved = true; loc.querySelectorAll('button').forEach((b) => b.classList.remove('on')); }
      view.x = drag.vx + dx;
      view.y = drag.vy + dy;
      clampView();
      apply();
    });
    function endPointer(e) {
      pointers.delete(e.pointerId);
      if (pointers.size === 0) {
        if (!moved && e.target.closest('[data-focus]')) {
          const id = e.target.closest('[data-focus]').dataset.focus;
          const i = targets.findIndex((t) => t.id === id);
          if (i >= 0) focusIndex(i);
        }
        drag = null; pinch = null; vp.classList.remove('dragging');
      }
      if (pointers.size < 2) pinch = null;
    }
    vp.addEventListener('pointerup', endPointer);
    vp.addEventListener('pointercancel', endPointer);
    mm.addEventListener('click', (e) => {
      const r = mm.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width * W;
      const y = (e.clientY - r.top) / r.height * H;
      focusRect([x - 300, y - 220, 600, 440], Math.max(view.z, 0.72), true);
    });
    let lastW = 0, lastH = 0;
    new ResizeObserver(() => {
      const { w, h } = dims();
      if (!view.ready || (lastW === 0 && w > 0)) {
        fit();
        if (w < 700 && h > w) {
          const t = targets[2];
          focusRect(t.rect, 0.56, false);
          loc.querySelectorAll('button').forEach((b, j) => b.classList.toggle('on', j === 2));
        }
        view.ready = true;
      } else { clampView(); apply(); }
      lastW = w; lastH = h;
    }).observe(vp);
    requestAnimationFrame(() => { if (!view.ready) { fit(); view.ready = true; } });
    return { focus: focusIndex, fit, getView: () => ({ ...view }), setTracks: (n) => { activeTracks = n; canvas.innerHTML = stationSvg(name, n); apply(); }, tracks: () => activeTracks };
  }

  function miniSvg() {
    const block = (x, y, w, h, cls) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${cls || '#d9cdb1'}" stroke="#8e8570" stroke-width="2"/>`;
    return `<rect width="2200" height="1500" fill="#efe8d6"/>
      ${block(466, 238, 1088, 700)}${block(1572, 392, 512, 404)}${block(1572, 982, 512, 320)}${block(70, 966, 392, 326)}
      <line x1="0" y1="600" x2="2200" y2="600" stroke="#6d6857" stroke-width="5"/>
      <line x1="0" y1="660" x2="2200" y2="660" stroke="#6d6857" stroke-width="5"/>
      <line x1="800" y1="108" x2="1470" y2="108" stroke="#a63a2e" stroke-width="8"/>
      <text x="500" y="1000" fill="#5f5c4e" font-size="90" font-family="Noto Serif SC,serif">客运</text>
      <text x="1640" y="930" fill="#5f5c4e" font-size="70" font-family="Noto Serif SC,serif">货场</text>`;
  }

  window.createStationMap = create;
})();
