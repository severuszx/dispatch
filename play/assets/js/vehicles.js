const COACH = {
  '25G': { body: '#315b46', roof: '#d6d3c5', stripe: '#c8c5b6', win: '#1d3128', ac: true },
  '25B': { body: '#3c6049', roof: '#939888', stripe: '#b6b3a2', win: '#24372b', porthole: true },
  '25K': { body: '#2f5175', roof: '#bfc3c2', stripe: '#e1ded0', win: '#182a3a', ac: true },
  '25T': { body: '#e6e3d8', roof: '#c8c6bb', stripe: '#3e5f85', win: '#263342', ac: true },
  '22B': { body: '#3d5f49', roof: '#9a9d90', stripe: '#c5c1ad', win: '#203128', ac: false },
  'SY25K': { body: '#b08a2e', roof: '#c9c6b6', stripe: '#4b4635', win: '#2c3028', inspect: true },
  'CR400AF': { body: '#e9e6dc', roof: '#c5c6c2', stripe: '#9c2f26', win: '#1d2733', emu: true },
  'CRH380A': { body: '#e9e6dc', roof: '#c5c6c2', stripe: '#335d86', win: '#1d2733', emu: true }
};
const LOCO = {
  HXD3D: { body: '#2f4f7a', roof: '#9da4aa', stripe: '#b23a2b' },
  HXD3C: { body: '#3a5b7a', roof: '#9da4aa', stripe: '#b23a2b' },
  SS7E: { body: '#d7dde2', roof: '#aeb4b8', stripe: '#2f5175' },
  SS9: { body: '#9c3a2c', roof: '#c9c5b8', stripe: '#e4d9c4' },
  DF11: { body: '#2f5b43', roof: '#8f9587', stripe: '#d5b34a' },
  DF7G: { body: '#b08a2e', roof: '#c9c3ae', stripe: '#3d3b30' },
  '调车机': { body: '#b08a2e', roof: '#c9c3ae', stripe: '#3d3b30' }
};
const box = (x, y, w, h, fill, stroke, sw) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill || 'none'}" stroke="${stroke || '#22231d'}" stroke-width="${sw == null ? 1 : sw}"/>`;
const line = (x1, y1, x2, y2, w, c) => `<path d="M ${x1} ${y1} L ${x2} ${y2}" fill="none" stroke="${c || '#22231d'}" stroke-width="${w || 1}"/>`;

function coach(x, y, model) {
  const s = COACH[model] || COACH['25G'];
  const w = 56;
  const wins = Array.from({ length: 8 }, (_, i) => box(x + 4.5 + i * 6.1, y - 1.3, 3.6, 3.1, s.win, '#14201b', .25)).join('');
  const band = s.stripe ? box(x + 2, y + 2.4, w - 4, 1.3, s.stripe, 'none', 0) : '';
  let detail = wins;
  if (s.ac) {
    detail = Array.from({ length: 3 }, (_, i) => {
      const ax = x + 9 + i * 15;
      return `${box(ax, y - 5.2, 10.5, 6, '#c3bfb1', '#5b594e', .65)}${box(ax + 1.6, y - 4.2, 2.6, 4.2, '#7d7a6c', 'none', 0)}${box(ax + 6.3, y - 4.2, 2.6, 4.2, '#7d7a6c', 'none', 0)}`;
    }).join('') + wins;
  }
  if (s.porthole) {
    detail = Array.from({ length: 8 }, (_, i) => `<circle cx="${x + 6.5 + i * 6.6}" cy="${y - 3.2}" r="1.5" fill="#4e5142" stroke="#262920" stroke-width=".5"/>`).join('') + wins;
  }
  if (s.inspect) detail += `${box(x + 16, y + 0.9, 24, 2.2, '#6d5b24', '#3f371c', .35)}`;
  return `<g>${box(x, y - 6, w, 12, s.body, '#22231d', .75)}${box(x + 2, y - 4, w - 4, 3.4, s.roof, '#3d3e34', .35)}${detail}${band}${box(x + 2.5, y - 4.2, 3, 8.2, s.body, '#1b1c17', .55)}${box(x + w - 5.5, y - 4.2, 3, 8.2, s.body, '#1b1c17', .55)}${box(x + 6, y + 5.4, 11, 2.4, '#3c3d34', '#20211b', .45)}${box(x + w - 17, y + 5.4, 11, 2.4, '#3c3d34', '#20211b', .45)}</g>`;
}

function freight(x, y, model) {
  const w = 56;
  if (model === 'X6K') {
    const boxes = Array.from({ length: 2 }, (_, i) => {
      const cx = x + 4 + i * 26, col = i ? '#7d876d' : '#aa865d';
      return `${box(cx, y - 13, 22, 10, col, '#484337', .55)}${Array.from({ length: 3 }, (_v, g) => line(cx + 3 + g * 7, y - 12, cx + 3 + g * 7, y - 4, .35, '#3f3b31')).join('')}`;
    }).join('');
    return `<g>${box(x, y + 1, w, 5, '#5d5b50', '#25261f', .6)}${boxes}${box(x + 5, y + 5.4, 9, 2.4, '#3c3d34', '#20211b', .45)}${box(x + w - 14, y + 5.4, 9, 2.4, '#3c3d34', '#20211b', .45)}</g>`;
  }
  if (model === 'N17') {
    return `<g>${box(x, y + 2, w, 5, '#6b6758', '#25261f', .6)}${Array.from({ length: 5 }, (_, i) => line(x + 5 + i * 11, y + 2, x + 5 + i * 11, y - 2, .5, '#4d4a3d')).join('')}${box(x + 5, y + 5.4, 9, 2.4, '#3c3d34', '#20211b', .45)}${box(x + w - 14, y + 5.4, 9, 2.4, '#3c3d34', '#20211b', .45)}</g>`;
  }
  if (model === 'G70') {
    return `<g><rect x="${x + 2}" y="${y - 5}" width="${w - 4}" height="10" rx="5" fill="#77776c" stroke="#2f3028" stroke-width=".6"/>${box(x + 5, y - 3.5, w - 10, 3, '#9b9b8e', '#44443a', .35)}${Array.from({ length: 4 }, (_, i) => line(x + 9 + i * 12, y - 5, x + 9 + i * 12, y + 5, .5, '#4a4a3f')).join('')}${box(x + 5, y + 5.4, 9, 2.4, '#3c3d34', '#20211b', .45)}${box(x + w - 14, y + 5.4, 9, 2.4, '#3c3d34', '#20211b', .45)}</g>`;
  }
  const open = model === 'C70';
  return `<g>${box(x, y - 5, w, 11, open ? '#68685d' : '#5b4a36', '#22231d', .7)}${box(x + 2, y - 4, w - 4, 3, open ? '#7f7f72' : '#7b6a50', '#3d3e34', .35)}${Array.from({ length: 5 }, (_, i) => line(x + 8 + i * 10, y - 4, x + 8 + i * 10, y + 3, .45, '#3f3f34')).join('')}${open ? '' : box(x + 20, y - 2, 16, 6, '#4a3d2d', '#2b241b', .5)}${box(x + 5, y + 5.4, 9, 2.4, '#3c3d34', '#20211b', .45)}${box(x + w - 14, y + 5.4, 9, 2.4, '#3c3d34', '#20211b', .45)}</g>`;
}

function loco(x, y, model) {
  const s = LOCO[model] || LOCO.HXD3D;
  const w = 62;
  const electric = !['DF11', 'DF7G', '调车机'].includes(model);
  return `<g>${box(x, y - 6.5, w, 13, s.body, '#1e1f19', .85)}${box(x + 3, y - 4.5, w - 6, 3.6, s.roof, '#35362e', .4)}${box(x + 4, y - 4.2, 8, 4.2, '#b9c2c3', '#30362f', .45)}${box(x + 18, y - 3.8, 10, 3.4, '#8d9798', '#363c35', .4)}${box(x + 12, y + 1.8, w - 16, 1.4, s.stripe, 'none', 0)}${electric ? `<path d="M ${x + 18} ${y - 6} C ${x + 26} ${y - 9} ${x + 34} ${y - 16} ${x + 46} ${y - 7}" fill="none" stroke="#3f4240" stroke-width="1"/><path d="M ${x + 27} ${y - 9} L ${x + 31} ${y - 12} L ${x + 36} ${y - 12} L ${x + 40} ${y - 9}" fill="none" stroke="#3f4240" stroke-width=".7"/>` : line(x + 28, y - 6, x + 28, y - 14, .6, '#3f4240')}${box(x + 7, y + 5.5, 12, 2.6, '#34352d', '#1b1c16', .45)}${box(x + w - 19, y + 5.5, 12, 2.6, '#34352d', '#1b1c16', .45)}</g>`;
}

function emu(x, y, model) {
  const s = COACH[model] || COACH.CR400AF;
  const w = 64;
  return `<g>${box(x, y - 6, w, 12, s.body, '#22231d', .75)}${box(x + 2, y - 4, w - 4, 3.2, s.roof, '#3d3e34', .35)}<path d="M ${x} ${y - 6} L ${x + 6} ${y - 8.5} L ${x + 24} ${y - 8.5} L ${x + 31} ${y - 6} Z" fill="${s.body}" stroke="#22231d" stroke-width=".7"/>${box(x + 7, y - 3.4, 13, 3.2, s.win, '#14201b', .3)}${box(x + 22, y - 1.3, 34, 3.1, s.win, '#14201b', .3)}${box(x + 2, y + 2.4, w - 4, 1.4, s.stripe, 'none', 0)}${box(x + 8, y + 5.4, 11, 2.4, '#3c3d34', '#20211b', .45)}${box(x + w - 20, y + 5.4, 11, 2.4, '#3c3d34', '#20211b', .45)}</g>`;
}

export function consistSVG(model, locoModel, cars, dir) {
  const n = Number.isFinite(+cars) ? Math.max(0, Math.min(9, Math.floor(+cars))) : 6;
  const isEmu = locoModel === '动车组自走' || model === 'CR400AF' || model === 'CRH380A';
  let x = 12, inner = '';
  if (isEmu) {
    inner += emu(x, 38, model);
    x += 64;
    for (let i = 1; i < n; i++) { inner += coach(x + 4, 38, model); x += 60; }
  } else {
    inner += loco(x, 38, locoModel);
    x += 68;
    for (let i = 0; i < n; i++) {
      inner += ['C70', 'X6K', 'N17', 'G70'].includes(model) ? freight(x, 38, model) : coach(x, 38, model);
      x += 60;
    }
  }
  const w = Math.max(160, x + 8);
  const flipped = dir < 0 ? ` transform="translate(${w},0) scale(-1,1)"` : '';
  return `<svg class="consist-svg" viewBox="0 0 ${w} 74" preserveAspectRatio="xMidYMid meet"><g${flipped}>${inner}</g></svg>`;
}
