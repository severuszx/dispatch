import * as THREE from './three.module.js';

const HUB = JSON.parse(document.getElementById('hubData').textContent);
const YARD = HUB.yards[0];
const N_TRACK = Number(YARD.tracks || 10);
const GAP = 6;
const START = 360;
const HALF = 110;
const TRACK_Z = (n) => (n - 1 - (N_TRACK - 1) / 2) * GAP;
const COACH_LEN = 6.4;
const LOCO_LEN = 7.4;
const CAR_GAP = 0.55;

const stage = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.62;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const skyTex = canvasTex(64, 512, (a, w, h) => {
  const g = a.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#0a1018');
  g.addColorStop(0.42, '#192028');
  g.addColorStop(0.72, '#39352b');
  g.addColorStop(1, '#595040');
  a.fillStyle = g;
  a.fillRect(0, 0, w, h);
});
scene.background = skyTex;
scene.fog = new THREE.FogExp2(0x2a2820, 0.0032);
const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 1600);

const hemi = new THREE.HemisphereLight(0xd6dde1, 0x2a241b, 1.75);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffe4bf, 3.6);
sun.position.set(-130, 230, 160);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -210;
sun.shadow.camera.right = 210;
sun.shadow.camera.top = 210;
sun.shadow.camera.bottom = -210;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 600;
sun.shadow.bias = -0.0004;
scene.add(sun);
const fill = new THREE.DirectionalLight(0x7e94a4, 0.55);
fill.position.set(150, 80, -130);
scene.add(fill);

const headMat = new THREE.MeshStandardMaterial({ color: 0xfff0cf, emissive: 0xffd28a, emissiveIntensity: 2.2, roughness: 0.2 });
const matCache = new Map();
function mat(color, roughness = 0.7, metalness = 0.15) {
  const key = `${color}|${roughness}|${metalness}`;
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness, metalness }));
  return matCache.get(key);
}
function box(w, h, d, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  return m;
}
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const a = c.getContext('2d');
  draw(a, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return t;
}
function rr(a, x, y, w, h, r) {
  a.beginPath();
  a.moveTo(x + r, y);
  a.arcTo(x + w, y, x + w, y + h, r);
  a.arcTo(x + w, y + h, x, y + h, r);
  a.arcTo(x, y + h, x, y, r);
  a.arcTo(x, y, x + w, y, r);
  a.closePath();
}
function hexMix(hex, mix) {
  const c = new THREE.Color(hex);
  c.lerp(new THREE.Color(mix), 0.5);
  return `#${c.getHexString()}`;
}

const COACH_CFG = {
  '25G': { body: '#315b46', roof: '#d3d0c2', band: '#c6c2b2', win: '#1a2a23', frame: '#d9d5c5', ac: true, label: '25G 硬座车', door: '#2a4d3c' },
  '25B': { body: '#3b5e47', roof: '#969a8b', band: '#b6b2a0', win: '#1e3027', frame: '#a9a694', porthole: true, label: '25B 硬座车', door: '#34533f' },
  '25K': { body: '#2f5175', roof: '#b9bec0', band: '#dedbcd', win: '#172838', frame: '#c9ccca', ac: true, label: '25K 快速客车', door: '#284568' },
  '25T': { body: '#e4e1d6', roof: '#c4c3b9', band: '#3d5f85', win: '#263342', frame: '#8d969f', ac: true, label: '25T 直达客车', door: '#d6d2c5' },
  '22B': { body: '#3c5e47', roof: '#989b8e', band: '#c3bfab', win: '#203128', frame: '#aaa694', label: '22B 硬座车', door: '#34533f' },
  SY25K: { body: '#ad892f', roof: '#c7c4b5', band: '#4b4635', win: '#242a28', frame: '#8f8b73', label: 'SY25K 轨道检测车', door: '#8f7126', inspect: true },
  CR400AF: { body: '#e7e4da', roof: '#c2c3bf', band: '#9c2f26', win: '#1a2430', frame: '#8e969c', ac: false, label: 'CR400AF 动车组', emu: true },
  CRH380A: { body: '#e7e4da', roof: '#c2c3bf', band: '#335d86', win: '#1a2430', frame: '#8e969c', ac: false, label: 'CRH380A 动车组', emu: true },
};

function coachTex(model, idx) {
  const s = COACH_CFG[model] || COACH_CFG['25G'];
  return canvasTex(1024, 256, (a, w, h) => {
    a.fillStyle = '#1b1d18';
    a.fillRect(0, 0, w, h);
    a.fillStyle = s.body;
    a.fillRect(12, 20, w - 24, h - 40);
    const g = a.createLinearGradient(0, 20, 0, h - 20);
    g.addColorStop(0, hexMix(s.body, '#ffffff'));
    g.addColorStop(0.18, s.body);
    g.addColorStop(0.86, s.body);
    g.addColorStop(1, hexMix(s.body, '#000000'));
    a.fillStyle = g;
    a.fillRect(12, 20, w - 24, h - 40);
    a.fillStyle = s.roof;
    a.fillRect(12, 0, w - 24, 34);
    a.fillStyle = hexMix(s.roof, '#000000');
    a.fillRect(12, 30, w - 24, 7);
    a.fillStyle = hexMix(s.body, '#000000');
    a.fillRect(12, h - 30, w - 24, 30);
    a.fillStyle = s.door;
    a.fillRect(52, 44, 40, h - 94);
    a.fillRect(w - 92, 44, 40, h - 94);
    a.strokeStyle = 'rgba(15,16,14,.8)';
    a.lineWidth = 2;
    a.strokeRect(52, 44, 40, h - 94);
    a.strokeRect(w - 92, 44, 40, h - 94);
    a.fillStyle = s.win;
    a.fillRect(70, 62, 22, 72);
    a.fillRect(w - 79, 62, 22, 72);
    const n = 9;
    for (let i = 0; i < n; i += 1) {
      const x = 132 + i * 79;
      if (x + 52 > w - 110) break;
      a.fillStyle = s.frame;
      if (s.porthole) {
        a.beginPath();
        a.arc(x + 26, 104, 20, 0, Math.PI * 2);
        a.fill();
        a.fillStyle = s.win;
        a.beginPath();
        a.arc(x + 26, 104, 16, 0, Math.PI * 2);
        a.fill();
      } else {
        rr(a, x, 62, 54, 78, 5);
        a.fill();
        a.fillStyle = s.win;
        rr(a, x + 4, 68, 46, 66, 3);
        a.fill();
        const gr = a.createLinearGradient(x, 68, x + 46, 134);
        gr.addColorStop(0, 'rgba(160,185,190,.24)');
        gr.addColorStop(0.5, 'rgba(60,78,84,.06)');
        gr.addColorStop(1, 'rgba(16,22,24,.2)');
        a.fillStyle = gr;
        rr(a, x + 4, 68, 46, 66, 3);
        a.fill();
        if (i % 3 === 0) {
          a.fillStyle = 'rgba(232,193,126,.28)';
          a.fillRect(x + 6, 96, 42, 34);
        }
      }
    }
    a.fillStyle = s.band;
    a.fillRect(12, 174, w - 24, 12);
    if (s.ac) {
      a.fillStyle = 'rgba(30,32,28,.32)';
      a.fillRect(150, 184, 250, 18);
      a.fillRect(520, 184, 250, 18);
    }
    a.fillStyle = hexMix(s.band, '#ffffff');
    a.font = '22px "Noto Sans SC", sans-serif';
    a.textAlign = 'center';
    a.fillText(s.label, w / 2, 230);
    a.font = '16px ui-monospace, monospace';
    a.fillStyle = 'rgba(30,32,28,.72)';
    a.textAlign = 'left';
    a.fillText(`TST·${String(1000 + idx).slice(1)}`, 106, 226);
    a.textAlign = 'right';
    a.fillText('120km/h', w - 108, 226);
    if (s.inspect) {
      a.fillStyle = '#2f342f';
      a.fillRect(330, 44, 360, 54);
      a.fillStyle = '#c8c3a2';
      a.font = '18px ui-monospace, monospace';
      a.fillText('轨道检测 · 接触网 / 信号', 350, 78);
      a.fillStyle = '#8b7b39';
      a.fillRect(330, 100, 360, 9);
    }
  });
}

const LOCO_CFG = {
  HXD3D: { body: '#2f4f7a', roof: '#9da4aa', band: '#b23a2b', label: 'HXD3D 客运电力机车', axles: 6, electric: true },
  HXD3C: { body: '#3a5b7a', roof: '#9da4aa', band: '#b23a2b', label: 'HXD3C 货运电力机车', axles: 6, electric: true },
  SS7E: { body: '#d7dde2', roof: '#aeb4b8', band: '#2f5175', label: 'SS7E 客运电力机车', axles: 6, electric: true },
  SS9: { body: '#9c3a2c', roof: '#c9c5b8', band: '#e4d9c4', label: 'SS9 客运电力机车', axles: 6, electric: true },
  DF11: { body: '#2f5b43', roof: '#8f9587', band: '#d5b34a', label: 'DF11 内燃机车', axles: 4, electric: false, diesel: true },
  DF7G: { body: '#b08a2e', roof: '#c9c3ae', band: '#3d3b30', label: 'DF7G 调车机车', axles: 4, electric: false, diesel: true },
  '调车机': { body: '#b08a2e', roof: '#c9c3ae', band: '#3d3b30', label: 'DF7G 调车机车', axles: 4, electric: false, diesel: true },
};

function locoTex(model) {
  const s = LOCO_CFG[model] || LOCO_CFG.HXD3D;
  return canvasTex(1024, 256, (a, w, h) => {
    a.fillStyle = '#171914';
    a.fillRect(0, 0, w, h);
    a.fillStyle = s.body;
    a.fillRect(10, 24, w - 20, h - 44);
    const g = a.createLinearGradient(0, 24, 0, h - 20);
    g.addColorStop(0, hexMix(s.body, '#ffffff'));
    g.addColorStop(0.2, s.body);
    g.addColorStop(0.8, s.body);
    g.addColorStop(1, hexMix(s.body, '#000000'));
    a.fillStyle = g;
    a.fillRect(10, 24, w - 20, h - 44);
    a.fillStyle = s.roof;
    a.fillRect(10, 0, w - 20, 30);
    a.fillStyle = '#141719';
    a.fillRect(55, 48, 92, 46);
    a.fillRect(w - 147, 48, 92, 46);
    a.fillStyle = '#25313a';
    a.fillRect(61, 53, 80, 36);
    a.fillRect(w - 141, 53, 80, 36);
    a.fillStyle = s.band;
    a.fillRect(10, 150, w - 20, 15);
    a.fillStyle = 'rgba(20,22,18,.18)';
    for (let i = 0; i < 6; i += 1) a.fillRect(190 + i * 95, 62, 72, 58);
    a.fillStyle = 'rgba(20,22,18,.7)';
    a.fillRect(170, 194, 330, 20);
    a.fillRect(560, 194, 280, 20);
    a.fillStyle = s.band;
    a.font = 'bold 21px "Noto Sans SC", sans-serif';
    a.textAlign = 'center';
    a.fillText(s.label, w / 2, 232);
    a.font = '15px ui-monospace, monospace';
    a.fillStyle = '#c6c1b1';
    a.textAlign = 'left';
    a.fillText(model, 30, 232);
    a.fillStyle = '#e6dcc7';
    a.fillText('TST', w - 76, 232);
  });
}

function boxMaterial(sideTex, bodyColor, roofColor, roughness = 0.48) {
  const side = new THREE.MeshStandardMaterial({ color: 0xffffff, map: sideTex, roughness, metalness: 0.22 });
  const end = mat(bodyColor, roughness, 0.25);
  const roof = mat(roofColor, 0.38, 0.4);
  const dark = mat(0x171915, 0.7, 0.2);
  return [end, end, roof, dark, side, side];
}

function splitDetail(g, keep = 3) {
  const detail = new THREE.Group();
  const tail = g.children.slice(keep);
  for (const c of tail) detail.add(c);
  g.add(detail);
  g.userData.detail = detail;
}

function bogie(g, x, z, y = -1.95) {
  g.add(box(1.55, 0.42, 2.1, mat(0x292b27, 0.78, 0.25), x, y, z));
  g.add(box(0.38, 0.32, 2.25, mat(0x1d1f1c, 0.8, 0.2), x - 0.5, y - 0.25, z));
  g.add(box(0.38, 0.32, 2.25, mat(0x1d1f1c, 0.8, 0.2), x + 0.5, y - 0.25, z));
  for (const dx of [-0.55, 0.55]) {
    for (const dz of [-1.13, 1.13]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.24, 12), mat(0x3d3e39, 0.55, 0.55));
      w.rotation.x = Math.PI / 2;
      w.position.set(x + dx, y - 0.36, z + dz);
      g.add(w);
    }
  }
}

function buildCoach(model, idx) {
  const s = COACH_CFG[model] || COACH_CFG['25G'];
  const g = new THREE.Group();
  const w = 3.0, h = 3.35;
  const body = new THREE.Mesh(new THREE.BoxGeometry(COACH_LEN, h, w), boxMaterial(coachTex(model, idx), s.body, s.roof));
  body.castShadow = true;
  body.position.y = 0;
  g.add(body);
  const roof = box(COACH_LEN - 0.25, 0.24, w - 0.32, mat(s.roof, 0.38, 0.35), 0, h / 2 + 0.1, 0);
  g.add(roof);
  const under = box(COACH_LEN - 0.55, 0.42, w - 0.55, mat(0x1c1e1a, 0.8, 0.25), 0, -h / 2 - 0.24, 0);
  g.add(under);
  if (s.ac) {
    for (const x of [-1.68, 1.56]) {
      const ac = box(1.35, 0.32, 1.35, mat(0xb9b5a8, 0.45, 0.3), x, h / 2 + 0.36, 0);
      g.add(ac);
      g.add(box(1.05, 0.07, 1.08, mat(0x4d4f47, 0.7, 0.2), x, h / 2 + 0.55, 0));
    }
  }
  if (s.inspect) {
    g.add(box(1.5, 0.26, 1.1, mat(0x4c4c40, 0.7, 0.3), 0.2, h / 2 + 0.35, 0));
    g.add(box(0.22, 0.22, 0.22, mat(0xc6a14e, 0.4, 0.15), 1.8, h / 2 + 0.48, 0));
  }
  for (const x of [-2.05, 2.05]) bogie(g, x, 0, -1.95);
  for (const x of [-COACH_LEN / 2 - 0.18, COACH_LEN / 2 + 0.18]) {
    g.add(box(0.34, 0.24, 1.4, mat(0x22241f, 0.7, 0.3), x, -0.55, 0));
  }
  splitDetail(g, 3);
  g.userData.kind = 'coach';
  g.userData.model = model;
  return g;
}

function pantograph(g, x, y, z) {
  const m = mat(0x4b4e4a, 0.6, 0.5);
  const a1 = box(1.9, 0.07, 0.07, m, x + 0.8, y + 0.92, z);
  a1.rotation.z = -0.42;
  g.add(a1);
  const a2 = box(1.6, 0.07, 0.07, m, x - 0.7, y + 1.55, z);
  a2.rotation.z = 0.52;
  g.add(a2);
  g.add(box(2.7, 0.08, 0.08, mat(0x6f726d, 0.5, 0.6), x, y + 1.95, z));
  g.add(box(1.1, 0.15, 0.45, mat(0x2a2d29, 0.8, 0.2), x + 0.25, y + 0.33, z));
}

function buildLoco(model, idx) {
  const s = LOCO_CFG[model] || LOCO_CFG.HXD3D;
  const g = new THREE.Group();
  const w = 3.15;
  if (s.diesel) {
    const frame = box(LOCO_LEN, 0.55, w, mat(0x252822, 0.75, 0.35), 0, -1.45, 0);
    g.add(frame);
    const cab = box(2.55, 2.6, w - 0.16, mat(s.body, 0.5, 0.25), 2.25, 0.15, 0);
    g.add(cab);
    const hood = box(4.1, 1.95, w - 0.3, mat(s.body, 0.55, 0.25), -1.35, -0.05, 0);
    g.add(hood);
    g.add(box(2.9, 0.25, w - 0.15, mat(s.band, 0.55, 0.2), -1.4, 0.96, 0));
    const winds = box(0.06, 0.82, 2.3, mat(0x1a262e, 0.25, 0.6), 3.55, 0.55, 0);
    g.add(winds);
    const sideWin = box(0.06, 0.7, 1.5, mat(0x1a262e, 0.25, 0.6), 1.05, 0.45, w / 2 - 0.02);
    g.add(sideWin);
    g.add(box(1.1, 0.32, 1.1, mat(0x34352e, 0.7, 0.3), -2.1, 1.15, 0));
    g.add(box(0.25, 0.9, 0.25, mat(0x5c5647, 0.7, 0.3), -2.75, 1.7, 0.65));
    for (const x of [-2.4, 2.2]) bogie(g, x, 0, -1.95);
  } else {
    const body = new THREE.Mesh(new THREE.BoxGeometry(LOCO_LEN, 3.5, w), boxMaterial(locoTex(model), s.body, s.roof, 0.42));
    body.castShadow = true;
    g.add(body);
    g.add(box(LOCO_LEN - 0.3, 0.22, w - 0.3, mat(s.roof, 0.35, 0.45), 0, 1.88, 0));
    g.add(box(LOCO_LEN - 0.7, 0.45, w - 0.6, mat(0x1b1d19, 0.8, 0.3), 0, -1.92, 0));
    for (const sx of [-1, 1]) {
      g.add(box(0.07, 0.92, 2.35, mat(0x1a252e, 0.2, 0.55), sx * (LOCO_LEN / 2 + 0.01), 0.42, 0));
      g.add(box(0.15, 0.45, 0.55, mat(0x343833, 0.6, 0.3), sx * (LOCO_LEN / 2 + 0.05), 1.45, 0.9));
      g.add(box(0.08, 0.28, 0.35, headMat, sx * (LOCO_LEN / 2 + 0.03), 1.0, -0.65));
    }
    for (const x of [-2.55, 0, 2.55]) bogie(g, x, 0, -2.02);
    if (s.electric) {
      g.add(box(0.85, 0.22, 2.1, mat(0x3a3c37, 0.7, 0.3), -1.4, 2.05, 0));
      pantograph(g, -1.3, 2.15, 0);
    }
    for (let i = 0; i < 4; i += 1) {
      g.add(box(0.5, 0.35, 0.45, mat(0x242721, 0.7, 0.3), 0.8 + i * 0.55, 2.05, 0.75));
    }
  }
  splitDetail(g, s.diesel ? 4 : 3);
  g.userData.kind = 'loco';
  g.userData.model = model;
  return g;
}

function freightTex(model, idx) {
  return canvasTex(1024, 256, (a, w, h) => {
    const col = model === 'C64' ? '#5b4a36' : model === 'P70' ? '#6d6252' : '#68685d';
    a.fillStyle = '#1b1c17';
    a.fillRect(0, 0, w, h);
    a.fillStyle = col;
    a.fillRect(10, 12, w - 20, h - 24);
    a.fillStyle = hexMix(col, '#000000');
    a.fillRect(10, h - 40, w - 20, 40);
    a.strokeStyle = 'rgba(36,36,30,.65)';
    a.lineWidth = 3;
    for (let i = 0; i < 16; i += 1) {
      const x = 22 + i * 63;
      a.beginPath();
      a.moveTo(x, 18);
      a.lineTo(x, h - 22);
      a.stroke();
    }
    a.strokeStyle = 'rgba(220,214,195,.18)';
    a.lineWidth = 2;
    for (let i = 0; i < 5; i += 1) {
      const x = 90 + i * 210;
      a.beginPath();
      a.moveTo(x, 55);
      a.lineTo(x + 22, 132);
      a.lineTo(x, 198);
      a.stroke();
    }
    a.fillStyle = 'rgba(195,186,162,.8)';
    a.font = 'bold 24px "Noto Sans SC", sans-serif';
    a.textAlign = 'left';
    a.fillText(model === 'C64' ? 'C64 敞车' : model === 'P70' ? 'P70 棚车' : 'C70 敞车', 28, 44);
    a.font = '15px ui-monospace, monospace';
    a.fillText(`载重 70t · ${String(2000 + idx).slice(1)}`, 28, h - 22);
    a.fillStyle = 'rgba(120,70,35,.25)';
    for (let i = 0; i < 7; i += 1) a.fillRect(80 + i * 130, 40 + (i % 3) * 40, 45, 16);
  });
}

function buildWagon(model, idx) {
  const g = new THREE.Group();
  const w = 3.0;
  if (model === 'G70') {
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.28, 1.28, COACH_LEN - 0.4, 18), mat(0x77776c, 0.55, 0.35));
    tank.rotation.z = Math.PI / 2;
    tank.position.y = 1.0;
    g.add(tank);
    g.add(box(COACH_LEN, 0.4, w - 0.3, mat(0x2d2b25, 0.8, 0.25), 0, -1.1, 0));
    for (const x of [-2.2, 2.2]) {
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.2, 18), mat(0x5f5d51, 0.5, 0.4));
      cap.rotation.z = Math.PI / 2;
      cap.position.set(x, 1.0, 0);
      g.add(cap);
    }
    g.add(box(1.4, 0.4, 1.4, mat(0x6b6b5e, 0.6, 0.3), 0, 2.3, 0));
    g.add(box(0.8, 0.2, 0.8, mat(0x4a4a40, 0.7, 0.25), 0, 2.52, 0));
    for (const x of [-2.1, 2.1]) bogie(g, x, 0, -1.75);
    splitDetail(g, 2);
    g.userData.kind = 'wagon';
    return g;
  }
  if (model === 'X6K') {
    g.add(box(COACH_LEN, 0.35, w, mat(0x4f4d43, 0.75, 0.3), 0, 0.25, 0));
    const c1 = box(3.0, 1.55, 2.5, mat(0x7d876d, 0.72, 0.2), -1.55, 1.2, 0);
    const c2 = box(3.0, 1.55, 2.5, mat(0xaa865d, 0.72, 0.2), 1.55, 1.2, 0);
    g.add(c1);
    g.add(c2);
    for (const x of [-2.7, -0.55, 0.55, 2.7]) g.add(box(0.16, 1.4, 2.52, mat(0x4a463c, 0.75, 0.2), x, 1.2, 0));
    for (const x of [-2.1, 2.1]) bogie(g, x, 0, -1.55);
    splitDetail(g, 3);
    g.userData.kind = 'wagon';
    return g;
  }
  if (model === 'N17') {
    g.add(box(COACH_LEN, 0.45, w, mat(0x6b6758, 0.75, 0.3), 0, 0.2, 0));
    for (let i = 0; i < 7; i += 1) {
      const x = -2.6 + i * 0.87;
      g.add(box(0.18, 1.4, 0.18, mat(0x4d4a3d, 0.72, 0.25), x, 0.95, -1.25));
      g.add(box(0.18, 1.4, 0.18, mat(0x4d4a3d, 0.72, 0.25), x, 0.95, 1.25));
    }
    for (const x of [-2.1, 2.1]) bogie(g, x, 0, -1.45);
    splitDetail(g, 3);
    g.userData.kind = 'wagon';
    return g;
  }
  const h = model === 'P70' ? 3.1 : 2.15;
  const body = new THREE.Mesh(new THREE.BoxGeometry(COACH_LEN, h, w), boxMaterial(freightTex(model, idx), 0x68685d, 0x55564c, 0.7));
    body.position.y = 0.55;
    g.add(body);
    if (model === 'P70') g.add(box(COACH_LEN - 0.2, 0.3, w - 0.2, mat(0x777367, 0.55, 0.3), 0, 0.55 + h / 2 + 0.12, 0));
    else {
      g.add(box(COACH_LEN, 0.18, 0.16, mat(0x8a8574, 0.55, 0.35), 0, 1.72, -1.42));
      g.add(box(COACH_LEN, 0.18, 0.16, mat(0x8a8574, 0.55, 0.35), 0, 1.72, 1.42));
    }
    g.add(box(COACH_LEN - 0.2, 0.3, w - 0.6, mat(0x292a24, 0.8, 0.25), 0, -0.75, 0));
  if (model === 'P70') {
    g.add(box(0.12, 2.25, 2.1, mat(0x4d4a3e, 0.7, 0.25), 0, 1.0, w / 2 + 0.01));
  } else {
    const load = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 8), mat(0x201f1b, 0.95, 0.05));
    load.scale.set(2.9, 0.48, 1.25);
    load.position.y = 1.65;
    g.add(load);
    for (const x of [-2.45, 2.45]) {
      for (let i = 0; i < 4; i += 1) {
        g.add(box(0.16, 0.25, 0.16, mat(0x8a8574, 0.6, 0.3), x, 0.2 + i * 0.5, 1.62));
      }
    }
  }
  for (const x of [-2.1, 2.1]) bogie(g, x, 0, -1.45);
  splitDetail(g, 3);
  g.userData.kind = 'wagon';
  g.userData.model = model;
  return g;
}

function buildEmu(model, idx) {
  const s = COACH_CFG[model] || COACH_CFG.CR400AF;
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(COACH_LEN, 3.15, 2.95), boxMaterial(coachTex(model, idx), s.body, s.roof, 0.35));
  g.add(body);
  g.add(box(COACH_LEN - .2, .22, 2.65, mat(s.roof, .32, .45), 0, 1.68, 0));
  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.2, 2.55), mat(s.body, .3, .35));
  nose.position.set(COACH_LEN / 2 + .55, -.15, 0);
  nose.rotation.z = -.16;
  g.add(nose);
  g.add(box(.1, .75, 2.0, mat(0x1a2631, .2, .6), COACH_LEN / 2 + 1.22, .45, 0));
  for (const x of [-1.9, 1.9]) bogie(g, x, 0, -1.85);
  splitDetail(g, 3);
  g.userData.kind = 'emu';
  return g;
}

function specFor(raw) {
  const no = String(raw.no || '');
  if (raw.type === '调') return { coach: null, loco: 'DF7G' };
  if (raw.type === '检') return { coach: 'SY25K', loco: 'HXD3D' };
  if (raw.type === '修') return { coach: 'N17', loco: 'DF7G' };
  if (raw.type === '工') return { coach: 'X6K', loco: 'DF7G' };
  if (raw.type === '货') return { coach: 'C70', loco: 'HXD3C' };
  if (no.startsWith('Z')) return { coach: '25T', loco: 'HXD3D' };
  if (no.startsWith('T')) return { coach: '25K', loco: 'SS9' };
  if (no.startsWith('D')) return { coach: 'CRH380A', loco: 'emu' };
  if (no.startsWith('G')) return { coach: 'CR400AF', loco: 'emu' };
  if (no.startsWith('K')) return { coach: '25G', loco: no === 'K102' ? 'SS7E' : 'HXD3D' };
  return { coach: '25G', loco: 'DF11' };
}

function labelSprite(text, color = '#e8dfc8', w = 256, h = 88, scale = [10, 3.45]) {
  const t = canvasTex(w, h, (a) => {
    a.fillStyle = 'rgba(10,13,15,.88)';
    a.fillRect(0, 0, w, h);
    a.strokeStyle = 'rgba(201,164,92,.6)';
    a.lineWidth = 3;
    a.strokeRect(2, 2, w - 4, h - 4);
    a.fillStyle = color;
    a.font = `bold ${Math.round(h * .54)}px "Noto Sans SC", sans-serif`;
    a.textAlign = 'center';
    a.textBaseline = 'middle';
    a.fillText(text, w / 2, h / 2 + 1);
  });
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false, depthWrite: false }));
  sp.scale.set(scale[0], scale[1], 1);
  return sp;
}

const station = new THREE.Group();
scene.add(station);

const ballastTex = canvasTex(512, 512, (a) => {
  a.fillStyle = '#34352f';
  a.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 4200; i += 1) {
    const v = 45 + Math.floor(Math.random() * 48);
    a.fillStyle = `rgb(${v},${v - 2},${v - 6})`;
    const s = 1 + Math.random() * 4;
    a.fillRect(Math.random() * 512, Math.random() * 512, s, s);
  }
});
ballastTex.wrapS = THREE.RepeatWrapping;
ballastTex.wrapT = THREE.RepeatWrapping;
ballastTex.repeat.set(4, 2);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), new THREE.MeshStandardMaterial({ color: 0x20231e, roughness: 1 }));
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.5;
ground.receiveShadow = true;
station.add(ground);

const yardFloor = new THREE.Mesh(new THREE.PlaneGeometry(300, 88), new THREE.MeshStandardMaterial({ map: ballastTex, color: 0xffffff, roughness: 1 }));
yardFloor.rotation.x = -Math.PI / 2;
yardFloor.position.y = -0.18;
yardFloor.receiveShadow = true;
station.add(yardFloor);

const railMat = mat(0x969b9b, 0.35, 0.75);
const tieMat = mat(0x2b2924, 0.9, 0.05);
const bedMat = mat(0x20211d, 1);
for (let n = 1; n <= N_TRACK; n += 1) {
  const z = TRACK_Z(n);
  station.add(box(310, 0.12, 3.4, bedMat, 0, -0.02, z));
  station.add(box(300, 0.13, 0.16, railMat, 0, 0.16, z - 0.86));
  station.add(box(300, 0.13, 0.16, railMat, 0, 0.16, z + 0.86));
  for (const sx of [-1, 1]) {
    const rail = box(120, 0.1, 0.14, railMat, sx * 155, 0.16, 0);
    rail.rotation.y = sx > 0 ? -0.33 : 0.33;
    station.add(rail);
  }
}
const tieCount = N_TRACK * 120;
const ties = new THREE.InstancedMesh(new THREE.BoxGeometry(2.7, 0.11, 0.34), tieMat, tieCount);
let ti = 0;
const mx = new THREE.Matrix4();
for (let n = 1; n <= N_TRACK; n += 1) {
  const z = TRACK_Z(n);
  for (let i = 0; i < 120; i += 1) {
    mx.makeTranslation(-148 + i * 2.48, 0.05, z);
    ties.setMatrixAt(ti, mx);
    ti += 1;
  }
}
ties.receiveShadow = true;
station.add(ties);

function throatCurve(z, side) {
  const sx = side > 0 ? 1 : -1;
  return new THREE.CatmullRomCurve3([
    new THREE.Vector3(sx * 150, 0.19, 0),
    new THREE.Vector3(sx * 127, 0.19, 0),
    new THREE.Vector3(sx * 110, 0.19, z),
    new THREE.Vector3(sx * 92, 0.19, z),
  ]);
}
for (let n = 1; n <= N_TRACK; n += 1) {
  for (const side of [-1, 1]) {
    const curve = throatCurve(TRACK_Z(n), side);
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 18, 0.075, 5, false), railMat);
    station.add(tube);
  }
}
const mainline = box(460, 0.15, 0.16, railMat, 0, 0.16, 0);
station.add(mainline);
for (const zz of [-0.86, 0.86]) station.add(box(460, 0.1, 0.14, railMat, 0, 0.16, zz));

for (let n = 1; n <= N_TRACK; n += 1) {
  const z = TRACK_Z(n);
  const p = labelSprite(`${n} 道`, '#c9c4b3', 160, 64, [4.2, 1.68]);
  p.position.set(-78, 2.2, z + 2.55);
  station.add(p);
}

const PLATFORMS = [
  { z: TRACK_Z(1) - 4.0, side: 'side', tracks: [1] },
  { z: (TRACK_Z(2) + TRACK_Z(3)) / 2, side: 'island', tracks: [2, 3] },
  { z: (TRACK_Z(4) + TRACK_Z(5)) / 2, side: 'island', tracks: [4, 5] },
  { z: (TRACK_Z(6) + TRACK_Z(7)) / 2, side: 'island', tracks: [6, 7] },
  { z: (TRACK_Z(8) + TRACK_Z(9)) / 2, side: 'island', tracks: [8, 9] },
  { z: TRACK_Z(10) + 4.0, side: 'side', tracks: [10] },
];
for (const p of PLATFORMS) {
  const slab = box(192, 0.9, p.side === 'island' ? 6.4 : 6.0, mat(0x5a574d, 0.82, 0.1), 0, 0.05, p.z);
  slab.receiveShadow = true;
  station.add(slab);
  station.add(box(192, 0.1, p.side === 'island' ? 6.2 : 5.8, mat(0x6f6b5e, 0.8, 0.1), 0, 0.54, p.z));
  for (const bx of [-48, -16, 16, 48]) {
    station.add(box(1.6, 0.55, 0.55, mat(0x30342e, 0.65, 0.3), bx, 0.85, p.z));
    station.add(box(1.6, 0.12, 0.42, mat(0x77715f, 0.7, 0.15), bx, 1.18, p.z));
  }
  for (const t of p.tracks) {
    const edgeZ = TRACK_Z(t);
    const edge = edgeZ > p.z ? p.z + 3.0 : p.z - 3.0;
    station.add(box(192, 0.045, 0.3, mat(0xc6b05d, 0.7, 0.1), 0, 0.61, edge));
  }
  for (const sx of [-72, -48, -24, 0, 24, 48, 72]) {
    station.add(box(0.1, 0.012, p.side === 'island' ? 6.15 : 5.8, mat(0x49473f, 0.9, 0.05), sx, 0.6, p.z));
  }
  for (const lx of [-68, -34, 0, 34, 68]) {
    station.add(box(0.16, 3.0, 0.16, mat(0x3d423d, 0.6, 0.45), lx, 2.05, p.z));
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshStandardMaterial({ color: 0xffe7b8, emissive: 0xffc46a, emissiveIntensity: 1.8 }));
    lamp.position.set(lx, 3.55, p.z);
    station.add(lamp);
  }
}

const buildingMat = mat(0x716d61, 0.72, 0.15);
const winMat = new THREE.MeshStandardMaterial({ color: 0x3a3430, emissive: 0xb08045, emissiveIntensity: 0.8, roughness: 0.28, metalness: 0.35 });
const building = box(72, 15, 14, buildingMat, -8, 7.2, -48);
building.castShadow = true;
station.add(building);
station.add(box(76, 1.2, 16, mat(0x3f403a, 0.8, 0.2), -8, 15.2, -48));
for (let i = 0; i < 7; i += 1) {
  station.add(box(5.5, 7.5, 0.12, winMat, -36 + i * 9, 7.0, -40.95));
  station.add(box(3.0, 2.3, 0.15, mat(0x9b7f42, 0.6, 0.2), -35 + i * 9, 3.3, -40.92));
}
const sign = labelSprite('宝 鸡 站', '#efe2c2', 640, 180, [26, 7.3]);
sign.position.set(-8, 18.7, -46);
station.add(sign);
const subSign = labelSprite('BAOJI  ·  一等站', '#a9b0a4', 512, 100, [17, 3.3]);
subSign.position.set(10, 16.4, -45.4);
station.add(subSign);

station.add(box(220, 0.3, 10, mat(0x2b2d27, 0.9, 0.1), 0, 0.05, 44));

for (const x of [-94, -47, 0, 47, 94]) {
  station.add(box(0.32, 9.2, 0.32, mat(0x4c514b, 0.55, 0.5), x, 4.6, TRACK_Z(1) - 8.2));
  station.add(box(0.32, 9.2, 0.32, mat(0x4c514b, 0.55, 0.5), x, 4.6, TRACK_Z(N_TRACK) + 8.2));
  station.add(box(0.24, 0.24, 72.8, mat(0x3f443f, 0.55, 0.5), x, 8.55, 0));
}
for (const x of [-110, -80, -50, -20, 10, 40, 70, 100]) {
  for (const zz of [TRACK_Z(1) - 8.2, TRACK_Z(N_TRACK) + 8.2]) {
    station.add(box(0.26, 8.2, 0.26, mat(0x4c514b, 0.55, 0.5), x, 4.1, zz));
    station.add(box(5.6, 0.15, 0.16, mat(0x4c514b, 0.55, 0.5), x, 8.0, zz));
  }
}
for (let n = 1; n <= N_TRACK; n += 1) {
  const z = TRACK_Z(n);
  const wire = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-115, 7.35, z), new THREE.Vector3(115, 7.35, z)]), new THREE.LineBasicMaterial({ color: 0x555951 }));
  station.add(wire);
}

const signalMats = {
  red: new THREE.MeshStandardMaterial({ color: 0x3d1714, emissive: 0xb23a2b, emissiveIntensity: 1.6 }),
  green: new THREE.MeshStandardMaterial({ color: 0x14311e, emissive: 0x4f9c67, emissiveIntensity: 1.4 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x171a17, emissive: 0x000000 }),
};
const signals = new Map();
for (let n = 1; n <= N_TRACK; n += 1) {
  for (const side of [-1, 1]) {
    const x = side * 113;
    const z = TRACK_Z(n) + 2.55;
    const post = box(0.18, 4.4, 0.18, mat(0x4b4f48, 0.7, 0.3), x, 2.1, z);
    station.add(post);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), signalMats.dark);
    lamp.position.set(x, 4.35, z);
    station.add(lamp);
    signals.set(`${side}:${n}`, lamp);
  }
}

const trainRoot = new THREE.Group();
scene.add(trainRoot);
const pickables = [];
const trains = [];
const occ = new Set();
let selected = null;
let follow = false;
let clock = START;
let paused = false;
let speed = 5;
let last = performance.now();
let carry = 0;
let finished = false;
const logs = [];

function fmt(m) {
  const h = Math.floor(m / 60) % 24;
  const mm = Math.round(m % 60);
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}
function log(text) {
  logs.unshift(`${fmt(clock)}  ${text}`);
  if (logs.length > 8) logs.pop();
  const el = document.getElementById('log');
  el.innerHTML = logs.map((x, i) => `<div${i === 0 ? ' style="color:#d8c7a2"' : ''}>${x}</div>`).join('');
}

const rawTrains = HUB.trains.slice(0, 14);
const minArr = Math.min(...rawTrains.map((t) => (t.arr == null ? START : t.arr)));
clock = Math.max(START, Number.isFinite(minArr) ? minArr : START);

function preference(t) {
  return t.type === '货' ? [7, 8, 9, 10, 1, 2, 3, 4, 5, 6] : [2, 3, 4, 5, 6, 1, 7, 8, 9, 10];
}
function freeTrack(t) {
  for (const n of preference(t)) if (!occ.has(n)) return n;
  return 0;
}
function trackFree(n) {
  occ.delete(n);
  for (const tr of trains) if (tr.status === 'station' && tr.trackNo === n) occ.add(n);
}

for (let i = 0; i < rawTrains.length; i += 1) {
  const raw = rawTrains[i];
  const spec = specFor(raw);
  const arr = raw.arr == null ? START : raw.arr;
  const dep = raw.dep == null ? arr + 10 : raw.dep;
  const dir = raw.dir === 0 ? -1 : raw.dir === 1 ? 1 : (Number(String(raw.no).replace(/\D/g, '')) % 2 === 0 ? 1 : -1);
  const through = !!raw.through;
  const nCars = Math.min(Number(raw.coaches || (raw.type === '货' ? 24 : 16)), 18);
  const g = new THREE.Group();
  const loco = spec.loco === 'emu' ? buildEmu(spec.coach, 0) : buildLoco(spec.loco, i);
  loco.position.x = 0;
  g.add(loco);
  const cars = [loco];
  for (let k = 0; k < nCars; k += 1) {
    const car = spec.coach === 'C70' || spec.coach === 'C64' || spec.coach === 'P70' || spec.coach === 'X6K' || spec.coach === 'N17' || spec.coach === 'G70'
      ? buildWagon(spec.coach, k)
      : buildCoach(spec.coach, k);
    g.add(car);
    cars.push(car);
  }
  const totalLen = LOCO_LEN + nCars * (COACH_LEN + CAR_GAP);
  const status = !through && arr <= clock ? 'station' : 'approach';
  const trackNo = status === 'station' ? freeTrack(raw) : 0;
  if (trackNo) occ.add(trackNo);
  const tr = {
    id: raw.id || `t${i}`, no: raw.no, type: raw.type || '', raw,
    spec, dir, through, arr, dep, status, trackNo, g, loco, cars, totalLen,
    nCars, visX: 0, z: 0, headX: 0, loaded: i,
    index: i, progress: 0, readyAt: Math.max(dep, through ? arr : arr + (raw.type === '货' ? 8 : 5)),
    departAt: 0, arriveAt: 0, label: null,
  };
  tr.label = labelSprite(tr.no, raw.type === '货' ? '#d8c9ac' : '#e9e2cf', 256, 88, [9, 3.1]);
  tr.label.position.y = 7.0;
  g.add(tr.label);
  g.traverse((o) => { o.userData.trainId = tr.id; });
  trainRoot.add(g);
  pickables.push(g);
  const center = dir * (totalLen / 2 - LOCO_LEN / 2);
  tr.headX = center;
  tr.visX = center;
  tr.z = TRACK_Z(trackNo || 1);
  trains.push(tr);
  if (status === 'approach') g.visible = true;
}
log(`开班 · 宝鸡站客运场 ${N_TRACK} 道 · ${trains.length} 列`);

function refreshApproach() {
  for (const d of [1, -1]) {
    const list = trains.filter((t) => t.status === 'approach' && t.dir === d).sort((a, b) => a.arr - b.arr);
    list.forEach((t, i) => { t.approachVisible = i === 0; });
  }
}

function targetFor(t) {
  if (t.status === 'terminated') return { x: t.dir * 220, z: 0, hide: true };
  if (t.status === 'running') {
    const p = Math.max(0, Math.min(1, t.progress));
    return { x: t.dir * (92 + 112 * p), z: 0, hide: false };
  }
  if (t.status === 'approach') {
    if (!t.approachVisible) return { x: t.dir * 190, z: 0, hide: true };
    const remain = Math.max(0, t.arr - clock);
    const off = Math.min(96, 18 + remain * 9);
    return { x: t.dir > 0 ? -92 - off : 92 + off, z: 0, hide: false };
  }
  const c = t.dir * (t.totalLen / 2 - LOCO_LEN / 2);
  return { x: c, z: TRACK_Z(t.trackNo || 1), hide: false };
}

function placeTrain(t) {
  const target = targetFor(t);
  if (target.hide) {
    t.g.visible = false;
    t.visX = target.x;
    return;
  }
  t.g.visible = true;
  const rate = t.status === 'station' ? 8.5 : 5.2;
  t.visX += (target.x - t.visX) * Math.min(1, rate * 0.016);
  if (Math.abs(target.x - t.visX) < 0.02) t.visX = target.x;
  t.z = target.z;
  const baseX = t.visX;
  t.headX = baseX;
  let lastX = 0;
  for (let i = 0; i < t.cars.length; i += 1) {
    const car = t.cars[i];
    const off = i === 0 ? 0 : LOCO_LEN / 2 + COACH_LEN / 2 + (i - 1) * (COACH_LEN + CAR_GAP);
    const x = baseX - t.dir * off;
    const z = trackZForX(t.z, x);
    const za = trackZForX(t.z, x + t.dir * 0.45);
    const zb = trackZForX(t.z, x - t.dir * 0.45);
    car.position.set(x, 0.56, z);
    car.rotation.y = t.dir > 0 ? -Math.atan2(za - zb, 0.9) : Math.PI - Math.atan2(za - zb, 0.9);
    lastX = x;
  }
  t.label.position.set(baseX, 7.4, trackZForX(t.z, baseX));
  t.label.material.opacity = selected && selected.id === t.id ? 1 : 0.8;
  t.g.userData.lastX = lastX;
}

function trackZForX(z, x) {
  const a = Math.abs(x);
  if (a <= 95) return z;
  if (a >= 150) return 0;
  const k = (150 - a) / 55;
  return z * k;
}

function assign(t) {
  if (!t.trackNo) t.trackNo = freeTrack(t.raw);
  if (!t.trackNo) return false;
  occ.add(t.trackNo);
  t.status = 'station';
  log(`${t.no} 接入 ${t.trackNo} 道`);
  return true;
}
function depart(t) {
  t.status = 'running';
  occ.delete(t.trackNo);
  t.departAt = clock;
  t.arriveAt = clock + (t.through ? 5 : 3);
  t.progress = 0;
  log(`${t.no} ${t.trackNo} 道发车`);
  t.trackNo = 0;
}
function step() {
  for (const t of trains) {
    if (t.status === 'terminated') continue;
    if (t.status === 'approach' && clock >= t.arr) assign(t);
    if (t.status === 'station' && clock >= t.readyAt) depart(t);
    if (t.status === 'running') {
      const d = Math.max(1, t.arriveAt - t.departAt);
      t.progress = Math.max(0, Math.min(1, (clock - t.departAt) / d));
      if (clock >= t.arriveAt) {
        t.status = 'terminated';
        log(`${t.no} 出清本站`);
      }
    }
  }
  if (trains.every((t) => t.status === 'terminated')) finished = true;
}

function signalsUpdate() {
  for (const t of trains) if (t.status === 'station' && t.trackNo) occ.add(t.trackNo);
  for (let n = 1; n <= N_TRACK; n += 1) {
    const busy = occ.has(n);
    for (const side of [-1, 1]) {
      const lamp = signals.get(`${side}:${n}`);
      if (!lamp) continue;
      lamp.material = busy ? signalMats.red : signalMats.green;
    }
  }
}

const target = new THREE.Vector3(0, 0, -3);
let radius = 200;
let theta = 0.86;
let phi = 1.08;
function applyCamera() {
  const p = new THREE.Vector3(
    target.x + radius * Math.sin(phi) * Math.sin(theta),
    target.y + radius * Math.cos(phi),
    target.z + radius * Math.sin(phi) * Math.cos(theta),
  );
  camera.position.copy(p);
  camera.lookAt(target);
}
applyCamera();

let dragging = false;
let dragMode = 0;
let lx = 0, ly = 0, moved = 0;
renderer.domElement.addEventListener('pointerdown', (e) => {
  dragging = true;
  dragMode = e.button === 2 || e.shiftKey ? 2 : 1;
  lx = e.clientX; ly = e.clientY; moved = 0;
  renderer.domElement.setPointerCapture(e.pointerId);
});
renderer.domElement.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const dx = e.clientX - lx, dy = e.clientY - ly;
  moved += Math.abs(dx) + Math.abs(dy);
  lx = e.clientX; ly = e.clientY;
  if (dragMode === 2) {
    target.x -= dx * radius * 0.0016;
    target.z -= dy * radius * 0.0016;
  } else {
    theta -= dx * 0.0048;
    phi = Math.max(0.32, Math.min(1.42, phi - dy * 0.0042));
  }
  applyCamera();
});
renderer.domElement.addEventListener('pointerup', (e) => {
  dragging = false;
  if (moved < 7) pick(e);
});
renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
renderer.domElement.addEventListener('wheel', (e) => {
  e.preventDefault();
  radius = Math.max(55, Math.min(620, radius * (1 + e.deltaY * 0.0012)));
  applyCamera();
}, { passive: false });
let pinch = 0;
renderer.domElement.addEventListener('touchmove', (e) => {
  if (e.touches.length === 2) {
    const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    if (pinch) radius = Math.max(55, Math.min(620, radius * (pinch / d)));
    pinch = d;
    applyCamera();
  }
}, { passive: true });
renderer.domElement.addEventListener('touchend', () => { pinch = 0; });

const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
function pick(e) {
  ndc.x = (e.clientX / window.innerWidth) * 2 - 1;
  ndc.y = -(e.clientY / window.innerHeight) * 2 + 1;
  ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObjects(pickables, true);
  const first = hits.find((h) => h.object.userData.trainId);
  if (!first) return;
  const id = first.object.userData.trainId;
  const t = trains.find((x) => x.id === id);
  if (!t) return;
  selected = t;
  updateSide();
  if (follow) {
    radius = Math.min(radius, 115);
    phi = Math.min(phi, 1.2);
  }
}

function updateSide() {
  const no = document.getElementById('selNo');
  const rows = document.getElementById('selRows');
  const task = document.getElementById('selTask');
  if (!selected) {
    no.textContent = '未选择';
    rows.innerHTML = '<i>状态</i>点一列车查看';
    task.textContent = '拖动旋转 · 滚轮缩放 · 点车选中';
    return;
  }
  const s = selected;
  const st = s.status === 'station' ? `在站 ${s.trackNo} 道` : s.status === 'approach' ? '站外待接' : s.status === 'running' ? '区间运行' : '已出清';
  no.textContent = s.no;
  rows.innerHTML = [
    `<div><i>车种</i>${s.spec.coach || '单机'} · ${s.spec.loco}</div>`,
    `<div><i>状态</i>${st}</div>`,
    `<div><i>方向</i>${s.dir > 0 ? '上行' : '下行'}${s.through ? ' · 通过' : ''}</div>`,
    `<div><i>到达</i>${s.raw.arr == null ? '始发' : fmt(s.arr)}</div>`,
    `<div><i>发车</i>${fmt(s.dep)}</div>`,
    `<div><i>编组</i>${s.nCars ? `${s.nCars} 辆` : '单机'}</div>`,
  ].join('');
  task.textContent = s.through ? '跨站通过，不停站作业' : s.type === '货' ? '货场作业，本站换挂/装卸' : s.type === '检' ? '检测作业，区间数据采集' : '客运乘降，站台作业';
}

function updateHud() {
  document.getElementById('clock').textContent = fmt(clock);
  const inStation = trains.filter((t) => t.status === 'station').length;
  const waiting = trains.filter((t) => t.status === 'approach').length;
  document.getElementById('count').textContent = `在站 ${inStation} / 待接 ${waiting}`;
}

function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!paused && !finished) {
    carry += dt * speed / 2;
    while (carry >= 1) {
      carry -= 1;
      clock += 1;
      step();
    }
  }
  refreshApproach();
  for (const t of trains) {
    placeTrain(t);
    const near = Math.hypot(t.headX - camera.position.x, t.z - camera.position.z) < 175 || (selected && selected.id === t.id) || follow;
    for (const c of t.cars) if (c.userData.detail) c.userData.detail.visible = near;
  }
  signalsUpdate();
  if (selected && follow && selected.status !== 'terminated') {
    target.x += (selected.headX - target.x) * Math.min(1, dt * 3.2);
    target.z += (selected.z - target.z) * Math.min(1, dt * 3.2);
  } else if (!follow) {
    target.x += (0 - target.x) * Math.min(1, dt * 0.6);
    target.z += (0 - target.z) * Math.min(1, dt * 0.6);
  }
  applyCamera();
  document.getElementById('clock').textContent = fmt(clock);
  if (Math.floor(now / 220) % 2 === 0) { updateHud(); if (selected) updateSide(); }
  renderer.render(scene, camera);
  window.__dbg = () => ({ clock, speed, paused, finished, n: trains.length, states: trains.map((t) => [t.no, t.status, t.trackNo, t.visX]) });
window.__skip = (n) => { for (let i = 0; i < n; i += 1) { clock += 1; step(); } };
window.__speed = (n) => { speed = n; };
window.__select = (no) => { selected = trains.find((t) => t.no === no) || selected; updateSide(); };
window.__cam = (r, t, p, x, z) => { radius = r; theta = t; phi = p; target.set(x, 0, z); applyCamera(); };
window.__focus = () => { if (selected) { target.set(selected.headX, 0, selected.z); radius = Math.min(radius, 95); } };
requestAnimationFrame(loop);
}

document.querySelectorAll('.sp').forEach((b) => {
  b.addEventListener('click', () => {
    speed = Number(b.dataset.s);
    document.querySelectorAll('.sp').forEach((x) => x.classList.remove('on'));
    b.classList.add('on');
  });
});
document.getElementById('pause').addEventListener('click', (e) => {
  paused = !paused;
  e.currentTarget.textContent = paused ? '继续' : '暂停';
  e.currentTarget.classList.toggle('on', paused);
});
document.getElementById('follow').addEventListener('click', (e) => {
  follow = !follow;
  e.currentTarget.classList.toggle('on', follow);
  e.currentTarget.textContent = follow ? '取消跟车' : '跟车';
  if (follow && selected) radius = Math.min(radius, 120);
});
document.getElementById('reset').addEventListener('click', () => {
  follow = false;
  document.getElementById('follow').classList.remove('on');
  document.getElementById('follow').textContent = '跟车';
  target.set(0, 0, -3);
  radius = 200;
  theta = 0.86;
  phi = 1.08;
  applyCamera();
});
document.getElementById('to2d').addEventListener('click', () => { location.href = '../index.html'; });
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

refreshApproach();
for (const t of trains) {
  if (t.status === 'station') {
    const p = t.dir * (t.totalLen / 2 - LOCO_LEN / 2);
    t.visX = p;
  } else {
    const p = t.dir > 0 ? -92 - Math.min(96, 18 + (t.arr - clock) * 9) : 92 + Math.min(96, 18 + (t.arr - clock) * 9);
    t.visX = p;
  }
  placeTrain(t);
}
selected = trains.find((t) => t.status === 'station') || trains[0];
updateSide();
updateHud();
document.getElementById('loading').classList.add('hidden');
requestAnimationFrame(loop);
