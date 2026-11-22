const COL = {
  bg: '#f7f8f9', frame: '#dce3e9', grid: '#edf1f4',
  line: '#26313e', lineDim: '#cbd3db', track: '#26313e', idle: '#9aa6b2',
  text: '#18222d', dim: '#536170', faint: '#8b98a5',
  green: '#2e9e6b', amber: '#d5891f', red: '#e84b30', white: '#ffffff',
  train: '#ffffff', trainBox: '#ffffff',
};

function fmt(m) {
  if (typeof m !== 'number') return '';
  const v = ((Math.round(m) % 1440) + 1440) % 1440;
  return `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`;
}

const GAP = 16;
const THROAT = 30;
const PAD_L = 90;
const PAD_R = 80;

export class CTCView {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.snap = null;
    this.hover = null;
    this.onPick = opts.onPick || (() => {});
    this.onInspect = opts.onInspect || (() => {});
    this.hit = [];
    this.resize();
    const ro = new ResizeObserver(() => { this.resize(); this.draw(); });
    ro.observe(canvas.parentElement || canvas);
    canvas.addEventListener('mousemove', (e) => this.mouseMove(e));
    canvas.addEventListener('click', (e) => this.click(e));
    canvas.addEventListener('mouseleave', () => { this.hover = null; this.draw(); });
  }

  resize() {
    const box = this.canvas.parentElement;
    const w = Math.max(320, box.clientWidth);
    const h = Math.max(180, box.clientHeight);
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.w = w;
    this.h = h;
  }

  setSnapshot(snap) {
    const prev = this.snap;
    this.snap = snap;
    if (!prev || prev.clock !== snap.clock || prev.trains !== snap.trains) this.draw();
  }

  font(size, mono) {
    const ctx = this.ctx;
    ctx.font = `${size}px ${mono ? 'Consolas,monospace' : '"Microsoft YaHei UI","Microsoft YaHei",sans-serif'}`;
  }

  layout() {
    const s = this.snap;
    const order = s.stationOrder;
    const total = Math.max(1, s.line.length || 1);
    const usable = Math.max(140, this.w - PAD_L - PAD_R);
    const kms = order.map((id, i) => {
      const c = s.stations[id];
      return typeof c.km === 'number' ? c.km : (total * i) / Math.max(1, order.length - 1);
    });
    const xs = kms.map((km) => PAD_L + (km / total) * usable);
    const half = xs.map((x, i) => {
      const left = i === 0 ? x - 22 : (x - xs[i - 1]) / 2 - 10;
      const right = i === xs.length - 1 ? this.w - x - 22 : (xs[i + 1] - x) / 2 - 10;
      return Math.max(52, Math.min(104, left, right));
    });
    const top = 60;
    const bottom = this.h - 26;
    const cy = Math.round(top + (bottom - top) * 0.5);
    const maxTracks = Math.max(...order.map((id) => s.stations[id].tracks || 1), 1);
    const gap = Math.max(18, Math.min(38, (bottom - top - 70) / Math.max(1, maxTracks - 1)));
    return { order, xs, half, cy, top, bottom, kms, total, gap };
  }

  draw() {
    const ctx = this.ctx;
    ctx.fillStyle = COL.bg;
    ctx.fillRect(0, 0, this.w, this.h);
    ctx.strokeStyle = COL.grid;
    ctx.lineWidth = 1;
    for (let x = 56; x < this.w; x += 56) {
      ctx.beginPath(); ctx.moveTo(x + .5, 0); ctx.lineTo(x + .5, this.h); ctx.stroke();
    }
    for (let y = 56; y < this.h; y += 56) {
      ctx.beginPath(); ctx.moveTo(0, y + .5); ctx.lineTo(this.w, y + .5); ctx.stroke();
    }
    const s = this.snap;
    if (!s) return;
    this.hit = [];
    ctx.textBaseline = 'middle';
    if (s.hub && s.stationOrder.length <= 1) {
      this.drawYard(s);
    } else {
      if (s.hub) this.drawHub(s);
      else if (s.stationOrder.length <= 1) this.drawYard(s);
      else this.drawLine(s);
      this.drawHead(s);
    }
    this.drawLegend();
  }

  drawHead(s) {
    const ctx = this.ctx;
    this.font(10, true);
    ctx.fillStyle = COL.faint;
    ctx.textAlign = 'left';
    const kind = s.line.kind || '';
    ctx.fillText(`${s.line.name}　${kind}　${s.line.block || ''}`, 12, 16);
    ctx.textAlign = 'right';
    ctx.fillText(`${s.weather}　${s.clockText}`, this.w - 12, 16);
    ctx.textAlign = 'left';
    ctx.strokeStyle = COL.frame;
    ctx.beginPath();
    ctx.moveTo(10, 26.5);
    ctx.lineTo(this.w - 10, 26.5);
    ctx.stroke();
  }

  drawLine(s) {
    const L = this.layout();
    this.drawBlocks(L, s);
    this.drawCorridor(L, s);
    this.tracksOf = (id) => {
      const list = s.tracks.get ? s.tracks.get(id) : s.tracks[id];
      return list || [];
    };
    L.order.forEach((id, i) => this.drawStation(L, s, id, i));
    this.drawRunning(L, s);
  }

  drawBlocks(L, s) {
    const ctx = this.ctx;
    const y = 46;
    for (let i = 0; i < L.order.length - 1; i += 1) {
      const a = L.order[i];
      const b = L.order[i + 1];
      const x1 = L.xs[i] + L.half[i] + 8;
      const x2 = L.xs[i + 1] - L.half[i + 1] - 8;
      if (x2 <= x1) continue;
      const occupied = s.trains.some((t) => t.status === 'running' && t.section && ((t.section.a === a && t.section.b === b) || (t.section.a === b && t.section.b === a)));
      const blocked = s.conditions.blockSections.some((x) => ((x.a === a && x.b === b) || (x.a === b && x.b === a)) && x.until > s.clock);
      const limited = s.conditions.speedLimits.some((x) => ((x.a === a && x.b === b) || (x.a === b && x.b === a)) && x.until > s.clock);
      ctx.fillStyle = occupied ? '#fff0ec' : '#f1f4f7';
      ctx.strokeStyle = blocked ? COL.red : '#d6dee5';
      ctx.lineWidth = 1;
      ctx.fillRect(x1, y, x2 - x1, 6);
      ctx.strokeRect(x1, y, x2 - x1, 6);
      if (occupied) {
        ctx.strokeStyle = 'rgba(232,75,48,.45)';
        for (let x = x1 + 4; x < x2 - 2; x += 7) {
          ctx.beginPath(); ctx.moveTo(x, y + 6); ctx.lineTo(x + 4, y); ctx.stroke();
        }
      }
      this.font(9, true);
      ctx.fillStyle = occupied ? '#c5452d' : limited ? COL.amber : COL.faint;
      ctx.textAlign = 'center';
      const mid = (x1 + x2) / 2;
      ctx.fillText(blocked ? '区间封锁' : limited ? `${Math.round(L.kms[i])}—${Math.round(L.kms[i + 1])} km 限速` : `${Math.round(L.kms[i])}—${Math.round(L.kms[i + 1])} km`, mid, y + 16);
      ctx.textAlign = 'left';
    }
  }

  drawCorridor(L, s) {
    const ctx = this.ctx;
    const double = !s.line.kind.includes('单线');
    ctx.strokeStyle = COL.line;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, L.cy - (double ? 5 : 0));
    ctx.lineTo(this.w, L.cy - (double ? 5 : 0));
    ctx.stroke();
    if (double) {
      ctx.beginPath();
      ctx.moveTo(0, L.cy + 5);
      ctx.lineTo(this.w, L.cy + 5);
      ctx.stroke();
      this.font(8, true);
      ctx.fillStyle = COL.faint;
      ctx.fillText('上行', 6, L.cy - 12);
      ctx.fillText('下行', 6, L.cy + 14);
    }
  }

  drawStation(L, s, id, i) {
    const ctx = this.ctx;
    const conf = s.stations[id];
    const x = L.xs[i];
    const hw = L.half[i];
    const left = x - hw;
    const right = x + hw;
    const n = Math.max(1, conf.tracks || 1);
    const GAP = L.gap;
    const span = (n - 1) * GAP;
    const yFirst = Math.round(L.cy - span / 2);
    const main = (n - 1) / 2;
    const list = s.tracks.get ? s.tracks.get(id) : s.tracks[id];
    const trackY = (k) => Math.round(yFirst + k * GAP);

    ctx.strokeStyle = '#cfd7de';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 6]);
    ctx.beginPath(); ctx.moveTo(left, yFirst - 16); ctx.lineTo(left, yFirst + span + 16); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(right, yFirst - 16); ctx.lineTo(right, yFirst + span + 16); ctx.stroke();
    ctx.setLineDash([]);

    this.font(12, false);
    ctx.fillStyle = COL.text;
    ctx.textAlign = 'center';
    ctx.fillText(conf.name, x, yFirst - 30);
    this.font(9, false);
    ctx.fillStyle = COL.faint;
    ctx.fillText(`${conf.unmanned ? '无人站' : conf.type || '中间站'} · ${n} 股道`, x, yFirst - 18);
    if ((s.control || []).includes(id)) {
      ctx.fillStyle = COL.amber;
      ctx.fillRect(x - 22, yFirst - 45, 4, 4);
      this.font(9, true);
      ctx.fillStyle = COL.amber;
      ctx.fillText('站控', x + 8, yFirst - 28);
    }

    for (let k = 0; k < n; k += 1) {
      const ty = trackY(k);
      const tr = list ? list[k] : null;
      const busy = tr && tr.train;
      const blocked = tr && tr.blocked;
      const isMain = !s.line.kind.includes('单线') ? (ty === L.cy - 5 || ty === L.cy + 5) : ty === L.cy;

      if (isMain && Math.abs(k - main) <= 0.5) {
        this.font(9, true);
        ctx.fillStyle = COL.faint;
        ctx.textAlign = 'left';
        ctx.fillText(String(k + 1), left + 3, ty - 8);
      } else {
        ctx.strokeStyle = blocked ? COL.red : COL.track;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(left, L.cy);
        ctx.bezierCurveTo(left + 16, L.cy, left + THROAT - 12, ty, left + THROAT, ty);
        ctx.lineTo(right - THROAT, ty);
        ctx.bezierCurveTo(right - THROAT + 12, ty, right - 16, L.cy, right, L.cy);
        ctx.stroke();
        this.font(9, true);
        ctx.fillStyle = COL.faint;
        ctx.textAlign = 'left';
        ctx.fillText(String(k + 1), left + THROAT + 3, ty - 8);
      }

      const occupied = busy || blocked;
      if (occupied) {
        ctx.strokeStyle = COL.red;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(left + THROAT, ty);
        ctx.lineTo(right - THROAT, ty);
        ctx.stroke();
      }

      if (busy) {
        const t = s.trains.find((tt) => tt.id === busy);
        if (t) this.drawTrainAt(t, x, ty, true, 1);
      }

      this.hit.push({ type: 'track', station: id, track: k + 1, x: left, y: ty - 8, w: right - left, h: 16 });

      const dotY = ty;
      for (const side of [0, 1]) {
        const sx = side ? right + 6 : left - 6;
        ctx.fillStyle = occupied ? COL.red : COL.green;
        ctx.beginPath();
        ctx.arc(sx, dotY, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (this.hover && this.hover.type === 'track' && this.hover.station === id) {
      const ty = trackY(this.hover.track - 1);
      ctx.strokeStyle = 'rgba(220,220,220,.55)';
      ctx.lineWidth = 1;
      ctx.strokeRect(left + 2, ty - 7, right - left - 4, 14);
    }
  }

  drawHub(s) {
    const ctx = this.ctx;
    const yards = s.stationOrder;
    const cols = yards.length <= 3 ? Math.max(1, yards.length) : 2;
    const rows = Math.ceil(yards.length / cols);
    const gap = 8;
    const left = 10;
    const top = 36;
    const right = this.w - 10;
    const bottom = this.h - 30;
    const cw = (right - left - gap * (cols - 1)) / cols;
    const ch = (bottom - top - gap * (rows - 1)) / rows;
    yards.forEach((id, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const x = left + col * (cw + gap);
      const y = top + row * (ch + gap);
      const conf = s.stations[id];
      const list = (s.tracks.get ? s.tracks.get(id) : s.tracks[id]) || [];
      const controlled = (s.control || []).includes(id);
      const pending = s.trains.filter((t) => t.station === id && t.status === 'station' && t.hold).length;
      ctx.strokeStyle = '#d6dee5';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, cw - 1, ch - 1);
      ctx.fillStyle = controlled ? '#fff4f1' : '#ffffff';
      ctx.fillRect(x + 1, y + 1, cw - 2, 26);
      ctx.fillStyle = controlled ? COL.amber : COL.faint;
      ctx.beginPath();
      ctx.arc(x + 10, y + 13, 3, 0, Math.PI * 2);
      ctx.fill();
      this.font(11, false);
      ctx.fillStyle = COL.text;
      ctx.textAlign = 'left';
      ctx.fillText(conf.name, x + 18, y + 13);
      const nameW = ctx.measureText(conf.name).width;
      this.font(9, true);
      ctx.fillStyle = COL.faint;
      ctx.fillText(`${conf.type || ''} · ${list.length} 道`, x + 26 + nameW, y + 13);
      ctx.textAlign = 'right';
      ctx.fillStyle = controlled ? COL.amber : COL.dim;
      ctx.fillText(controlled ? (pending ? `站控 · 待 ${pending}` : '站控') : '自律', x + cw - 8, y + 13);
      ctx.strokeStyle = '#e3e9ee';
      ctx.beginPath();
      ctx.moveTo(x + 1, y + 27.5);
      ctx.lineTo(x + cw - 1, y + 27.5);
      ctx.stroke();

      const n = Math.max(1, list.length);
      const padTop = 14;
      const padBottom = 10;
      const area = Math.max(20, ch - 28 - padTop - padBottom);
      const GAPY = Math.min(28, Math.max(9, area / Math.max(1, n - 1)));
      const span = (n - 1) * GAPY;
      const first = Math.round(y + 28 + padTop + (area - span) / 2);
      list.forEach((tr, k) => {
        const ty = Math.round(first + k * GAPY);
        const busy = tr.train;
        const blocked = tr.blocked;
        const lineL = x + 34;
        const lineR = x + cw - 18;
        ctx.strokeStyle = blocked ? COL.red : '#26313e';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(lineL, ty);
        ctx.lineTo(lineR, ty);
        ctx.stroke();
        this.font(9, true);
        ctx.fillStyle = COL.faint;
        ctx.textAlign = 'left';
        ctx.fillText(String(tr.no), x + 8, ty);
        if (busy || blocked) {
          ctx.strokeStyle = COL.red;
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(lineL, ty);
          ctx.lineTo(lineR, ty);
          ctx.stroke();
        }
        if (busy) {
          const t = s.trains.find((tt) => tt.id === busy);
          if (t) this.drawTrainAt(t, (lineL + lineR) / 2, ty, true, 1);
        }
        ctx.fillStyle = busy || blocked ? COL.red : COL.green;
        ctx.beginPath();
        ctx.arc(lineR + 6, ty, 2.5, 0, Math.PI * 2);
        ctx.fill();
        this.hit.push({ type: 'track', station: id, track: tr.no, x: lineL - 6, y: ty - 7, w: lineR - lineL + 12, h: 14 });
        if (this.hover && this.hover.type === 'track' && this.hover.station === id && this.hover.track === tr.no) {
          ctx.strokeStyle = 'rgba(220,220,220,.5)';
          ctx.lineWidth = 1;
          ctx.strokeRect(lineL - 4, ty - 7, lineR - lineL + 8, 14);
        }
      });
    });
    this.font(9, true);
    ctx.fillStyle = COL.faint;
    ctx.textAlign = 'right';
    ctx.fillText(`${yards.length} 个场 · ${s.trains.filter((t) => t.status !== 'terminated').length} 列在站`, this.w - 12, 18);
    ctx.textAlign = 'left';
  }

  drawYard(s) {
    const ctx = this.ctx;
    const id = s.stationOrder[0];
    const conf = s.stations[id];
    const n = Math.max(1, conf.tracks || 1);
    const list = s.tracks.get ? s.tracks.get(id) : s.tracks[id];
    const padCoach = document.body.classList.contains('pad-mode') && !!document.getElementById('tutorialCoach');
    const top = 122;
    const bottom = this.h - (padCoach ? 230 : 54);
    const gap = Math.min(104, Math.max(58, (bottom - top) / Math.max(1, n - 1)));
    const span = (n - 1) * gap;
    const yFirst = Math.round((top + bottom) / 2 - span / 2);
    const left = 84;
    const right = this.w - 86;

    this.font(27, false);
    ctx.fillStyle = COL.text;
    ctx.textAlign = 'left';
    ctx.fillText(conf.name, left, 38);
    const nameW = ctx.measureText(conf.name).width;
    const narrow = this.w < 620;
    if (!narrow) {
      this.font(9, false);
      ctx.fillStyle = COL.faint;
      ctx.fillText(`${conf.type || '编组站'} · ${n} 股道　${conf.unmanned ? '无人站' : '有人值守'}`, left + nameW + 14, 38);
    }
    ctx.textAlign = 'right';
    this.font(10, true);
    ctx.fillStyle = COL.faint;
    const onDuty = s.trains.filter((t) => t.status !== 'terminated').length;
    ctx.fillText(narrow ? `${onDuty} 列 · ${s.clockText}` : `在站 ${onDuty} 列　·　区间空闲　·　${s.clockText}`, this.w - 30, 38);
    ctx.strokeStyle = COL.frame;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(30, 62.5); ctx.lineTo(this.w - 30, 62.5); ctx.stroke();
    ctx.textAlign = 'left';

    ctx.strokeStyle = '#cfd7de';
    ctx.setLineDash([5, 6]);
    ctx.beginPath(); ctx.moveTo(left, yFirst - 24); ctx.lineTo(left, yFirst + span + 24); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(right, yFirst - 24); ctx.lineTo(right, yFirst + span + 24); ctx.stroke();
    ctx.setLineDash([]);

    for (let k = 0; k < n; k += 1) {
      const ty = Math.round(yFirst + k * gap);
      const tr = list ? list[k] : null;
      const busy = tr && tr.train;
      const blocked = tr && tr.blocked;
      ctx.strokeStyle = blocked ? COL.red : COL.track;
      ctx.lineWidth = blocked ? 5 : 4;
      ctx.beginPath();
      ctx.moveTo(left, ty);
      ctx.lineTo(right, ty);
      ctx.stroke();

      this.font(12, true);
      ctx.fillStyle = COL.faint;
      ctx.textAlign = 'left';
      ctx.fillText(String(k + 1), left + 1, ty - 13);

      if (busy) {
        const t = s.trains.find((tt) => tt.id === busy);
        if (t) this.drawTrainAt(t, (left + right) / 2, ty, true, 1.5);
      }
      this.hit.push({ type: 'track', station: id, track: k + 1, x: left, y: ty - 10, w: right - left, h: 20 });

      for (const sx of [left - 8, right + 8]) {
        ctx.fillStyle = busy || blocked ? COL.red : COL.green;
        ctx.beginPath();
        ctx.arc(sx, ty, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  drawTrainAt(t, x, y, atStation, scale = 1) {
    const ctx = this.ctx;
    const late = t.late || 0;
    const color = late > 15 ? COL.red : late > 5 ? COL.amber : COL.train;
    const h = 28 * scale;
    const arrow = t.dir > 0 ? '▸' : '◂';
    this.font(12 * scale, true);
    const label = t.no;
    const tw = ctx.measureText(label).width;
    const time = fmt(t.planDep);
    this.font(7.5 * scale, true);
    const timeW = time ? ctx.measureText(time).width : 0;
    const lateText = late > 0 ? `+${late}` : '';
    const lateW = lateText ? ctx.measureText(lateText).width : 0;
    const w = Math.max(88 * scale, 12 * scale + tw + 16 * scale + timeW + (lateText ? 9 * scale + lateW : 0) + 10 * scale);
    const bx = Math.round(x - w / 2);
    const by = Math.round(y - h / 2);
    ctx.save();
    ctx.shadowColor = 'rgba(20,35,50,.11)';
    ctx.shadowBlur = 10 * scale;
    ctx.shadowOffsetY = 3 * scale;
    ctx.fillStyle = COL.trainBox;
    this.roundRect(bx, by, w, h, 5 * scale);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = '#cfd7de';
    ctx.lineWidth = 1;
    this.roundRect(bx, by, w, h, 5 * scale);
    ctx.stroke();
    ctx.fillStyle = color === COL.train ? COL.red : color;
    ctx.fillRect(bx + 1, by + 1, 4 * scale, h - 2);
    this.font(9 * scale, true);
    ctx.fillStyle = COL.faint;
    ctx.textAlign = 'left';
    ctx.fillText(arrow, bx + 10 * scale, y);
    this.font(12 * scale, true);
    ctx.fillStyle = COL.text;
    ctx.fillText(label, bx + 10 * scale + 10 * scale, y);
    ctx.textAlign = 'right';
    if (time) {
      this.font(7.5 * scale, true);
      ctx.fillStyle = COL.dim;
      ctx.fillText(time, bx + w - 10 * scale, y - (lateText ? 4 * scale : 0));
    }
    if (lateText) {
      this.font(7.5 * scale, true);
      ctx.fillStyle = late > 15 ? COL.red : COL.amber;
      ctx.fillText(lateText, bx + w - 10 * scale, y + 6 * scale);
    }
    ctx.textAlign = 'left';
    this.hit.push({ type: 'train', id: t.id, x: bx, y: by, w, h });
  }

  roundRect(x, y, w, h, r) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  drawRunning(L, s) {
    const double = !s.line.kind.includes('单线');
    for (const t of s.trains) {
      if (t.status === 'terminated') continue;
      if (t.status === 'station' || t.status === 'waiting') continue;
      if (t.status === 'running' && t.section) {
        const ai = L.order.indexOf(t.section.a);
        const bi = L.order.indexOf(t.section.b);
        if (ai < 0 || bi < 0) continue;
        const xa = L.xs[ai] + L.half[ai] * (bi > ai ? 1 : -1);
        const xb = L.xs[bi] + L.half[bi] * (bi > ai ? -1 : 1);
        const p = Math.max(0, Math.min(1, t.progress || 0));
        const yMain = double ? (t.dir > 0 ? L.cy - 5 : L.cy + 5) : L.cy;
        const destN = Math.max(1, s.stations[t.section.b].tracks || 1);
        const destFirst = Math.round(L.cy - ((destN - 1) * L.gap) / 2);
        const destY = destFirst + ((t.nextTrack || 1) - 1) * L.gap;
        const origN = Math.max(1, s.stations[t.section.a].tracks || 1);
        const origFirst = Math.round(L.cy - ((origN - 1) * L.gap) / 2);
        const origY = origFirst + ((t.originTrack || 1) - 1) * L.gap;
        let x = xa + (xb - xa) * p;
        let y = yMain;
        if (p < 0.18) {
          const q = p / 0.18;
          x = L.xs[ai] + (xa - L.xs[ai]) * q;
          y = origY + (yMain - origY) * q;
        } else if (p > 0.78) {
          const q = (p - 0.78) / 0.22;
          const e = q * q * (3 - 2 * q);
          y = yMain + (destY - yMain) * e;
          if (p > 0.88) x = x + (L.xs[bi] - xb) * ((p - 0.88) / 0.12);
        }
        this.drawTrainAt(t, x, y, false);
        continue;
      }
      if (t.status === 'pending') {
        const idx = L.order.indexOf(t.station);
        if (idx < 0) continue;
        const n = Math.max(1, s.stations[t.station].tracks || 1);
        const GAP = L.gap;
        const span = (n - 1) * GAP;
        const yFirst = Math.round(L.cy - span / 2);
        const y = yFirst + ((t.trackNo || 1) - 1) * GAP;
        this.drawTrainAt(t, L.xs[idx], y, true);
      }
    }
  }

  drawKm(L, s) {
    const ctx = this.ctx;
    this.font(9, true);
    ctx.fillStyle = COL.faint;
    ctx.textAlign = 'center';
    L.order.forEach((id, i) => {
      const km = Math.round(L.kms[i]);
      ctx.fillText(`${km} km`, L.xs[i], L.bottom + 14);
      ctx.fillStyle = '#aeb9c4';
      ctx.fillRect(L.xs[i] - 0.5, L.bottom + 2, 1, 4);
      ctx.fillStyle = COL.faint;
    });
    ctx.textAlign = 'left';
    this.font(9, false);
    ctx.fillStyle = COL.faint;
    ctx.fillText(`比例 1:${Math.round((L.total / Math.max(1, this.w - 70)) * 1000)}m`, 12, this.h - 10);
  }

  drawLegend() {
    const ctx = this.ctx;
    const items = [['股道占用', COL.red], ['信号开放', COL.green], ['股道空闲', COL.track]];
    this.font(9, false);
    let x = this.w - 12;
    for (const [label, color] of items) {
      const tw = ctx.measureText(label).width;
      x -= tw;
      ctx.fillStyle = COL.faint;
      ctx.textAlign = 'left';
      ctx.fillText(label, x, this.h - 10);
      x -= 12;
      ctx.fillStyle = color;
      if (label === '信号开放') {
        ctx.beginPath(); ctx.arc(x + 4, this.h - 11, 3.5, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillRect(x, this.h - 12, 9, 3);
      }
      x -= 40;
    }
  }

  mouseMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const found = [...this.hit].reverse().find((h) => mx >= h.x && mx <= h.x + h.w && my >= h.y && my <= h.y + h.h);
    const prev = this.hover;
    this.hover = found ? (found.type === 'track' ? { type: 'track', station: found.station, track: found.track } : { type: 'train', id: found.id }) : null;
    this.canvas.style.cursor = found ? 'pointer' : 'default';
    if (JSON.stringify(prev) !== JSON.stringify(this.hover)) this.draw();
  }

  click(e) {
    const rect = this.canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const inside = (h) => mx >= h.x && mx <= h.x + h.w && my >= h.y && my <= h.y + h.h;
    const train = [...this.hit].reverse().find((h) => h.type === 'train' && inside(h));
    if (train) { this.onInspect(train.id); return; }
    const track = [...this.hit].reverse().find((h) => h.type === 'track' && inside(h));
    if (track) this.onPick(track.station, track.track);
  }
}


