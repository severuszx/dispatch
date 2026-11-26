import * as THREE from './three.module.js';

const stage = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9db2bd);
scene.fog = new THREE.Fog(0xa8b8bf, 320, 1750);
const skyTex = canvasTexture(1024, 512, (ctx, w, h) => {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#54778f'); g.addColorStop(.38, '#93aebc'); g.addColorStop(.62, '#d6dedb'); g.addColorStop(1, '#a7a58e');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  const halo = ctx.createRadialGradient(690, 180, 6, 690, 180, 240);
  halo.addColorStop(0, 'rgba(255,238,198,.52)'); halo.addColorStop(.35, 'rgba(255,224,166,.18)'); halo.addColorStop(1, 'rgba(255,224,166,0)');
  ctx.fillStyle = halo; ctx.fillRect(0, 0, w, h);
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(2100, 32, 18), new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false, depthWrite: false }));
scene.add(sky);

const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.05, 2600);

const hemi = new THREE.HemisphereLight(0xc6d7de, 0x5c5240, 1.9);
scene.add(hemi);
scene.add(new THREE.AmbientLight(0x5c6668, 1.1));
const sun = new THREE.DirectionalLight(0xffe2b8, 2.6);
sun.position.set(-420, 620, 380);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 10;
sun.shadow.camera.far = 1200;
sun.shadow.camera.left = -420;
sun.shadow.camera.right = 420;
sun.shadow.camera.top = 420;
sun.shadow.camera.bottom = -420;
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.6;
scene.add(sun);
scene.add(sun.target);
const cabLight = new THREE.PointLight(0xffe1bc, 2.6, 14, 1.5);
cabLight.position.set(0, 2.7, 0.2);
scene.add(cabLight);
const cabFill = new THREE.PointLight(0xbfd2dc, 1.4, 10, 1.6);
cabFill.position.set(-1.5, 1.9, 1.2);
scene.add(cabFill);

const STATIONS = [
  { km: 0, name: '信阳', arr: '20:46', dep: '20:52', stop: true },
  { km: 72, name: '桐柏', arr: '21:56', dep: '22:00', stop: true },
  { km: 174, name: '南阳', pass: true },
  { km: 208, name: '镇平', pass: true },
  { km: 241, name: '内乡', pass: true },
  { km: 274, name: '西峡', pass: true },
  { km: 357, name: '商南', pass: true },
  { km: 404, name: '丹凤', pass: true },
  { km: 441, name: '商洛', pass: true },
  { km: 534, name: '渭南', pass: true },
  { km: 616, name: '西安', arr: '04:33', dep: '04:52', stop: true }
];

const state = {
  speed: 0,
  notch: 0,
  brake: 2,
  direction: 'F',
  distance: 0,
  bp: 420,
  mr: 900,
  panto: true,
  main: true,
  control: true,
  compressor: true,
  vent: true,
  aux: true,
  head: true,
  marker: false,
  cabLamp: true,
  wiper: false,
  sander: false,
  cruise: false,
  atp: true,
  radio: true,
  ack: false,
  fire: false,
  isolate: false,
  heat: false,
  ac: false,
  fan: false,
  rear: false,
  time: 20 * 60 + 46,
  timeScale: 18,
  cabMode: true,
  view: 'cab',
  alarm: ''
};

const clock = new THREE.Clock();
const routeLength = 12200;
let routeCurve, trainGroup, cabGroup, extGroup, trainPoint = 0;
const clickables = [];
const buttons = {};
const screenTextures = [];
const gaugeCanvas = document.createElement('canvas');
gaugeCanvas.width = 512;
gaugeCanvas.height = 512;
const gaugeTex = new THREE.CanvasTexture(gaugeCanvas);

function mat(color, roughness = 0.72, metalness = 0.08) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}
function box(w, h, d, m, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.position.set(x, y, z);
  return mesh;
}
function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  draw(ctx, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function buildRoute() {
  const pts = [];
  const seg = 900;
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    const z = t * routeLength;
    const x = 520 * Math.sin(t * Math.PI * 3.1) + 190 * Math.sin(t * Math.PI * 9.2) - 180 * Math.sin(t * Math.PI * 1.2);
    const y = 16 * Math.sin(t * Math.PI * 4.5) + 5 * Math.sin(t * Math.PI * 17);
    pts.push(new THREE.Vector3(x, y, z));
  }
  routeCurve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.44);

  const groundTex = canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#727b55'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) {
      const x = Math.random() * w, y = Math.random() * h;
      ctx.fillStyle = Math.random() < .5 ? 'rgba(58,68,44,.28)' : 'rgba(150,148,104,.22)';
      ctx.fillRect(x, y, 1 + Math.random() * 3, 1 + Math.random() * 4);
    }
    for (let i = 0; i < 60; i++) {
      ctx.strokeStyle = 'rgba(66,73,48,.22)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(Math.random() * w, Math.random() * h); ctx.lineTo(Math.random() * w, Math.random() * h); ctx.stroke();
    }
  });
  groundTex.wrapS = groundTex.wrapT = THREE.RepeatWrapping;
  groundTex.repeat.set(60, 60);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(24000, 24000, 1, 1), new THREE.MeshStandardMaterial({ map: groundTex, color: 0x9aa17e, roughness: 1, metalness: 0 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -8, routeLength / 2);
  ground.receiveShadow = true;
  scene.add(ground);

  const fieldColors = [0x7d8857, 0x677547, 0x8e8959, 0x596841, 0x9a9064];
  for (let i = 0; i < 120; i++) {
    const t = Math.random();
    const p = routeCurve.getPointAt(t);
    const f = new THREE.Mesh(new THREE.PlaneGeometry(180 + Math.random() * 360, 120 + Math.random() * 280), mat(fieldColors[i % 5], 1, 0));
    f.rotation.x = -Math.PI / 2;
    f.rotation.z = Math.random() * Math.PI;
    f.position.set(p.x + (Math.random() < .5 ? -1 : 1) * (80 + Math.random() * 360), -7.8 + Math.random() * .3, p.z + (Math.random() - .5) * 140);
    f.receiveShadow = true;
    scene.add(f);
  }

  const hillMat = mat(0x4c5b46, 1, 0);
  const hillMat2 = mat(0x5c634a, 1, 0);
  for (let i = 0; i < 110; i++) {
    const p = routeCurve.getPointAt((i + .35) / 110);
    const side = i % 2 ? 1 : -1;
    const h = 32 + Math.random() * 96;
    const c = new THREE.Mesh(new THREE.ConeGeometry(h * (1.15 + Math.random() * .5), h, 7), i % 3 ? hillMat : hillMat2);
    c.position.set(p.x + side * (250 + Math.random() * 520), h / 2 - 8, p.z + (Math.random() - .5) * 420);
    c.rotation.y = Math.random() * Math.PI;
    c.castShadow = true; c.receiveShadow = true;
    scene.add(c);
  }

  const ballastGeo = new THREE.BufferGeometry();
  const positions = [];
  const uvs = [];
  const idx = [];
  const n = 720;
  const railPtsL = [];
  const railPtsR = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = routeCurve.getPointAt(t);
    const tan = routeCurve.getTangentAt(t);
    const nx = tan.z, nz = -tan.x;
    const len = Math.hypot(nx, nz) || 1;
    const ox = nx / len, oz = nz / len;
    positions.push(p.x + ox * 4.2, p.y - 7.4, p.z + oz * 4.2);
    positions.push(p.x - ox * 4.2, p.y - 7.4, p.z - oz * 4.2);
    uvs.push(0, i / 8, 1, i / 8);
    railPtsL.push(new THREE.Vector3(p.x + ox * .78, p.y + .12, p.z + oz * .78));
    railPtsR.push(new THREE.Vector3(p.x - ox * .78, p.y + .12, p.z - oz * .78));
  }
  for (let i = 0; i < n; i++) {
    const a = i * 2, b = i * 2 + 1, c = i * 2 + 2, d = i * 2 + 3;
    idx.push(a, b, c, b, d, c);
  }
  ballastGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  ballastGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  ballastGeo.setIndex(idx);
  ballastGeo.computeVertexNormals();
  scene.add(new THREE.Mesh(ballastGeo, mat(0x57544b, 1, 0)));

  const railMat = new THREE.MeshStandardMaterial({ color: 0xaeb2af, roughness: .28, metalness: .82, emissive: 0x181a19 });
  const railCurveL = new THREE.CatmullRomCurve3(railPtsL);
  const railCurveR = new THREE.CatmullRomCurve3(railPtsR);
  scene.add(new THREE.Mesh(new THREE.TubeGeometry(railCurveL, 760, .115, 5, false), railMat));
  scene.add(new THREE.Mesh(new THREE.TubeGeometry(railCurveR, 760, .115, 5, false), railMat));

  const sleeperGeo = new THREE.BoxGeometry(2.7, .16, .32);
  const sleeperMesh = new THREE.InstancedMesh(sleeperGeo, mat(0x3d3c36, .95, 0), 3050);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < 3050; i++) {
    const t = i / 3050;
    const p = routeCurve.getPointAt(t);
    const tan = routeCurve.getTangentAt(t);
    q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tan);
    m4.compose(new THREE.Vector3(p.x, p.y + .01, p.z), q, new THREE.Vector3(1, 1, 1));
    sleeperMesh.setMatrixAt(i, m4);
  }
  scene.add(sleeperMesh);

  const mastGeo = new THREE.BoxGeometry(.1, 5.4, .1);
  const mastMat = mat(0x5e6668, .55, .45);
  const mastCount = 244;
  const masts = new THREE.InstancedMesh(mastGeo, mastMat, mastCount * 2);
  const armGeo = new THREE.BoxGeometry(3.4, .08, .08);
  const arms = new THREE.InstancedMesh(armGeo, mastMat, mastCount);
  for (let i = 0; i < mastCount; i++) {
    const t = (i + .5) / mastCount;
    const p = routeCurve.getPointAt(t);
    const tan = routeCurve.getTangentAt(t);
    const nx = tan.z, nz = -tan.x;
    const len = Math.hypot(nx, nz) || 1;
    const ox = nx / len, oz = nz / len;
    q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tan);
    for (let s = 0; s < 2; s++) {
      m4.compose(new THREE.Vector3(p.x + (s ? 2.7 : -2.7), p.y + 2.7, p.z), q, new THREE.Vector3(1, 1, 1));
      masts.setMatrixAt(i * 2 + s, m4);
    }
    q.setFromUnitVectors(new THREE.Vector3(1, 0, 0), new THREE.Vector3(ox, 0, oz));
    const q2 = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), new THREE.Vector3(ox, 0, oz));
    m4.compose(new THREE.Vector3(p.x, p.y + 5.25, p.z), q2, new THREE.Vector3(1, 1, 1));
    arms.setMatrixAt(i, m4);
  }
  scene.add(masts, arms);

  const wireGeo = new THREE.BufferGeometry();
  const wirePts = [];
  for (let i = 0; i <= 300; i++) {
    const p = routeCurve.getPointAt(i / 300);
    wirePts.push(p.x, p.y + 5.2, p.z);
    if (i < 300) wirePts.push(p.x, p.y + 5.2, p.z);
  }
  wireGeo.setAttribute('position', new THREE.Float32BufferAttribute(wirePts, 3));
  scene.add(new THREE.LineSegments(wireGeo, new THREE.LineBasicMaterial({ color: 0x343b3b })));

  const treeTrunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(.12, .18, 2.4, 5), mat(0x4b3d2d, 1, 0), 1600);
  const treeCrown = new THREE.InstancedMesh(new THREE.ConeGeometry(1.45, 4.2, 6), mat(0x39482f, 1, 0), 1600);
  for (let i = 0; i < 1600; i++) {
    const p = routeCurve.getPointAt(Math.random());
    const side = Math.random() < .5 ? -1 : 1;
    const off = 14 + Math.random() * 260;
    const tan = routeCurve.getTangentAt(Math.random());
    const nx = tan.z, nz = -tan.x;
    const len = Math.hypot(nx, nz) || 1;
    const x = p.x + (nx / len) * off * side;
    const z = p.z + (nz / len) * off * side;
    const sc = .6 + Math.random() * 1.1;
    m4.compose(new THREE.Vector3(x, -7 + 1.2 * sc, z), new THREE.Quaternion(), new THREE.Vector3(sc, sc, sc));
    treeTrunk.setMatrixAt(i, m4);
    m4.compose(new THREE.Vector3(x, -7 + 3.2 * sc, z), new THREE.Quaternion(), new THREE.Vector3(sc, sc, sc));
    treeCrown.setMatrixAt(i, m4);
  }
  treeTrunk.castShadow = true; treeTrunk.receiveShadow = true;
  treeCrown.castShadow = true; treeCrown.receiveShadow = true;
  const bushGeo = new THREE.SphereGeometry(1, 6, 4);
  const bush = new THREE.InstancedMesh(bushGeo, mat(0x445235, 1, 0), 1500);
  for (let i = 0; i < 1500; i++) {
    const p = routeCurve.getPointAt(Math.random());
    const tan = routeCurve.getTangentAt(Math.random());
    const nx = tan.z, nz = -tan.x;
    const len = Math.hypot(nx, nz) || 1;
    const side = Math.random() < .5 ? -1 : 1;
    const off = 8 + Math.random() * 34;
    const sc = .35 + Math.random() * .9;
    m4.compose(new THREE.Vector3(p.x + nx / len * off * side, -6.0 + sc, p.z + nz / len * off * side), new THREE.Quaternion(), new THREE.Vector3(sc * 1.4, sc, sc * 1.2));
    bush.setMatrixAt(i, m4);
  }
  bush.castShadow = true; bush.receiveShadow = true;
  scene.add(bush);
  const postGeo = new THREE.BoxGeometry(.12, 1.2, .12);
  const posts = new THREE.InstancedMesh(postGeo, mat(0x9a998c, .9, 0), 610);
  for (let i = 0; i < 610; i++) {
    const p = routeCurve.getPointAt((i + .5) / 610);
    const tan = routeCurve.getTangentAt((i + .5) / 610);
    const nx = tan.z, nz = -tan.x; const len = Math.hypot(nx, nz) || 1;
    m4.compose(new THREE.Vector3(p.x + nx / len * 11, p.y - 5.7, p.z + nz / len * 11), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
    posts.setMatrixAt(i, m4);
  }
  posts.castShadow = true;
  scene.add(posts);
  scene.add(treeTrunk, treeCrown);

  for (const st of STATIONS) buildStation(st);
}

function stationAt(st) {
  const t = Math.max(0, Math.min(1, st.km / 616));
  const p = routeCurve.getPointAt(t);
  const tan = routeCurve.getTangentAt(t);
  const g = new THREE.Group();
  g.position.copy(p);
  g.rotation.y = Math.atan2(tan.x, tan.z);
  return g;
}

function labelSprite(text, size = 64, color = '#ddd4bc', bg = 'rgba(9,12,14,.82)') {
  const t = canvasTexture(512, 128, (ctx, w, h) => {
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#5b513d'; ctx.lineWidth = 4; ctx.strokeRect(2, 2, w - 4, h - 4);
    ctx.fillStyle = color; ctx.font = `600 ${size}px "Noto Sans SC",sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, h / 2 + 2);
  });
  const m = new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: true });
  const s = new THREE.Sprite(m);
  s.scale.set(22, 5.5, 1);
  return s;
}

function buildStation(st) {
  const g = stationAt(st);
  const pmat = mat(0x918d80, .95, 0);
  const conc = mat(0x77776f, .95, 0);
  const roof = mat(0x3f4b50, .82, .05);
  const p = new THREE.Mesh(new THREE.BoxGeometry(42, .9, 8), pmat);
  p.position.set(-13, -6.6, 10);
  g.add(p);
  const edge = box(42, .12, .18, mat(0xd3b35c, .8, .1), -13, -6.1, 6.1);
  g.add(edge);
  const b = box(24, 9, 10, conc, 18, -2.2, 16);
  g.add(b);
  const r = box(26, .5, 11, roof, 18, 2.5, 16);
  g.add(r);
  const canopy = box(30, .3, 6, roof, 10, -1.2, 11.6);
  g.add(canopy);
  for (let i = 0; i < 5; i++) g.add(box(.25, 4.2, .25, conc, -3 + i * 7, -3.9, 12));
  for (let i = 0; i < 4; i++) {
    const lx = -8 + i * 8;
    g.add(box(.12, 4.2, .12, mat(0x3d4545, .6, .3), lx, -4.6, 8.4));
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(.2, 6, 4), new THREE.MeshStandardMaterial({ color: 0xfff1c9, emissive: 0xffd79a, emissiveIntensity: 2.2 }));
    bulb.position.set(lx, -2.35, 8.4); g.add(bulb);
    const bench = box(2.3, .12, .5, mat(0x5a4a37, .9, 0), lx + 2.5, -5.7, 8.1); g.add(bench);
    g.add(box(.1, .45, .1, mat(0x30383a, .8, .1), lx + 1.8, -6.0, 8.1));
    g.add(box(.1, .45, .1, mat(0x30383a, .8, .1), lx + 3.2, -6.0, 8.1));
  }
  const name = labelSprite(st.name, 58);
  name.position.set(18, 5.2, 16);
  name.scale.set(19, 4.75, 1);
  g.add(name);
  const board = new THREE.Mesh(new THREE.PlaneGeometry(9, 3.4), canvasTexture(512, 256, (ctx, w, h) => {
    ctx.fillStyle = '#11181c'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#334149'; ctx.strokeRect(4, 4, w - 8, h - 8);
    ctx.fillStyle = '#d9cfb8'; ctx.font = '600 35px "Noto Sans SC",sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(st.name, w / 2, 55);
    ctx.fillStyle = '#8fa09f'; ctx.font = '24px "Noto Sans SC",sans-serif';
    ctx.fillText(st.stop ? `${st.arr} / ${st.dep}` : '通过', w / 2, 105);
    ctx.fillStyle = '#6e7d78'; ctx.font = '20px ui-monospace,monospace';
    ctx.fillText(`K${st.km}`, w / 2, 155);
    ctx.fillStyle = '#485652'; ctx.font = '18px "Noto Sans SC",sans-serif';
    ctx.fillText('宁西线 · Z595', w / 2, 205);
  }));
  board.position.set(18, -0.3, 10.86);
  g.add(board);
  const sig = new THREE.Group();
  sig.position.set(-32, -6.2, 9);
  const pole = box(.12, 5.2, .12, mat(0x343b3e, .5, .4), 0, 2.6, 0);
  sig.add(pole);
  const lampMat = new THREE.MeshStandardMaterial({ color: 0x164a2c, emissive: 0x2f8a52, emissiveIntensity: 1.4, roughness: .4 });
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(.36, .36, .22, 12), lampMat);
  lamp.rotation.z = Math.PI / 2;
  lamp.position.set(0, 5.05, .2);
  sig.add(lamp);
  g.add(sig);
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  scene.add(g);
}

function buildTrain() {
  trainGroup = new THREE.Group();
  scene.add(trainGroup);

  extGroup = new THREE.Group();
  trainGroup.add(extGroup);

  const body = mat(0x1d4a70, .55, .2);
  const body2 = mat(0x203d59, .6, .15);
  const white = mat(0xd9d6cc, .7, .05);
  const glass = new THREE.MeshStandardMaterial({ color: 0x243a44, roughness: .15, metalness: .3 });
  const red = mat(0xa63a2c, .6, .1);
  const dark = mat(0x22262a, .8, .1);

  const loco = new THREE.Group();
  const lb = box(6.2, 4.1, 22, body, 0, 1.0, 0);
  loco.add(lb);
  loco.add(box(6.26, .6, 22.1, white, 0, -0.9, 0));
  loco.add(box(6.24, .36, 22.1, red, 0, .2, 0));
  loco.add(box(5.4, .22, 14, dark, 0, 3.2, -1));
  const cabFace = box(5.2, 2.4, .18, glass, 0, 1.9, 10.94);
  loco.add(cabFace);
  loco.add(box(5.8, .35, .3, dark, 0, .55, 11.02));
  for (const x of [-2.2, 2.2]) {
    const l = new THREE.Mesh(new THREE.CylinderGeometry(.28, .28, .22, 12), new THREE.MeshStandardMaterial({ color: 0xfff3cf, emissive: 0xffd98f, emissiveIntensity: 2.2 }));
    l.rotation.x = Math.PI / 2;
    l.position.set(x, .4, 11.08);
    loco.add(l);
  }
  for (const x of [-1.7, 1.7]) {
    const hl = new THREE.SpotLight(0xfff0cd, 1.6, 160, .32, .6, 1.4);
    hl.position.set(x, .45, 11.1);
    hl.target.position.set(x * .4, -1.5, 80);
    loco.add(hl, hl.target);
  }
  const panto = new THREE.Group();
  const p1 = box(.12, 4.5, .12, dark, 0, 3.2, 0); p1.rotation.x = -.35; panto.add(p1);
  const p2 = box(.12, 4.5, .12, dark, 0, 3.2, 1.4); p2.rotation.x = .35; panto.add(p2);
  const bar = box(2.4, .1, .12, mat(0x8f9492, .4, .5), 0, 5.4, .8); panto.add(bar);
  panto.position.set(0, 3.1, -4);
  loco.add(panto);
  extGroup.add(loco);

  for (let i = 0; i < 18; i++) {
    const c = new THREE.Group();
    const cb = box(3.1, 3.2, 6.2, i % 3 === 0 ? white : mat(0xd2d0c7, .72, .04), 0, .9, 0);
    c.add(cb);
    c.add(box(3.14, .3, 6.22, mat(0x2b4d68, .6, .1), 0, .1, 0));
    for (let w = 0; w < 7; w++) {
      c.add(box(.04, .5, .75, glass, 1.57, 1.45, -2.2 + w * .72));
      c.add(box(.04, .5, .75, glass, -1.57, 1.45, -2.2 + w * .72));
    }
    c.add(box(2.3, .16, 5.2, dark, 0, 2.6, 0));
    c.position.set(0, .9, -13 - i * 7.1);
    extGroup.add(c);
  }
  extGroup.visible = false;

  cabGroup = new THREE.Group();
  trainGroup.add(cabGroup);
  buildCab(cabGroup);
}

function buildCab(root) {
  const wall = mat(0x8f9a9b, .82, .04);
  const wallDark = mat(0x4b565a, .8, .05);
  const floorMat = mat(0x303537, .92, .02);
  const deskMat = new THREE.MeshStandardMaterial({ color: 0x8f999b, roughness: .62, metalness: .12 });
  const panelMat = new THREE.MeshStandardMaterial({ color: 0x323d41, roughness: .62, metalness: .08 });

  root.add(box(4.6, .16, 6.4, floorMat, 0, .16, 0));
  root.add(box(4.6, .14, 6.4, wall, 0, 2.96, 0));
  root.add(box(.16, 2.8, 6.4, wall, -2.22, 1.52, 0));
  root.add(box(.16, 2.8, 6.4, wall, 2.22, 1.52, 0));
  root.add(box(4.6, 2.8, .16, wall, 0, 1.52, -3.1));

  const front = new THREE.Group();
  front.add(box(4.6, .86, .18, wallDark, 0, .48, 3.12));
  front.add(box(4.6, .2, .18, wallDark, 0, 2.78, 3.12));
  front.add(box(.24, 2.1, .18, wallDark, -2.15, 1.55, 3.12));
  front.add(box(.24, 2.1, .18, wallDark, 2.15, 1.55, 3.12));
  front.add(box(.14, 1.65, .18, wallDark, 0, 1.45, 3.12));
  root.add(front);

  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x9db6c1, transparent: true, opacity: .16, roughness: .06, metalness: 0, transmission: 0, side: THREE.DoubleSide });
  const w1 = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.68), glassMat);
  w1.position.set(-1.06, 1.93, 3.18); w1.rotation.y = Math.PI;
  root.add(w1);
  const w2 = w1.clone(); w2.position.x = 1.06; root.add(w2);

  const sideGlassMat = glassMat.clone();
  for (const x of [-2.12, 2.12]) {
    const sw = new THREE.Mesh(new THREE.PlaneGeometry(1.35, 1.0), sideGlassMat);
    sw.position.set(x, 2.0, 1.35); sw.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2;
    root.add(sw);
  }

  const wiperPivot = new THREE.Group();
  wiperPivot.position.set(-1.25, 1.44, 3.3);
  const wiperMat = mat(0x222626, .7, .2);
  const blade = box(.05, 1.0, .05, wiperMat, 0, .5, 0);
  blade.rotation.z = -.32;
  wiperPivot.add(blade);
  wiperPivot.add(box(.36, .06, .08, wiperMat, -.17, 0, 0));
  root.add(wiperPivot);
  wiperPivot.visible = false;
  window.__wiper = wiperPivot;

  const visor = box(4.4, .11, .5, mat(0x2c3438, .85, .05), 0, 2.83, 2.92);
  visor.rotation.x = -.15;
  root.add(visor);

  const desk = new THREE.Group();
  desk.add(box(3.66, .14, 1.2, deskMat, 0, 1.08, 2.26));
  desk.add(box(3.7, .72, .16, deskMat, 0, .72, 2.84));
  desk.add(box(3.44, .08, .95, panelMat, 0, 1.17, 2.24));
  desk.add(box(.7, .95, 1.5, wallDark, -1.95, .58, 2.2));
  desk.add(box(.7, .95, 1.5, wallDark, 1.95, .58, 2.2));
  root.add(desk);

  const screens = [
    { x: -.79, y: 1.65, w: .64, h: .46 },
    { x: .08, y: 1.7, w: .86, h: .54 },
    { x: .99, y: 1.65, w: .64, h: .46 }
  ];
  for (let i = 0; i < screens.length; i++) {
    const s = screens[i];
    const c = document.createElement('canvas');
    c.width = i === 1 ? 768 : 512;
    c.height = 320;
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    screenTextures.push({ canvas: c, tex, index: i });
    const bezel = box(s.w + .08, s.h + .08, .05, mat(0x161b1e, .7, .1), s.x, s.y, 2.73);
    root.add(bezel);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(s.w, s.h), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
    screen.position.set(s.x, s.y, 2.7);
    screen.rotation.y = Math.PI;
    root.add(screen);
    screen.rotation.x = -.07;
  }

  const gauge = new THREE.Mesh(new THREE.CircleGeometry(.23, 32), new THREE.MeshBasicMaterial({ map: gaugeTex, toneMapped: false }));
  gauge.position.set(1.77, 1.88, 2.66);
  gauge.rotation.y = Math.PI;
  root.add(gauge);
  root.add(box(.5, .5, .05, mat(0x161b1e, .7, .1), 1.77, 1.88, 2.7));

  desk.add(box(.56, .68, .06, mat(0x3b464a, .66, .1), -1.68, 1.42, 2.61));
  desk.add(box(.56, .68, .06, mat(0x3b464a, .66, .1), 1.68, 1.42, 2.61));
  desk.add(box(1.5, .16, .06, mat(0x3b464a, .66, .1), 0, 1.01, 2.91));
  addButtons(root);
  addLevers(root);

  const seat = new THREE.Group();
  const seatMat = mat(0x2e4147, .9, .02);
  const base = box(.8, .18, .75, seatMat, 0, .58, .6);
  const back = box(.8, .95, .18, seatMat, 0, 1.1, .98);
  back.rotation.x = -.12;
  seat.add(base, back);
  seat.add(box(.24, .65, .24, mat(0x242a2c, .8, .1), 0, .28, .6));
  seat.add(box(.9, .08, .7, mat(0x1d2326, .9, 0), 0, .47, .6));
  seat.position.z = -1.72;
  seat.position.z = -1.72;
  root.add(seat);

  const handset = new THREE.Group();
  handset.add(box(.22, .34, .1, mat(0x1a1e20, .7, .1), 0, 0, 0));
  handset.add(box(.16, .18, .06, mat(0x323a3b, .65, .15), 0, -.2, .02));
  handset.position.set(1.86, 1.9, 2.35);
  handset.rotation.z = -.15;
  root.add(handset);

  const extinguisher = new THREE.Mesh(new THREE.CylinderGeometry(.15, .15, .7, 10), mat(0x8d2c24, .55, .1));
  extinguisher.position.set(-2.0, .55, 1.0);
  root.add(extinguisher);
  root.add(box(.1, .55, .1, mat(0xb9b4a8, .8, .1), -2.0, 1.0, 1.0));

  const stepMat = mat(0x5c6465, .8, .1);
  for (const x of [-1.55, 1.55]) {
    root.add(box(1.4, .1, .95, stepMat, x, .05, 1.9));
    root.add(box(.08, .3, .7, mat(0x23292c, .8, .1), x + (x < 0 ? -.65 : .65), .2, 2.25));
  }

  const mirror = new THREE.Mesh(new THREE.CircleGeometry(.16, 16), new THREE.MeshBasicMaterial({ color: 0xa8b3b3 }));
  mirror.position.set(2.42, 2.1, 2.9);
  mirror.rotation.y = -Math.PI / 2;
  root.add(mirror);

  const spot = new THREE.SpotLight(0xffe3c2, 3.1, 7, .62, .55, 1.3);
  spot.position.set(0, 2.9, 1.7);
  spot.target.position.set(0, 1.0, 2.4);
  root.add(spot, spot.target);
  const dome = new THREE.PointLight(0xffd4a2, 1.4, 4, 1.5);
  dome.position.set(0, 2.7, .5);
  root.add(dome);
  root.add(box(1.4, .05, .16, new THREE.MeshStandardMaterial({ color: 0xffe3b8, emissive: 0xffc77d, emissiveIntensity: 1.2 }), 0, 2.84, .4));
}

const BTN_DEFS = [
  ['pantoUp', '受电弓升'], ['pantoDown', '受电弓降'], ['mainOn', '主断合'], ['mainOff', '主断分'],
  ['controlOn', '控制电源'], ['compOn', '压缩机'], ['ventOn', '通风机'], ['auxOn', '辅助逆变'],
  ['headOn', '前照灯'], ['markerOn', '标志灯'], ['cabLamp', '司机室灯'], ['wiperOn', '雨刷'],
  ['sanderOn', '撒砂'], ['cruiseOn', '定速'], ['atpOn', '监控'], ['radioOn', '电台'],
  ['ack', '报警确认'], ['fireOn', '防火'], ['isolateOn', '故障隔离'], ['heatOn', '取暖'],
  ['acOn', '空调'], ['fanOn', '风扇'], ['rearOn', '后视'], ['spare1', '备用'],
  ['spare2', '备用'], ['spare3', '备用'], ['spare4', '备用'], ['spare5', '备用'],
  ['spare6', '备用'], ['spare7', '备用'], ['spare8', '备用'], ['spare9', '备用'],
  ['spare10', '备用'], ['spare11', '备用'], ['spare12', '备用'], ['spare13', '备用']
];

function buttonState(id) {
  const map = {
    pantoUp: state.panto, pantoDown: !state.panto, mainOn: state.main, mainOff: !state.main,
    controlOn: state.control, compOn: state.compressor, ventOn: state.vent, auxOn: state.aux,
    headOn: state.head, markerOn: state.marker, cabLamp: state.cabLamp, wiperOn: state.wiper,
    sanderOn: state.sander, cruiseOn: state.cruise, atpOn: state.atp, radioOn: state.radio,
    ack: state.ack, fireOn: state.fire, isolateOn: state.isolate, heatOn: state.heat,
    acOn: state.ac, fanOn: state.fan, rearOn: state.rear
  };
  return map[id] || false;
}

function sidePanelTexture(offset) {
  return canvasTexture(512, 900, (ctx, w, h) => {
    ctx.fillStyle = '#343e42'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#283135'; ctx.fillRect(8, 8, w - 16, h - 16);
    ctx.fillStyle = '#cfcbbc'; ctx.font = '600 26px "Noto Sans SC",sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(offset ? '右侧开关屏' : '左侧开关屏', w / 2, 32);
    const rows = [];
    for (let i = 0; i < 6; i++) {
      rows.push([0, 1, 2].map(c => BTN_DEFS[offset + i * 3 + c]));
    }
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 3; c++) {
        const x = 88 + c * 168, y = 80 + r * 140;
        ctx.strokeStyle = '#1b2326'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y, 31, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = '#4f5a5c'; ctx.beginPath(); ctx.arc(x, y, 27, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#e0dccb'; ctx.font = '600 25px "Noto Sans SC",sans-serif';
        ctx.fillText(rows[r][c][1], x, y + 52);
        ctx.fillStyle = '#131a1c'; ctx.beginPath(); ctx.arc(x + 40, y - 22, 5, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.fillStyle = '#687370'; ctx.font = '15px ui-monospace,monospace'; ctx.textAlign = 'left';
    ctx.fillText('HXD3D  CAB CONTROL', 20, h - 18);
  });
}

function addButtons(root) {
  for (const side of [0, 1]) {
    const pt = new THREE.Mesh(new THREE.PlaneGeometry(.54, .68), new THREE.MeshBasicMaterial({ map: sidePanelTexture(side * 18), toneMapped: false, side: THREE.DoubleSide }));
    pt.position.set(side ? 1.68 : -1.68, 1.42, 2.575); pt.rotation.y = Math.PI;
    root.add(pt);
  }
  const btnGeo = new THREE.CylinderGeometry(.038, .038, .035, 10);
  const labelGeo = new THREE.PlaneGeometry(.15, .045);
  for (let i = 0; i < BTN_DEFS.length; i++) {
    const [id, label] = BTN_DEFS[i];
    let x, y;
    if (i < 18) {
      const col = i % 3, row = Math.floor(i / 3);
      x = -1.82 + col * .16;
      y = 1.66 - row * .105;
    } else {
      const col = (i - 18) % 3, row = Math.floor((i - 18) / 3);
      x = 1.5 + col * .16;
      y = 1.66 - row * .105;
    }
    const z = 2.555;
    const base = new THREE.Mesh(btnGeo, new THREE.MeshStandardMaterial({ color: 0x737d7e, roughness: .45, metalness: .22, emissive: 0x0b0f10 }));
    base.rotation.x = Math.PI / 2;
    base.position.set(x, y, z);
    base.userData.action = id;
    base.userData.label = label;
    base.userData.isButton = true;
    root.add(base);
    clickables.push(base);
    buttons[id] = base;
    const lt = canvasTexture(128, 48, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#e8e6d8'; ctx.font = '600 19px "Noto Sans SC",sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(label, w / 2, h / 2 + 1);
    });
    const lm = new THREE.Mesh(new THREE.PlaneGeometry(.125, .04), new THREE.MeshBasicMaterial({ map: lt, transparent: true, toneMapped: false, depthWrite: false }));
    lm.position.set(x, y, z - .019); lm.rotation.y = Math.PI; root.add(lm);
    const led = new THREE.Mesh(new THREE.CircleGeometry(.022, 10), new THREE.MeshBasicMaterial({ color: 0x2f6b43 }));
    led.position.set(x + .045, y + .036, z - .021);
    root.add(led);
    base.userData.led = led;
  }
  for (const id in buttons) {
    const b = buttons[id];
    const led = b.userData.led;
    if (!led) continue;
    const on = buttonState(id);
    led.material.color.set(on ? 0x57c47a : 0x2b302e);
  }
}

function addLevers(root) {
  const base = mat(0x1c2225, .7, .15);
  const metal = mat(0x6e7474, .35, .5);
  const pGroup = new THREE.Group();
  pGroup.position.set(-.72, 1.22, 2.22);
  pGroup.add(box(.34, .08, .5, base, 0, 0, 0));
  pGroup.add(box(.08, .08, .32, metal, 0, .02, -.15));
  const pLever = new THREE.Group();
  pLever.position.set(0, .03, 0);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(.025, .03, .55, 8), metal);
  rod.position.set(0, .28, .05);
  rod.rotation.x = -.25;
  pLever.add(rod);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(.09, 10, 8), mat(0x9d2922, .5, .1));
  knob.position.set(0, .55, .14);
  pLever.add(knob);
  pLever.userData.action = 'powerLever';
  pLever.userData.label = '主控制器 0–8 级';
  pGroup.add(pLever);
  root.add(pGroup);
  clickables.push(knob);
  knob.userData.action = 'powerLever';
  knob.userData.label = '主控制器 0–8 级';
  window.__powerHandle = pLever;

  const bGroup = new THREE.Group();
  bGroup.position.set(.72, 1.22, 2.2);
  bGroup.add(box(.34, .08, .5, base, 0, 0, 0));
  const bLever = new THREE.Group();
  bLever.position.set(0, .04, 0);
  const brod = new THREE.Mesh(new THREE.CylinderGeometry(.025, .03, .5, 8), metal);
  brod.position.set(0, .25, .02);
  brod.rotation.x = .08;
  bLever.add(brod);
  const bknob = new THREE.Mesh(new THREE.SphereGeometry(.09, 10, 8), mat(0x1d2224, .5, .1));
  bknob.position.set(0, .5, .05);
  bLever.add(bknob);
  bGroup.add(bLever);
  root.add(bGroup);
  clickables.push(bknob);
  bknob.userData.action = 'brakeLever';
  bknob.userData.label = '制动阀 0–5 级';
  window.__brakeHandle = bLever;
}

function drawScreens() {
  const s0 = screenTextures[0];
  const ctx = s0.canvas.getContext('2d');
  const w = s0.canvas.width, h = s0.canvas.height;
  ctx.fillStyle = '#050a0b'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#12201f'; ctx.fillRect(10, 10, w - 20, h - 20);
  ctx.fillStyle = '#8caaa4'; ctx.font = '16px ui-monospace,monospace';
  ctx.fillText('HXD3D  LOCO DATA', 26, 38);
  ctx.fillStyle = '#d7e6de'; ctx.font = '600 58px ui-monospace,monospace';
  ctx.fillText(`${Math.round(state.speed)}`, 26, 112);
  ctx.fillStyle = '#6d8d84'; ctx.font = '14px ui-monospace,monospace'; ctx.fillText('km/h', 132, 108);
  const nw = (w - 60) / 8;
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = i < state.notch ? '#c28c45' : '#1c2b29';
    ctx.fillRect(26 + i * nw, 142, nw - 4, 16);
  }
  ctx.fillStyle = '#6d8d84'; ctx.font = '13px ui-monospace,monospace';
  ctx.fillText(`NOTCH ${state.notch}`, 26, 182);
  ctx.fillText(`BP ${Math.round(state.bp)}  MR ${Math.round(state.mr)}`, 26, 210);
  ctx.fillText(`DIR ${state.direction}   ${state.main ? 'MAIN ON' : 'MAIN OFF'}`, 26, 238);
  ctx.fillStyle = state.main ? '#77c794' : '#bd5a48';
  ctx.fillText(`Panto ${state.panto ? 'UP' : 'DOWN'}`, 26, 266);
  ctx.fillStyle = '#6d8d84'; ctx.font = '13px ui-monospace,monospace';
  ctx.fillText(`${Math.floor(state.time / 60).toString().padStart(2, '0')}:${Math.floor(state.time % 60).toString().padStart(2, '0')}`, 26, 296);
  s0.tex.needsUpdate = true;

  const s1 = screenTextures[1];
  const c1 = s1.canvas.getContext('2d');
  const w1 = s1.canvas.width, h1 = s1.canvas.height;
  c1.fillStyle = '#06090a'; c1.fillRect(0, 0, w1, h1);
  c1.fillStyle = '#16201f'; c1.fillRect(8, 8, w1 - 16, h1 - 16);
  c1.fillStyle = '#9db0a9'; c1.font = '15px ui-monospace,monospace'; c1.fillText('NINGXI LINE  /  Z595', 20, 32);
  c1.strokeStyle = '#3d5a50'; c1.lineWidth = 2;
  c1.beginPath(); c1.moveTo(24, 96); c1.lineTo(w1 - 24, 96); c1.stroke();
  const frac = Math.min(1, state.distance / 616);
  for (let i = 0; i < STATIONS.length; i++) {
    const x = 24 + (w1 - 48) * STATIONS[i].km / 616;
    c1.fillStyle = i < STATIONS.findIndex(s => s.km >= state.distance) ? '#4b7b63' : '#2a3533';
    c1.beginPath(); c1.arc(x, 96, 7, 0, Math.PI * 2); c1.fill();
    c1.fillStyle = '#5e6e68'; c1.font = '11px "Noto Sans SC",sans-serif'; c1.textAlign = 'center';
    c1.fillText(STATIONS[i].name, x, 124);
  }
  c1.fillStyle = '#e1c681'; c1.beginPath(); c1.arc(24 + (w1 - 48) * frac, 96, 9, 0, Math.PI * 2); c1.fill();
  c1.fillStyle = '#b6c1b9'; c1.font = '14px ui-monospace,monospace'; c1.textAlign = 'left';
  c1.fillText(`KM ${Math.round(state.distance)} / 616`, 20, 168);
  c1.fillText(`NEXT ${nextStation().name}`, 20, 194);
  c1.fillStyle = '#73827a'; c1.font = '13px "Noto Sans SC",sans-serif';
  c1.fillText('信阳 → 桐柏 → 南阳 → 西峡 → 商洛 → 西安', 20, 226);
  c1.fillStyle = '#43534b'; c1.font = '12px ui-monospace,monospace';
  c1.fillText('SIGNAL  GREEN   ATP   ACTIVE', 20, 260);
  s1.tex.needsUpdate = true;

  const s2 = screenTextures[2];
  const c2 = s2.canvas.getContext('2d');
  const w2 = s2.canvas.width, h2 = s2.canvas.height;
  c2.fillStyle = '#070c0d'; c2.fillRect(0, 0, w2, h2);
  c2.fillStyle = '#111c1d'; c2.fillRect(10, 10, w2 - 20, h2 - 20);
  c2.fillStyle = '#c2b28c'; c2.font = '600 19px "Noto Sans SC",sans-serif'; c2.fillText('Z595  时刻表', 24, 40);
  c2.fillStyle = '#71847e'; c2.font = '13px ui-monospace,monospace'; c2.fillText('ARR / DEP', 24, 66);
  const rows = [
    ['信阳', '20:46', '20:52'],
    ['桐柏', '21:56', '22:00'],
    ['西安', '04:33', '04:52']
  ];
  for (let i = 0; i < rows.length; i++) {
    const y = 106 + i * 48;
    c2.fillStyle = i === 0 ? '#d3c39a' : '#8d9e96';
    c2.font = '18px "Noto Sans SC",sans-serif';
    c2.fillText(rows[i][0], 24, y);
    c2.font = '15px ui-monospace,monospace';
    c2.fillText(`${rows[i][1]} / ${rows[i][2]}`, 118, y);
  }
  c2.fillStyle = '#68756d'; c2.font = '12px "Noto Sans SC",sans-serif';
  c2.fillText('南阳 / 镇平 / 内乡 / 西峡 / 商南 / 丹凤 / 商洛 / 渭南 通过', 24, 258);
  c2.fillText('HXD3D + 25T 18 辆 · 宁西线', 24, 282);
  s2.tex.needsUpdate = true;
}

function drawGauge() {
  const ctx = gaugeCanvas.getContext('2d');
  const w = gaugeCanvas.width, h = gaugeCanvas.height;
  ctx.fillStyle = '#070b0c'; ctx.fillRect(0, 0, w, h);
  ctx.save(); ctx.translate(w / 2, h / 2);
  ctx.strokeStyle = '#465552'; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.arc(0, 0, 202, 0, Math.PI * 2); ctx.stroke();
  const a0 = Math.PI * .78, a1 = Math.PI * 2.22;
  ctx.strokeStyle = '#243331'; ctx.lineWidth = 16;
  ctx.beginPath(); ctx.arc(0, 0, 185, a0, a1); ctx.stroke();
  ctx.fillStyle = '#b7b39c'; ctx.font = '600 46px ui-monospace,monospace'; ctx.textAlign = 'center';
  ctx.fillText(Math.round(state.speed), 0, 40);
  ctx.fillStyle = '#777f71'; ctx.font = '16px ui-monospace,monospace'; ctx.fillText('km/h', 0, 72);
  for (let i = 0; i <= 8; i++) {
    const a = a0 + (a1 - a0) * i / 8;
    ctx.strokeStyle = i <= state.notch ? '#c8a15b' : '#53615a';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(Math.cos(a) * 160, Math.sin(a) * 160); ctx.lineTo(Math.cos(a) * 184, Math.sin(a) * 184); ctx.stroke();
  }
  ctx.restore();
  gaugeTex.needsUpdate = true;
}

function nextStation() {
  return STATIONS.find(s => s.km > state.distance + 1) || STATIONS[STATIONS.length - 1];
}

function setNote(text) {
  const el = document.getElementById('note');
  el.textContent = text;
  el.style.display = 'block';
  clearTimeout(setNote.t);
  setNote.t = setTimeout(() => el.style.display = 'none', 2100);
}

function doAction(id) {
  if (id === 'powerLever') {
    state.notch = (state.notch + 1) % 9;
    if (state.notch > 0 && state.direction === 'N') state.direction = 'F';
    return;
  }
  if (id === 'brakeLever') {
    state.brake = (state.brake + 1) % 6;
    return;
  }
  if (id === 'pantoUp') {
    if (!state.control) return setNote('控制电源未合，受电弓无控制电');
    state.panto = true; state.main = false; return setNote('受电弓升起，主断已分');
  }
  if (id === 'pantoDown') {
    state.panto = false; state.main = false; return setNote('受电弓降下，主断已分');
  }
  if (id === 'mainOn') {
    if (!state.panto) return setNote('受电弓未升，主断不能闭合');
    state.main = true; return setNote('主断路器闭合');
  }
  if (id === 'mainOff') { state.main = false; return setNote('主断路器分断'); }
  if (id === 'controlOn') {
    state.control = !state.control;
    if (!state.control) { state.main = false; state.panto = false; state.head = false; }
    return setNote(state.control ? '控制电源已合' : '控制电源已断');
  }
  if (id === 'compOn') { state.compressor = !state.compressor; return; }
  if (id === 'ventOn') { state.vent = !state.vent; return; }
  if (id === 'auxOn') { state.aux = !state.aux; return; }
  if (id === 'headOn') { state.head = !state.head; return; }
  if (id === 'markerOn') { state.marker = !state.marker; return; }
  if (id === 'cabLamp') {
    state.cabLamp = !state.cabLamp;
    cabLight.intensity = state.cabLamp ? 1.5 : .25;
    return;
  }
  if (id === 'wiperOn') {
    state.wiper = !state.wiper;
    if (window.__wiper) window.__wiper.visible = state.wiper;
    return;
  }
  if (id === 'sanderOn') { state.sander = !state.sander; return setNote(state.sander ? '撒砂开' : '撒砂关'); }
  if (id === 'cruiseOn') { state.cruise = !state.cruise; return; }
  if (id === 'atpOn') { state.atp = !state.atp; return; }
  if (id === 'radioOn') { state.radio = !state.radio; return; }
  if (id === 'ack') { state.alarm = ''; return setNote('报警已确认'); }
  if (id === 'fireOn') { state.fire = !state.fire; return; }
  if (id === 'isolateOn') { state.isolate = !state.isolate; return setNote(state.isolate ? '故障隔离投入' : '故障隔离切除'); }
  if (id === 'heatOn') { state.heat = !state.heat; return; }
  if (id === 'acOn') { state.ac = !state.ac; return; }
  if (id === 'fanOn') { state.fan = !state.fan; return; }
  if (id === 'rearOn') { state.rear = !state.rear; return; }
  if (id.startsWith('spare')) { return setNote('备用按钮 · 未接线'); }
}

function refreshLeds() {
  for (const id in buttons) {
    const b = buttons[id];
    const led = b.userData.led;
    if (!led) continue;
    led.material.color.set(buttonState(id) ? 0x57c47a : 0x2b302e);
  }
  document.getElementById('spd').textContent = Math.round(state.speed);
  document.getElementById('notchTxt').textContent = state.notch;
  document.getElementById('brakeTxt').textContent = state.brake;
  document.getElementById('bp').textContent = Math.round(state.bp);
  document.getElementById('mr').textContent = Math.round(state.mr);
  const st = nextStation();
  document.getElementById('nextSt').textContent = st.name;
  document.getElementById('eta').textContent = st.arr ? `${st.arr} 到 / ${st.dep} 发` : '通过';
  const pb = document.getElementById('pwrBar');
  pb.innerHTML = '';
  for (let i = 0; i < 8; i++) {
    const s = document.createElement('span');
    if (i < state.notch) s.className = 'on';
    pb.appendChild(s);
  }
  const bb = document.getElementById('brkBar');
  bb.innerHTML = '';
  for (let i = 0; i < 5; i++) {
    const s = document.createElement('span');
    if (i < state.brake) s.className = 'on';
    bb.appendChild(s);
  }
}

function updatePhysics(dt) {
  const emergency = state.brake >= 5;
  const targetBp = emergency ? 0 : 500 - state.brake * 45;
  state.bp += (targetBp - state.bp) * Math.min(1, dt * 2.2);
  if (state.compressor) state.mr += (900 - state.mr) * Math.min(1, dt * .5);
  else state.mr -= dt * .3;
  const canPull = state.panto && state.main && state.control && !state.isolate && state.brake === 0 && state.direction !== 'N';
  const tract = canPull ? state.notch * 1.55 : 0;
  const resistance = .9 + state.speed * .011;
  let acc = tract - resistance;
  if (state.brake > 0) acc -= state.brake * 3.2;
  if (emergency) acc -= 9;
  if (state.speed <= 0 && acc < 0) acc = 0;
  state.speed += acc * dt;
  if (state.speed < 0) state.speed = 0;
  if (state.speed > 160) {
    state.speed = 160;
    state.alarm = '超速';
  }
  if (state.speed > 0) state.distance += state.speed * dt * state.timeScale / 3600;
  if (state.distance > 616) state.distance = 616;
  state.time += dt * state.timeScale / 60 * 2;
  if (state.time > 1440) state.time -= 1440;
  if (state.atp && state.speed > 148 && state.speed <= 160) state.alarm = '接近限速';
  if (state.notch > 0 && !canPull) state.alarm = '牵引封锁';
  if (Math.abs(state.speed) < .2 && state.brake >= 1) state.speed = 0;
  document.getElementById('pwrBar').style.opacity = state.main ? 1 : .45;
}

function updateClockUI() {
  const h = Math.floor(state.time / 60) % 24;
  const m = Math.floor(state.time % 60);
  document.querySelector('.train-sub').textContent = `宁西线 · 信阳 → 西安 · ${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  refreshLeds();
}

function updateTrain(dt) {
  const t = Math.min(1, state.distance / 616);
  const p = routeCurve.getPointAt(t);
  const tan = routeCurve.getTangentAt(t).normalize();
  trainGroup.position.copy(p);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), tan);
  trainGroup.quaternion.copy(q);
  trainPoint = t;
}

function placeCamera() {
  if (!trainGroup) return;
  const q = trainGroup.quaternion;
  if (state.cabMode && state.view === 'desk') {
    const local = new THREE.Vector3(0, 1.58, .42);
    const target = new THREE.Vector3(0, 1.28, 2.72);
    const m = new THREE.Matrix4().lookAt(local, target, new THREE.Vector3(0, 1, 0));
    camera.position.copy(local.applyQuaternion(q)).add(trainGroup.position);
    camera.quaternion.copy(q).multiply(new THREE.Quaternion().setFromRotationMatrix(m));
    camera.fov = 74;
  } else if (state.cabMode) {
    const local = new THREE.Vector3(0, 1.7, -.28).applyQuaternion(q);
    camera.position.copy(trainGroup.position).add(local);
    const look = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
    camera.quaternion.copy(q).multiply(look);
    camera.fov = 70;
  } else {
    const local = new THREE.Vector3(-18, 20, -55).applyQuaternion(q);
    camera.position.copy(trainGroup.position).add(local);
    camera.lookAt(trainGroup.position.clone().add(new THREE.Vector3(0, 4, 12).applyQuaternion(q)));
    camera.fov = 54;
  }
  camera.updateProjectionMatrix();
  cabGroup.visible = state.cabMode;
  extGroup.visible = !state.cabMode;
}

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let hovered = null;
let dragging = null;
let lastY = 0;

function pick(x, y) {
  pointer.x = (x / innerWidth) * 2 - 1;
  pointer.y = -(y / innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(clickables, false);
  return hits[0] ? hits[0].object : null;
}

renderer.domElement.addEventListener('pointermove', e => {
  if (state.cabMode) {
    const hit = pick(e.clientX, e.clientY);
    if (hit) {
      document.getElementById('tooltip').style.display = 'block';
      document.getElementById('tooltip').textContent = hit.userData.label || '';
      document.getElementById('tooltip').style.left = `${e.clientX + 12}px`;
      document.getElementById('tooltip').style.top = `${e.clientY - 16}px`;
      renderer.domElement.style.cursor = 'pointer';
    } else {
      document.getElementById('tooltip').style.display = 'none';
      renderer.domElement.style.cursor = 'grab';
    }
  }
  if (dragging === 'powerLever') {
    const dy = lastY - e.clientY;
    state.notch = Math.max(0, Math.min(8, state.notch + Math.round(dy / 12)));
    lastY = e.clientY;
  }
  if (dragging === 'brakeLever') {
    const dy = e.clientY - lastY;
    state.brake = Math.max(0, Math.min(5, state.brake + Math.round(dy / 14)));
    lastY = e.clientY;
  }
});

renderer.domElement.addEventListener('pointerdown', e => {
  if (!state.cabMode) return;
  const hit = pick(e.clientX, e.clientY);
  if (!hit) return;
  const a = hit.userData.action;
  if (a === 'powerLever' || a === 'brakeLever') {
    dragging = a; lastY = e.clientY;
    return;
  }
  doAction(a);
  refreshLeds();
});

addEventListener('pointerup', () => { dragging = null; });

addEventListener('keydown', e => {
  if (e.code === 'ArrowUp' || e.code === 'KeyW') { state.notch = Math.min(8, state.notch + 1); }
  if (e.code === 'ArrowDown' || e.code === 'KeyS') { state.notch = Math.max(0, state.notch - 1); }
  if (e.code === 'KeyA') { state.brake = Math.min(5, state.brake + 1); }
  if (e.code === 'KeyD') { state.brake = Math.max(0, state.brake - 1); }
  if (e.code === 'Space') { e.preventDefault(); horn(); }
  if (e.code === 'KeyC') { state.cabMode = !state.cabMode; document.getElementById('cabBtn').classList.toggle('on', state.cabMode); document.getElementById('extBtn').classList.toggle('on', !state.cabMode); }
  if (e.code === 'KeyR') { state.direction = state.direction === 'F' ? 'R' : 'F'; setNote(`方向 ${state.direction}`); }
});

document.getElementById('cabBtn').onclick = () => {
  state.cabMode = true; state.view = 'cab'; state.view = 'cab';
  document.getElementById('cabBtn').classList.add('on');
  document.getElementById('deskBtn').classList.remove('on');
  document.getElementById('extBtn').classList.remove('on');
};
document.getElementById('deskBtn').onclick = () => {
  state.cabMode = true; state.view = 'desk';
  document.getElementById('deskBtn').classList.add('on');
  document.getElementById('cabBtn').classList.remove('on');
  document.getElementById('extBtn').classList.remove('on');
};
document.getElementById('deskBtn').onclick = () => {
  state.cabMode = true; state.view = 'desk';
  document.getElementById('deskBtn').classList.add('on');
  document.getElementById('cabBtn').classList.remove('on');
  document.getElementById('extBtn').classList.remove('on');
};
document.getElementById('extBtn').onclick = () => {
  state.cabMode = false;
  document.getElementById('extBtn').classList.add('on');
  document.getElementById('deskBtn').classList.remove('on');
  document.getElementById('cabBtn').classList.remove('on');
};
document.getElementById('hornBtn').onclick = horn;
document.getElementById('exitBtn').onclick = () => { location.href = '../index.html'; };
document.getElementById('pwrUp').onclick = () => { state.notch = Math.min(8, state.notch + 1); refreshLeds(); };
document.getElementById('pwrDown').onclick = () => { state.notch = Math.max(0, state.notch - 1); refreshLeds(); };
document.getElementById('brkUp').onclick = () => { state.brake = Math.min(5, state.brake + 1); refreshLeds(); };
document.getElementById('brkDown').onclick = () => { state.brake = Math.max(0, state.brake - 1); refreshLeds(); };
document.getElementById('relBtn').onclick = () => { state.brake = 0; state.notch = 0; refreshLeds(); };

let audioCtx = null;
function horn() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const t0 = audioCtx.currentTime;
    for (const f of [196, 294, 392]) {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = 'sawtooth'; o.frequency.value = f;
      g.gain.setValueAtTime(.0001, t0);
      g.gain.exponentialRampToValueAtTime(.14, t0 + .05);
      g.gain.setValueAtTime(.14, t0 + .55);
      g.gain.exponentialRampToValueAtTime(.0001, t0 + .9);
      o.connect(g).connect(audioCtx.destination);
      o.start(t0); o.stop(t0 + .92);
    }
  } catch (e) {}
  setNote('鸣笛');
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(.05, clock.getDelta());
  updatePhysics(dt);
  updateTrain(dt);
  placeCamera();
  if (trainGroup && sky) sky.position.copy(trainGroup.position);
  if (trainGroup && sun) { sun.position.copy(trainGroup.position).add(new THREE.Vector3(-420, 620, 380)); sun.target.position.copy(trainGroup.position); sun.target.updateMatrixWorld(); }
  drawScreens();
  drawGauge();
  updateClockUI();
  if (window.__powerHandle) window.__powerHandle.rotation.x = -state.notch * .055;
  if (window.__brakeHandle) window.__brakeHandle.rotation.x = state.brake * .045;
  renderer.render(scene, camera);
}

buildRoute();
buildTrain();
extGroup.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
cabGroup.traverse(o => { if (o.isMesh) { o.receiveShadow = true; } });

updateTrain(0);
placeCamera();
refreshLeds();
drawScreens();
drawGauge();
document.getElementById('loading').classList.add('hidden');
animate();

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

window.__dbg = () => ({
  speed: state.speed, notch: state.notch, brake: state.brake, km: state.distance,
  bp: state.bp, main: state.main, panto: state.panto, cabMode: state.cabMode,
  next: nextStation().name, buttons: Object.keys(buttons).length
});
window.__set = (n) => { state.notch = n; refreshLeds(); };
window.__brake = (n) => { state.brake = n; refreshLeds(); };
window.__cam = () => { state.cabMode = !state.cabMode; };
window.__jump = (km) => { state.distance = Math.max(0, Math.min(616, km)); updateTrain(0); };
window.__run = (sec) => { for (let i = 0; i < sec * 20; i++) { updatePhysics(1 / 20); updateTrain(1 / 20); } };
