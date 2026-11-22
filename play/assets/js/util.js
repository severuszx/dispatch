export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function pad(n, w = 2) { return String(n).padStart(w, '0'); }
export function fmtClock(min) {
  const m = Math.round(min);
  const h = Math.floor(m / 60) % 24;
  return `${pad(h)}:${pad(m % 60)}`;
}
export function fmtDur(min) {
  const m = Math.round(Math.abs(min));
  if (m < 60) return `${m} 分`;
  return `${Math.floor(m / 60)} 时 ${pad(m % 60)} 分`;
}
export function hhmmToMin(s) {
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
}
export function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < String(s).length; i += 1) {
    h ^= String(s).charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}
export function rnd(seed) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}
export function pick(arr, seed) { return arr[hash(seed) % arr.length]; }
export function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined && text !== null) n.textContent = text;
  return n;
}
export function on(node, type, fn) { node.addEventListener(type, fn); return fn; }
let toastTimer = null;
export function toast(msg, kind = '') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = `toast ${kind}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = 'toast hidden'; }, 3200);
}
export function storage(key, val) {
  try {
    if (val === undefined) {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    }
    localStorage.setItem(key, JSON.stringify(val));
    return val;
  } catch (e) { return null; }
}
export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
