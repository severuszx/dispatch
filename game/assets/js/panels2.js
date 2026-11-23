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
  const kicker = el('div', 'act-kicker', '本务列车');
  const title = el('div', 'act-title', '选一列车');
  const route = el('div', 'act-route', '');
  const facts = el('div', 'act-facts', '');
  const note = el('div', 'act-note', '');
  const actions = el('div', 'act-actions');
  const tracksBox = el('div', 'act-tracks');
  wrap.append(kicker, title, route, facts, note, actions, tracksBox);
  let showTracks = false;
  const fm = (v) => (typeof v === 'number' ? fmtClock(v) : '—');

  function trackState(t, tr) {
    const list = sim.tracks.get(t.station) || [];
    if (tr.no === t.trackNo) return { label: t.status === 'station' ? '本列占用' : '本列已预留', ok: false, self: true };
    const conf = sim.stations[t.station] || {};
    const role = sim.trackRole(conf, tr.no);
    if (sim.hubMode && t.freight && role === 'platform') return { label: '客运站台，不接货车', ok: false };
    if (sim.hubMode && !t.freight && role === 'freight') return { label: '货场线路，不接客车', ok: false };
    if (tr.blocked) return { label: '封锁', ok: false };
    if (tr.reserved && tr.train !== t.id) return { label: '他车预留', ok: false };
    if (tr.train && tr.train !== t.id) {
      const other = sim.getTrain(tr.train);
      return { label: other && other.reserved ? '他车预留' : '占用', ok: false };
    }
    if (tr.lenM && t.lengthM > tr.lenM) return { label: '长度不足', ok: false };
    const half = Math.ceil(list.length / 2);
    if (sim.hubMode && list.length >= 3 && role === 'mixed' && ((t.dir > 0 && tr.no > half) || (t.dir < 0 && tr.no <= half))) return { label: '方向不符', ok: false };
    return { label: role === 'freight' ? '货场可用' : role === 'platform' ? '站台可用' : '可用', ok: true };
  }

  function reason(t, controlled) {
    if (t.status === 'running') return '列车已在区间内运行，本站只监视，不再改动进路。';
    if (t.status === 'approach' || t.status === 'pending') {
      if (!t.trackNo) return `计划 ${fmtClock(t.planArr)} 到站，现在先预排接车股道，到点自动接入。一直不排股道会在站外压车，压满 ${sim.limits.wait} 分判负。`;
      if (sim.clock < t.planArr) return `已预留 ${t.trackNo} 道，${fmtClock(t.planArr)} 到点自动接入，接入前可换线。`;
      return `已预留 ${t.trackNo} 道，等股道条件满足后接入；站外已停 ${sim.clock - t.planArr} 分，限 ${sim.limits.wait} 分。`;
    }
    if (t.release) return '已放行，等待列车出清。出清前股道仍被占用。';
    if (t.hold) return `已超过计划发车 ${t.late} 分，仍占用 ${t.trackNo || '—'} 道。再压下去会撞晚点红线。`;
    if (!controlled) return '本站当前为自动放行，列车按计划点直接发车，不会等你。';
    if (sim.clock < t.planDep - 1) return `计划 ${fmtClock(t.planDep)} 发车。核对进路和邻线后，可提前给放行信号。`;
    return '已到计划发车点，等值班员放行信号。';
  }

  function render() {
    const id = ctx.inspectId && ctx.inspectId();
    const t = id ? sim.getTrain(id) : null;
    actions.innerHTML = '';
    tracksBox.innerHTML = '';
    if (!t) {
      title.innerHTML = '<b>选一列车</b>';
      route.innerHTML = '';
      facts.innerHTML = '';
      note.textContent = '在站场图上点一列车，或点站外的待接标签。';
      wrap.classList.remove('is-running');
      return;
    }
    const stationName = sim.stations[t.station] ? sim.stations[t.station].name : '—';
    const trackConf = sim.stations[t.station] || {};
    const platformList = Array.isArray(trackConf.platform) ? trackConf.platform : [trackConf.platform];
    const freightList = Array.isArray(trackConf.freight) ? trackConf.freight : [trackConf.freight];
    const isPlatform = !!(t.trackNo && platformList.includes(t.trackNo));
    const controlled = sim.isStationControlled(t.station);
    const list = sim.tracks.get(t.station) || [];
    const tr = list.find((x) => x.no === t.trackNo);
    const isApron = t.status === 'approach' || t.status === 'pending';
    wrap.classList.toggle('is-running', t.status === 'running');
    title.innerHTML = `<b>${escapeHtml(t.no)}</b><span class="act-chip">${escapeHtml(t.trainClass || t.model || t.type || '列车')}</span><span class="act-dir">${t.dir > 0 ? '上行' : '下行'}</span>`;
    route.innerHTML = `<div class="act-route-leg"><small>始发</small><b>${escapeHtml(t.originName || '—')}</b></div><span class="act-route-arrow">→</span><div class="act-route-leg is-here"><small>本站</small><b>${escapeHtml(stationName)}</b></div><span class="act-route-arrow">→</span><div class="act-route-leg"><small>终到</small><b>${escapeHtml(t.destName || '—')}</b></div>`;
    const stateText = isApron ? (t.reserved ? `已预留 ${t.trackNo} 道` : '站外待接') : t.release ? '已放行' : t.hold ? `晚 ${t.late} 分` : '在站';
    const workBlock = t.status === 'station' && sim.departBlock ? sim.departBlock(t) : '';
    const factRows = [
      ['股道', `${t.trackNo ? `${t.trackNo} 道` : '未指定'}${isPlatform ? ' · 站台' : ''}${tr && tr.lenM ? ` · 有效长 ${tr.lenM} m` : ''}`],
      ['编组', `${t.coaches || '—'} 辆 · ${t.lengthM || '—'} m`],
      ['计划到发', `${fm(t.planArr)} 到 · ${fm(t.planDep)} 发`],
      ['实际到发', `${fm(t.arrivalReal || t.arriveReal)} 到 · ${fm(t.departAt)} 发`],
      ['下一区间', `${escapeHtml(t.nextSection || '—')}`],
      ['运用', `${escapeHtml(t.model || '—')} · ${escapeHtml(t.loco || '—')} · ${escapeHtml(t.bureau || '—')}`],
    ];
    if (isApron) {
      const until = t.holdOutside ? t.holdOutside + sim.limits.wait : t.planArr + sim.limits.wait;
      const rest = Math.max(0, until - sim.clock);
      factRows.push(['站外限时', `${rest} 分后判负 · ${fm(until)}`]);
    }
    facts.innerHTML = factRows.map(([k, v]) => `<div class="act-fact"><span>${k}</span><b>${v}</b></div>`).join('');
    const stateRow = el('div', 'act-state');
    stateRow.innerHTML = `<span>${escapeHtml(stateText)}</span><small>${sim.limits ? `晚点红线 ${sim.limits.late} 分 · 站外红线 ${sim.limits.wait} 分` : ''}</small>`;
    facts.append(stateRow);
    if (t.tasks && t.tasks.length) {
      const box = el('div', 'act-tasks');
      box.append(el('div', 'act-sub-title', '站内作业'));
      t.tasks.forEach((task) => {
        const row = el('div', `act-task ${task.state}`);
        const label = task.state === 'done' ? '已完成' : task.state === 'active' ? `剩 ${task.left} 分` : `${task.min} 分`;
        row.innerHTML = `<div><b>${escapeHtml(task.title)}</b><small>${label}</small></div>`;
        if (task.state === 'wait' && t.status === 'station') {
          const go = el('button', 'act-task-btn', '开始');
          go.disabled = !!t.release || (t.tasks || []).some((x) => x.state === 'active');
          go.addEventListener('click', () => {
            if (sim.startTask(t.id, task.id)) { toast(`${t.no} ${task.title}开始`, 'ok'); render(); }
            else toast('已有作业在占用股道，先等它完成', 'err');
          });
          row.append(go);
        }
        box.append(row);
      });
      actions.append(box);
    }
    if (t.waitForNo) {
      const other = sim.getTrain && (sim.trains || []).find((x) => x.no === t.waitForNo);
      const done = other && other.status === 'terminated';
      const wait = el('div', 'act-wait');
      wait.innerHTML = `<span>待避</span><b>${escapeHtml(t.waitForNo)} ${done ? '已出清' : '未出清'}</b>`;
      actions.append(wait);
    }
    note.textContent = reason(t, controlled);
    if (t.status === 'running') {
      const b = el('button', 'act-btn act-main', '看在运行图上的位置');
      b.addEventListener('click', () => { if (ctx.showGraph) ctx.showGraph(); });
      actions.append(b);
      return;
    }

    if (isApron) {
      const main = el('button', 'act-btn act-main', t.reserved ? `已预留 ${t.trackNo} 道 · ${fmtClock(t.planArr)} 接入` : t.trackNo ? `接入 ${t.trackNo} 道` : '先选接车股道');
      main.disabled = !!t.reserved;
      main.addEventListener('click', () => {
        if (!t.trackNo) { showTracks = true; render(); return; }
        if (sim.assignTrack(t.id, t.station, t.trackNo)) { toast(`${t.no} 接入 ${t.trackNo} 道`, 'ok'); render(); }
        else toast('股道条件不满足，核对方向、站台和有效长', 'err');
      });
      actions.append(main);
      showTracks = true;
    } else if (t.status === 'station') {
      if (!controlled) {
        const take = el('button', 'act-btn act-main', '接管本站，改手动放行');
        take.addEventListener('click', () => { sim.setStationControl(t.station, true); toast(`${stationName} 已接管`, 'ok'); render(); });
        actions.append(take);
      } else if (!t.release) {
        const rel = el('button', 'act-btn act-main', workBlock ? `不能发车 · ${workBlock}` : '放行出站');
        rel.disabled = !!workBlock;
        rel.addEventListener('click', () => { if (sim.releaseTrain(t.id)) { toast(`${t.no} 已放行`, 'ok'); render(); } else toast(sim.departBlock && sim.departBlock(t) ? sim.departBlock(t) : '现在不能放行', 'err'); });
        actions.append(rel);
      } else {
        const done = el('button', 'act-btn act-main', '已放行 · 等出清');
        done.disabled = true;
        actions.append(done);
      }
      const row = el('div', 'act-row');
      const trk = el('button', 'act-btn act-sub', showTracks ? '收起股道' : '换一条股道');
      trk.addEventListener('click', () => { showTracks = !showTracks; render(); });
      row.append(trk);
      const ctl = el('button', 'act-btn act-sub', controlled ? '改回自动放行' : '接管本站');
      ctl.addEventListener('click', () => { sim.setStationControl(t.station, !controlled); toast(`${stationName} ${controlled ? '已改回自动放行' : '已接管'}`, 'ok'); render(); });
      row.append(ctl);
      const cmd = el('button', 'act-btn act-sub', '调度命令');
      cmd.addEventListener('click', () => { if (ctx.openCommand) ctx.openCommand(t.id); });
      row.append(cmd);
      const auto = el('button', 'act-btn act-sub', t.autoRelease ? '本列改人工' : '本列自动放行');
      auto.addEventListener('click', () => { sim.setTrainAutoRelease(t.id, !t.autoRelease); toast(`${t.no} ${t.autoRelease ? '转人工放行' : '转自动放行'}`, 'ok'); render(); });
      row.append(auto);
      const hold = el('button', 'act-btn act-sub', t.manualHold ? '解除扣车' : '扣住本列');
      hold.addEventListener('click', () => {
        const was = !!t.manualHold;
        if (was) sim.resumeTrain(t.id); else sim.holdTrain(t.id);
        toast(`${t.no} ${was ? '已解除扣车' : '已扣车'}`, 'ok');
        render();
      });
      row.append(hold);
      actions.append(row);
    }

    if (showTracks && t.station) {
      const listNow = sim.tracks.get(t.station) || [];
      const head = el('div', 'act-sub-title', isApron ? '接入哪条股道' : '换到哪条股道');
      tracksBox.append(head);
      const grid = el('div', 'act-tr-grid');
      const conf = sim.stations[t.station] || {};
      listNow.forEach((x) => {
        const st = trackState(t, x);
        const b = el('button', `act-tr ${x.no === t.trackNo ? 'on' : ''} ${st.ok || st.self ? '' : 'off'} ${t.reserved && x.no === t.trackNo ? 'reserved' : ''}`, `${x.no} 道`);
        if (!st.ok) {
          const short = st.label.replace('货物线，不接客车', '货线').replace('客运站台，不接货车', '客站').replace('方向不符', '反向').replace('长度不足', '太短').replace('本列占用', '本列').replace('本列已预留', '已预留');
          b.innerHTML = `${x.no} 道<small>${short}</small>`;
        } else if (platformList.includes(x.no)) {
          b.innerHTML = `${x.no} 道<small>站台</small>`;
        } else if (freightList.includes(x.no)) {
          b.innerHTML = `${x.no} 道<small>货线</small>`;
        }
        b.title = `${x.lenM || '—'} m · ${st.label}`;
        b.addEventListener('click', () => {
          if (!st.ok) { toast(`${x.no} 道：${st.label}`, 'err'); return; }
          if (sim.assignTrack(t.id, t.station, x.no)) { toast(`${t.no} → ${x.no} 道`, 'ok'); render(); }
          else toast('还没到允许接入的时间', 'err');
        });
        grid.append(b);
      });
      tracksBox.append(grid);
      const help = el('div', 'act-tr-help', '上行只能接正线上方的股道，下行只能接正线下方的股道；货车按有效长选线。');
      tracksBox.append(help);
    }
  }
  render();
  sim.subscribe((s, evt) => { if (evt === 'tick' || evt === 'route' || evt === 'control') render(); });
  body.append(wrap);
  return { update() { render(); }, destroy() {} };
}

export function buildInspectPanelOld(body, ctx) {
  const wrap = el('div', 'pane inspect-pane action-pane');
  const kicker = el('div', 'act-kicker', '这列车下一步');
  const title = el('div', 'act-title', '选一列车');
  const meta = el('div', 'act-meta', '');
  const note = el('div', 'act-note', '');
  const actions = el('div', 'act-actions');
  const tracksBox = el('div', 'act-tracks');
  wrap.append(kicker, title, meta, note, actions, tracksBox);
  let showTracks = false;
  function render() {
    const id = ctx.inspectId && ctx.inspectId();
    const t = id ? sim.getTrain(id) : null;
    actions.innerHTML = '';
    tracksBox.innerHTML = '';
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
    title.innerHTML = `<b>${escapeHtml(t.no)}</b><span class="act-chip">${escapeHtml(t.model || t.type || '列车')}</span>`;
    const stateText = t.release ? '已放行' : t.late ? `晚 ${t.late} 分` : '正点';
    meta.classList.add('is-grid');
    meta.innerHTML = `<div class="ai-cell"><span>位置</span><b>${stationName}${t.trackNo ? ` · ${t.trackNo} 道` : ''}</b></div><div class="ai-cell"><span>计划</span><b>${fmtClock(t.planDep)} 发</b></div><div class="ai-cell"><span>状态</span><b>${stateText}</b></div><div class="ai-cell"><span>编组</span><b>${t.coaches || '—'} 辆</b></div><div class="ai-cell"><span>车型</span><b>${t.model || '—'}</b></div><div class="ai-cell"><span>机车</span><b>${t.loco || '—'}</b></div><div class="ai-cell"><span>路局</span><b>${t.bureau || '—'}</b></div><div class="ai-cell"><span>方向</span><b>${t.dir > 0 ? '上行' : '下行'}</b></div>`;
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
      const ctl = el('button', 'act-btn act-sub', controlled ? '改回自动放行' : '接管本站');
      ctl.addEventListener('click', () => {
        sim.setStationControl(t.station, !controlled);
        toast(`${stationName} ${controlled ? '已改回自动放行' : '已接管'}`, 'ok');
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
  const endText = sim.finishReason === 'late' ? `晚点红线：${sim.accident && sim.accident.no ? `${sim.accident.no} 晚 ${sim.accident.late} 分` : '超限'}`
    : sim.finishReason === 'blocked' ? `站外停车：${sim.accident && sim.accident.no ? `${sim.accident.no} 等 ${sim.accident.wait} 分` : '超时'}`
    : sim.finishReason === 'safety' ? '安全底线击穿'
    : sim.finishReason === 'time' ? '值班时间到'
    : '全部列车终到';
  const fail = sim.finishReason === 'late' || sim.finishReason === 'blocked' || sim.finishReason === 'safety';
  wrap.innerHTML = `
    <div class="pane-title">复盘摘要<span class="mono">${escapeHtml(sim.scene.title)}</span></div>
    <div class="rv-line ${fail ? 'is-bad' : ''}"><span>结束原因</span><b>${escapeHtml(endText)}</b></div>
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
