const CLOUD_TOKEN_KEY = 'tst-dispatch-cloud-token';
function cloudToken() {
  try { return localStorage.getItem(CLOUD_TOKEN_KEY) || ''; } catch (e) { return ''; }
}
function setCloudToken(t) {
  try { if (t) localStorage.setItem(CLOUD_TOKEN_KEY, String(t).trim()); else localStorage.removeItem(CLOUD_TOKEN_KEY); return true; } catch (e) { return false; }
}
function parseCloudInput(text) {
  const s = String(text || '').trim();
  if (!s) return '';
  const m = s.match(/gist\.github\.com\/[^/]+\/([a-f0-9]+)/i) || s.match(/^([a-f0-9]{12,})$/i);
  return m ? m[1] : '';
}
function uploadCloud(code, meta) { return import('../assets/js/cloud.js').then((m) => m.uploadCloud(code, meta)); }
function downloadCloud(id) { return import('../assets/js/cloud.js').then((m) => m.downloadCloud(id)); }
