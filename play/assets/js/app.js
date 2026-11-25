import { el, on, fmtClock, toast, storage, clamp, escapeHtml } from './util.js';
import { initWM, createWindow, getWin } from './wm.js';
import { sim, MODES, REALISM_DEFAULT } from './sim.js';
import { CTCView } from './ctc.js?v=0.6.19c';
import { GraphView } from './graph.js';
import { AudioEngine, trackForScene, TRACK_NAMES } from './audio.js';
import { buildCommandPanel, buildRadioPanel, prefillCommand } from './cmd.js';
import { buildOrderLogPanel } from './orders.js';
import { mountPacks, enabledPackScenes } from './packs.js';
import { mountTutorial } from './tutorial.js';
import { mountOps } from './ops.js';
import { mountAdmin } from './admin.js';
import { mountDLC, dlcOn, dlcScenes } from './dlc.js';
import { runBalance } from './balance.js';
import { mountEmu } from './emu.js';
import { mountPort } from './port.js';
import { mountYard } from './yard.js';
import { applyMechanics } from './mechanic.js';
import { mountBureau } from './bureau.js';
import { expandEvents } from './event-expand.js';
import { applyLedger, dailyReport, bankruptcyRisk } from './economy.js';
import { tickBuilds } from './upgrades.js';
import { tickContracts, refreshOffers } from './contracts.js';
import { recordChoice, dueConsequences } from './consequences.js';
import { applyTraffic } from './traffic.js';
import { choosePolicy, activePolicies, POLICIES } from './review.js';
import { applySettings, loadProfile, profile, rankOf, settleShift, exportArchive, importArchive, dailyChallenge } from './profile.js';
import { parseSceneFile, packageScene, migrateScene, validateScene } from './schema.js';
import { loadCareer, settleCareer, career } from './career.js';
import { rollMods, activeMod, setMod } from './mods.js';
import {
  buildAlarmPanel, buildEventPanel, buildTrainsPanel,
  buildScorePanel, buildGlossaryPanel, termShow,
} from './panels.js';
import {
  buildSandboxPanel, buildHelpPanel,
  buildInspectPanel, showReview, sandboxState,
} from './panels2.js';

const audio = new AudioEngine();
let data = null;
let currentScene = null;
let currentMode = 'standard';
let currentDifficulty = storage('tst-dispatch-difficulty') || 'standard';
let currentTT = storage('tst-dispatch-tt') || 'old';
let realism = { ...REALISM_DEFAULT };
let currentPack = 'base';
let currentGameMode = storage('tst-dispatch-game-mode') || '';
const PACK_BASE = 'https://severuszx.github.io/dispatch/data/packs/';
let baseScenarios = [];
const packCache = { jiaoliu: null, ningxi: null };
const packLoading = { jiaoliu: false, ningxi: false };
let views = {};
let inspectId = null;
let started = false;
let shiftSettled = false;
let pendingDay = null;
const isPad = new URLSearchParams(location.search).get('pad') === '1'
  || (/Android/i.test(navigator.userAgent) && !/Mobile/i.test(navigator.userAgent))
  || (window.matchMedia('(pointer: coarse)').matches && window.innerWidth >= 700);
if (isPad) document.body.classList.add('pad-mode');
loadProfile();
loadCareer();
applySettings();

const REALISM_ROWS = [
  ['autoRoute', '进路自动排列', '关闭后每条进路手动办理'],
  ['routeTimeout', '进路超时报警', '45 秒未确认即报警'],
  ['orderCheck', '命令校验', '号码、区间、时分错一项退回'],
  ['localControl', '非常站控', '车站接管，只能电话指挥'],
  ['phoneBlock', '电话闭塞', '降级闭塞，区间能力按路签办理'],
  ['crewLimit', '乘务超劳', '值乘超时强制换班'],
  ['stockChain', '车底接续', '晚点沿车底交路传播'],
  ['hotLimit', '热备限制', '热备车底用完为止'],
  ['weather', '天气与设备', '天气持续影响设备状态'],
  ['propagation', '晚点传播', '晚点按接续与区间关系传递'],
  ['reviewDetail', '复盘详细度', '记录到每个决策点'],
];

const TT_VERSIONS = [
  { id: 'old', name: '老版车次', code: 'BASE', desc: '沿用的示意时刻。车次少、停站长，适合同步熟悉流程。' },
  { id: 'new', name: '新版车次 · 2026-11 调图', code: '2026-11', desc: '车次加密、部分车次改号，停站压缩。仍为示意运行图，不代表官方时刻。' },
];

const DIFFICULTIES = [
  { id: 'easy', name: '见习', code: 'EASY', desc: '不弹术语，提示全用白话，事件间隔更长。' },
  { id: 'standard', name: '值班员', code: 'STD', desc: '术语弹一次白话解释，事件按正常节奏。' },
  { id: 'hard', name: '调度长', code: 'HARD', desc: '术语直接用专业口径，提示减少，事件更密。' },
  { id: 'expert', name: '总调度', code: 'EXP', desc: '不再解释术语，处置窗口更短，晚点传播更快。' },
];

function boot() {
  bindModeGate();
  document.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button, .pack-tab, .scene-cell, .mode-card, .act-tr, .diff-card, .tt-card')) {
      audio.sfx('click');
    }
  }, { passive: true });
  loadData().then(() => {
    buildBoot();
    bindBoot();
    applyBootMode();
  }).catch((e) => {
    document.getElementById('bootMeta').textContent = `数据加载失败：${e.message}`;
  });
}

function bindModeGate() {
  const gate = document.getElementById('modeGate');
  if (!gate) return;
  gate.querySelectorAll('.mg-card').forEach((card) => {
    card.addEventListener('click', () => pickGameMode(card.dataset.gm));
  });
}

function pickGameMode(mode) {
  if (mode === 'manage') {
    location.href = 'manage/index.html';
    return;
  }
  currentGameMode = 'dispatch';
  storage('tst-dispatch-game-mode', currentGameMode);
  document.body.dataset.gameMode = currentGameMode;
  document.getElementById('modeGate').classList.add('hidden');
  document.getElementById('boot').classList.remove('hidden');
  applyBootMode();
}

function applyBootMode() {
  const manage = currentGameMode === 'manage';
  const role = document.getElementById('bootRole');
  if (role) role.textContent = manage ? '四站经营 · 站长台' : '双线中间站 · 行车值班台';
  const nav = document.getElementById('bootNavLabel');
  if (nav) nav.textContent = manage ? '经营准备' : '值班准备';
  const title = document.getElementById('bootModeTitle');
  if (title) title.textContent = manage ? '站长台开班' : '开班准备';
  const desc = document.getElementById('bootModeDesc');
  if (desc) desc.textContent = manage ? '先选一个站进场，再看资产、人员和车流。班次照跑，目标是把四站养活。' : '先定值班强度、岗位和车次。开班后，本站接车、放行和处置都由你一人负责。';
  const label = document.getElementById('bootSummaryLabel');
  if (label) label.textContent = manage ? '本次经营' : '本次值班';
  const bsRole = document.getElementById('bsRole');
  if (bsRole) bsRole.textContent = manage ? '站长' : '值班员';
  const go = document.getElementById('bootGo');
  if (go) go.textContent = manage ? '进入站长台' : '开始值班';
  const tabs = document.getElementById('bootTabs');
  if (tabs) {
    tabs.querySelectorAll('button').forEach((b) => {
      if (b.dataset.btab === 'sandbox' || b.dataset.btab === 'realism') b.classList.toggle('hidden', manage);
    });
    if (manage) setBootTab('scene');
  }
}

async function loadData() {
  const [network, timetable, timetable2, events, glossary, scenarios, orders, hub, hubt1, hubdc, hubveh, hubmar, hubbaoji] = await Promise.all([
    fetchJson('data/network.json'), fetchJson('data/timetable.json'), fetchJson('data/timetable-v2.json'),
    fetchJson('data/events.json'),
    fetchJson('data/glossary.json'), fetchJson('data/scenarios.json'), fetchJson('data/orders.json'),
    fetchJson('data/hub.json'), fetchJson('data/hub-t1.json'), fetchJson('data/hub-dc.json'), fetchJson('data/hub-veh.json'), fetchJson('data/hub-mar.json'), fetchJson('data/hub-baoji.json'),
  ]);
  const packScenes = enabledPackScenes();
  if (events && Array.isArray(events.events)) {
    events.events = expandEvents(events.events);
    events.count = events.events.length;
  }
  baseScenarios = scenarios.concat(packScenes, dlcScenes());
  data = {
    network, timetable, timetable2, events, glossary,
    scenarios: baseScenarios.slice(),
    orders, hub, hubt1, hubdc, hubveh, hubmar, hubbaoji, hubjl: {}, hubnx: {},
  };
  sim.loadData(data);
  const meta = document.getElementById('bootMeta');
  if (meta) meta.textContent = '06:00 接班 · 附加线路包按需从云端载入';
}

async function loadCloudPack(id) {
  if (packCache[id] || packLoading[id]) return packCache[id];
  packLoading[id] = true;
  renderPackTabs();
  renderScenes();
  try {
    const res = await fetch(`${PACK_BASE}${id}.json`, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`云端资源包 ${id} ${res.status}`);
    const bundle = await res.json();
    packCache[id] = bundle;
    const target = id === 'jiaoliu' ? data.hubjl : data.hubnx;
    Object.assign(target, bundle.stations || {});
    const loadedScenes = Object.keys(packCache).filter((k) => packCache[k]).flatMap((k) => packCache[k].scenes || []);
    data.scenarios = baseScenarios.concat(loadedScenes);
    sim.loadData(data);
    toast(`${bundle.name || id} 已从云端载入`);
  } catch (e) {
    toast(`云端资源包下载失败：${e.message}`);
  } finally {
    packLoading[id] = false;
    renderPackTabs();
    renderScenes();
    const first = data.scenarios.find((s) => s.pack === id);
    if (first && currentPack === id) {
      currentScene = first;
      renderScenes();
    }
  }
  return packCache[id];
}

async function fetchJson(path) {
  const res = await fetch(path, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${path} ${res.status}`);
  return res.json();
}

function hubStationName(scene) {
  if (scene.stationName) return scene.stationName;
  const hubs = { bengbu: data.hub, dc: data.hubdc, veh: data.hubveh, mar: data.hubmar };
  const hub = hubs[scene.hub] || data.hub;
  return (hub && hub.station && hub.station.name) || '枢纽';
}

function updateProfileLabels() {
  const r = document.getElementById('bsRank');
  if (r) r.textContent = rankOf(profile.data.xp).name;
  const m = document.getElementById('bsMoney');
  if (m) m.textContent = `¥ ${profile.data.credits}`;
}

function buildBoot() {
  updateProfileLabels();
  const modeGrid = document.getElementById('modeGrid');
  MODES.forEach((m) => {
    const card = el('div', `mode-card ${m.id === currentMode ? 'on' : ''}`);
    const head = el('div', 'mc-head');
    head.append(el('b', '', m.name));
    card.append(head, el('p', '', m.desc));
    card.addEventListener('click', () => {
      currentMode = m.id;
      const want = m.id === 'arcade' ? 'tutorial' : m.id === 'story' ? 'story' : null;
      if (want && (!currentScene || currentScene.kind !== want)) {
        currentScene = data.scenarios.find((s) => s.kind === want) || currentScene;
      }
      modeGrid.querySelectorAll('.mode-card').forEach((x) => x.classList.remove('on'));
      card.classList.add('on');
      renderScenes();
    });
    modeGrid.append(card);
  });
  renderRealism();
  renderDifficulty();
  renderMods();
  renderTT();
  renderPackTabs();
  renderScenes();
  renderBootSandbox();
  renderSaves();
}

function renderRealism() {
  const list = document.getElementById('realismList');
  list.innerHTML = '';
  REALISM_ROWS.forEach(([key, name, desc]) => {
    const row = el('div', 'rl-row');
    row.title = desc;
    row.append(el('span', '', name));
    const range = el('input');
    range.type = 'range';
    range.min = '0';
    range.max = '3';
    range.value = String(realism[key] ?? 1);
    const rv = el('span', 'rv mono', String(range.value));
    range.addEventListener('input', () => { realism[key] = Number(range.value); rv.textContent = range.value; updateRealismLabel(); });
    row.append(range, rv);
    list.append(row);
  });
  updateRealismLabel();
}

function renderMods() {
  const list = document.getElementById('modList');
  if (!list) return;
  list.innerHTML = '';
  const day = new Date().toISOString().slice(0, 10);
  const options = [{ id: '', name: '常规班', tone: '', desc: '不加词条，按标准班运行' }, ...rollMods(day)];
  options.forEach((m) => {
    const card = el('div', `mod-card ${m.id === (activeMod() ? activeMod().id : '') ? 'on' : ''} ${m.tone || ''}`);
    const head = el('div', 'mod-name');
    head.append(el('b', '', m.name), el('span', 'mod-tone', m.tone === 'buff' ? '增益' : m.tone === 'debuff' ? '减益' : m.tone === 'risk' ? '风险' : '标准'));
    card.append(head, el('p', '', m.desc));
    card.addEventListener('click', () => {
      setMod(m.id);
      list.querySelectorAll('.mod-card').forEach((x) => x.classList.remove('on'));
      card.classList.add('on');
      const bs = document.getElementById('bsMod');
      if (bs) bs.textContent = m.name;
      toast(`本班词条：${m.name}`, 'ok');
    });
    list.append(card);
  });
  const cur = activeMod();
  const bs = document.getElementById('bsMod');
  if (bs) bs.textContent = cur ? cur.name : '常规班';
}

function renderDifficulty() {
  const list = document.getElementById('diffList');
  if (!list) return;
  list.innerHTML = '';
  DIFFICULTIES.forEach((d) => {
    const card = el('div', `diff-card ${d.id === currentDifficulty ? 'on' : ''}`);
    const head = el('div', 'dc-name');
    head.append(el('b', '', d.name));
    card.append(head, el('p', '', d.desc));
    card.addEventListener('click', () => {
      currentDifficulty = d.id;
      storage('tst-dispatch-difficulty', d.id);
      list.querySelectorAll('.diff-card').forEach((x) => x.classList.remove('on'));
      card.classList.add('on');
      const bs = document.getElementById('bsDiff');
      if (bs) bs.textContent = d.name;
    });
    list.append(card);
  });
  const bs = document.getElementById('bsDiff');
  if (bs) bs.textContent = (DIFFICULTIES.find((d) => d.id === currentDifficulty) || DIFFICULTIES[1]).name;
}

function renderTT() {
  const list = document.getElementById('ttList');
  if (!list) return;
  list.innerHTML = '';
  TT_VERSIONS.forEach((v) => {
    const card = el('div', `tt-card ${v.id === currentTT ? 'on' : ''}`);
    const head = el('div', 'tt-name');
    head.append(el('b', '', v.name));
    card.append(head, el('p', '', v.desc));
    card.addEventListener('click', () => {
      currentTT = v.id;
      storage('tst-dispatch-tt', v.id);
      list.querySelectorAll('.tt-card').forEach((x) => x.classList.remove('on'));
      card.classList.add('on');
      const bs = document.getElementById('bsTT');
      if (bs) bs.textContent = v.name;
    });
    list.append(card);
  });
  const bs = document.getElementById('bsTT');
  if (bs) bs.textContent = (TT_VERSIONS.find((v) => v.id === currentTT) || TT_VERSIONS[0]).name;
}

function updateRealismLabel() {
  const sum = Object.values(realism).reduce((a, b) => a + Number(b), 0);
  const avg = sum / REALISM_ROWS.length;
  const v = document.getElementById('realismVal');
  if (v) v.textContent = avg < 0.6 ? '街机' : avg < 1.4 ? '标准' : avg < 2.2 ? '偏拟真' : '拟真';
}

function renderPackTabs() {
  const box = document.getElementById('packTabs');
  if (!box) return;
  box.innerHTML = '';
  const counts = {
    base: data.scenarios.filter((s) => !s.pack).length,
    jiaoliu: packCache.jiaoliu ? (packCache.jiaoliu.scenes || []).length : 30,
    ningxi: packCache.ningxi ? (packCache.ningxi.scenes || []).length : 26,
  };
  const tabs = [
    ['base', `基础场景 ${counts.base}`],
    ['jiaoliu', packCache.jiaoliu ? `焦柳线全线 ${counts.jiaoliu}` : `焦柳线全线 · 云端 ${counts.jiaoliu}`],
    ['ningxi', packCache.ningxi ? `宁西线全线 ${counts.ningxi}` : `宁西线全线 · 云端 ${counts.ningxi}`],
  ];
  tabs.forEach(([id, label]) => {
    const b = el('button', `pack-tab ${currentPack === id ? 'on' : ''}`, label);
    b.type = 'button';
    b.addEventListener('click', () => {
      currentPack = id;
      renderPackTabs();
      renderScenes();
      if (id !== 'base' && !packCache[id] && !packLoading[id]) loadCloudPack(id);
    });
    box.append(b);
  });
}

function renderScenes() {
  const list = document.getElementById('sceneList');
  list.innerHTML = '';
  const kinds = { tutorial: '教学', story: '剧本', daily: '每日', sandbox: '自定', pack: '线路', hub: '枢纽' };
  let scenes = data.scenarios.slice();
  if (currentMode === 'story') scenes = scenes.filter((s) => s.kind === 'story');
  else if (currentMode === 'arcade') scenes = scenes.filter((s) => s.kind === 'tutorial');
  if (currentPack === 'base') scenes = scenes.filter((s) => !s.pack);
  else scenes = scenes.filter((s) => s.pack === currentPack);
  const head = el('div', 'scene-head');
  ['车站', '线路', '天气', '时长', '难度', '车次', '数据'].forEach((t) => head.append(el('span', '', t)));
  list.append(head);
  if (currentPack !== 'base' && !packCache[currentPack]) {
    const row = el('div', 'scene-remote');
    const name = currentPack === 'jiaoliu' ? '焦柳线全线' : '宁西线全线';
    row.append(el('b', '', packLoading[currentPack] ? `${name} 正在从云端下载` : `${name} 尚未下载`));
    row.append(el('span', '', packLoading[currentPack] ? '首次进入才拉取，下载后本次会话内复用。' : '资源包不在安装包里，点右侧按钮从官网拉取。'));
    if (!packLoading[currentPack]) {
      const btn = el('button', 'scene-dl', '从云端下载');
      btn.type = 'button';
      btn.addEventListener('click', () => loadCloudPack(currentPack));
      row.append(btn);
    }
    list.append(row);
    const detail = document.getElementById('sceneDetail');
    if (detail) detail.textContent = `${name}｜未下载｜点“从云端下载”后载入车站与车次`;
    return;
  }
  scenes.forEach((s) => {
    const cell = el('div', `scene-cell ${currentScene && currentScene.id === s.id ? 'on' : ''}`);
    const line = data.network.lines.find((l) => l.id === s.line);
    const lineName = s.stationName || (s.kind === 'hub' ? hubStationName(s) : (line ? line.name : s.line));
    const lineList = s.lines && s.lines.length ? s.lines.join('、') : lineName;
    cell.append(el('b', 'sc-name', s.title));
    cell.append(el('span', 'sc-line', lineList));
    cell.append(el('span', 'sc-wx', s.weather || '晴'));
    cell.append(el('span', 'sc-time', `${Math.round(s.duration / 60 * 10) / 10}h`));
    cell.append(el('span', 'sc-diff', `${s.difficulty}`));
    cell.append(el('span', 'sc-trains', `${s.trains} 列`));
    cell.append(el('span', 'sc-src', s.special ? '混合车种' : s.source ? '12306' : (kinds[s.kind] || s.kind)));
    cell.addEventListener('click', () => {
      currentScene = s;
      list.querySelectorAll('.scene-cell').forEach((x) => x.classList.remove('on'));
      cell.classList.add('on');
      renderSceneDetail();
    });
    list.append(cell);
  });
  if (!currentScene) currentScene = scenes[0];
  renderSceneDetail();
}

function renderSceneDetail() {
  const box = document.getElementById('sceneDetail');
  if (!box || !currentScene) return;
  const line = data.network.lines.find((l) => l.id === currentScene.line);
  const lineName = currentScene.stationName || (currentScene.kind === 'hub' ? hubStationName(currentScene) : (line ? line.name : currentScene.line));
  box.textContent = `${currentScene.title}｜${lineName}｜${currentScene.brief}`;
  const bsStation = document.getElementById('bsStation');
  const bsTask = document.getElementById('bsTask');
  const side = document.getElementById('sceneDetailSide');
  if (bsStation) bsStation.textContent = lineName;
  if (bsTask) bsTask.textContent = currentScene.title;
  if (side) side.textContent = `${currentGameMode === 'manage' ? '经营管理' : '单站值班'} · 车次 ${currentScene.trains} 列 · 计划 ${Math.round(currentScene.duration / 60 * 10) / 10} 小时`;
}

function renderBootSandbox() {
  const wrap = document.getElementById('sandboxWrap');
  wrap.innerHTML = '';
  const state = sandboxState();
  Object.entries(groupBy(state)).forEach(([g, items]) => {
    const box = el('div', 'sb-group');
    box.append(el('h4', '', g));
    items.forEach(([key, val]) => {
      const row = el('label', 'sb-row');
      const cb = el('input');
      cb.type = 'checkbox';
      cb.checked = val;
      cb.addEventListener('change', () => {
        const s = storage('tst-dispatch-sandbox') || {};
        s[key] = cb.checked;
        storage('tst-dispatch-sandbox', s);
      });
      row.append(el('span', '', key.split(':')[1]), cb);
      box.append(row);
    });
    wrap.append(box);
  });
  function groupBy(st) {
    const out = {};
    for (const [k, v] of Object.entries(st)) {
      const g = k.split(':')[0];
      (out[g] = out[g] || []).push([k, v]);
    }
    return out;
  }
}

function renderSaves() {
  const list = document.getElementById('saveList');
  const saves = storage('tst-dispatch-saves') || [];
  list.innerHTML = '';
  if (!saves.length) { list.append(el('div', 'hint', '还没有存档。进入值班后点菜单里的“保存”。')); return; }
  saves.forEach((s, i) => {
    const row = el('div', 'save-item');
    row.append(el('span', '', `${s.name} · ${s.scene} · ${s.clock}`));
    const load = el('button', 'si-load', '载入');
    load.addEventListener('click', () => loadSave(i));
    row.append(load);
    list.append(row);
  });
}

function bindBoot() {
  const tabs = document.getElementById('bootTabs');
  tabs.querySelectorAll('button').forEach((b) => {
    b.addEventListener('click', () => {
      tabs.querySelectorAll('button').forEach((x) => x.classList.remove('on'));
      b.classList.add('on');
      document.querySelectorAll('.boot-pane').forEach((p) => p.classList.remove('on'));
      document.getElementById(`pane${b.dataset.btab[0].toUpperCase()}${b.dataset.btab.slice(1)}`).classList.add('on');
    });
  });
  document.getElementById('bootGo').addEventListener('click', () => startGame());
  const updateBtn = document.getElementById('bootUpdate');
  if (window.dispatchUpdate && updateBtn) {
    updateBtn.classList.remove('hidden');
    updateBtn.addEventListener('click', async () => {
      updateBtn.disabled = true;
      toast('正在检查更新');
      const r = await window.dispatchUpdate.check();
      updateBtn.disabled = false;
      if (r && r.state === 'dev') toast('开发环境不检查更新');
      else if (r && r.state === 'latest') toast(`已是最新版本 ${r.current}`);
      else if (r && r.state === 'error') toast(`检查失败：${r.error}`);
    });
  }
  document.getElementById('bootQuit').addEventListener('click', () => {
    document.getElementById('askLayer').classList.add('on');
    document.getElementById('askNo').focus();
  });
  document.getElementById('askNo').addEventListener('click', () => {
    document.getElementById('askLayer').classList.remove('on');
  });
  document.getElementById('askYes').addEventListener('click', () => {
    document.getElementById('askLayer').classList.remove('on');
    document.getElementById('boot').innerHTML = '<div class="quit-note">已退出，可以直接关闭窗口。</div>';
    window.close();
  });
  document.getElementById('askLayer').addEventListener('click', (e) => {
    if (e.target.id === 'askLayer') e.currentTarget.classList.remove('on');
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') document.getElementById('askLayer').classList.remove('on');
  });
  document.getElementById('wpExport').addEventListener('click', exportScene);
  const arch = document.getElementById('archLayer');
  const code = document.getElementById('archCode');
  const showArch = (text) => {
    code.value = text || '';
    arch.classList.add('on');
  };
  document.getElementById('archExport').addEventListener('click', async () => {
    const text = exportArchive();
    showArch(text);
    try { await navigator.clipboard.writeText(text); toast('存档码已生成并复制', 'ok'); } catch (e) { code.select(); toast('存档码已生成，请手动复制', 'warn'); }
  });
  document.getElementById('archImport').addEventListener('click', () => showArch(''));
  document.getElementById('archDoExport').addEventListener('click', async () => {
    const text = exportArchive();
    code.value = text;
    try { await navigator.clipboard.writeText(text); toast('已生成并复制', 'ok'); } catch (e) { code.select(); toast('请手动复制', 'warn'); }
  });
  document.getElementById('archDoImport').addEventListener('click', () => {
    try {
      const info = importArchive(code.value, true);
      toast(`已导入 ${info.saves} 个班次存档`, 'ok');
      arch.classList.remove('on');
      renderSaves();
      updateProfileLabels();
    } catch (e) { toast(`导入失败：${e.message}`, 'err'); }
  });
  document.getElementById('archClose').addEventListener('click', () => arch.classList.remove('on'));
  arch.addEventListener('click', (e) => { if (e.target === arch) arch.classList.remove('on'); });
  document.getElementById('wpImport').addEventListener('click', () => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.json';
    inp.addEventListener('change', () => importWorkshop(inp.files[0]));
    inp.click();
  });
  document.getElementById('wpOpen').addEventListener('click', () => {
    setBootTab('load');
    toast('工坊在游戏内的“创意工坊”窗口里，也可以直接导入 JSON。');
  });
  const saved = storage('tst-dispatch-scene');
  if (saved) currentScene = data.scenarios.find((s) => s.id === saved) || null;
  if (!currentScene) currentScene = data.scenarios.find((s) => s.kind === 'tutorial') || data.scenarios[0];
}

function setBootTab(name) {
  const btn = document.querySelector(`#bootTabs button[data-btab="${name}"]`);
  if (btn) btn.click();
}

function startGame(presetScene) {
  if (presetScene) currentScene = presetScene;
  if (currentGameMode === 'manage') {
    if (currentMode === 'arcade') currentMode = 'standard';
    if (currentScene && currentScene.kind === 'tutorial') {
      currentScene = data.scenarios.find((s) => s.kind === 'hub') || data.scenarios.find((s) => s.kind === 'story') || currentScene;
    }
  }
  if (currentMode === 'arcade' && currentScene && currentScene.kind !== 'tutorial') {
    currentScene = data.scenarios.find((s) => s.kind === 'tutorial') || currentScene;
  }
  if (!currentScene) { toast('先选一个场景', 'err'); return; }
  audio.resume();
  audio.play(trackForScene(currentScene, currentMode), {});
  document.getElementById('boot').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  document.body.dataset.gameMode = currentGameMode || 'dispatch';
  const role = document.getElementById('tbRole');
  if (role) role.textContent = currentGameMode === 'manage' ? '站长经营台' : '行车值班台';
  const stLabel = document.getElementById('tbStationLabel');
  if (stLabel) stLabel.textContent = currentGameMode === 'manage' ? '经营站' : '值班站';
  initDesk();
  sim.onTerm = (term) => {
    if (currentDifficulty === 'easy') return;
    termShow(term);
  };
  shiftSettled = false;
  sim.setup(currentScene, currentMode, realism, storage('tst-dispatch-sandbox') || {}, currentDifficulty, currentTT);
  applyTraffic(sim);
  applyMechanics(sim);
  sim.start();
  if (new URLSearchParams(location.search).get('debug') === '1') window.__sim = sim;
  buildWindows();
  if (currentScene.kind === 'tutorial') {
    mountTutorial(currentScene, data.glossary.terms, {
      difficulty: currentDifficulty,
      openPanel(id) { openWindow(id); },
      onDone() {},
    });
  }
  started = true;
  updateHud();
  sim.subscribe(() => updateHud());
  sim.subscribe((s, evt, arg) => {
    if (evt === 'finish') onFinish();
    if (evt === 'arrive' && arg) audio.trainArrive(arg);
    if (evt === 'depart' && arg) audio.trainDepart(arg);
    if (evt === 'event') {
      const inst = sim.activeEvents[0];
      if (inst && !modalInst) { showEventModal(inst); audio.announce(`${inst.title}。请处置。`); }
      audio.sfx('alarm');
    }
  });
  toast(`${currentScene.title} ${currentGameMode === 'manage' ? '进入站长台' : '开班'}。${currentScene.brief}`, 'ok');
  audio.announce(`${currentScene.title}，${currentGameMode === 'manage' ? '经营开始' : '开班'}。`);
}

function loadPackScene(scene) {
  currentScene = scene;
  sim.setup(currentScene, currentMode, realism, storage('tst-dispatch-sandbox') || {}, currentDifficulty, currentTT);
  applyTraffic(sim);
  applyMechanics(sim);
  sim.start();
  if (views.ctc) views.ctc.setSnapshot(sim.getSnapshot());
  if (views.graph) views.graph.setSnapshot(sim.getSnapshot());
  updateHud();
}

function initDesk() {
  if (views.deskInit) return;
  initWM(document.getElementById('desk'), document.getElementById('taskbar'));
  views.deskInit = true;
  bindTopbar();
  bindRail();
  bindKeys();
  bindEventModal();
  bindEventResult();
}

function bindRail() {
  document.querySelectorAll('.rail button[data-panel]').forEach((b) => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.rail button').forEach((x) => x.classList.remove('on'));
      b.classList.add('on');
      if (b.dataset.panel !== 'ctc') closeSide();
      openWindow(b.dataset.panel);
    });
  });
  on(document.getElementById('sideClose'), 'click', closeSide);
  on(document.getElementById('sideBoardBtn'), 'click', () => showNextBoard());
}

function bindEventModal() {
  on(document.getElementById('emLater'), 'click', () => {
    hideEventModal();
    resumeAfterModal();
  });
  on(document.getElementById('emBranches'), 'click', (e) => {
    const b = e.target.closest('button[data-branch]');
    if (!b) return;
    if (!modalInst) return;
    const inst = modalInst;
    const br = inst.branches.find((x) => x.id === b.dataset.branch);
    const res = sim.resolveEvent(inst.instId, b.dataset.branch);
    let cons = null;
    if (res && br) cons = recordChoice(inst, br, res);
    audio.sfx(res && res.fail ? 'fail' : 'ok');
    hideEventModal();
    if (res && br) {
      if (cons) res.note = `${res.note}\n${cons.due} 班后：${cons.title}，账上会多一笔 ${cons.money < 0 ? '支出' : '收入'}。`;
      showEventResult(inst, br, res);
    }
    else resumeAfterModal();
  });
}

function bindTopbar() {
  on(document.getElementById('btnNext'), 'click', () => showNextBoard());
  on(document.getElementById('btnPause'), 'click', () => togglePause());
  on(document.getElementById('btnSpeed'), 'click', () => cycleSpeed());
  on(document.getElementById('graphClose'), 'click', () => {
    getWin('graph')?.hide();
    document.querySelectorAll('.rail button').forEach((x) => x.classList.remove('on'));
    document.querySelector('.rail button[data-panel="ctc"]')?.classList.add('on');
  });
  on(document.getElementById('btnAudio'), 'click', (e) => {
    audioOn = !audioOn;
    audio.setEnabled(audioOn);
    e.currentTarget.classList.toggle('on', audioOn);
  });
  on(document.getElementById('btnMenu'), 'click', (e) => { e.stopPropagation(); toggleMenu(); });
  document.addEventListener('click', (e) => {
    const pop = document.getElementById('menuPop');
    if (!pop.classList.contains('hidden') && !e.target.closest('#menuPop') && !e.target.closest('#btnMenu')) pop.classList.add('hidden');
  });
}

let audioOn = true;

function togglePause() {
  sim.setPaused(!sim.paused);
  const b = document.getElementById('btnPause');
  b.textContent = sim.paused ? '继续' : '暂停';
  b.classList.toggle('on', sim.paused);
}

function cycleSpeed() {
  const next = sim.speed === 1 ? 2 : sim.speed === 2 ? 3 : 1;
  sim.setSpeed(next);
  document.getElementById('btnSpeed').textContent = `×${next}`;
}

function bindKeys() {
  window.addEventListener('keydown', (e) => {
    if (e.target.closest('input,textarea,select')) return;
    if (e.code === 'Space') { e.preventDefault(); togglePause(); }
    if (e.key === '1') openWindow('ctc');
    if (e.key === '2') openWindow('graph');
    if (e.key === '3') openWindow('trains');
    if (e.key === '4') openWindow('ops');
    if (e.key === '+' || e.key === '=') { sim.setSpeed(Math.min(3, sim.speed + 1)); document.getElementById('btnSpeed').textContent = `×${sim.speed}`; }
    if (e.key === '-') { sim.setSpeed(Math.max(1, sim.speed - 1)); document.getElementById('btnSpeed').textContent = `×${sim.speed}`; }
    if (e.key === 'Tab') {
      e.preventDefault();
      const list = sim.trains.filter((t) => t.status !== 'terminated');
      if (!list.length) return;
      const i = list.findIndex((t) => t.id === inspectId);
      openTrain(list[(i + 1) % list.length].id);
    }
    if (e.key === 'f' && sim.focusStation) {
      sim.toggleStationControl(sim.focusStation);
      toast(`${sim.focusStation} ${sim.isStationControlled(sim.focusStation) ? '已接管' : '已交回自动'}`);
    }
    if (e.key === 'Enter' && inspectId) {
      const t = sim.getTrain(inspectId);
      if (t && sim.releaseTrain(t.id)) toast(`${t.no} 已放行`, 'ok');
    }
    if (e.key === 'c') openWindow('cmd');
    if (e.key === 'e') openWindow('events');
    if (e.key === 'a') openWindow('alarms');
    if (e.key === 't') openWindow('gloss');
  });
}

const WIN_DEFS = [
  { id: 'ctc', code: 'CTC-1', title: '站场图', w: 0.58, h: 0.46, factory: mountCTC },
  { id: 'graph', code: 'GR-2', title: '运行图', w: 0.41, h: 0.46, factory: mountGraph },
  { id: 'alarms', code: 'AL-3', title: '信号报警', w: 0.24, h: 0.32, factory: (b) => buildAlarmPanel(b) },
  { id: 'events', code: 'EV-4', title: '事故与处置', w: 0.33, h: 0.32, factory: (b) => buildEventPanel(b) },
  { id: 'cmd', code: 'CM-5', title: '调度命令', w: 0.41, h: 0.32, factory: (b) => buildCommandPanel(b), skin: 'paper' },
  { id: 'trains', code: 'TR-6', title: '车次簿', w: 0.3, h: 0.3, factory: (b) => buildTrainsPanel(b, ctx()) },
  { id: 'score', code: 'SC-8', title: '评分复盘', w: 0.3, h: 0.34, factory: (b) => buildScorePanel(b, ctx()) },
  { id: 'gloss', code: 'GL-9', title: '术语图鉴', w: 0.32, h: 0.36, factory: (b) => buildGlossaryPanel(b), skin: 'paper' },
  { id: 'inspect', code: 'IN-10', title: '列车详情', w: 0.24, h: 0.3, factory: (b) => buildInspectPanel(b, ctx()) },
  { id: 'radio', code: 'RD-12', title: '调度电话', w: 0.26, h: 0.3, factory: (b) => buildRadioPanel(b) },
  { id: 'sandbox', code: 'SB-14', title: '沙盒开关', w: 0.34, h: 0.34, factory: (b) => buildSandboxPanel(b, ctx()), skin: 'paper' },
  { id: 'help', code: 'HP-16', title: '值班手册', w: 0.3, h: 0.34, factory: (b) => buildHelpPanel(b), skin: 'paper' },
  { id: 'orders', code: 'OD-17', title: '行车日志', w: 0.3, h: 0.34, factory: (b) => buildOrderLogPanel(b) },
  { id: 'packs', code: 'PK-18', title: '扩展包', w: 0.34, h: 0.42, factory: (b) => mountPacks(b, ctx()) },
  { id: 'ops', code: 'OP-20', title: '调度中心', w: 0.48, h: 0.62, factory: (b) => mountOps(b, ctx()) },
  { id: 'admin', code: 'AD-21', title: '经营', w: 0.72, h: 640, factory: (b) => mountAdmin(b, ctx()) },
  { id: 'bureau', code: 'BR-23', title: '区域调度中心', w: 0.8, h: 520, factory: (b) => mountBureau(b, ctx()) },
  { id: 'yard', code: 'YD-24', title: '编组站四场', w: 0.8, h: 540, factory: (b) => mountYard(b, ctx()) },
  { id: 'emu', code: 'EM-25', title: '动车所', w: 720, h: 500, factory: (b) => mountEmu(b) },
  { id: 'port', code: 'PT-26', title: '口岸站', w: 720, h: 520, factory: (b) => mountPort(b) },
  { id: 'dlc', code: 'DL-22', title: '资源附加包', w: 760, h: 620, factory: (b) => mountDLC(b, ctx()) },
];

function buildWindows() {
  openWindow(currentGameMode === 'manage' ? 'admin' : 'ctc');
  if (currentGameMode !== 'manage') showNextBoard();
}

function openTrain(id) {
  inspectId = id;
  document.getElementById('sideNext')?.classList.add('hidden');
  document.getElementById('sideBody')?.classList.remove('hidden');
  document.getElementById('sideBoardBtn')?.classList.remove('hidden');
  const t = sim.getTrain(id);
  openSide('inspect', t ? `行车凭证 · ${t.no}` : '行车凭证', 'ACT-1');
  if (views.inspectView) views.inspectView.update();
}

function hideDrawers(except) {
  document.querySelectorAll('.drawer-win').forEach((pane) => {
    if (pane.dataset.win !== except) pane.classList.add('hidden');
  });
}

function openWindow(id, pos) {
  if (id === 'bureau' && !dlcOn('bureau')) {
    toast('区域调度中心属于扩展包，先安装 e2', 'warn');
    id = 'dlc';
  }
  if (id === 'port' && !dlcOn('port')) {
    toast('口岸站属于扩展包，先安装 e4', 'warn');
    id = 'dlc';
  }
  if (id === 'emu' && !dlcOn('emu')) {
    toast('动车所属于扩展包，先安装 e3', 'warn');
    id = 'dlc';
  }
  if (id === 'yard' && !dlcOn('yard')) {
    toast('编组站属于扩展包，先安装 e1', 'warn');
    id = 'dlc';
  }
  if (id === 'graph') closeSide();
  else getWin('graph')?.hide();
  hideDrawers(id);
  const def = WIN_DEFS.find((d) => d.id === id);
  if (!def) return;
  const exist = getWin(id);
  if (exist) {
    exist.show();
    if (!views[`m_${id}`]) {
      views[`m_${id}`] = true;
      def.factory(exist.body);
    }
    return;
  }
  const win = createWindow({ id, code: def.code, title: def.title, skin: def.skin, onClose: () => {} });
  views[`m_${id}`] = true;
  def.factory(win.body);
  if (id === 'score') views.scoreWin = win;
}

function openSide(id, title, code) {
  getWin('graph')?.hide();
  document.getElementById('sideNext')?.classList.add('hidden');
  document.getElementById('sideBody')?.classList.remove('hidden');
  hideDrawers(null);
  const side = document.getElementById('side');
  const codeEl = document.getElementById('sideCode');
  if (codeEl) codeEl.textContent = code;
  document.getElementById('sideTitle').textContent = title;
  side.classList.remove('hidden');
  if (!views.inspectMounted && id === 'inspect') {
    views.inspectMounted = true;
    try {
      views.inspectView = buildInspectPanel(document.getElementById('sideBody'), ctx());
    } catch (err) {
      console.error('inspect mount failed', err);
      views.inspectMounted = false;
    }
  }
}

function closeSide() {
  document.getElementById('side').classList.add('hidden');
  document.getElementById('sideNext')?.classList.add('hidden');
  document.getElementById('sideBody')?.classList.remove('hidden');
}

function nextAction(t, clock) {
  if (!t || t.status === 'terminated' || t.status === 'running' || t.through) return null;
  if (t.status === 'approach' || t.status === 'pending') {
    return { kind: '接车', at: t.planArr ?? clock, note: t.trackNo ? `${t.trackNo} 道已预留` : '未定接车股道' };
  }
  if (t.status !== 'station') return null;
  const task = (t.tasks || []).find((x) => x.state !== 'done');
  if (task) return { kind: '作业', at: clock, note: `${task.title}${task.left ? ` · 剩 ${task.left} 分` : ''}` };
  if (t.hold || t.waitForNo) return { kind: '待避', at: clock, note: t.waitForNo ? `等 ${t.waitForNo} 出清` : '扣在站内未放行' };
  if (t.planDep != null && t.planDep <= clock + 20 && !t.release) {
    return { kind: '待发', at: t.planDep, note: `${t.trackNo || '—'} 道 · ${t.coaches ? `${t.coaches} 辆` : '待发'}` };
  }
  return null;
}

function nextItems() {
  if (!sim || !sim.trains) return [];
  const clock = sim.clock;
  const focus = sim.focusStation;
  return sim.trains
    .filter((t) => t.station === focus)
    .map((t) => {
      const act = nextAction(t, clock);
      return act ? { t, ...act, d: act.at - clock } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.d - b.d)
    .slice(0, 4);
}

function dueText(d) {
  const v = Math.round(Math.abs(d));
  if (d <= 0) return v ? `超 ${v} 分` : '现在';
  return `${v} 分后`;
}

function toneOf(d) {
  if (d <= 0) return 'now';
  if (d <= 3) return 'warn';
  return 'plan';
}

function renderNextBoard() {
  const box = document.getElementById('sideNext');
  if (!box || box.classList.contains('hidden')) return;
  const items = nextItems();
  const sig = items.map((x) => `${x.t.id}:${x.kind}:${x.at}:${x.note}`).join('|');
  if (box.dataset.sig === sig) return;
  box.dataset.sig = sig;
  if (!items.length) {
    box.innerHTML = '<div class="nx-empty"><b>当前没有要动手的车</b><span>下一班还有空档。可以看运行图，或者等下一列车进站。</span></div>';
    return;
  }
  const main = items[0];
  const rest = items.slice(1);
  const mtone = toneOf(main.d);
  box.innerHTML = `<div class="nx-head"><span class="mono">NEXT / ${fmtClock(sim.clock)}</span><b>${items.length} 项待办</b></div>
    <button class="nx-main ${mtone}" data-train="${main.t.id}">
      <div class="nx-line"><span class="nx-kind">${main.kind}</span><span class="nx-clock mono">${fmtClock(main.at)}</span><em>${dueText(main.d)}</em></div>
      <b class="nx-no">${escapeHtml(main.t.no)}</b>
      <div class="nx-note">${escapeHtml(main.note)}</div>
      <div class="nx-go">处理这班 <i>→</i></div>
    </button>
    <div class="nx-sub mono">接下来 20 分</div>
    ${rest.map((x) => `<button class="nx-row ${toneOf(x.d)}" data-train="${x.t.id}"><b>${escapeHtml(x.t.no)}</b><span>${x.kind}</span><time class="mono">${fmtClock(x.at)}</time><em>${dueText(x.d)}</em></button>`).join('')}`;
  box.querySelectorAll('[data-train]').forEach((b) => b.addEventListener('click', () => openTrain(b.dataset.train)));
  updateNextCount(items.length);
}

function updateNextCount(n) {
  const el = document.getElementById('tbNextCount');
  if (el) el.textContent = String(n);
  const btn = document.getElementById('btnNext');
  if (btn) btn.classList.toggle('urgent', n > 0);
}

function showNextBoard() {
  if (currentGameMode === 'manage') return;
  const side = document.getElementById('side');
  const next = document.getElementById('sideNext');
  const body = document.getElementById('sideBody');
  if (!side || !next || !body) return;
  side.classList.remove('hidden');
  next.classList.remove('hidden');
  body.classList.add('hidden');
  document.getElementById('sideTitle').textContent = '下一班';
  document.getElementById('sideBoardBtn').classList.add('hidden');
  next.dataset.sig = '';
  renderNextBoard();
}

function mountCTC(body) {
  const holder = el('div', 'ctc-holder');
  const canvas = el('canvas', 'ctc-canvas');
  holder.append(canvas);
  body.append(holder);
  const view = new CTCView(canvas, {
    onPick: (station, track) => {
      const candidates = sim.trains.filter((t) => t.station === station && (t.status === 'station' || t.status === 'waiting' || t.status === 'pending'));
      if (!candidates.length) { toast(`${sim.stations[station].name} ${track} 道：没有待接的列车`); return; }
      const t = candidates[0];
      if (sim.assignTrack(t.id, station, track)) toast(`${t.no} → ${sim.stations[station].name} ${track} 道`, 'ok');
      else toast(`${track} 道不可用`, 'err');
    },
    onInspect: (id) => { openTrain(id); },
  });
  views.ctc = view;
  if (location.search.includes('debug')) {
    window.__ctc = view;
    window.__sim = sim;
    window.__audio = audio;
    window.__balance = runBalance;
  }
  view.setSnapshot(sim.getSnapshot());
  sim.subscribe((s) => view.setSnapshot(s.getSnapshot()));
  const ro = new ResizeObserver(() => { view.resize(); view.draw(); });
  ro.observe(holder);
}

function mountGraph(body) {
  const holder = el('div', 'graph-holder');
  const canvas = el('canvas', 'graph-canvas');
  const bar = el('div', 'graph-tools');
  const edit = el('button', 'graph-tool', '编辑排点');
  const zoomIn = el('button', 'graph-tool', '＋');
  const zoomOut = el('button', 'graph-tool', '－');
  const conflict = el('span', 'graph-conflict mono', '');
  bar.append(edit, zoomOut, zoomIn, conflict);
  holder.append(canvas, bar);
  body.append(holder);
  const view = new GraphView(canvas, {
    onInspect: (id) => { openTrain(id); },
    onReschedule: (id, d) => { sim.rescheduleTrain(id, d); view.detect(); },
  });
  const refresh = () => {
    const n = view.conflicts.length;
    conflict.textContent = n ? `冲突 ${n}` : '无冲突';
    conflict.classList.toggle('bad', n > 0);
    edit.textContent = view.edit ? '退出编辑' : '编辑排点';
  };
  edit.addEventListener('click', () => { view.setEdit(!view.edit); refresh(); });
  zoomIn.addEventListener('click', () => { view.zoom(15); refresh(); });
  zoomOut.addEventListener('click', () => { view.zoom(-15); refresh(); });
  views.graph = view;
  view.setSnapshot(sim.getSnapshot());
  view.detect();
  refresh();
  sim.subscribe((s) => { view.setSnapshot(s.getSnapshot()); refresh(); });
  const ro = new ResizeObserver(() => { view.resize(); view.draw(); });
  ro.observe(holder);
}

function ctx() {
  return {
    inspect(id) { openTrain(id); },
    inspectId() { return inspectId; },
    openCommand(id) {
      prefillCommand(id);
      openWindow('cmd');
      setTimeout(() => prefillCommand(id), 60);
    },
    showGraph() { openWindow('graph'); },
    review() { openWindow('score'); showReview(views.scoreWin.body, ctx()); },
    closeReview() { views.scoreWin?.hide(); },
    restart() { restartScene(); views.scoreWin?.hide(); },
    sandboxChange(key, val) {
      if (key === 'L0:闭塞方式') sim.conditions.phoneBlock = !val;
      if (key === 'L6:命令校验') sim.realism.orderCheck = val ? 1 : 0;
      if (key === 'L6:自动进路') sim.realism.autoRoute = val ? 1 : 0;
    },
    loadWorkshop(w) { loadWorkshopScene(w); },
    exportScene() { exportScene(); },
    save() { saveGame(); },
    graph() { return views.graph || null; },
    sim,
    audio,
    adminRefresh() { views.m_admin && mountAdmin(getWin('admin').body, ctx()); },
    loadPack(scene) { loadPackScene(scene); },
    downloadExample() { downloadExample(); },
  };
}

function buildTaskbarExtras() {
  const bar = document.getElementById('taskbar');
  if (bar.dataset.extras) return;
  bar.dataset.extras = '1';
  const more = el('div', 'tb-item');
  more.append(el('span', 'dot'));
  more.append(document.createTextNode('更多窗口'));
  more.addEventListener('click', toggleMenu);
  bar.append(more);
}

function toggleMenu() {
  const pop = document.getElementById('menuPop');
  if (!pop.classList.contains('hidden')) { pop.classList.add('hidden'); return; }
  pop.innerHTML = '';
  const head = el('div', 'mp-head');
  head.append(el('span', '', '其它窗口'), el('span', 'mono', 'Esc'));
  pop.append(head);
  const grid = el('div', 'mp-grid');
  const menuIds = currentMode === 'sandbox' ? ['score', 'gloss', 'help', 'packs', 'sandbox'] : ['score', 'gloss', 'help', 'packs'];
  WIN_DEFS.filter((d) => menuIds.includes(d.id)).forEach((d) => {
    const b = el('button', '', d.title);
    b.addEventListener('click', () => { openWindow(d.id); pop.classList.add('hidden'); });
    grid.append(b);
  });
  pop.append(grid);
  const foot = el('div', 'mp-foot');
  const actions = [
    ['保存存档', saveGame],
    ['导出本场', exportScene],
    ['生成复盘', () => { openWindow('score'); showReview(views.scoreWin.body, ctx()); }],
    ['声音开关', () => { audioOn = !audioOn; audio.setEnabled(audioOn); }],
    ['返回选关', () => { sim.stop(); location.reload(); }],
  ];
  actions.forEach(([label, fn]) => {
    const b = el('button', '', label);
    b.addEventListener('click', () => { fn(); pop.classList.add('hidden'); });
    foot.append(b);
  });
  pop.append(foot);
  pop.classList.remove('hidden');
}

let modalInst = null;
let modalWasPaused = false;

function showEventModal(inst) {
  if (!inst) return;
  document.getElementById('termCard').classList.add('hidden');
  document.querySelector('.coach')?.classList.add('evt-hide');
  modalInst = inst;
  modalWasPaused = sim.paused;
  sim.setPaused(true);
  const box = document.getElementById('eventModal');
  box.classList.remove('hidden');
  document.getElementById('emCode').textContent = inst.code;
  document.getElementById('emSev').textContent = `S${inst.severity}`;
  document.getElementById('emSev').className = `em-sev mono sev${inst.severity}`;
  document.getElementById('emTime').textContent = `剩余 ${Math.max(0, inst.deadline - sim.clock)} 分`;
  document.getElementById('emTitle').textContent = inst.title;
  const tr = inst.targetTrain ? sim.getTrain(inst.targetTrain) : null;
  const where = tr ? `${tr.no} · ${sim.stations[tr.station] ? sim.stations[tr.station].name : '区间'}` : '全线';
  document.getElementById('emMeta').textContent = `${where} / ${inst.stage ? inst.stage[0] : '运行'} / ${inst.positions ? inst.positions[0] : '区间'}`;
  document.getElementById('emDesc').textContent = inst.desc;
  document.getElementById('emRadio').textContent = inst.radio;
  const branches = document.getElementById('emBranches');
  branches.innerHTML = '';
  inst.branches.forEach((br) => {
    const b = el('button', `em-branch ${br.tone}`);
    b.dataset.branch = br.id;
    b.innerHTML = `<span class="eb-top"><b>${escapeHtml(br.label)}</b><span class="em-risk">${escapeHtml(br.risk)}</span></span>
      <span class="em-eff">${escapeHtml(br.effect)}</span><span class="em-why">${escapeHtml(br.why)}</span>`;
    branches.append(b);
  });
  branches.style.pointerEvents = 'none';
  setTimeout(() => { branches.style.pointerEvents = ''; }, 500);
  document.getElementById('btnPause').textContent = '继续';
}

function hideEventModal() {
  document.getElementById('eventModal').classList.add('hidden');
  document.querySelector('.coach')?.classList.remove('evt-hide');
  modalInst = null;
}

function resumeAfterModal() {
  if (!modalWasPaused) {
    sim.setPaused(false);
    document.getElementById('btnPause').textContent = '暂停';
  }
  updateHud();
}

function showEventResult(inst, br, res) {
  document.querySelector('.coach')?.classList.add('evt-hide');
  const box = document.getElementById('eventResult');
  box.classList.remove('hidden');
  const badge = document.getElementById('erBadge');
  badge.textContent = res.fail ? '处置失败' : '处置完成';
  badge.className = `er-badge ${res.fail ? 'bad' : 'ok'}`;
  document.getElementById('erCode').textContent = inst.code;
  document.getElementById('erTitle').textContent = inst.title;
  document.getElementById('erChoice').textContent = br.label;
  document.getElementById('erRisk').textContent = `${br.risk}风险`;
  document.getElementById('erEffect').textContent = res.note;
  const stats = document.getElementById('erStats');
  stats.innerHTML = '';
  const items = [
    ['合规', res.deltas.compliance, ''],
    ['安全', res.deltas.safety, ''],
    ['资源', res.deltas.resource, ''],
    ['情绪', res.deltas.emotion, ''],
    ['处置余量', res.deltas.effort, ''],
    [res.train ? `${res.train.no} 晚点` : '晚点', res.deltas.late, '分'],
  ];
  items.forEach(([k, v, unit]) => {
    if (!v) return;
    const positiveIsGood = !k.includes('晚点');
    const good = positiveIsGood ? v > 0 : v < 0;
    const row = el('div', `er-stat ${good ? 'up' : 'down'}`);
    row.append(el('span', '', k));
    row.append(el('b', 'mono', `${v > 0 ? '+' : ''}${v}${unit}`));
    stats.append(row);
  });
  if (!stats.children.length) stats.append(el('div', 'er-stat flat', '没有明显指标变化'));
  const chain = document.getElementById('erChain');
  chain.innerHTML = '';
  const props = (res.event && res.event.propagate) || [];
  if (res.fail) chain.append(el('div', 'er-chain-row bad', '已演变为险性事件，后续列车会被连带晚点。'));
  props.forEach((p) => {
    const row = el('div', 'er-chain-row');
    row.append(el('span', '', p.n));
    row.append(el('b', 'mono', `${p.d > 0 ? '+' : ''}${p.d}`));
    chain.append(row);
  });
  if (!res.fail && !props.length) chain.append(el('div', 'er-chain-row', '传播链被截断，没有继续扩散。'));
  document.getElementById('erNext').textContent = sim.activeEvents.length ? '处置下一件' : '继续值班';
}

function closeEventResult() {
  document.getElementById('eventResult').classList.add('hidden');
  const next = sim.activeEvents[0];
  if (next) showEventModal(next);
  else {
    document.querySelector('.coach')?.classList.remove('evt-hide');
    resumeAfterModal();
  }
}

function bindEventResult() {
  const btn = document.getElementById('erNext');
  if (!btn || btn.dataset.bound) return;
  btn.dataset.bound = '1';
  on(btn, 'click', closeEventResult);
}

function updateHud() {
  const s = sim.getSnapshot();
  const clock = document.getElementById('tbClock');
  if (!clock) return;
  clock.textContent = s.clockText;
  const band = Math.max(1, Math.ceil((s.clock - sim.startClock + 1) / 60));
  document.getElementById('tbDate').textContent = `第 ${band} 班`;
  const atStation = s.trains.filter((t) => t.status === 'station').length;
  const approach = s.trains.filter((t) => t.status === 'approach' || t.status === 'pending').length;
  const lateCount = s.trains.filter((t) => t.status !== 'terminated' && t.late > 0).length;
  document.getElementById('tbPunc').textContent = approach ? `${atStation}/${approach}` : `${atStation}`;
  document.getElementById('tbScore').textContent = `${lateCount}`;
  const alarms = s.alarms.filter((a) => !a.ack).length;
  document.getElementById('tbAlarm').textContent = `${alarms}`;
  const focusName = s.focusStation && s.stations[s.focusStation] ? s.stations[s.focusStation].name : '本站';
  const sceneStation = s.scene.stationName || '';
  const sceneTitle = s.scene.title || focusName;
  document.getElementById('tbScene').textContent = sceneStation && !sceneTitle.includes(sceneStation) ? `${sceneStation} · ${sceneTitle}` : sceneTitle;
  document.getElementById('tbSpeed').textContent = `已运行 ${Math.round(s.clock - sim.startClock)} 分`;
  const diffName = (DIFFICULTIES.find((d) => d.id === currentDifficulty) || { name: '值班员' }).name;
  document.getElementById('sbSeat').textContent = `${focusName} · ${currentGameMode === 'manage' ? '站长' : diffName} · ${currentTT === 'new' ? '2026-11' : '老版运行图'}`;
  const ctlText = document.getElementById('sbControlText');
  const ctlLabel = document.querySelector('#sbControl .sb-label');
  if (s.hub) {
    const waiting = sim.trains.filter((t) => t.status === 'station' && !t.release).length;
    ctlLabel.textContent = '站控';
    ctlText.textContent = `${sim.isStationControlled(s.focusStation) ? '本站手动放行' : '本站自动放行'} · 待放行 ${waiting} · 晚点≤${s.limits ? s.limits.late : 90} / 站外≤${s.limits ? s.limits.wait : 45}`;
  } else {
    ctlLabel.textContent = '站控';
    ctlText.textContent = `${sim.isStationControlled(s.focusStation) ? '本站手动' : '本站自动'} · 晚点≤${s.limits ? s.limits.late : 90} / 站外≤${s.limits ? s.limits.wait : 45}`;
  }
  const focusTrains = s.trains.filter((t) => t.station === s.focusStation && t.status !== 'terminated');
  const metaCtc = document.getElementById('metaCtc');
  if (metaCtc) metaCtc.textContent = `${focusName} · ${focusTrains.length} 列`;
  const metaGraph = document.getElementById('metaGraph');
  if (metaGraph) metaGraph.textContent = `±60 分 · ${focusTrains.length} 列`;
  const metaAlarms = document.getElementById('metaAlarms');
  if (metaAlarms) metaAlarms.textContent = `${alarms} 未确认`;
  const metaEvents = document.getElementById('metaEvents');
  if (metaEvents) metaEvents.textContent = `${sim.activeEvents.length} 待处置`;
  const metaCmd = document.getElementById('metaCmd');
  if (metaCmd) metaCmd.textContent = s.hub ? '枢纽模式' : '线路模式';
  const metaOrders = document.getElementById('metaOrders');
  if (metaOrders) metaOrders.textContent = `${sim.decisions.length} 条`;
  updateNextCount(nextItems().length);
  renderNextBoard();
}

function onFinish() {
  let settle = null;
  let ledger = null;
  if (!shiftSettled && currentScene) {
    shiftSettled = true;
    ledger = applyLedger(sim, currentScene);
    settle = settleShift(sim, currentScene, ledger.net);
    const done = tickBuilds();
    const expired = tickContracts(sim, ledger);
    const cons = dueConsequences(career.data.shiftIndex || 0);
    if ((career.data.shiftIndex || 0) % 3 === 0) refreshOffers();
    pendingDay = { ledger, settle, done, expired, cons };
    audio.sfx(settle.stars >= 2 ? 'ok' : 'fail');
    showDayClose();
  }
  openWindow('score');
  showReview(views.scoreWin.body, ctx());
  const reasonText = sim.finishReason === 'safety' ? '安全底线击穿'
    : sim.finishReason === 'time' ? '时间到'
    : sim.finishReason === 'late' ? '晚点红线击穿'
    : sim.finishReason === 'blocked' ? '站外停车超时'
    : '全部终到';
  toast(`本场结束：${reasonText}`, sim.finishReason === 'safety' || sim.finishReason === 'late' || sim.finishReason === 'blocked' ? 'err' : 'ok');
  audio.sfx(sim.finishReason === 'safety' || sim.finishReason === 'late' || sim.finishReason === 'blocked' ? 'fail' : 'ok');
}

function showDayClose() {
  if (!pendingDay) return;
  const { ledger, settle, done, expired, cons } = pendingDay;
  const old = document.getElementById('dayClose');
  if (old) old.remove();
  const mask = document.createElement('div');
  mask.id = 'dayClose';
  mask.className = 'day-close';
  const lines = ledger.lines.map((l) => `<div class="dc-line"><span>${l.type}</span><b>${escapeHtml(l.name)}</b><em class="${l.kind === 'in' ? 'pos' : 'neg'}">${l.kind === 'in' ? '+' : '-'}${l.amount}</em></div>`).join('');
  const builds = done.length ? done.map((b) => `<div class="dc-build">${b.name} 已竣工，下一班生效</div>`).join('') : '';
  const expireds = expired.length ? expired.map((c) => `<div class="dc-build">${c.name} 已到期</div>`).join('') : '';
  const tails = cons && cons.due.length ? cons.due.map((x) => `<div class="dc-build bad">${x.title}：${x.note}</div>`).join('') : '';
  const risk = bankruptcyRisk();
  const rv = ledger.review;
  const rectify = ledger.rectify || career.data.rectify;
  const pendingPolicy = career.data.policyPending;
  const pols = pendingPolicy ? pendingPolicy.options.map((id) => POLICIES.find((x) => x.id === id)).filter(Boolean) : [];
  const polActive = activePolicies().map((x) => `<span class="dc-pol">${x.name} · 剩 ${x.left} 班</span>`).join('');
  const t = Math.round(ledger.punctuality);
  const tips = [];
  if (ledger.late > 0) tips.push(`${ledger.late} 列晚点超 3 分，本班罚款 ${ledger.late * 120} 元。先查是待避还是进路拖的。`);
  if (t < 90) tips.push(`准点 ${t}%，低于三等站及格线。股道 3 占用偏高，扩建一股能少一轮待避。`);
  if (career.data.equipmentAge > 30) tips.push(`设备老化 ${career.data.equipmentAge}/100，下一班故障概率上升。先做信号 LED 或轨道电路。`);
  if (!(career.data.contracts || []).length) tips.push('合同槽空着。签一份临客或货运，下一班时刻表会真加车。');
  if (!tips.length) tips.push('本班没有明显窟窿。可以攒钱，不要为了花而花。');
  mask.innerHTML = `<div class="dc-card">
    <div class="dc-top"><span class="mono">${currentScene ? currentScene.title : ''} · 第 ${career.data.shiftIndex} 班</span><b>日结单</b><span class="mono ${risk.level}">${risk.text}</span></div>
    <div class="dc-nums"><div><span>收入</span><b>${moneyC(ledger.income)}</b></div><div><span>支出</span><b>${moneyC(ledger.cost)}</b></div><div><span>净利</span><b class="${ledger.net >= 0 ? 'pos' : 'neg'}">${moneyC(ledger.net)}</b></div><div><span>准点</span><b>${t}%</b></div><div><span>事故</span><b>${ledger.incidents}</b></div></div>
    <div class="dc-cols"><div class="dc-lines">${lines}</div><div class="dc-side"><h4>本班结论</h4>${tips.map((x) => `<p>${x}</p>`).join('')}${builds}${expireds}${tails}${rectify && rectify.active ? `<div class="dc-build bad">整改期：${rectify.reason || ''}，还剩 ${rectify.left} 班，禁止新投资和签约</div>` : ''}<div class="dc-build">声誉 ${profile.data.reputation} · 上级 ${career.data.superior}</div></div></div>
    ${rv ? `<div class="dc-week"><div class="dc-week-head"><b>第 ${rv.week} 周评级 ${rv.rating}</b><span>净利 ${moneyC(rv.net)} · 准点 ${rv.punctuality}% · 事故 ${rv.incidents} · 得分 ${rv.score}</span></div><p>${rv.note}${rv.grant ? ` 上级拨款 ${moneyC(rv.grant)}。` : ''}</p>${pols.length ? `<div class="dc-pol-title">本周政策三选一，选定后 21 班内生效</div><div class="dc-pols">${pols.map((x) => `<button data-policy="${x.id}"><b>${x.name}</b><span>${x.desc}</span></button>`).join('')}</div>` : ''}${polActive ? `<div class="dc-pol-active">${polActive}</div>` : ''}</div>` : ''}
    <div class="dc-foot"><button id="dcAdmin">去经营面板</button><button id="dcOk">确认日结，记入档案</button></div>
  </div>`;
  document.body.append(mask);
  mask.querySelectorAll('[data-policy]').forEach((b) => {
    b.addEventListener('click', () => {
      const r = choosePolicy(b.dataset.policy);
      toast(r.msg, r.ok ? 'ok' : 'err');
      if (r.ok) { showDayClose(); }
    });
  });
  document.getElementById('dcOk').addEventListener('click', () => {
    pendingDay = null;
    mask.remove();
    toast(`日结已确认，第 ${(career.data.shiftIndex || 0) + 1} 班开班`, 'ok');
    restartScene();
  });
  document.getElementById('dcAdmin').addEventListener('click', () => {
    pendingDay = null;
    mask.remove();
    openWindow('admin');
  });
}

function moneyC(n) {
  const v = Math.round(n);
  const abs = Math.abs(v);
  return `${v < 0 ? '-' : ''}${abs >= 10000 ? `${(abs / 10000).toFixed(1)}万` : `¥${abs}`}`;
}

function restartScene() {
  if (pendingDay) { showDayClose(); toast('先确认日结，再开下一班', 'warn'); return; }
  sim.setup(currentScene, currentMode, realism, storage('tst-dispatch-sandbox') || {}, currentDifficulty, currentTT);
  applyTraffic(sim);
  applyMechanics(sim);
  inspectId = null;
  closeSide();
  sim.start();
  if (views.ctc) views.ctc.setSnapshot(sim.getSnapshot());
  if (views.graph) views.graph.setSnapshot(sim.getSnapshot());
  toast('本场已重开', 'ok');
}

function saveGame() {
  const s = {
    name: `${currentScene.title} ${fmtClock(sim.clock)}`,
    scene: currentScene.id,
    sceneTitle: currentScene.title,
    sceneData: JSON.parse(JSON.stringify(currentScene)),
    startClock: sim.startClock,
    weather: sim.weather,
    clock: fmtClock(sim.clock),
    mode: currentMode,
    tt: currentTT,
    realism,
    trains: sim.trains.map((t) => ({ ...t })),
    tracks: [...sim.tracks.entries()].map(([k, v]) => [k, v]),
    alarms: sim.alarms.slice(0, 40),
    decisions: sim.decisions,
    metrics: sim.metrics,
    resources: { ...sim.resources },
    conditions: JSON.parse(JSON.stringify(sim.conditions)),
    eventCursor: sim.eventCursor,
    savedAt: Date.now(),
  };
  const list = storage('tst-dispatch-saves') || [];
  list.unshift(s);
  storage('tst-dispatch-saves', list.slice(0, 8));
  toast('已保存到本地存档', 'ok');
  renderSaves();
}

function loadSave(i) {
  const list = storage('tst-dispatch-saves') || [];
  const s = list[i];
  if (!s) return;
  const scene = s.sceneData || data.scenarios.find((x) => x.id === s.scene);
  if (!scene) { toast('找不到对应场景', 'err'); return; }
  currentScene = migrateScene(scene);
  if (s.tt) currentTT = s.tt;
  startGame(currentScene);
  sim.startClock = Number.isFinite(s.startClock) ? s.startClock : sim.startClock;
  sim.weather = s.weather || sim.weather;
  sim.trains = s.trains;
  sim.tracks = new Map(s.tracks);
  sim.alarms = s.alarms;
  sim.decisions = s.decisions;
  sim.metrics = s.metrics;
  sim.resources = s.resources;
  sim.conditions = s.conditions;
  sim.eventCursor = s.eventCursor;
  sim.clock = 0;
  const parts = s.clock.split(':').map(Number);
  sim.clock = parts[0] * 60 + parts[1];
  sim.nextEventAt = sim.clock + 6;
  if (sim.interlock) sim.interlock.init(sim);
  sim.emit('tick');
  if (views.ctc) views.ctc.setSnapshot(sim.getSnapshot());
  if (views.graph) views.graph.setSnapshot(sim.getSnapshot());
  toast(`已载入 ${s.name}`, 'ok');
}

function exportScene() {
  const pack = packageScene(currentScene || { title: '自定义场景', line: sim.lineId }, sim.trains, storage('tst-dispatch-sandbox') || {});
  pack.mode = currentMode;
  pack.name = currentScene ? currentScene.title : '自定义场景';
  download(`${pack.name}.json`, JSON.stringify(pack, null, 2));
  const list = storage('tst-dispatch-workshop') || [];
  list.unshift({ name: pack.name, line: pack.line, at: Date.now(), data: pack });
  storage('tst-dispatch-workshop', list.slice(0, 20));
  toast('已导出，同时记入本地工坊', 'ok');
}

function downloadExample() {
  const pack = {
    format: 'tst-dispatch-scene',
    version: 1,
    name: '示例：雨夜单线',
    line: 'qinglan',
    scene: { id: 'wp-demo', kind: 'sandbox', title: '示例：雨夜单线', line: 'qinglan', brief: '两站单线，暴雨，自己排', weather: '暴雨', difficulty: 4, duration: 420, trains: 8 },
    mode: 'standard',
    sandbox: {},
    trains: [],
  };
  download('示例-雨夜单线.json', JSON.stringify(pack, null, 2));
}

function download(name, text) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function importWorkshop(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = parseSceneFile(reader.result, data.network, data.timetable);
      if (!parsed.report.ok) throw new Error(parsed.report.errors.slice(0, 3).join('；'));
      const pack = parsed.pack;
      pack.scene = parsed.report.scene;
      const list = storage('tst-dispatch-workshop') || [];
      list.unshift({ name: pack.name || parsed.report.scene.title, line: parsed.report.scene.line, at: Date.now(), data: pack });
      storage('tst-dispatch-workshop', list.slice(0, 20));
      currentScene = parsed.report.scene;
      const warn = parsed.report.warnings.length ? `（${parsed.report.warnings.length} 条提醒）` : '';
      toast(`关卡已导入${warn}，点“开始值班”开跑`, 'ok');
    } catch (e) { toast(`导入失败：${e.message}`, 'err'); }
  };
  reader.readAsText(file);
}

function loadWorkshopScene(pack) {
  if (!pack || !pack.scene) return;
  currentScene = pack.scene;
  if (pack.mode) currentMode = pack.mode;
  startGame(pack.scene);
  toast('工坊关卡已开跑', 'ok');
}

boot();

