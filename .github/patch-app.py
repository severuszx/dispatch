import shutil
p = 'play/assets/js/app.js'
a = open(p).read()
if 'window.__startGame' not in a:
    old = """async function fetchJson(path) {
  const res = await fetch(path, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${path} ${res.status}`);
  return res.json();
}"""
    new = """async function fetchJson(path) {
  for (let i = 0; i < 4; i += 1) {
    try {
      const res = await fetch(path, { cache: 'no-cache' });
      if (res.ok) return res.json();
    } catch (e) { }
    await new Promise((r) => setTimeout(r, 500 + i * 400));
  }
  throw new Error(`${path} 读取失败`);
}"""
    if old in a:
        a = a.replace(old, new, 1)
    a += "\nwindow.__startGame = startGame;\n"
    open(p, 'w').write(a)
shutil.copyfile(p, 'play/assets/js/app-0.6.20.js')
p = 'play/index.html'
h = open(p).read()
h = h.replace('assets/js/app.js?v=0.6.20', 'assets/js/app-0.6.20.js')
h = h.replace('assets/js/app.js?v=0.6.19c', 'assets/js/app-0.6.20.js')
h = h.replace('v0.6.19', 'v0.6.20').replace('0.6.19</b>', '0.6.20</b>')
open(p, 'w').write(h)
print('app patched')
