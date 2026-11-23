import { el, toast, fmtClock } from './util.js';
import { sim } from './sim.js';
import { profile, saveProfile, rankOf, nextRank, achievementList, exportArchive, importArchive, archiveMeta, setSetting, applySettings, dailyChallenge } from './profile.js';
import { career, careerSnapshot, saveCareer, UPGRADES, STAFF, upgradeCost, canUpgrade, buyUpgrade, hireStaff, staffHas, careerFactor } from './career.js';
import { cloudToken, setCloudToken, uploadCloud, downloadCloud, parseCloudInput, lastCloudId } from './cloud.js';

function pill(text, cls = '') {
  return el('span', `ops-pill ${cls}`, text);
}

function stat(label, value, sub = '') {
  const box = el('div', 'ops-stat');
  box.append(el('span', 'ops-stat-label', label), el('b', 'ops-stat-value mono', value));
  if (sub) box.append(el('span', 'ops-stat-sub', sub));
  return box;
}

function section(title, hint) {
  const box = el('div', 'ops-section');
  const head = el('div', 'ops-section-head');
  head.append(el('b', '', title));
  if (hint) head.append(el('span', 'ops-hint', hint));
  box.append(head);
  return box;
}

function stationList() {
  return (sim.stationOrder || []).map((id) => ({ id, name: (sim.stations[id] || {}).name || id }));
}

function trackRows(station) {
  return sim.tracks.get(station) || [];
}

function trackRole(conf, no) {
  if (!conf) return 'mixed';
  const n = Number(conf.tracks) || 0;
  if (Array.isArray(conf.platform) || Array.isArray(conf.freight)) {
    if (Array.isArray(conf.platform) && conf.platform.includes(no)) return 'platform';
    if (Array.isArray(conf.freight) && conf.freight.includes(no)) return 'freight';
    return 'mixed';
  }
  const p = Number(conf.platform) || 0;
  if (n >= 6) {
    if (p && no <= p) return 'platform';
    return p ? 'freight' : 'mixed';
  }
  if (p && no === p) return 'platform';
  return 'mixed';
}

export function mountOps(body, ctx) {
  body.classList.add('ops-pane');
  const tabs = el('div', 'ops-tabs');
  const names = [['home', '本班'], ['interlock', '联锁'], ['work', '施工天气'], ['career', '经营'], ['set', '设置']];
  let tab = 'home';
  const stage = el('div', 'ops-stage');
  names.forEach(([id, label]) => {
    const b = el('button', `ops-tab ${id === tab ? 'on' : ''}`, label);
    b.type = 'button';
    b.addEventListener('click', () => {
      tab = id;
      tabs.querySelectorAll('.ops-tab').forEach((x) => x.classList.remove('on'));
      b.classList.add('on');
      draw();
    });
    tabs.append(b);
  });
  body.append(tabs, stage);

  function draw() {
    stage.innerHTML = '';
    if (tab === 'home') drawHome();
    else if (tab === 'interlock') drawInterlock();
    else if (tab === 'work') drawWork();
    else if (tab === 'career') drawCareer();
    else drawSettings();
  }

  function drawHome() {
    const s = sim.getSnapshot();
    const goals = currentGoals();
    const grid = el('div', 'ops-stat-grid');
    grid.append(
      stat('准点率', `${goals.punctuality}%`, `${s.trains.filter((t) => (t.late || 0) > 3).length} 列晚点`),
      stat('在站 / 区间', `${s.trains.filter((t) => t.status === 'station').length} / ${s.trains.filter((t) => t.status === 'running').length}`, '当前占用'),
      stat('安全分', String(s.metrics.safety), `${s.alarms.filter((a) => !a.ack).length} 条未确认`),
      stat('本班收入', `¥ ${profile.data.credits}`, `${rankOf(profile.data.xp).name}`),
    );
    stage.append(grid);
    const g = section('本班目标', `${dailyChallenge().key} · ${dailyChallenge().rule.label}`);
    const list = el('div', 'ops-goals');
    goals.list.forEach((x) => {
      const row = el('div', `ops-goal ${x.ok ? 'ok' : ''}`);
      row.append(el('span', 'ops-goal-dot', x.ok ? '✓' : '·'), el('b', '', x.name), el('span', '', x.now));
      list.append(row);
    });
    g.append(list);
    stage.append(g);
    const q = section('快捷办理');
    const row = el('div', 'ops-actions');
    const b1 = el('button', 'ops-btn ops-primary', '打开运行图');
    b1.onclick = () => { getGraph()?.setEdit(true); ctx.showGraph && ctx.showGraph(); toast('运行图已进入编辑，拖动车次条改点'); };
    const b2 = el('button', 'ops-btn', '保存本班');
    b2.onclick = () => ctx.save && ctx.save();
    const b3 = el('button', 'ops-btn', '班末复盘');
    b3.onclick = () => ctx.review && ctx.review();
    row.append(b1, b2, b3);
    q.append(row);
    stage.append(q);
    const recent = section('最近决策');
    (s.decisions || []).slice(-6).reverse().forEach((d) => {
      const row = el('div', 'ops-log');
      row.append(el('span', 'mono', fmtClock(d.t)), el('b', '', d.title), el('span', '', d.branch));
      recent.append(row);
    });
    if (!(s.decisions || []).length) recent.append(el('div', 'ops-empty', '还没有决策记录'));
    stage.append(recent);
  }

  function getGraph() {
    return (ctx.graph && ctx.graph()) || null;
  }

  function drawInterlock() {
    const st = sim.focusStation || sim.stationOrder[0];
    const conf = sim.stations[st] || {};
    const snap = sim.interlock ? sim.interlock.snapshot() : { stations: {}, routes: [] };
    const head = section(`${conf.name || st} 联锁台`, `${conf.tracks || 0} 股道 · ${conf.type || '本站'}`);
    const sig = (snap.stations[st] || {}).signals || [];
    const sigRow = el('div', 'ops-signals');
    sig.forEach((x) => {
      const b = el('div', `ops-signal ${x.aspect}`);
      b.append(el('span', 'ops-signal-lamp', ''), el('b', '', x.dir > 0 ? '上行' : '下行'), el('span', '', x.label));
      sigRow.append(b);
    });
    head.append(sigRow);
    const trains = sim.trains.filter((t) => t.station === st && t.status !== 'terminated' && t.status !== 'running');
    const sel = el('select', 'ops-select');
    sel.append(new Option('选择本班列车', ''));
    trains.forEach((t) => sel.append(new Option(`${t.no} · ${t.freight ? '货车' : '客车'} · ${t.status === 'station' ? `${t.trackNo} 道` : '待接'}`, t.id)));
    const type = el('select', 'ops-select');
    [['receive', '接车进路'], ['depart', '发车进路'], ['through', '通过进路']].forEach(([v, n]) => type.append(new Option(n, v)));
    const routeRow = el('div', 'ops-form');
    routeRow.append(sel, type);
    head.append(routeRow);
    const actRow = el('div', 'ops-actions');
    const act = (label, fn) => {
      const b = el('button', 'ops-btn', label);
      b.onclick = () => {
        const id = sel.value;
        if (!id) { toast('先选一列车'); return; }
        const r = fn(id);
        toast(typeof r === 'string' ? r : `${label}：${r ? '已执行' : '未执行'}`, r ? 'ok' : 'err');
        draw();
      };
      actRow.append(b);
    };
    act('人工放行', (id) => sim.releaseTrain(id));
    act('自动放行', (id) => sim.setTrainAutoRelease(id, true));
    act('扣车', (id) => sim.holdTrain(id));
    act('恢复运行', (id) => sim.resumeTrain(id));
    head.append(actRow);
    const tracks = el('div', 'ops-track-grid');
    trackRows(st).forEach((tr) => {
      const role = trackRole(conf, tr.no);
      const card = el('div', `ops-track ${tr.train ? 'busy' : ''} ${tr.blocked ? 'blocked' : ''} ${role}`);
      card.append(el('b', 'mono', `${tr.no} 道`), el('span', '', role === 'platform' ? '客运站台' : role === 'freight' ? '货运货场' : '共用线'));
      card.append(el('span', 'ops-track-state', tr.blocked ? '封锁' : tr.train ? '占用' : '空闲'));
      card.addEventListener('click', () => {
        const id = sel.value;
        if (!id) { toast('先选一列车'); return; }
        const r = sim.requestRoute(id, st, tr.no, type.value);
        toast(r.msg || '进路已办理', r.ok ? 'ok' : 'err');
        draw();
      });
      tracks.append(card);
    });
    head.append(tracks);
    stage.append(head);

    const routes = section('已锁闭进路');
    const live = (snap.routes || []).filter((r) => r.station === st);
    if (!live.length) routes.append(el('div', 'ops-empty', '没有锁闭进路'));
    live.forEach((r) => {
      const row = el('div', 'ops-route');
      row.append(el('b', 'mono', r.id), el('span', '', `${r.track} 道 · ${r.type === 'receive' ? '接车' : r.type === 'depart' ? '发车' : '通过'}`), el('span', '', r.no || ''));
      const b = el('button', 'ops-mini', '人工解锁');
      b.onclick = () => { sim.interlock.clear(r.id, '人工解锁'); draw(); };
      row.append(b);
      routes.append(row);
    });
    stage.append(routes);

    const faults = section('故障注入', '用于演练与考核，不扣经营分');
    const fRow = el('div', 'ops-actions');
    [['redband', '红光带'], ['switch', '道岔失表'], ['signal', '信号灭灯'], ['power', '供电中断'], ['comm', '通信中断']].forEach(([k, n]) => {
      const b = el('button', 'ops-btn', n);
      b.onclick = () => { const r = sim.injectFault(st, k, 1); toast(r.msg, r.ok ? 'warn' : 'err'); draw(); };
      fRow.append(b);
    });
    const rec = el('button', 'ops-btn ops-primary', '恢复全部');
    rec.onclick = () => { ['redband', 'switch', 'signal', 'power', 'comm'].forEach((k) => sim.recoverFault(st, k, 1)); toast('故障已销记'); draw(); };
    fRow.append(rec);
    faults.append(fRow);
    stage.append(faults);
  }

  function drawWork() {
    const st = sim.focusStation || sim.stationOrder[0];
    const conf = sim.stations[st] || {};
    const head = section('施工天窗', '封锁股道，登记后立即生效');
    const form = el('div', 'ops-form');
    const tsel = el('select', 'ops-select');
    trackRows(st).forEach((tr) => tsel.append(new Option(`${tr.no} 道`, tr.no)));
    const mins = el('input', 'ops-input');
    mins.type = 'number'; mins.value = '60'; mins.min = '10'; mins.max = '240';
    const b = el('button', 'ops-btn ops-primary', '登记天窗');
    b.onclick = () => { const r = sim.openConstruction(st, Number(tsel.value), Number(mins.value)); toast(r.msg, r.ok ? 'ok' : 'err'); draw(); };
    form.append(tsel, mins, b);
    head.append(form);
    stage.append(head);

    const lim = section('临时限速', '按区间登记，落到运行图');
    const lf = el('div', 'ops-form');
    const a = el('select', 'ops-select');
    const bsel = el('select', 'ops-select');
    sim.stationOrder.forEach((id, i) => {
      a.append(new Option(sim.stations[id].name, id));
      if (i > 0) bsel.append(new Option(sim.stations[id].name, id));
    });
    const sp = el('input', 'ops-input');
    sp.type = 'number'; sp.value = '45'; sp.min = '5'; sp.max = '120';
    const lbtn = el('button', 'ops-btn', '登记限速');
    lbtn.onclick = () => { sim.setTemporaryLimit(a.value, bsel.value, Number(sp.value), 60); toast('限速已登记'); draw(); };
    lf.append(a, bsel, sp, lbtn);
    lim.append(lf);
    stage.append(lim);

    const weather = section('天气与降级', sim.weather);
    const wf = el('div', 'ops-actions');
    ['晴', '小雨', '暴雨', '大雪', '大雾', '大风'].forEach((w) => {
      const b = el('button', `ops-btn ${sim.weather === w ? 'ops-primary' : ''}`, w);
      b.onclick = () => { sim.setWeather(w); toast(`天气改为${w}`); draw(); };
      wf.append(b);
    });
    weather.append(wf);
    stage.append(weather);

    const cond = section('当前限制');
    (sim.conditions.speedLimits || []).forEach((x) => cond.append(el('div', 'ops-log', `${sim.stations[x.a] ? sim.stations[x.a].name : x.a} — ${sim.stations[x.b] ? sim.stations[x.b].name : x.b} 限速 ${x.speed} km/h，至 ${fmtClock(x.until)}`)));
    if (!(sim.conditions.speedLimits || []).length) cond.append(el('div', 'ops-empty', '没有临时限速'));
    stage.append(cond);
  }

  function drawCareer() {
    const p = profile.data;
    const r = rankOf(p.xp);
    const nx = nextRank(p.xp);
    const head = section('经营档案', `${r.name} · 执照 ${r.license}`);
    const grid = el('div', 'ops-stat-grid');
    grid.append(
      stat('资金', `¥ ${p.credits}`, '班末结算'),
      stat('经验', `${p.xp}`, nx ? `距 ${nx.name} 还差 ${nx.xp - p.xp}` : '已达最高'),
      stat('声誉', String(p.reputation), `${p.stats.shifts} 个班次`),
      stat('星级', String(p.stats.stars), `最佳准点 ${p.stats.bestPunctuality}%`),
    );
    head.append(grid);
    stage.append(head);

    const ach = section('成就');
    const ag = el('div', 'ops-achievements');
    achievementList().forEach((a) => {
      const card = el('div', `ops-ach ${a.got ? 'got' : ''}`);
      card.append(el('b', '', a.name), el('span', '', a.desc));
      ag.append(card);
    });
    ach.append(ag);
    stage.append(ach);

    const biz = section('车站经营', `本站 ${career.data.name} · 综合等级 ${careerSnapshot().level}`);
    const flags = el('div', 'ops-biz-sum');
    flags.append(
      pill(`信号故障 -${Math.round(careerFactor('signal') * 100)}%`, 'ok'),
      pill(`乘降 -${careerFactor('platform')} 分`, 'info'),
      pill(`调车 -${careerFactor('track')} 分`, 'info'),
      pill(`待接红线 +${careerFactor('crew')} 分`, 'warn'),
      pill(`收入 ×${careerFactor('income').toFixed(2)}`, 'plan'),
    );
    biz.append(flags);
    const bus = el('button', 'ops-btn', career.data.business ? '经营加成：开' : '经营加成：关');
    bus.onclick = () => { career.data.business = !career.data.business; saveCareer(); toast('经营加成已切换，下一班生效', 'ok'); draw(); };
    biz.append(bus);
    const ug = el('div', 'ops-upgrades');
    UPGRADES.forEach((u) => {
      const lv = Number(career.data.upgrades[u.id]) || 0;
      const cost = upgradeCost(u.id);
      const card = el('div', 'ops-upgrade');
      const top = el('div', 'ops-upgrade-top');
      top.append(el('b', '', u.name), pill(`${lv}/${u.max}`, lv >= u.max ? 'ok' : 'info'));
      const bar = el('div', 'ops-level');
      for (let i = 0; i < u.max; i += 1) bar.append(el('span', `ops-level-dot ${i < lv ? 'on' : ''}`, ''));
      card.append(top, el('span', 'ops-upgrade-effect', u.effect), bar);
      const buy = el('button', 'ops-btn ops-primary', lv >= u.max ? '已满级' : `升级 ¥${cost}`);
      buy.disabled = lv >= u.max || profile.data.credits < cost;
      buy.onclick = () => {
        const r = buyUpgrade(u.id, profile.data.credits);
        if (!r.ok) { toast(r.msg, 'err'); return; }
        profile.data.credits -= r.cost;
        saveProfile();
        toast(r.msg, 'ok');
        draw();
      };
      card.append(buy);
      ug.append(card);
    });
    biz.append(ug);
    const staffBox = el('div', 'ops-staff');
    STAFF.forEach((st) => {
      const card = el('div', 'ops-upgrade');
      card.append(el('b', '', st.name), el('span', 'ops-upgrade-effect', st.effect));
      const hire = el('button', 'ops-btn', staffHas(st.id) ? '在岗' : `招聘 ¥${st.cost}`);
      hire.disabled = staffHas(st.id) || profile.data.credits < st.cost;
      hire.onclick = () => {
        const r = hireStaff(st.id, profile.data.credits);
        if (!r.ok) { toast(r.msg, 'err'); return; }
        profile.data.credits -= r.cost;
        saveProfile();
        toast(r.msg, 'ok');
        draw();
      };
      card.append(hire);
      staffBox.append(card);
    });
    biz.append(staffBox);
    stage.append(biz);

    const history = section('班次记录');
    if (!p.history.length) history.append(el('div', 'ops-empty', '还没有交班记录'));
    p.history.slice(0, 6).forEach((h) => {
      const row = el('div', 'ops-history');
      row.append(el('b', '', h.scene), el('span', '', `${h.punctuality}% · ${h.stars}★`), el('span', 'mono', `¥${h.income} / ${h.xp}xp`));
      history.append(row);
    });
    stage.append(history);

    const cloud = section('跨设备存档', '复制存档码到另一台设备导入');
    const code = el('textarea', 'ops-code');
    code.placeholder = '粘贴存档码';
    const row = el('div', 'ops-actions');
    const exp = el('button', 'ops-btn ops-primary', '生成存档码');
    exp.onclick = () => {
      code.value = exportArchive();
      code.select();
      toast('存档码已生成', 'ok');
    };
    const cp = el('button', 'ops-btn', '复制');
    cp.onclick = async () => {
      if (!code.value) code.value = exportArchive();
      try { await navigator.clipboard.writeText(code.value); toast('已复制', 'ok'); } catch (e) { code.select(); toast('请手动复制', 'warn'); }
    };
    const imp = el('button', 'ops-btn', '导入');
    imp.onclick = () => {
      try {
        const info = importArchive(code.value, true);
        toast(`已导入 ${info.saves} 个存档`, 'ok');
        draw();
      } catch (e) { toast(`导入失败：${e.message}`, 'err'); }
    };
    row.append(exp, cp, imp);
    cloud.append(code, row);

    const gh = el('div', 'ops-cloud');
    gh.append(el('div', 'ops-sub-title', '云端存档'));
    const tk = el('input', 'ops-input');
    tk.type = 'password';
    tk.placeholder = 'GitHub 令牌（仅 gist 权限，只存本机）';
    tk.value = cloudToken();
    const tkRow = el('div', 'ops-form');
    const saveTk = el('button', 'ops-btn', '保存令牌');
    saveTk.onclick = () => { setCloudToken(tk.value); toast(tk.value ? '令牌已保存在本机' : '令牌已清除', 'ok'); };
    tkRow.append(tk, saveTk);
    gh.append(tkRow);
    const up = el('button', 'ops-btn ops-primary', '上传当前档案到云端');
    up.onclick = async () => {
      up.disabled = true;
      try {
        const r = await uploadCloud(exportArchive(), { name: profile.data.name, credits: profile.data.credits });
        code.value = r.id;
        toast(`已上传，云存档编号 ${r.id}`, 'ok');
      } catch (e) { toast(`上传失败：${e.message}`, 'err'); }
      up.disabled = false;
    };
    const down = el('button', 'ops-btn', '按编号下载');
    down.onclick = async () => {
      const id = parseCloudInput(code.value) || lastCloudId();
      if (!id) { toast('先填云存档编号或 gist 链接', 'err'); return; }
      down.disabled = true;
      try {
        const r = await downloadCloud(id);
        importArchive(r.code, true);
        toast('云端存档已导入', 'ok');
        draw();
      } catch (e) { toast(`下载失败：${e.message}`, 'err'); }
      down.disabled = false;
    };
    const last = el('button', 'ops-btn', '上次的云存档');
    last.onclick = () => { if (lastCloudId()) { code.value = lastCloudId(); toast('已填入上次编号', 'ok'); } else toast('还没有上传过', 'warn'); };
    const ar = el('div', 'ops-actions');
    ar.append(up, down, last);
    gh.append(ar, el('div', 'ops-hint', '云端用 GitHub 私有 gist 保存，编号可跨设备输入；令牌只存在本机浏览器。'));
    cloud.append(gh);
    stage.append(cloud);
  }

  function drawSettings() {
    const s = profile.data.settings;
    const head = section('显示与可访问性', '立即生效');
    const f1 = el('div', 'ops-form');
    const theme = el('select', 'ops-select');
    [['control', '控制室深色'], ['paper', '纸面浅色']].forEach(([v, n]) => theme.append(new Option(n, v)));
    theme.value = s.theme;
    theme.onchange = () => { setSetting('theme', theme.value); };
    const font = el('input', 'ops-range');
    font.type = 'range'; font.min = '.9'; font.max = '1.2'; font.step = '.05'; font.value = String(s.font);
    font.oninput = () => setSetting('font', Number(font.value));
    const contrast = el('select', 'ops-select');
    [['normal', '标准'], ['high', '高对比']].forEach(([v, n]) => contrast.append(new Option(n, v)));
    contrast.value = s.contrast;
    contrast.onchange = () => setSetting('contrast', contrast.value);
    const cb = el('input');
    cb.type = 'checkbox'; cb.checked = !!s.colorblind;
    cb.onchange = () => setSetting('colorblind', cb.checked);
    const cbLabel = el('label', 'ops-check', '色盲友好（红圆停 / 绿方行）');
    cbLabel.prepend(cb);
    f1.append(theme, font, contrast, cbLabel);
    head.append(f1);
    stage.append(head);

    const vol = section('音量分轨', '环境 / 语音 / 音效');
    const vf = el('div', 'ops-vols');
    ['ambient', 'voice', 'sfx'].forEach((k) => {
      const row = el('div', 'ops-vol');
      const range = el('input', 'ops-range');
      range.type = 'range'; range.min = '0'; range.max = '100'; range.value = String(s.volumes[k]);
      range.oninput = () => setSetting('volumes', { ...profile.data.settings.volumes, [k]: Number(range.value) });
      row.append(el('span', '', { ambient: '环境', voice: '语音', sfx: '音效' }[k]), range);
      vf.append(row);
    });
    vol.append(vf);
    stage.append(vol);

    const keys = section('快捷键');
    const map = [
      ['空格', '暂停 / 继续'], ['1—4', '站场 / 运行图 / 车次 / 联锁'], ['Tab', '下一列车'],
      ['F', '接管 / 交回站控'], ['G', '放行当前列车'], ['Esc', '关闭浮层'],
    ];
    map.forEach(([k, d]) => {
      const row = el('div', 'ops-key');
      row.append(el('kbd', '', k), el('span', '', d));
      keys.append(row);
    });
    stage.append(keys);
    applySettings();
  }

  draw();
  sim.subscribe((s, evt) => { if (evt === 'tick' || evt === 'route' || evt === 'fault' || evt === 'reschedule') draw(); });
  return { draw };
}

function currentGoals() {
  const total = Math.max(1, sim.metrics.total || sim.trains.length || 1);
  const onTime = sim.trains.filter((t) => (t.late || 0) <= 3).length;
  const punctuality = Math.round((onTime / total) * 100);
  const safety = sim.metrics.safety || 100;
  const list = [
    { name: '准点率 ≥ 90%', now: `${punctuality}%`, ok: punctuality >= 90 },
    { name: '安全分 ≥ 90', now: String(safety), ok: safety >= 90 },
    { name: '责任事故 0', now: String(sim.metrics.incidents || 0), ok: (sim.metrics.incidents || 0) === 0 },
    { name: '本班放行 ≥ 10 列', now: String(sim.trains.filter((t) => t.status === 'terminated').length), ok: sim.trains.filter((t) => t.status === 'terminated').length >= 10 },
  ];
  return { punctuality, safety, list };
}
