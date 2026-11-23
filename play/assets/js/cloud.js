const TOKEN_KEY = 'tst-dispatch-cloud-token';
const LAST_KEY = 'tst-dispatch-cloud-last';

export function cloudToken() {
  try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; }
}

export function setCloudToken(t) {
  try {
    if (t) localStorage.setItem(TOKEN_KEY, String(t).trim());
    else localStorage.removeItem(TOKEN_KEY);
    return true;
  } catch (e) { return false; }
}

export function lastCloudId() {
  try { return localStorage.getItem(LAST_KEY) || ''; } catch (e) { return ''; }
}

function remember(id) {
  try { localStorage.setItem(LAST_KEY, id); } catch (e) { /* ignored */ }
}

async function api(path, opt) {
  const token = cloudToken();
  const headers = { Accept: 'application/vnd.github+json', ...(opt && opt.headers) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`https://api.github.com${path}`, { ...opt, headers });
  if (!res.ok) {
    if (res.status === 401) throw new Error('GitHub 令牌无效或已过期');
    if (res.status === 404) throw new Error('找不到这个云存档编号');
    throw new Error(`云端返回 ${res.status}`);
  }
  return res.json();
}

export async function uploadCloud(code, meta) {
  if (!cloudToken()) throw new Error('先在设置里填 GitHub 令牌');
  const body = {
    description: `调度台云存档 ${meta && meta.name ? meta.name : ''} ${new Date().toISOString().slice(0, 16)}`,
    public: false,
    files: {
      'dispatch-save.txt': { content: String(code) },
      'dispatch-meta.json': { content: JSON.stringify(meta || {}, null, 2) },
    },
  };
  const out = await api('/gists', { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });
  remember(out.id);
  return { id: out.id, url: out.html_url, at: Date.now() };
}

export async function downloadCloud(id) {
  const clean = String(id || '').trim().split('/').pop();
  if (!clean) throw new Error('云存档编号为空');
  const gist = await api(`/gists/${clean}`, { method: 'GET' });
  const f = gist.files && gist.files['dispatch-save.txt'];
  if (!f) throw new Error('这个云端记录不是调度台存档');
  let code = f.content || '';
  if (f.truncated && f.raw_url) {
    const res = await fetch(f.raw_url);
    if (!res.ok) throw new Error('云存档内容读取失败');
    code = await res.text();
  }
  remember(gist.id);
  return { code, meta: gist.description || '', id: gist.id };
}

export function parseCloudInput(text) {
  const s = String(text || '').trim();
  if (!s) return '';
  const m = s.match(/gist\.github\.com\/[^/]+\/([a-f0-9]+)/i) || s.match(/^([a-f0-9]{12,})$/i);
  return m ? m[1] : '';
}
