const { app, BrowserWindow, shell, dialog, ipcMain, Menu } = require('electron');
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const MANIFEST_URL = 'https://severuszx.github.io/dispatch/latest.json';

function updateDir() {
  return path.join(app.getPath('temp'), 'dispatch-update');
}

const ASAR = path.join(process.resourcesPath, 'app.asar');
const packedBase = fs.existsSync(ASAR) ? ASAR : path.join(process.resourcesPath, 'app');
const ROOT = app.isPackaged ? path.join(packedBase, 'app') : path.join(__dirname, 'app');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8'
};

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent(req.url.split('?')[0]);
      const rel = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
      const file = path.join(ROOT, rel);
      if (!file.startsWith(ROOT)) {
        res.writeHead(403);
        res.end('forbidden');
        return;
      }
      fs.readFile(file, (err, data) => {
        if (err) {
          res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
          res.end('404');
          return;
        }
        res.writeHead(200, {
          'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
          'cache-control': 'no-store'
        });
        res.end(data);
      });
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

let updating = false;

function httpGet(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https:') ? https : http;
    const req = lib.get(url, { headers: { 'user-agent': 'dispatch-updater' } }, (res) => {
      const code = res.statusCode || 0;
      if ([301, 302, 303, 307, 308].includes(code) && res.headers.location) {
        res.resume();
        if (redirects > 6) {
          reject(new Error('重定向次数过多'));
          return;
        }
        resolve(httpGet(new URL(res.headers.location, url).toString(), redirects + 1));
        return;
      }
      resolve(res);
    });
    req.setTimeout(20000, () => req.destroy(new Error('连接超时')));
    req.on('error', reject);
  });
}

async function getJson(url) {
  const res = await httpGet(url);
  if (res.statusCode !== 200) {
    res.resume();
    throw new Error(`HTTP ${res.statusCode}`);
  }
  const text = await new Promise((resolve, reject) => {
    let body = '';
    res.setEncoding('utf8');
    res.on('data', (c) => { body += c; });
    res.on('end', () => resolve(body));
    res.on('error', reject);
  });
  return JSON.parse(text);
}

function versionValue(v) {
  return String(v || '').replace(/^v/i, '').split(/[.+-]/).map((x, i) => {
    const n = parseInt(x, 10);
    return Number.isFinite(n) ? n : (i === 0 ? 0 : 0);
  });
}

function versionNewer(latest, current) {
  const a = versionValue(latest);
  const b = versionValue(current);
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    if ((a[i] || 0) > (b[i] || 0)) return true;
    if ((a[i] || 0) < (b[i] || 0)) return false;
  }
  return false;
}

function updateInfo(manifest) {
  if (manifest && manifest.win) return manifest.win;
  if (manifest && manifest.downloads && manifest.downloads.win) return manifest.downloads.win;
  return manifest || {};
}

function notesText(notes) {
  if (Array.isArray(notes)) return notes.map((x) => `· ${x}`).join('\n');
  return String(notes || '本次更新没有附加说明。');
}

async function downloadFile(url, dest, size) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const res = await httpGet(url);
  if (res.statusCode !== 200) {
    res.resume();
    throw new Error(`下载失败 HTTP ${res.statusCode}`);
  }
  const total = Number(res.headers['content-length']) || Number(size) || 0;
  let got = 0;
  res.on('data', (c) => {
    got += c.length;
    if (win && total) win.setProgressBar(Math.min(got / total, 0.99));
  });
  await new Promise((resolve, reject) => {
    const out = fs.createWriteStream(dest);
    res.pipe(out);
    out.on('finish', resolve);
    out.on('error', reject);
    res.on('error', reject);
  });
  if (total && got !== total) throw new Error('下载不完整');
}

function sha256(file) {
  return new Promise((resolve, reject) => {
    const h = crypto.createHash('sha256');
    fs.createReadStream(file)
      .on('data', (c) => h.update(c))
      .on('error', reject)
      .on('end', () => resolve(h.digest('hex')));
  });
}

function fileSha(file) {
  try { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); } catch { return ''; }
}

function runUpdater(zip, folder, pid) {
  if (!fs.existsSync(folder)) throw new Error('找不到安装目录');
  const script = path.join(updateDir(), 'apply-update.ps1');
  const body = [
    '$ErrorActionPreference = "Stop"',
    `$pidToWait = ${pid}`,
    `$zip = ${JSON.stringify(zip)}`,
    `$target = ${JSON.stringify(folder)}`,
    'Wait-Process -Id $pidToWait -ErrorAction SilentlyContinue',
    'Start-Sleep -Seconds 2',
    '$stage = Join-Path $env:TEMP ("dispatch-stage-" + [guid]::NewGuid().ToString("N"))',
    'New-Item -ItemType Directory -Force $stage | Out-Null',
    'Expand-Archive -LiteralPath $zip -DestinationPath $stage -Force',
    '$inner = $stage',
    '$sub = Get-ChildItem -LiteralPath $stage -Directory | Select-Object -First 1',
    'if ($sub -and -not (Test-Path (Join-Path $stage "调度台.exe")) -and (Test-Path (Join-Path $sub.FullName "调度台.exe"))) { $inner = $sub.FullName }',
    'Copy-Item -Path (Join-Path $inner "*") -Destination $target -Recurse -Force',
    'Remove-Item -LiteralPath $stage -Recurse -Force',
    'Remove-Item -LiteralPath $zip -Force -ErrorAction SilentlyContinue',
    'Start-Process -FilePath (Join-Path $target "调度台.exe") -WorkingDirectory $target',
    'Remove-Item -LiteralPath $PSCommandPath -Force -ErrorAction SilentlyContinue'
  ].join('\r\n');
  fs.writeFileSync(script, body, 'utf8');
  const child = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true
  });
  child.unref();
}

async function checkForUpdates(options = {}) {
  const silent = !!options.silent;
  if (updating) return { state: 'busy' };
  if (!app.isPackaged) {
    if (!silent) await dialog.showMessageBox(win, {
      type: 'info',
      title: '检查更新',
      message: '开发环境不检查更新。',
      detail: '打包后的桌面端才会连接官网读取版本清单。',
      buttons: ['知道了']
    });
    return { state: 'dev' };
  }
  updating = true;
  try {
    const manifest = await getJson(MANIFEST_URL);
    const current = app.getVersion();
    const latest = String(manifest.version || '').replace(/^v/i, '');
    if (!latest || !versionNewer(latest, current)) {
      if (!silent) await dialog.showMessageBox(win, {
        type: 'info',
        title: '检查更新',
        message: `已是最新版本 ${current}`,
        detail: '官网版本清单里没有更高的版本。',
        buttons: ['知道了']
      });
      return { state: 'latest', current };
    }
    const info = updateInfo(manifest);
    if (!info.url) throw new Error('版本清单缺少下载地址');
    const decisions = await dialog.showMessageBox(win, {
      type: 'info',
      title: '发现新版本',
      message: `调度台 ${latest}`,
      detail: `当前版本 ${current}\n\n${notesText(manifest.notes)}\n\n下载后会自动校验并替换当前版本。`,
      buttons: ['下载并更新', '稍后'],
      defaultId: 0,
      cancelId: 1
    });
    if (decisions.response !== 0) return { state: 'later', latest };
    const zip = path.join(updateDir(), `调度台-${latest}.zip`);
    if (fs.existsSync(zip) && info.sha256 && fileSha(zip).toLowerCase() === String(info.sha256).toLowerCase()) {
      runUpdater(zip, path.dirname(app.getPath('exe')), process.pid);
      app.quit();
      return { state: 'installing', latest };
    }
    await downloadFile(info.url, zip, info.size);
    if (win) win.setProgressBar(-1);
    if (info.sha256) {
      const got = await sha256(zip);
      if (got.toLowerCase() !== String(info.sha256).toLowerCase()) {
        fs.rmSync(zip, { force: true });
        throw new Error('SHA256 校验不通过，安装包已删除');
      }
    }
    await dialog.showMessageBox(win, {
      type: 'info',
      title: '准备更新',
      message: `调度台 ${latest} 已下载完成`,
      detail: '点击确定后调度台会关闭，替换文件并自动重新打开。',
      buttons: ['立即重启']
    });
    runUpdater(zip, path.dirname(app.getPath('exe')), process.pid);
    app.quit();
    return { state: 'installing', latest };
  } catch (e) {
    if (win) win.setProgressBar(-1);
    if (!silent) await dialog.showMessageBox(win, {
      type: 'error',
      title: '检查更新失败',
      message: '没能完成更新检查。',
      detail: e.message,
      buttons: ['知道了']
    });
    return { state: 'error', error: e.message };
  } finally {
    updating = false;
  }
}

function buildMenu() {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      label: '调度台',
      submenu: [
        { label: '检查更新', click: () => checkForUpdates({ silent: false }) },
        { type: 'separator' },
        { role: 'quit', label: '退出' }
      ]
    },
    {
      label: '窗口',
      submenu: [
        { role: 'minimize', label: '最小化' },
        { role: 'togglefullscreen', label: '全屏' }
      ]
    }
  ]));
}

let win = null;
let server = null;

const captureArg = process.argv.find((a) => a.startsWith('--capture='));
const sceneArg = (process.argv.find((a) => a.startsWith('--scene=')) || '').slice('--scene='.length);

async function createWindow() {
  server = await startServer();
  const port = server.address().port;
  win = new BrowserWindow({
    show: !captureArg,
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: '#151515',
    title: '调度台',
    icon: path.join(__dirname, 'build', 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });
  win.setMenuBarVisibility(false);
  win.loadURL(`http://127.0.0.1:${port}/index.html`);
  if (!captureArg) {
    win.webContents.once('did-finish-load', () => {
      setTimeout(() => checkForUpdates({ silent: true }), 4000);
    });
  }
  if (captureArg) {
    const target = captureArg.slice('--capture='.length);
    const doStart = process.argv.includes('--start');
    const doBig = process.argv.includes('--big');
    const doPacks = process.argv.includes('--packs');
    win.webContents.once('did-finish-load', () => {
      const grab = async () => {
        if (doStart) {
          await win.webContents.executeJavaScript(`
            [...document.querySelectorAll('button')].filter((b) => b.textContent.trim() === '知道了').forEach((b) => b.click())
          `);
          await new Promise((r) => setTimeout(r, 260));
        }
        if (doPacks) {
          await win.webContents.executeJavaScript(`
            (() => {
              const m = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '菜单');
              if (m) m.click();
              return !!m;
            })()
          `);
          await new Promise((r) => setTimeout(r, 400));
          await win.webContents.executeJavaScript(`
            [...document.querySelectorAll('button')].filter((b) => b.textContent.includes('PK-18')).forEach((b) => b.click())
          `);
          await new Promise((r) => setTimeout(r, 900));
          await win.webContents.executeJavaScript(`
            [...document.querySelectorAll('button')].filter((b) => b.textContent.trim() === '知道了').forEach((b) => b.click())
          `);
          await new Promise((r) => setTimeout(r, 260));
        }
        const image = await win.webContents.capturePage();
        fs.writeFileSync(target, image.toPNG());
        app.quit();
      };
      setTimeout(async () => {
        if (!doStart) return grab();
        if (sceneArg) {
          await win.webContents.executeJavaScript(`
            (() => {
              const tab = [...document.querySelectorAll('#bootTabs button')].find((b) => b.textContent.includes('运行场景'));
              if (tab) tab.click();
              const key = ${JSON.stringify(sceneArg.toUpperCase())};
              const cell = [...document.querySelectorAll('.scene-cell')].find((c) => c.textContent.replace(/\\s+/g, '').toUpperCase().includes(key));
              if (cell) cell.click();
              const go = document.getElementById('bootGo');
              if (go) go.click();
              return !!cell;
            })()
          `);
          setTimeout(grab, 3500);
          return;
        }
        await win.webContents.executeJavaScript(`
          (() => {
            const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '开始值班');
            if (b) b.click();
            return !!b;
          })()
        `);
        setTimeout(async () => {
          await win.webContents.executeJavaScript(`
            (() => {
              for (const b of [...document.querySelectorAll('button')]) {
                if (b.textContent.trim() === '知道了') b.click();
              }
              const wins = [...document.querySelectorAll('.win')];
              if (${doBig ? 'true' : 'false'} && wins.length) {
                wins.forEach((w, i) => { if (i > 0) w.style.display = 'none'; });
                const c = wins[0];
                c.style.left = '8px'; c.style.top = '52px'; c.style.width = '1424px'; c.style.height = '820px';
              }
              return wins.length;
            })()
          `);
          setTimeout(grab, 2500);
        }, 14000);
      }, 1500);
    });
  }
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.on('closed', () => { win = null; });
}

const locked = app.requestSingleInstanceLock();
if (!locked) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
  app.whenReady().then(() => {
    buildMenu();
    ipcMain.handle('update:check', () => checkForUpdates({ silent: false }));
    createWindow();
  });
}

app.on('window-all-closed', () => {
  if (server) server.close();
  app.quit();
});
