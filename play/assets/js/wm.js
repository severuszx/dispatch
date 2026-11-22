let deskEl = null;
let barEl = null;
let zTop = 20;
const wins = new Map();

function ensureBody(pane) {
  let body = pane.querySelector(':scope > .dock-body, :scope > .drawer-body');
  if (!body) {
    body = document.createElement('div');
    body.className = pane.classList.contains('drawer-win') ? 'drawer-body' : 'dock-body';
    pane.append(body);
  }
  return body;
}

function makeWin(id, pane, body, onClose) {
  const win = {
    id,
    element: pane,
    body,
    show() {
      pane.classList.remove('hidden');
      win.focus();
    },
    hide() {
      pane.classList.add('hidden');
    },
    focus() {
      zTop += 1;
      pane.style.zIndex = String(zTop);
      wins.forEach((w) => w.element.classList.remove('active'));
      pane.classList.add('active');
    },
    close() {
      if (onClose) onClose();
      pane.classList.add('hidden');
    },
    destroy() {
      pane.remove();
      wins.delete(id);
    },
    isOpen() {
      return !pane.classList.contains('hidden');
    },
  };
  return win;
}

export function initWM(desk, bar) {
  deskEl = desk;
  barEl = bar;
  document.body.classList.add('wm-docked');
  deskEl.querySelectorAll('[data-win]').forEach((pane) => {
    const id = pane.dataset.win;
    const body = ensureBody(pane);
    wins.set(id, makeWin(id, pane, body, null));
    pane.addEventListener('mousedown', () => wins.get(id)?.focus());
  });
	document.querySelectorAll('.rail button[data-panel]').forEach((btn) => {
		btn.addEventListener('click', () => {
			const id = btn.dataset.panel;
			const win = wins.get(id);
			if (id !== 'graph') document.querySelector('.graph-float')?.classList.add('hidden');
			else document.getElementById('side')?.classList.add('hidden');
			if (win) {
				document.querySelectorAll('.drawer-win').forEach((pane) => {
					if (pane.dataset.win !== id) pane.classList.add('hidden');
				});
				win.show();
			}
		});
	});
}

export function createWindow(def) {
  const id = def.id;
  const exist = wins.get(id);
  if (exist) {
    exist.show();
    if (def.onClose) exist.onClose = def.onClose;
    return exist;
  }

  let pane = deskEl.querySelector(`[data-win="${id}"]`);
  if (!pane) {
    pane = document.createElement('div');
    pane.className = 'drawer-win';
    pane.dataset.win = id;
    const head = document.createElement('div');
    head.className = 'drawer-head';
    const title = document.createElement('b');
    title.textContent = def.title || id;
    const close = document.createElement('button');
    close.textContent = '×';
    close.title = '关闭';
    head.append(title, close);
    pane.append(head);
    deskEl.append(pane);
    const idx = [...deskEl.querySelectorAll('.drawer-win')].length - 1;
    pane.style.top = `${8 + idx * 10}px`;
    pane.style.right = `${8 + idx * 10}px`;
    pane.style.height = def.h ? `${Math.min(def.h, deskEl.clientHeight - 20)}px` : '58%';
    close.addEventListener('click', () => {
      pane.classList.add('hidden');
    });
  }

  const body = ensureBody(pane);
  const win = makeWin(id, pane, body, def.onClose);
  wins.set(id, win);
  win.show();
  return win;
}

export function getWin(id) {
  const win = wins.get(id);
  if (!win || !win.element.isConnected) return null;
  return win;
}

export function focusWin(id) {
  wins.get(id)?.show();
}

export function destroyWindow(id) {
  wins.get(id)?.destroy();
}

export function listWindows() {
  return [...wins.values()].filter((w) => w.element.isConnected);
}
