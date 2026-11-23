function saveCode() {
  const s = { ...state, selected };
  return `MGV1:${btoa(unescape(encodeURIComponent(JSON.stringify(s))))}`;
}

function readCode(code) {
  const t = String(code || '').trim();
  if (!t.startsWith('MGV1:')) throw new Error('不是站长台存档');
  const s = JSON.parse(decodeURIComponent(escape(atob(t.slice(5)))));
  if (!s || s.v !== 1) throw new Error('存档版本不对');
  return normalize(s);
}
