import { el, toast } from './util.js';
import { career, saveCareer } from './career.js';

const CLOUD = 'https://severuszx.github.io/dispatch/data/dlc/';
const TIERS = [['expansion', 'Expansion'], ['line', '线路包'], ['mechanic', '机制包']];

function installed() {
  career.data.dlc = career.data.dlc || {};
  return career.data.dlc;
}

function save() { saveCareer(); }

async function fetchJson(url, ms) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal, cache: 'no-store' });
    if (!r.ok) throw new Error(String(r.status));
    return await r.json();
  } finally {
    clearTimeout(timer);
  }
}

async function manifest(id) {
  try {
    const m = await fetchJson(`${CLOUD}${id}.json`, 900);
    if (m && m.id === id) return { ...m, source: 'cloud' };
  } catch (e) {}
  const m = await fetchJson(`data/dlc/${id}.json`, 8000);
  if (!m || m.id !== id) throw new Error('清单校验失败');
  return { ...m, source: 'fallback' };
}

export function installedList() {
  return Object.values(installed()).filter((x) => x.enabled !== false);
}

export function expansionLoad() {
  let pax = 0;
  let freight = 0;
  return { pax, freight };
}

export function dlcScenes() {
  return installedList()
    .filter((x) => String(x.feature || '').startsWith('line-') && x.scene)
    .map((x) => ({ ...x.scene, kind: 'pack', title: x.scene.title, line: x.scene.line || 'qinglan' }));
}

export function linePackCount() {
  return installedList().filter((x) => String(x.feature || '').startsWith('line-')).length;
}

export function dlcOn(feature) {
  const list = installed();
  return Object.values(list).some((x) => x.feature === feature && x.enabled !== false);
}

export function mountDLC(body, ctx) {
  body.classList.add('dlc-pane');
  const root = el('div', 'dlc');
  body.append(root);
  let tier = 'expansion';
  let busy = '';

  function card(m) {
    const st = installed()[m.id];
    const can = !!st;
    return `<div class="dlc-card ${can ? 'on' : ''}">
      <div class="dlc-top"><b>${m.name}</b><span>${m.version || '0.1.0'}</span><em>${st ? (st.enabled === false ? '已停用' : '已安装') : '未安装'}</em></div>
      <p class="dlc-hook">${m.hook}</p>
      <ul>${(m.items || []).map((x) => `<li>${x}</li>`).join('')}</ul>
      <div class="dlc-foot"><span>依赖 ${m.dep || '主线'}</span><span>${Math.round((m.bytes || 0) / 1024)} KB</span>
      ${can ? `${st.scene && st.enabled !== false ? `<button class="dlc-go" data-act="go:${m.id}">进入线路</button>` : ''}<button data-act="toggle:${m.id}">${st.enabled === false ? '启用' : '停用'}</button><button data-act="remove:${m.id}">卸载</button>` : `<button data-act="install:${m.id}" ${busy === m.id ? 'disabled' : ''}>${busy === m.id ? '下载中' : '云端下载'}</button>`}</div>
      ${st && st.scene ? `<div class="dlc-scene">${st.scene.title} · ${st.scene.trains} 列 · ${st.scene.weather} · ${st.scene.difficulty} 级</div>` : ''}
    </div>`;
  }

  async function render() {
    const idx = await fetchJson('data/dlc/index.json', 8000).catch(() => []);
    const list = idx.filter((x) => x.tier === tier);
    root.innerHTML = `<div class="dlc-head"><div><b>扩展包</b><span>主线只带基础场景。扩展包从云端按需下载，不预装。</span></div><div class="dlc-count">已装 ${Object.keys(installed()).length} / ${idx.length}</div></div>
      <div class="dlc-tabs">${TIERS.map(([id, n]) => `<button data-tier="${id}" class="${tier === id ? 'on' : ''}">${n}</button>`).join('')}</div>
      <div class="dlc-grid">${list.map(card).join('')}</div>
      <p class="dlc-note">线路包需要对应运行图数据；机制包只改一个玩法侧面。安装后可在场景选择里看到对应入口。</p>`;
  }

  root.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-tier],[data-act]');
    if (!b) return;
    if (b.dataset.tier) { tier = b.dataset.tier; render(); return; }
    const act = b.dataset.act;
    if (act.startsWith('install:')) {
      const id = act.slice(8);
      busy = id;
      await render();
      try {
        const m = await manifest(id);
        installed()[id] = { ...m, enabled: true, at: Date.now() };
        save();
        toast(`${m.name} 已下载，${m.source === 'cloud' ? '云端' : '本地镜像'}`, 'ok');
      } catch (err) {
        toast(`下载失败：${err.message}`, 'err');
      }
      busy = '';
      await render();
    } else if (act.startsWith('go:')) {
      const st = installed()[act.slice(3)];
      if (st && st.scene && ctx.loadPack) {
        ctx.loadPack({ ...st.scene, kind: 'pack', title: st.scene.title, line: st.scene.line || 'qinglan' });
        document.querySelectorAll('.drawer-win').forEach((w) => w.remove());
        toast(`已进入 ${st.scene.title}`, 'ok');
      }
    } else if (act.startsWith('toggle:')) {
      const id = act.slice(7);
      const st = installed()[id];
      st.enabled = st.enabled === false;
      save();
      render();
    } else if (act.startsWith('remove:')) {
      delete installed()[act.slice(7)];
      save();
      render();
    }
  });

  render();
  return { refresh: render };
}
