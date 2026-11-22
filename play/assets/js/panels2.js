import { el, on, fmtClock, storage, toast, escapeHtml } from './util.js';
import { sim } from './sim.js';

const SANDBOX_GROUPS = [
  { id: 'L0', name: '基础设施', items: ['股道开放', '股道封锁', '股道预留', '借道货物线', '站台类型', '闭塞方式', '列控等级'] },
  { id: 'L1', name: '设备', items: ['设备健康度', '故障注入', '预防性维护', '热备资源', '救援资源'] },
  { id: 'L2', name: '作业', items: ['调车作业', '编组解编', '货运作业', '客运作业', '车辆段作业', '乘务交路', '车底接续'] },
  { id: 'L3', name: '人员', items: ['单/多台', '有人/无人站', '乘务超劳', 'AI 助调错误率'] },
  { id: 'L4', name: '环境', items: ['天气演化', '地质灾害', '异物侵限', '防洪三检'] },
  { id: 'L5', name: '管理', items: ['天窗修', '施工', '临客加挂', '春运暑运', '专运', '分界口', '交接班', '舆情', '预算'] },
  { id: 'L6', name: '游戏层', items: ['自动进路', '超时报警', '命令校验', '传播模型', '推荐处置', '复盘详细度', '图鉴', '成就'] },
];

export function sandboxState() {
  const s = storage('tst-dispatch-sandbox') || {};
  const out = {};
  for (const g of SANDBOX_GROUPS) for (const it of g.items) {
    const key = `${g.id}:${it}`;
    out[key] = s[key] !== undefined ? !!s[key] : true;
  }
  return out;
}

export function buildSandboxPanel(body, ctx) {
  const wrap = el('div', 'pane sb-pane');
  const head = el('div', 'pane-title', '沙盒规则开关');
  head.append(el('span', 'mono', '依赖缺失会提示'));
  wrap.append(head);
  const grid = el('div', 'sb-grid');
  const state = storage('tst-dispatch-sandbox') || {};
  SANDBOX_GROUPS.forEach((g) => {
    const box = el('div', 'sb-box');
    box.append(el('div', 'sb-box-h', `${g.id} ${g.name}`));
    g.items.forEach((it) => {
      const row = el('label', 'sb-toggle');
      const cb = el('input');
      cb.type = 'checkbox';
      const key = `${g.id}:${it}`;
      cb.checked = state[key] !== undefined ? !!state[key] : true;
      cb.addEventListener('change', () => {
        state[key] = cb.checked;
        storage('tst-dispatch-sandbox', state);
        if (ctx && ctx.sandboxChange) ctx.sandboxChange(key, cb.checked);
        const dependencies = { 'L2:车底接续': ['L0:闭塞方式'], 'L2:危险品隔离': ['L2:货运作业'], 'L5:专运': ['L3:单/多台'] };
        const dep = dependencies[key];
        if (dep && cb.checked) {
          const missing = dep.filter((d) => state[d] === false);
          if (missing.length) toast(`依赖缺失：${missing.join('、')}`, 'err');
        }
      });
      row.append(cb, el('span', '', it));
      box.append(row);
    });
    grid.append(box);
  });
  wrap.append(grid);
  body.append(wrap);
  return { update() {} };
}

export function buildDepotPanel(body) {
  const wrap = el('div', 'pane depot-pane');
  const head = el('div', 'pane-title', '段所状态');
  head.append(el('span', 'mono', '临河'));
  wrap.append(head);
  const grid = el('div', 'depot-grid');
  const unis = [
    { name: '动车所', lines: ['检修线', '洗车线', '存车线', '临修线', '融冰线'], load: 5, cap: 8 },
    { name: '客整所', lines: ['整备线', '存车线', '洗车线', '消毒线'], load: 4, cap: 6 },
    { name: '机务折返段', lines: ['整备线', '折返线', '检修线', '机走线'], load: 3, cap: 5 },
    { name: '站修所', lines: ['站修线', '洗罐线', '轮对线'], load: 2, cap: 4 },
  ];
  unis.forEach((u) => {
    const card = el('div', 'depot-card');
    card.append(el('div', 'dp-name', u.name));
    const bar = el('div', 'dp-bar');
    const fill = el('div', 'dp-fill');
    fill.style.width = `${(u.load / u.cap) * 100}%`;
    bar.append(fill);
    card.append(bar);
    card.append(el('div', 'dp-meta mono', `${u.load}/${u.cap} 线占用`));
    const ul = el('div', 'dp-lines');
    u.lines.forEach((l, i) => {
      const r = el('div', `dp-line ${i < Math.min(2, u.load) ? 'busy' : ''}`);
      r.append(el('span', '', l));
      r.append(el('span', 'mono', i < Math.min(2, u.load) ? '占用' : '空闲'));
      ul.append(r);
    });
    card.append(ul);
    grid.append(card);
  });
  wrap.append(grid);
  wrap.append(el('div', 'hint', '段所是车底接续的源头：出所晚 3 分钟，始发就晚 3 分钟，往下传三趟。'));
  body.append(wrap);
  return { update() {} };
}

export function buildWorkshopPanel(body, ctx) {
  const wrap = el('div', 'pane workshop-pane');
  const head = el('div', 'pane-title', '创意工坊');
  head.append(el('span', 'mono', 'JSON 关卡'));
  wrap.append(head);
  wrap.append(el('div', 'hint', '工坊关卡 = 一条线路 + 一组列车 + 事件偏好 + 一套沙盒开关。导入后可直接开跑，也能导出上传。'));
  const btns = el('div', 'wp-btns');
  const imp = el('button', 'btn', '导入关卡');
  const exp = el('button', 'btn', '导出当前场景');
  const ex = el('button', 'btn', '下载示例关卡');
  btns.append(imp, exp, ex);
  wrap.append(btns);
  const file = el('input');
  file.type = 'file';
  file.accept = '.json,application/json';
  file.style.display = 'none';
  wrap.append(file);
  const list = el('div', 'wp-list');
  wrap.append(list);
  on(imp, 'click', () => file.click());
  on(file, 'change', () => {
    const f = file.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data.scene) throw new Error('缺少 scene');
        if (ctx && ctx.loadWorkshop) ctx.loadWorkshop(data);
        toast('关卡已导入', 'ok');
      } catch (e) { toast(`导入失败：${e.message}`, 'err'); }
    };
    reader.readAsText(f);
  });
  on(exp, 'click', () => { if (ctx && ctx.exportScene) ctx.exportScene(); });
  on(ex, 'click', () => { if (ctx && ctx.downloadExample) ctx.downloadExample(); });
  const saved = storage('tst-dispatch-workshop') || [];
  if (!saved.length) list.append(el('div', 'hint', '本地还没有工坊关卡。导入一个试试。'));
  else {
    saved.forEach((w) => {
      const row = el('div', 'wp-row');
      row.append(el('span', '', `${w.name}（${w.line || '未知线路'}）`));
      const b = el('button', 'btn', '载入');
      b.addEventListener('click', () => { if (ctx && ctx.loadWorkshop) ctx.loadWorkshop(w); });
      row.append(b);
      list.append(row);
    });
  }
  body.append(wrap);
  return { update() {} };
}

export function buildHelpPanel(body) {
  const wrap = el('div', 'pane help-pane');
  wrap.innerHTML = `
    <div class="pane-title">值班手册<span class="mono">第 1 版</span></div>
    <div class="help-sec"><h4>你在做什么</h4><p>你是列调，不是司机。你只能通过进路、股道、命令、资源和运行计划去影响列车。站场图看占用，运行图看偏离，命令终端下指令，报警栏盯异常，事件处置做取舍。</p></div>
    <div class="help-sec"><h4>一波处置的顺序</h4><ol>
      <li>先看报警栏，分清是车、设备还是人的问题。</li>
      <li>看站场图，确认是哪条股道、哪个区间，别只听电话。</li>
      <li>看运行图，判断会传染给哪几趟。</li>
      <li>在事件窗口选分支：快但险，还是慢但稳。</li>
      <li>必须封锁/限速的，去命令终端正式下命令，别只口头。</li>
      <li>顶不住再用热备或救援，底牌有限。</li>
    </ol></div>
    <div class="help-sec"><h4>快捷键</h4><p class="mono">空格 暂停 · 1/2/3 倍速 · G 运行图 · C 命令 · E 事件 · A 报警 · T 术语</p></div>
    <div class="help-sec"><h4>失败条件</h4><p>正面冲突、追尾、脱轨直接结束；关键列车晚点超阈值、到发线全满、救援无法开出也可能判负。</p></div>`;
  body.append(wrap);
  return { update() {} };
}

export function buildInspectPanel(body, ctx) {
  const wrap = el('div', 'pane inspect-pane action-pane');
  const kicker = el('div', 'act-kicker', '这列车下一步');
  const title = el('div', 'act-title', '选一列车');
  const meta = el('div', 'act-meta', '');
  const note = el('div', 'act-note', '');
  const actions = el('div', 'act-actions');
  const tracksBox = el('div', 'act-tracks');
  const detail = el('div', 'act-detail');
  wrap.append(kicker, title, meta, note, actions, tracksBox, detail);
  let showTracks = false;
  let showDetail = false;
  function render() {
    const id = ctx.inspectId && ctx.inspectId();
    const t = id ? sim.getTrain(id) : null;
    actions.innerHTML = '';
    tracksBox.innerHTML = '';
    detail.innerHTML = '';
    if (!t) {
      title.textContent = '选一列车';
      meta.classList.remove('is-grid');
      meta.textContent = '在站场图或运行图上点一列车。';
      note.textContent = '';
      wrap.classList.remove('is-running');
      return;
    }
    const stationName = sim.stations[t.station] ? sim.stations[t.station].name : '—';
    const controlled = sim.isStationControlled(t.station);
    wrap.classList.toggle('is-running', t.status === 'running');
    title.innerHTML = `<b>${escapeHtml(t.no)}</b><span class="act-chip">${escapeHtml(t.type || '列车')}</span>`;
    const stateText = t.release ? '已放行' : t.late ? `晚 ${t.late} 分` : '正点';
    meta.classList.add('is-grid');
    meta.innerHTML = `<div class="ai-cell"><span>位置</span><b>${stationName}${t.trackNo ? ` · ${t.trackNo} 道` : ''}</b></div><div class="ai-cell"><span>计划</span><b>${fmtClock(t.planDep)} 发</b></div><div class="ai-cell"><span>状态</span><b>${stateText}</b></div><div class="ai-cell"><span>编组</span><b>${t.coaches || '—'} 辆</b></div>`;
    note.textContent = '';
    if (t.status === 'running') {
      note.textContent = '这列车已经在区间里，调度台不能再改它的走向，只能看它到哪一站。';
      const b = el('button', 'act-btn', '看它在运行图上的位置');
      b.addEventListener('click', () => { if (ctx.showGraph) ctx.showGraph(); });
      actions.append(b);
      return;
    }
    if (!controlled && (t.status === 'station' || t.status === 'pending' || t.status === 'waiting')) {
      note.textContent = '本站现在由电脑按计划自动发车。你要先接管，才能决定它什么时候走。';
    } else if (t.release) {
      note.textContent = '已经放行。列车出清本站后，这条股道会自动空出来。';
    } else if (t.status === 'station' || t.status === 'pending' || t.status === 'waiting') {
      note.textContent = `放行后，${t.no} 进入下一区间，本站 ${t.trackNo || 1} 道随即空出。`;
    }
    if (t.status === 'station' || t.status === 'pending' || t.status === 'waiting') {
      if (!controlled) {
        const take = el('button', 'act-btn act-main', '接管本站，改成手动发车');
        take.addEventListener('click', () => {
          sim.setStationControl(t.station, true);
          toast(`${stationName} 已接管`, 'ok');
          render();
        });
        actions.append(take);
      } else if (!t.release) {
        const rel = el('button', 'act-btn act-main', '放行出站');
        rel.addEventListener('click', () => {
          sim.releaseTrain(t.id);
          toast(`${t.no} 已放行，下一站按运行图走`, 'ok');
          render();
        });
        actions.append(rel);
      } else {
        const done = el('button', 'act-btn act-main', '已放行 · 等待出清');
        done.disabled = true;
        actions.append(done);
      }
      const row = el('div', 'act-row');
      const ctl = el('button', 'act-btn act-sub', controlled ? '交回本站' : '接管本站');
      ctl.addEventListener('click', () => {
        sim.setStationControl(t.station, !controlled);
        toast(`${stationName} ${controlled ? '交回自律' : '已接管'}`, 'ok');
        render();
      });
      row.append(ctl);
      const trk = el('button', 'act-btn act-sub', showTracks ? '收起股道' : '换一条股道');
      trk.addEventListener('click', () => { showTracks = !showTracks; render(); });
      row.append(trk);
      const cmd = el('button', 'act-btn act-sub', '下发调度命令');
      cmd.addEventListener('click', () => { if (ctx.openCommand) ctx.openCommand(t.id); });
      row.append(cmd);
      actions.append(row);
      if (showTracks && t.station) {
        const list = sim.tracks.get(t.station) || [];
        tracksBox.append(el('div', 'act-sub-title', '把车换到哪条线'));
        const grid = el('div', 'act-tr-grid');
        list.forEach((tr) => {
          const b = el('button', `act-tr ${tr.train === t.id ? 'on' : ''} ${tr.blocked || (tr.train && tr.train !== t.id) ? 'off' : ''}`, `${tr.no} 道`);
          b.addEventListener('click', () => {
            if (tr.train === t.id) { toast('已经停在这条线'); return; }
            if (sim.assignTrack(t.id, t.station, tr.no)) { toast(`${t.no} → ${tr.no} 道`, 'ok'); render(); }
            else toast(`${tr.no} 道现在不能用`, 'err');
          });
          grid.append(b);
        });
        tracksBox.append(grid);
      }
      const det = el('button', 'act-btn act-link', showDetail ? '收起全部信息' : '查看全部信息');
      det.addEventListener('click', () => { showDetail = !showDetail; render(); });
      actions.append(det);
      if (showDetail) {
        const rows = [
          ['状态', t.status], ['计划发/到', `${fmtClock(t.planDep)} / ${fmtClock(t.planArr)}`],
          ['实际发/到', `${t.departAt ? fmtClock(t.departAt) : '—'} / ${t.arriveReal ? fmtClock(t.arriveReal) : '—'}`],
          ['车底组', t.stock || '—'], ['编组', `${t.coaches} 辆`], ['乘务', `${t.crew} 班`],
        ];
        rows.forEach(([k, v]) => {
          const r = el('div', 'kv');
          r.append(el('span', '', k));
          r.append(el('b', '', String(v)));
          detail.append(r);
        });
      }
    }
  }
  render();
  sim.subscribe((s, evt) => { if (evt === 'tick' || evt === 'route' || evt === 'control') render(); });
  body.append(wrap);
  return { update: render };
}


export function buildStationPanel(body) {
  const wrap = el('div', 'pane station-pane');
  const bar = el('div', 'stn-bar');
  const count = el('span', 'stn-count mono', '0 站接管');
  const allOn = el('button', 'btn btn-sm', '全部接管');
  const allOff = el('button', 'btn btn-sm', '全部交回');
  allOn.addEventListener('click', () => { sim.controlAll(true); render(); });
  allOff.addEventListener('click', () => { sim.controlAll(false); render(); });
  bar.append(count, allOn, allOff);
  wrap.append(bar);
  const grid = el('div', 'station-grid');
  wrap.append(grid);

  function render() {
    grid.innerHTML = '';
    count.textContent = `${sim.control.size} / ${sim.stationOrder.length} 站接管`;
    sim.stationOrder.forEach((id) => {
      const conf = sim.stations[id];
      const controlled = sim.isStationControlled(id);
      const card = el('div', `station-card ${controlled ? 'ctl' : ''}`);
      const h = el('div', 'stc-head');
      h.append(el('span', 'stc-name', conf.name));
      h.append(el('span', 'tag', conf.unmanned ? '无人' : conf.type));
      const cb = el('button', `stc-ctl ${controlled ? 'on' : ''}`, controlled ? '交回' : '接管');
      cb.title = controlled ? '交回调度中心自律控制' : '本站转站控，发车需逐列放行';
      cb.addEventListener('click', () => { sim.setStationControl(id, !controlled); render(); });
      h.append(cb);
      card.append(h);

      const tracks = sim.tracks.get(id) || [];
      const row = el('div', 'stc-tracks');
      tracks.forEach((tr) => {
        const b = el('div', `stc-tr ${tr.blocked ? 'blk' : ''} ${tr.train ? 'busy' : ''} ${tr.reserved ? 'res' : ''}`);
        b.append(el('span', 'mono', `${tr.no}`));
        b.append(el('span', 'stc-tr-x', tr.train ? sim.getTrain(tr.train).no : tr.blocked ? '封锁' : tr.reserved ? '预留' : '空'));
        b.addEventListener('click', () => {
          if (tr.blocked) sim.openRoute(id, tr.no);
          else sim.blockTrack(id, tr.no, 15);
          render();
        });
        row.append(b);
      });
      card.append(row);

      const at = sim.trains.filter((t) => t.station === id && (t.status === 'station' || t.status === 'pending' || t.status === 'waiting'));
      if (at.length) {
        const list = el('div', 'stc-trains');
        at.forEach((t) => {
          const r = el('div', 'stc-train');
          r.append(el('span', 'mono', t.no));
          r.append(el('span', 'stc-state', t.status === 'running' ? '区间' : t.status === 'station' ? (controlled ? '待放行' : '站内') : t.status === 'waiting' ? '站外' : '待发'));
          if (controlled && (t.status === 'station' || t.status === 'pending')) {
            const rel = el('button', 'stc-rel', '放行');
            rel.addEventListener('click', () => { sim.releaseTrain(t.id); render(); });
            r.append(rel);
          }
          list.append(r);
        });
        card.append(list);
      }
      grid.append(card);
    });
  }
  render();
  sim.subscribe((s, evt) => { if (evt === 'tick' || evt === 'route' || evt === 'control') render(); });
  body.append(wrap);
  return { update: render };
}

export function showReview(body, ctx) {
  const m = sim.metrics;
  const wrap = el('div', 'pane review-pane');
  wrap.innerHTML = `
    <div class="pane-title">复盘摘要<span class="mono">${escapeHtml(sim.scene.title)}</span></div>
    <div class="rv-line"><span>运行时长</span><b>${sim.clock - sim.startClock} 分</b></div>
    <div class="rv-line"><span>终到</span><b>${m.terminated || 0} / ${m.total || 0}</b></div>
    <div class="rv-line"><span>正点率</span><b>${Math.round(m.punctual || 0)}%</b></div>
    <div class="rv-line"><span>平均晚点</span><b>${m.avgLate || 0} 分</b></div>
    <div class="rv-line"><span>险性事件</span><b>${m.incidents}</b></div>
    <div class="rv-line"><span>评级</span><b>${rating(sim.scoreTotal())}</b></div>`;
  const chain = el('div', 'rv-chain');
  chain.append(el('div', 'pane-title', '传播链'));
  const bad = sim.decisions.filter((d) => d.risk === '高' || d.fail).slice(-8);
  if (!bad.length) chain.append(el('div', 'hint', '本场没有高风险决策，传播链被压住了。'));
  bad.forEach((d) => {
    const r = el('div', 'rv-chain-row');
    r.append(el('span', 'mono', fmtClock(d.t)));
    r.append(el('span', '', `${d.title} → ${d.branch}`));
    if (d.fail) r.append(el('span', 'dc-f', '险性'));
    chain.append(r);
  });
  wrap.append(chain);
  const btns = el('div', 'rv-btns');
  const again = el('button', 'btn btn-paper', '再开一场');
  const close = el('button', 'btn', '关闭');
  btns.append(again, close);
  wrap.append(btns);
  on(again, 'click', () => { if (ctx && ctx.restart) ctx.restart(); });
  on(close, 'click', () => { if (ctx && ctx.closeReview) ctx.closeReview(); });
  body.innerHTML = '';
  body.append(wrap);
}

export function rating(score) {
  if (score >= 90) return 'A+ 调度长';
  if (score >= 82) return 'A 值班主任';
  if (score >= 72) return 'B 熟练列调';
  if (score >= 60) return 'C 合格调度员';
  if (score >= 45) return 'D 学员';
  return 'E 回炉重训';
}
