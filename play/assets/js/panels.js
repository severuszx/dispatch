import { el, on, fmtClock, escapeHtml, storage, toast, clamp } from './util.js';
import { sim } from './sim.js';

export const termShow = (term) => {
  const card = document.getElementById('termCard');
  if (!card || !term) return;
  card.innerHTML = `
    <h3>${escapeHtml(term.term)}</h3>
    <div class="tc-en">${escapeHtml(term.en || '')}</div>
    <div class="tc-plain">${escapeHtml(term.plain)}</div>
    <div class="tc-line"><span class="tc-k">游戏里</span><span>${escapeHtml(term.impact)}</span></div>
    <div class="tc-line"><span class="tc-k">常见误解</span><span>${escapeHtml(term.myth)}</span></div>
    <div class="tc-foot"><span class="hint">记入术语掌握清单</span><button class="btn btn-paper" id="tcClose">知道了</button></div>`;
  card.classList.remove('hidden');
  on(card.querySelector('#tcClose'), 'click', () => card.classList.add('hidden'));
  on(card, 'click', (e) => { if (e.target === card) card.classList.add('hidden'); });
  setTimeout(() => card.classList.add('hidden'), 14000);
};

export function buildAlarmPanel(body) {
  const wrap = el('div', 'pane alarm-pane');
  const head = el('div', 'pane-title', '报警栏');
  const count = el('span', 'mono', '0');
  head.append(count);
  wrap.append(head);
  const filter = el('div', 'alarm-filter');
  let cur = '全部';
  ['全部', '事件', '晚点', '命令', '事故', '站外'].forEach((f) => {
    const b = el('button', `chip ${f === '全部' ? 'on' : ''}`, f);
    b.addEventListener('click', () => { filter.querySelectorAll('.chip').forEach((x) => x.classList.remove('on')); b.classList.add('on'); cur = f; render(); });
    filter.append(b);
  });
  wrap.append(filter);
  const list = el('div', 'alarm-list');
  wrap.append(list);
  function render() {
    list.innerHTML = '';
    const rows = sim.alarms.filter((a) => cur === '全部' || a.kind.includes(cur)).slice(0, 60);
    count.textContent = String(sim.alarms.filter((a) => !a.ack).length);
    if (!rows.length) { list.append(el('div', 'al-empty', '没有未处理报警。')); return; }
    rows.forEach((a) => {
      const row = el('div', `al-row ${a.level} ${a.ack ? 'ack' : ''}`);
      row.append(el('span', 'al-t', fmtClock(a.t)));
      row.append(el('span', 'al-k', a.kind));
      row.append(el('span', 'al-x', a.text));
      const ack = el('button', 'al-ack', a.ack ? '已确认' : '确认');
      ack.addEventListener('click', () => { sim.ackAlarm(a.id); render(); });
      row.append(ack);
      list.append(row);
    });
  }
  render();
  sim.subscribe((s, evt) => { if (evt === 'tick' || evt === 'alarm') render(); });
  body.append(wrap);
  return { update: render };
}

export function buildEventPanel(body) {
  const wrap = el('div', 'pane evt-pane');
  const head = el('div', 'pane-title', '事件处置');
  const badge = el('span', 'tag y', '0');
  head.append(badge);
  wrap.append(head);
  const list = el('div', 'evt-list');
  wrap.append(list);
  const hist = el('div', 'evt-hist');
  wrap.append(hist);
  function branchBtn(br, inst) {
    const b = el('button', `ev-branch ${br.tone}`);
    b.innerHTML = `<span class="eb-top"><span class="eb-label">${escapeHtml(br.label)}</span><span class="eb-risk">${br.risk}</span></span>
      <span class="eb-eff">${escapeHtml(br.effect)}</span>
      <span class="eb-why">${escapeHtml(br.why)}</span>`;
    b.addEventListener('click', () => {
      const res = sim.resolveEvent(inst.instId, br.id);
      if (res) toast(res.fail ? '处置失败，已计入险性事件' : '处置完成', res.fail ? 'err' : 'ok');
      render();
    });
    return b;
  }
  function render() {
    list.innerHTML = '';
    badge.textContent = String(sim.activeEvents.length);
    if (!sim.activeEvents.length) list.append(el('div', 'ev-empty', '当前没有待处置事件。若长时间无事件，说明这一班很干净。'));
    sim.activeEvents.forEach((inst) => {
      const card = el('div', `ev-card sev${inst.severity}`);
      const top = el('div', 'ev-top');
      top.append(el('span', 'ev-code mono', inst.code));
      top.append(el('span', 'ev-title', inst.title));
      top.append(el('span', 'ev-sev', `S${inst.severity}`));
      card.append(top);
      const meta = el('div', 'ev-meta');
      const tr = inst.targetTrain ? sim.getTrain(inst.targetTrain) : null;
      meta.append(el('span', '', tr ? `${tr.no} · ${sim.stations[tr.station] ? sim.stations[tr.station].name : ''}` : '全线'));
      meta.append(el('span', '', `${inst.stage ? inst.stage[0] : '运行'} / ${inst.positions ? inst.positions[0] : '区间'}`));
      meta.append(el('span', '', `剩余 ${Math.max(0, inst.deadline - sim.clock)} 分`));
      card.append(meta);
      card.append(el('div', 'ev-desc', inst.desc));
      card.append(el('div', 'ev-radio', inst.radio));
      const branches = el('div', 'ev-branches');
      inst.branches.forEach((br) => branches.append(branchBtn(br, inst)));
      card.append(branches);
      list.append(card);
    });
    hist.innerHTML = '';
    const rows = sim.eventHistory.slice(-5).reverse();
    if (rows.length) {
      hist.append(el('div', 'pane-title', '最近处置'));
      rows.forEach((h) => {
        const r = el('div', 'ev-hist-row');
        r.append(el('span', 'mono', fmtClock(h.resolvedAt || h.at)));
        r.append(el('span', '', h.title));
        r.append(el('span', 'ev-out', h.outcome));
        hist.append(r);
      });
    }
  }
  render();
  sim.subscribe((s, evt) => { if (evt === 'tick' || evt === 'event' || evt === 'resolve') render(); });
  body.append(wrap);
  return { update: render };
}

export function buildTrainsPanel(body, ctx) {
  const wrap = el('div', 'pane trains-pane');
  const head = el('div', 'pane-title', '列车一览');
  head.append(el('span', 'mono', `${sim.trains.length} 列`));
  wrap.append(head);
  const table = el('div', 'tr-table');
  wrap.append(table);
  function render() {
    table.innerHTML = '';
    const hdr = el('div', 'tr-row tr-head');
    ['车次', '等级', '状态', '位置', '股道', '晚点'].forEach((x) => hdr.append(el('span', '', x)));
    table.append(hdr);
    sim.trains.slice().sort((a, b) => a.planDep - b.planDep).forEach((t) => {
      const row = el('div', `tr-row ${t.late > 12 ? 'late2' : t.late > 4 ? 'late1' : ''}`);
      row.append(el('span', 'tr-no', t.no));
      row.append(el('span', '', t.type));
      row.append(el('span', '', t.status === 'running' ? '区间' : t.status === 'station' ? '站内' : t.status === 'waiting' ? (t.holdOutside ? '站外' : '待发') : '终到'));
      row.append(el('span', '', t.status === 'running' && t.section ? `${sim.stations[t.section.a].name}—${sim.stations[t.section.b].name}` : (t.station ? sim.stations[t.station].name : '—')));
      row.append(el('span', 'mono', t.trackNo ? `${t.trackNo}` : '—'));
      row.append(el('span', 'mono', t.late ? `+${t.late}` : '正点'));
      row.addEventListener('click', () => ctx.inspect(t.id));
      table.append(row);
    });
  }
  render();
  sim.subscribe((s, evt) => { if (evt === 'tick') render(); });
  body.append(wrap);
  return { update: render };
}

export function buildTrackGantt(body) {
  const wrap = el('div', 'pane gantt-pane');
  const head = el('div', 'pane-title', '股道占用甘特');
  head.append(el('span', 'mono', '60 分钟窗口'));
  wrap.append(head);
  const holder = el('div', 'gantt-holder');
  const canvas = el('canvas', 'gantt-canvas');
  holder.append(canvas);
  wrap.append(holder);
  const draw = () => {
    const w = Math.max(300, holder.clientWidth);
    const h = Math.max(160, holder.clientHeight);
    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr; canvas.height = h * dpr;
    canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#10161a'; ctx.fillRect(0, 0, w, h);
    const stId = sim.stationOrder[sim.stationOrder.length - 1];
    const rows = sim.tracks.get(stId) || [];
    const lineH = Math.max(14, (h - 30) / Math.max(1, rows.length));
    const t0 = sim.clock - 30;
    const span = 60;
    const xOf = (m) => 40 + ((m - t0) / span) * (w - 48);
    ctx.font = '9px Consolas,monospace';
    for (let m = Math.ceil(t0 / 10) * 10; m <= t0 + span; m += 10) {
      const x = xOf(m);
      ctx.strokeStyle = m % 30 === 0 ? '#2b353d' : '#202930';
      ctx.beginPath(); ctx.moveTo(x, 14); ctx.lineTo(x, h - 12); ctx.stroke();
      ctx.fillStyle = '#4b5760';
      ctx.fillText(fmtClock(m), x - 10, 10);
    }
    rows.forEach((tr, i) => {
      const y = 22 + i * lineH;
      ctx.strokeStyle = '#232c33';
      ctx.beginPath(); ctx.moveTo(34, y + lineH - 3); ctx.lineTo(w - 6, y + lineH - 3); ctx.stroke();
      ctx.fillStyle = '#6a787f';
      ctx.fillText(`${tr.no} 道`, 6, y + lineH / 2 + 2);
      if (tr.train) {
        const t = sim.getTrain(tr.train);
        if (t) {
          const start = t.arriveReal || t.planArr;
          const end = t.status === 'station' ? sim.clock : (t.departAt || sim.clock);
          const x1 = xOf(start);
          const x2 = xOf(end);
          ctx.fillStyle = t.type === 'G' ? 'rgba(213,81,60,.35)' : t.type === '货' ? 'rgba(140,122,82,.35)' : 'rgba(78,149,198,.32)';
          ctx.fillRect(x1, y + 2, Math.max(2, x2 - x1), lineH - 7);
          ctx.strokeStyle = '#5b6b74';
          ctx.strokeRect(x1 + .5, y + 2.5, Math.max(2, x2 - x1), lineH - 8);
          ctx.fillStyle = '#dfe7ec';
          ctx.fillText(t.no, Math.min(x2 - 30, x1 + 3), y + lineH / 2 + 1);
        }
      }
      if (tr.blocked) {
        ctx.fillStyle = 'rgba(213,81,60,.18)';
        ctx.fillRect(40, y + 2, w - 48, lineH - 7);
        ctx.fillStyle = '#d5513c';
        ctx.fillText('封锁', 44, y + lineH / 2 + 1);
      }
    });
    const nx = xOf(sim.clock);
    ctx.strokeStyle = '#d5513c';
    ctx.beginPath(); ctx.moveTo(nx, 14); ctx.lineTo(nx, h - 10); ctx.stroke();
  };
  draw();
  const ro = new ResizeObserver(() => draw());
  ro.observe(holder);
  sim.subscribe((s, evt) => { if (evt === 'tick') draw(); });
  body.append(wrap);
  return { update: draw };
}

export function buildScorePanel(body, ctx) {
  const wrap = el('div', 'pane score-pane');
  const head = el('div', 'pane-title', '评分与复盘');
  const total = el('span', 'mono', '0');
  head.append(total);
  wrap.append(head);
  const gauges = el('div', 'gauges');
  wrap.append(gauges);
  const bars = el('div', 'score-bars');
  wrap.append(bars);
  const decisions = el('div', 'decisions');
  wrap.append(decisions);
  const actions = el('div', 'score-actions');
  wrap.append(actions);
  function render() {
    const m = sim.metrics;
    total.textContent = `${sim.scoreTotal()} 分`;
    gauges.innerHTML = '';
    [['正点率', clamp(m.punctual || 0, 0, 100), '%'], ['安全底线', m.safety, '%'], ['命令合规', m.compliance, '%'], ['应急时效', m.effort, ''], ['资源效率', m.resource, ''], ['旅客情绪', m.emotion, '']].forEach(([k, v, u]) => {
      const g = el('div', 'gauge');
      g.append(el('span', 'g-k', k));
      g.append(el('span', 'g-v mono', `${Math.round(v)}${u}`));
      const bar = el('div', 'g-bar');
      const fill = el('div', `g-fill ${v < 40 ? 'bad' : v < 70 ? 'mid' : 'good'}`);
      fill.style.width = `${clamp(v, 0, 100)}%`;
      bar.append(fill);
      g.append(bar);
      gauges.append(g);
    });
    bars.innerHTML = '';
    [`终到 ${m.terminated || 0} / ${m.total || 0}`, `平均晚点 ${m.avgLate || 0} 分`, `事件处置 ${m.branchCount} 次`, `险性事件 ${m.incidents} 次`, `预算余额 ${m.budget}`].forEach((k, i) => {
      const r = el('div', `sb-row ${(i === 3 && m.incidents) || (i === 4 && m.budget < 400) ? 'bad' : ''}`);
      r.append(el('span', '', k));
      bars.append(r);
    });
    decisions.innerHTML = '';
    decisions.append(el('div', 'pane-title', '决策记录'));
    const rows = sim.decisions.slice(-14).reverse();
    if (!rows.length) decisions.append(el('div', 'hint', '还没有决策。'));
    rows.forEach((d) => {
      const r = el('div', `dc-row ${d.risk === '高' ? 'risk' : ''}`);
      r.append(el('span', 'dc-t mono', fmtClock(d.t)));
      r.append(el('span', 'dc-x', `${d.title} → ${d.branch}`));
      if (d.fail) r.append(el('span', 'dc-f', '险性'));
      decisions.append(r);
    });
  }
  const bReview = el('button', 'btn', '生成复盘摘要');
  const bRestart = el('button', 'btn btn-primary', '重开本场');
  actions.append(bReview, bRestart);
  on(bReview, 'click', () => { if (ctx && ctx.review) ctx.review(); });
  on(bRestart, 'click', () => { if (ctx && ctx.restart) ctx.restart(); });
  render();
  sim.subscribe((s, evt) => { if (evt === 'tick' || evt === 'resolve' || evt === 'finish') render(); });
  body.append(wrap);
  return { update: render };
}

export function buildGlossaryPanel(body) {
  const wrap = el('div', 'pane glos-pane');
  const head = el('div', 'pane-title', '术语图鉴');
  head.append(el('span', 'mono', `${sim.glossary.length} 条`));
  wrap.append(head);
  const search = el('input', 'glos-search');
  search.placeholder = '搜术语、英文或白话…';
  wrap.append(search);
  const grid = el('div', 'glos-grid');
  wrap.append(grid);
  function render() {
    const q = search.value.trim().toLowerCase();
    grid.innerHTML = '';
    const rows = sim.glossary.filter((t) => !q || t.term.toLowerCase().includes(q) || (t.en || '').toLowerCase().includes(q) || t.plain.includes(q));
    if (!rows.length) { grid.append(el('div', 'hint', '没有匹配的术语。')); return; }
    rows.forEach((t) => {
      const card = el('div', 'glos-card');
      card.append(el('div', 'gc-term', t.term));
      card.append(el('div', 'gc-en mono', t.en || ''));
      card.append(el('div', 'gc-plain', t.plain));
      card.addEventListener('click', () => termShow(t));
      grid.append(card);
    });
  }
  search.addEventListener('input', render);
  render();
  body.append(wrap);
  return { update() {} };
}
