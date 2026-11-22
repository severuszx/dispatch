import { el, toast } from './util.js';

const KEY = 'tst-dispatch-packs';
const LINES = ['qinglan', 'jiangwan', 'linhe'];

function state() {
  const raw = localStorage.getItem(KEY);
  if (!raw) return { items: {} };
  try {
    const s = JSON.parse(raw);
    return s && s.items ? s : { items: {} };
  } catch (e) {
    return { items: {} };
  }
}

function save(s) {
  localStorage.setItem(KEY, JSON.stringify(s));
}

function validate(pack) {
  if (!pack || typeof pack !== 'object') throw new Error('空文件');
  if (!pack.id || !/^[a-z0-9-]{2,40}$/.test(pack.id)) throw new Error('id 只能是小写字母、数字、连字符');
  if (!pack.name || !pack.version) throw new Error('缺少 name 或 version');
  const scene = pack.scene;
  if (!scene || !scene.title || !LINES.includes(scene.line)) throw new Error('scene.line 不在支持线路内');
  return {
    id: pack.id,
    name: String(pack.name),
    version: String(pack.version),
    author: String(pack.author || '未署名'),
    note: String(pack.note || scene.brief || ''),
    scene: {
      id: String(scene.id || `pk-${pack.id}`),
      kind: 'pack',
      title: String(scene.title),
      line: String(scene.line),
      brief: String(scene.brief || pack.note || ''),
      terms: Array.isArray(scene.terms) ? scene.terms.slice(0, 8) : [],
      duration: Number(scene.duration) || 240,
      difficulty: Number(scene.difficulty) || 2,
      weather: String(scene.weather || '晴'),
      trains: Math.max(3, Math.min(20, Number(scene.trains) || 8)),
    },
  };
}

export function enabledPackScenes() {
  const s = state();
  return Object.values(s.items).filter((p) => p.enabled).map((p) => p.scene);
}

async function readZip(file) {
  const buf = await file.arrayBuffer();
  const view = new DataView(buf);
  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65558); i -= 1) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('不是 zip 文件');
  const count = view.getUint16(eocd + 10, true);
  const offset = view.getUint32(eocd + 16, true);
  const dec = new TextDecoder();
  let pos = offset;
  for (let i = 0; i < count; i += 1) {
    if (view.getUint32(pos, true) !== 0x02014b50) break;
    const method = view.getUint16(pos + 10, true);
    const compSize = view.getUint32(pos + 20, true);
    const nameLen = view.getUint16(pos + 28, true);
    const extraLen = view.getUint16(pos + 30, true);
    const commentLen = view.getUint16(pos + 32, true);
    const localOffset = view.getUint32(pos + 42, true);
    const name = dec.decode(buf.slice(pos + 46, pos + 46 + nameLen));
    if (name === 'pack.json' || name.endsWith('/pack.json')) {
      const lName = view.getUint16(localOffset + 26, true);
      const lExtra = view.getUint16(localOffset + 28, true);
      const start = localOffset + 30 + lName + lExtra;
      const data = buf.slice(start, start + compSize);
      if (method === 0) return JSON.parse(dec.decode(data));
      if (method !== 8) throw new Error('不支持的压缩方式');
      const ds = new DecompressionStream('deflate-raw');
      const out = await new Response(new Blob([data]).stream().pipeThrough(ds)).arrayBuffer();
      return JSON.parse(dec.decode(out));
    }
    pos += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error('zip 里没有 pack.json');
}

async function readPack(file) {
  if (/\.zip$/i.test(file.name)) return readZip(file);
  const text = await file.text();
  return JSON.parse(text);
}

async function builtins() {
  const res = await fetch('packs/index.json', { cache: 'no-store' });
  if (!res.ok) return [];
  const list = await res.json();
  const out = [];
  for (const it of list) {
    try {
      const r = await fetch(`packs/${it.id}/pack.json`, { cache: 'no-store' });
      if (r.ok) out.push(validate(await r.json()));
    } catch (e) {
      continue;
    }
  }
  return out;
}

export function mountPacks(body, ctx) {
  body.classList.add('pk-pane');
  const head = el('div', 'pk-head');
  const title = el('span', 'pk-title', '扩展包');
  const count = el('span', 'pk-count', '');
  head.append(title, count);
  const list = el('div', 'pk-list');
  const foot = el('div', 'pk-foot');
  const imp = el('button', 'btn', '导入包');
  const dir = el('button', 'btn', '打开目录');
  const hint = el('span', 'pk-hint', '支持 .zip（含 pack.json）与 .json');
  foot.append(imp, dir, hint);
  body.append(head, list, foot);

  const refresh = async () => {
    const s = state();
    const inst = Object.values(s.items);
    count.textContent = `已安装 ${inst.length} · 启用 ${inst.filter((p) => p.enabled).length}`;
    list.innerHTML = '';
    if (inst.length) {
      inst.sort((a, b) => a.name.localeCompare(b.name, 'zh'));
      for (const p of inst) {
        const row = el('div', 'pk-row');
        const main = el('div', 'pk-main');
        const name = el('div', 'pk-name');
        name.append(el('span', '', p.name), el('span', 'pk-ver', p.version), el('span', `pk-state ${p.enabled ? 'on' : ''}`, p.enabled ? '已启用' : '已停用'));
        main.append(name, el('div', 'pk-meta', `${p.author} · ${p.scene.title} · ${p.scene.trains} 列 · ${p.scene.weather}`));
        if (p.note) main.append(el('div', 'pk-note', p.note));
        const ops = el('div', 'pk-ops');
        const load = el('button', 'btn btn-primary', '载入');
        load.addEventListener('click', () => {
          ctx.loadPack(p.scene);
          toast(`已载入扩展包：${p.name}`, 'ok');
        });
        const toggle = el('button', 'btn', p.enabled ? '停用' : '启用');
        toggle.addEventListener('click', () => {
          s.items[p.id].enabled = !s.items[p.id].enabled;
          save(s);
          refresh();
        });
        const del = el('button', 'btn', '移除');
        del.addEventListener('click', () => {
          delete s.items[p.id];
          save(s);
          refresh();
        });
        ops.append(load, toggle, del);
        row.append(main, ops);
        list.append(row);
      }
    }
    const avail = (await builtins()).filter((p) => !s.items[p.id]);
    if (avail.length) {
      list.append(el('div', 'pk-sub', '内置包'));
      for (const p of avail) {
        const row = el('div', 'pk-row');
        const main = el('div', 'pk-main');
        const name = el('div', 'pk-name');
        name.append(el('span', '', p.name), el('span', 'pk-ver', p.version), el('span', 'pk-state', '未安装'));
        main.append(name, el('div', 'pk-meta', `${p.author} · ${p.scene.title} · ${p.scene.trains} 列 · ${p.scene.weather}`));
        if (p.note) main.append(el('div', 'pk-note', p.note));
        const ops = el('div', 'pk-ops');
        const add = el('button', 'btn', '安装');
        add.addEventListener('click', () => {
          s.items[p.id] = { ...p, enabled: true, at: Date.now() };
          save(s);
          refresh();
          toast(`已安装：${p.name}`, 'ok');
        });
        ops.append(add);
        row.append(main, ops);
        list.append(row);
      }
    }
    if (!list.children.length) list.append(el('div', 'pk-empty', '还没有扩展包。点下面的导入，或安装内置包。'));
  };

  imp.addEventListener('click', () => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.zip,.json';
    inp.addEventListener('change', async () => {
      if (!inp.files || !inp.files[0]) return;
      try {
        const pack = validate(await readPack(inp.files[0]));
        const s = state();
        s.items[pack.id] = { ...pack, enabled: true, at: Date.now() };
        save(s);
        refresh();
        toast(`已导入：${pack.name}`, 'ok');
      } catch (e) {
        toast(`导入失败：${e.message}`, 'err');
      }
    });
    inp.click();
  });

  dir.addEventListener('click', () => {
    toast('桌面端与 Pad 端把包放进安装目录的 packs/ 子目录；网页版存在浏览器本地。');
  });

  refresh();
}
