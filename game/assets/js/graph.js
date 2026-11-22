const C = {
  bg: '#f7f8f9', grid: '#e8edf1', grid2: '#d9e1e8', axis: '#c6d0d9',
  text: '#18222d', dim: '#536170', faint: '#8b98a5',
  plan: '#8b98a5', now: '#e84b30', evt: '#d5891f',
  run: '#26313e', late: '#b97a18', bad: '#e84b30',
};

const TYPE_COLOR = { G: '#e84b30', D: '#2d7fa6', Z: '#7b5e8a', T: '#2e9e6b', K: '#536170', 货: '#a5731d', 路用: '#5d7d59', 军运: '#8a5b49' };

function fmt(m) {
  const v = ((Math.round(m) % 1440) + 1440) % 1440;
  return `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`;
}

export class GraphView {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.snap = null;
    this.onInspect = opts.onInspect || (() => {});
    this.span = 120;
    this.resize();
    const ro = new ResizeObserver(() => { this.resize(); this.draw(); });
    ro.observe(canvas.parentElement || canvas);
    canvas.addEventListener('click', (e) => this.click(e));
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
    this.snap = snap;
    this.draw();
  }

  font(size, mono) {
    this.ctx.font = `${size}px ${mono ? 'Consolas,monospace' : '"Microsoft YaHei UI","Microsoft YaHei",sans-serif'}`;
  }

  draw() {
    const ctx = this.ctx;
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, this.w, this.h);
    this.hits = [];
    const s = this.snap;
    if (!s) return;
    this.drawTracks(s);
    return;

    const padL = 58;
    const padR = 16;
    const padT = 46;
    const padB = 22;
    const tEnd = s.clock + this.span * 0.55;
    const tStart = tEnd - this.span;
    const rows = order.length;
    const rowH = (this.h - padT - padB) / Math.max(1, rows - 1);
    const xOf = (m) => padL + ((m - tStart) / this.span) * (this.w - padL - padR);
    const yOf = (i) => padT + i * rowH;

    ctx.strokeStyle = C.grid;
    ctx.lineWidth = 1;
    for (let m = Math.ceil(tStart / 10) * 10; m <= tEnd; m += 10) {
      const x = xOf(m);
      ctx.strokeStyle = m % 30 === 0 ? C.grid2 : C.grid;
      ctx.beginPath(); ctx.moveTo(x, padT - 10); ctx.lineTo(x, this.h - padB); ctx.stroke();
      if (m % 30 === 0) {
        this.font(9, true);
        ctx.fillStyle = C.dim;
        ctx.textAlign = 'center';
        ctx.fillText(clockStr(m), x, padT - 15);
        ctx.textAlign = 'left';
      }
    }

    order.forEach((id, i) => {
      const y = yOf(i);
      ctx.strokeStyle = C.axis;
      ctx.beginPath(); ctx.moveTo(padL - 6, y); ctx.lineTo(this.w - padR, y); ctx.stroke();
      this.font(11, false);
      ctx.fillStyle = C.text;
      ctx.textAlign = 'right';
      ctx.fillText(s.stations[id].name, padL - 12, y);
      this.font(8.5, true);
      ctx.fillStyle = C.faint;
      ctx.fillText(`${Math.round(s.stations[id].km || 0)}`, padL - 12, y + 11);
      ctx.textAlign = 'left';
    });

    for (const t of s.trains) {
      if (t.status === 'terminated' && !t.trace.length) continue;
      const stops = t.stops || [];
      if (!stops.length) continue;
      const color = TYPE_COLOR[t.type] || C.run;
      const dir = t.dir;
      ctx.strokeStyle = C.plan;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      stops.forEach((st, k) => {
        const idx = order.indexOf(st.st);
        if (idx < 0) return;
        const xa = xOf(st.arr === null ? st.dep : st.arr);
        const xd = xOf(st.dep === null ? st.arr : st.dep);
        if (k === 0) ctx.moveTo(xa, yOf(idx));
        else ctx.lineTo(xa, yOf(idx));
        if (xd > xa) ctx.lineTo(xd, yOf(idx));
      });
      ctx.stroke();
      ctx.setLineDash([]);

      const pts = [];
      for (const p of t.trace || []) {
        if (p.i >= 0 && p.i < rows) pts.push([xOf(p.m), yOf(p.i)]);
      }
      if (t.status === 'running' && t.section) {
        const ai = order.indexOf(t.section.a);
        const bi = order.indexOf(t.section.b);
        if (ai >= 0 && bi >= 0) {
          const p = Math.max(0, Math.min(1, t.progress || 0));
          pts.push([xOf(s.clock), yOf(ai + (bi - ai) * p)]);
        }
      } else if (t.status === 'station' || t.status === 'waiting' || t.status === 'pending') {
        const idx = order.indexOf(t.station);
        if (idx >= 0) pts.push([xOf(s.clock), yOf(idx)]);
      }
      if (pts.length) {
        ctx.strokeStyle = t.late > 12 ? C.bad : t.late > 4 ? C.late : color;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        pts.forEach(([x, y], k) => { if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
        ctx.stroke();
        const last = pts[pts.length - 1];
        const idx = Math.round((last[1] - padT) / rowH);
        this.font(9.5, true);
        const tw = ctx.measureText(t.no).width;
        ctx.fillStyle = C.bg;
        ctx.fillRect(last[0] + 3, last[1] - 6, tw + 4, 12);
        ctx.fillStyle = t.late > 12 ? C.bad : t.late > 4 ? C.late : color;
        ctx.fillText(t.no, last[0] + 5, last[1]);
        this.hits = this.hits || [];
        this.hits.push({ id: t.id, x: last[0], y: last[1] - 8, w: tw + 8, h: 14 });
      }
    }

    for (const ev of s.events || []) {
      const x = xOf(ev.at);
      if (x < padL || x > this.w - padR) continue;
      ctx.fillStyle = C.evt;
      ctx.beginPath();
      ctx.moveTo(x, this.h - padB + 4);
      ctx.lineTo(x - 4, this.h - padB + 12);
      ctx.lineTo(x + 4, this.h - padB + 12);
      ctx.closePath();
      ctx.fill();
    }

    const nowX = xOf(s.clock);
    ctx.strokeStyle = C.now;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(nowX, padT - 10); ctx.lineTo(nowX, this.h - padB); ctx.stroke();
    ctx.fillStyle = C.now;
    this.font(9, true);
    ctx.fillText(clockStr(s.clock), nowX + 3, this.h - 8);
    this.font(9, false);
    ctx.fillStyle = C.faint;
    if (this.w >= 560) ctx.fillText(`图定虚线　实绩实线　窗宽 ${this.span} 分`, padL, 12);
  }

  drawHubPlan(s) {
    const ctx = this.ctx;
    const padL = 64;
    const padR = 16;
    const padT = 42;
    const padB = 24;
    const tEnd = s.clock + 60;
    const tStart = s.clock - 120;
    const span = tEnd - tStart;
    const xOf = (m) => padL + ((m - tStart) / span) * (this.w - padL - padR);
    const rows = s.stationOrder.length;
    const rowH = (this.h - padT - padB) / Math.max(1, rows);
    this.font(9, false);
    ctx.fillStyle = C.dim;
    ctx.textAlign = 'left';
    ctx.fillText(`${s.line.name}　站场作业计划　${fmt(s.clock)}`, 12, 16);
    ctx.textAlign = 'right';
    ctx.fillText('横轴 分钟 · 空心到达 / 实心出清', this.w - 12, 16);
    for (let m = Math.ceil(tStart / 15) * 15; m <= tEnd; m += 15) {
      const x = xOf(m);
      ctx.strokeStyle = m % 30 === 0 ? C.grid2 : C.grid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, padT);
      ctx.lineTo(x, this.h - padB);
      ctx.stroke();
      this.font(8, true);
      ctx.fillStyle = C.faint;
      ctx.textAlign = 'center';
      ctx.fillText(fmt(m), x, 30);
    }
    s.stationOrder.forEach((id, i) => {
      const y = padT + i * rowH;
      const conf = s.stations[id];
      ctx.strokeStyle = C.grid;
      ctx.beginPath();
      ctx.moveTo(padL, y + rowH);
      ctx.lineTo(this.w - padR, y + rowH);
      ctx.stroke();
      this.font(10, false);
      ctx.fillStyle = C.text;
      ctx.textAlign = 'right';
      ctx.fillText(conf.name, padL - 8, y + rowH / 2 - 4);
      this.font(8, true);
      ctx.fillStyle = C.faint;
      ctx.fillText(`${conf.tracks} 道`, padL - 8, y + rowH / 2 + 8);
    });
    const rowOf = (id) => padT + s.stationOrder.indexOf(id) * rowH + rowH / 2;
    s.trains.forEach((t) => {
      if (t.status === 'terminated') return;
      const y = rowOf(t.station);
      if (t.arr && t.arr >= tStart && t.arr <= tEnd) {
        const x = xOf(t.arr);
        ctx.strokeStyle = C.run;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x, y, 3.5, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (t.planDep >= tStart && t.planDep <= tEnd) {
        const x = xOf(t.planDep);
        ctx.fillStyle = t.status === 'station' ? C.late : C.faint;
        ctx.beginPath();
        ctx.arc(x, y, 2.5, 0, Math.PI * 2);
        ctx.fill();
        this.font(8, true);
        ctx.fillStyle = C.dim;
        ctx.textAlign = 'left';
        ctx.fillText(t.no, x + 6, y - 5);
      }
    });
    const nx = xOf(s.clock);
    ctx.strokeStyle = C.now;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(nx, padT);
    ctx.lineTo(nx, this.h - padB);
    ctx.stroke();
    this.font(8, true);
    ctx.fillStyle = C.now;
    ctx.textAlign = 'center';
    ctx.fillText(fmt(s.clock), nx, this.h - 10);
  }

  drawTracks(s) {
    const ctx = this.ctx;
    const focus = s.focusStation || s.stationOrder[0];
    const tracks = s.tracks.get ? s.tracks.get(focus) : [];
    const padL = 60;
    const padT = 46;
    const span = 60;
    const tEnd = s.clock + span * 0.55;
    const tStart = tEnd - span;
    const xOf = (m) => padL + ((m - tStart) / span) * (this.w - padL - 16);
    const n = tracks.length;
    const rowH = (this.h - padT - 20) / Math.max(1, n);
    this.font(9, true);
    for (let m = Math.ceil(tStart / 10) * 10; m <= tEnd; m += 10) {
      const x = xOf(m);
      ctx.strokeStyle = m % 30 === 0 ? C.grid2 : C.grid;
      ctx.beginPath(); ctx.moveTo(x, padT - 10); ctx.lineTo(x, this.h - 20); ctx.stroke();
      if (m % 30 === 0) { ctx.fillStyle = C.dim; ctx.fillText(clockStr(m), x - 12, padT - 15); }
    }
    tracks.forEach((tr, k) => {
      const y = padT + k * rowH + rowH / 2;
      ctx.strokeStyle = C.grid2;
      ctx.beginPath(); ctx.moveTo(padL - 6, y); ctx.lineTo(this.w - 16, y); ctx.stroke();
      this.font(10, false);
      ctx.fillStyle = C.text;
      ctx.textAlign = 'right';
      ctx.fillText(`${tr.no} 道`, padL - 12, y);
      ctx.textAlign = 'left';
      if (!s.trains.some((t) => t.station === focus && t.trackNo === tr.no && t.status !== 'pending' && t.status !== 'terminated')) {
        this.font(9, false);
        ctx.fillStyle = C.faint;
        ctx.fillText('空闲', padL + 8, y - 4);
      }
    });
    for (const t of s.trains) {
      if (t.status === 'pending' || t.station !== focus) continue;
      const k = (t.trackNo || 1) - 1;
      if (k < 0 || k >= n) continue;
      const y = padT + k * rowH + rowH / 2;
      const tr0 = t.trace && t.trace.length ? t.trace[0].m : s.clock;
      const trN = t.trace && t.trace.length ? t.trace[t.trace.length - 1].m : s.clock;
      const x1 = xOf(Math.min(tr0, t.planArr || tr0));
      const x2 = xOf(t.status === 'terminated' ? trN : s.clock);
      const color = t.status === 'terminated' ? C.plan : t.late > 12 ? C.bad : t.late > 4 ? C.late : TYPE_COLOR[t.type];
      ctx.fillStyle = color;
      ctx.globalAlpha = t.status === 'terminated' ? 0.35 : 0.85;
      ctx.fillRect(x1, y - 5, Math.max(2, x2 - x1), 10);
      ctx.globalAlpha = 1;
      this.font(9, true);
      ctx.fillStyle = C.bg;
      if (x2 - x1 > 40) ctx.fillText(t.no, x1 + 4, y);
      if (t.status === 'station' && t.planDep > s.clock) {
        const xD = xOf(t.planDep);
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.5;
        ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(x2, y); ctx.lineTo(xD, y); ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
        this.font(8.5, true);
        ctx.fillStyle = C.dim;
        ctx.fillText(`${clockStr(t.planDep)} 发`, xD + 3, y - 6);
      }
    }
    const nowX = xOf(s.clock);
    ctx.strokeStyle = C.now;
    ctx.beginPath(); ctx.moveTo(nowX, padT - 10); ctx.lineTo(nowX, this.h - 20); ctx.stroke();
    this.font(9, false);
    ctx.fillStyle = C.faint;
    if (this.w >= 560) ctx.fillText('本站股道占用 · 实线已占用，虚线到计划发车', 12, 12);
  }

  click(e) {
    if (!this.hits) return;
    const rect = this.canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const f = this.hits.find((h) => mx >= h.x && mx <= h.x + h.w && my >= h.y && my <= h.y + h.h);
    if (f) this.onInspect(f.id);
  }
}

function clockStr(m) {
  const hh = String(Math.floor(m / 60) % 24).padStart(2, '0');
  const mm = String(Math.floor(m % 60)).padStart(2, '0');
  return `${hh}:${mm}`;
}
