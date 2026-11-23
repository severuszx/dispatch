import { el, escapeHtml, toast } from './util.js';
import { career, saveCareer, STAFF } from './career.js';
import { profile, saveProfile } from './profile.js';
import { STATIONS, stationList, withUpgrades, bottleneck, SEGMENTS } from './stations.js';
import { catalog, CATEGORIES, startBuild, canBuild, tickBuilds } from './upgrades.js';
import { offers, refreshOffers, sign, drop } from './contracts.js';
import { dailyReport, trend, bankruptcyRisk } from './economy.js';
import { dlcOn } from './dlc.js';
import { catalogStats, pickCue } from './audio-catalog.js';
import { evaluateTraffic, setAllocation, allocations, applyTraffic } from './traffic.js';
import { weeklySummary, activePolicies, operatingLock } from './review.js';
import { staffRow, restStaff, recallStaff, trainStaff } from './staff.js';
import { activeMechanics } from './mechanic.js';
import { facilityStats, globalFacilityStats, repairFacility, facilityCost } from './facilities.js';

const NAMES = ['王建国', '李海峰', '赵春生', '陈立新', '周明远', '孙志强', '吴晓东', '郑国平'];
const TABS = [['overview', '总览'], ['assets', '资产'], ['traffic', '车流'], ['ledger', '账本'], ['contracts', '合同'], ['staff', '人员'], ['duty', '日程']];

function money(n) {
  const v = Math.round(n);
  if (Math.abs(v) >= 10000) return `${(v / 10000).toFixed(v % 10000 ? 1 : 0)} 万`;
  return `¥${v}`;
}

function bar(v, cls) {
  return `<div class="ad-bar ${cls || ''}"><i style="width:${Math.max(2, Math.min(100, v))}%"></i></div>`;
}

export function mountAdmin(body, ctx) {
  const root = el('div', 'admin-panel');
  body.append(root);
  let tab = 'overview';
  let station = career.data.currentStation || 'qinglan';
  const api = { refresh: render, open: () => {} };

  function head() {
    const risk = bankruptcyRisk();
    const lock = operatingLock();
    return `<div class="ad-head ${risk.level}">
      <div><span>资金</span><b>${money(profile.data.credits)}</b></div>
      <div><span>声誉</span><b>${profile.data.reputation}</b></div>
      <div><span>上级评价</span><b>${career.data.superior ?? 70}</b></div>
      <div><span>等级</span><b>${career.data.name} · ${career.data.level} 级</b></div>
      <div class="ad-risk">${risk.text}</div>
      ${lock.active ? `<div class="ad-lock">${lock.text}</div>` : ''}
    </div>`;
  }

  function tabs() {
    return `<div class="ad-tabs">${TABS.map(([id, name]) => `<button data-tab="${id}" class="${tab === id ? 'on' : ''}">${name}</button>`).join('')}</div>`;
  }

  function stationRow(s) {
    const b = Math.round(bottleneck(s.id) * 100);
    return `<button class="ad-station ${station === s.id ? 'on' : ''}" data-station="${s.id}">
      <div class="ad-st-top"><b>${s.name}</b><span class="mono">${s.code}</span><em>${s.grade}</em></div>
      <div class="ad-st-mid"><span>${s.tech}</span><span>${s.biz}</span><span>${s.adTracks} 股道</span></div>
      <div class="ad-st-bot"><span>瓶颈 ${b}%</span>${bar(b, b > 85 ? 'bad' : b > 70 ? 'warn' : 'ok')}</div>
    </button>`;
  }

  function overview() {
    const list = stationList();
    const decisions = [];
    const high = list.filter((s) => bottleneck(s.id) > 0.85);
    if (high.length) decisions.push({ title: `${high[0].name}股道占用 ${Math.round(bottleneck(high[0].id) * 100)}%`, desc: `本班已有待避车排队，扩建 1 股可多接 1 列`, act: `build:${high[0].id}:track_1`, btn: '扩建股道' });
    const aging = career.data.equipmentAge || 0;
    if (aging > 35) decisions.push({ title: `设备老化 ${aging}/100`, desc: '信号故障率上升，先做 LED 或轨道电路', act: `go:assets`, btn: '看设备' });
    if (!(career.data.contracts || []).length) decisions.push({ title: '合同槽位空着', desc: '没有合同车次，少一条收入和车流', act: `go:contracts`, btn: '看合同' });
    const builds = (career.data.builds || []).map((b) => `<div class="ad-build"><b>${b.name}</b><span>${b.station} · 还剩 ${b.left} 班</span>${bar((b.total - b.left) / b.total * 100, 'ok')}</div>`).join('');
    return `<div class="ad-overview">
      <div class="ad-stations">${list.map(stationRow).join('')}</div>
      <div class="ad-main">
        <h3>本班待决策</h3>
        ${decisions.length ? decisions.map((d) => `<div class="ad-decision"><div><b>${d.title}</b><p>${d.desc}</p></div><button data-act="${d.act}">${d.btn}</button></div>`).join('') : '<p class="ad-empty">没有必须处理的经营项，回去盯车。</p>'}
        <h3>在建</h3>
        ${builds || '<p class="ad-empty">没有在建项目。</p>'}
        <h3>区段</h3>
        <div class="ad-segments">${SEGMENTS.map((s) => `<div><b>${STATIONS[s.from].name}—${STATIONS[s.to].name}</b><span>${s.km} km · ${s.runMin} 分 · ${s.block} · 追踪 ${s.capacity} 列</span></div>`).join('')}</div>
        <h3>周评级</h3>
        ${weeklySummary().length ? weeklySummary().map((w) => `<div class="ad-week-row"><b>第 ${w.week} 周 · ${w.rating}</b><span>净利 ${money(w.net)} · 准点 ${w.punctuality}% · 事故 ${w.incidents}</span><em>${w.note}</em></div>`).join('') : '<p class="ad-empty">每 21 班出一次周评级，还没到。</p>'}
        <h3>生效政策</h3>
        ${activePolicies().length ? activePolicies().map((x) => `<span class="ad-chip">${x.name} · 剩 ${x.left} 班</span>`).join('') : '<p class="ad-empty">本周政策还没选。</p>'}
      </div>
    </div>`;
  }

  function schematic(s) {
    const built = withUpgrades(s.id);
    const fs = facilityStats(s.id);
    const tracks = Array.from({ length: built.adTracks }, (_, i) => `<div class="ad-track ${i >= s.adTracks ? 'new' : ''}" data-act="build:${s.id}:track_1"><span class="mono">${i + 1}</span><i></i></div>`).join('');
    return `<div class="ad-profile">
      <div class="ad-profile-top"><b>${s.name}</b><span>${s.grade} · ${s.tech}</span><span class="mono">${s.code}</span></div>
      <div class="ad-platforms">${s.platforms.map((p, i) => `<div class="ad-plat">${i + 1} 站台 · ${p.type} · ${p.faces} 面 · ${p.lenM}m</div>`).join('')}</div>
      <div class="ad-yard">${tracks}</div>
      <div class="ad-profile-foot"><span>正线 ${s.mainTracks}</span><span>到发线 ${built.adTracks}</span><span>货物线 ${s.sidings}</span><span>最大换长 ${s.maxLen}m</span></div>
      <p>点空股道位置可看扩建。新建股道会在下一班站场图直接出现。</p>
      <div class="ad-fac"><div class="ad-fac-head"><b>设施清册</b><span>${fs.total} 项 · 异常 ${fs.bad} · 观察 ${fs.watch}</span><span>全线 ${globalFacilityStats().total} 项</span></div>${fs.list.map((x) => `<div class="ad-fac-row"><span>${x.name}</span><em>${x.status} · ${x.age} 年 · ${x.grade} 级</em><button data-act="fix:${x.id}">修 ¥${facilityCost(x.id)}</button></div>`).join('') || '<p class="ad-empty">没有待修设备。</p>'}</div>
    </div>`;
  }

  function upgrades() {
    const s = STATIONS[station];
    const items = catalog(station);
    const groups = Object.entries(CATEGORIES).map(([cat, label]) => {
      const list = items.filter((u) => u.cat === cat);
      if (!list.length) return '';
      return `<div class="ad-group"><h4>${label}</h4>${list.map((u) => {
        const c = canBuild(u.id, station);
        return `<div class="ad-up ${u.built ? 'done' : u.queued ? 'queued' : ''}">
          <div class="ad-up-main"><b>${u.name}</b><span>${u.effect}</span><em>${u.sim}</em></div>
          <div class="ad-up-side"><span>${money(u.cost)}</span><span>维护 ${money(u.maint)}/班</span><span>${u.days} 班</span>
          <button data-act="build:${station}:${u.id}" ${c.ok ? '' : 'disabled'} title="${escapeHtml(c.msg)}">${u.built ? '已建' : u.queued ? '在建' : '开工'}</button></div>
        </div>`;
      }).join('')}</div>`;
    }).join('');
    return `<div class="ad-assets"><div class="ad-left">${schematic(s)}<div class="ad-station-tabs">${stationList().map((x) => `<button data-station="${x.id}" class="${x.id === station ? 'on' : ''}">${x.name}</button>`).join('')}</div></div><div class="ad-right">${groups}</div></div>`;
  }


  function traffic() {
    const ev = evaluateTraffic();
    const alloc = allocations();
    const rows = ev.rows.map((r) => {
      const pct = Math.round(r.pressure * 100);
      return `<div class="ad-seg-card ${r.risk === '挤占' ? 'bad' : r.risk === '饱和' ? 'warn' : ''}">
        <div class="ad-seg-head"><b>${STATIONS[r.from].name}—${STATIONS[r.to].name}</b><span>${r.km} km · ${r.block} · 能力 ${r.cap} 列/班</span><em>${r.risk}</em></div>
        <div class="ad-seg-load"><span>需求 ${r.demand} 列</span><span>压力 ${pct}%</span>${bar(pct, pct > 115 ? 'bad' : pct > 95 ? 'warn' : 'ok')}</div>
        <div class="ad-seg-split"><label>客运 <b data-out="pax:${r.id}">${r.pax}%</b><input type="range" min="10" max="90" value="${r.pax}" data-seg="${r.id}" data-kind="pax"></label><label>货运 <b>${r.freight}%</b></label><select data-seg="${r.id}" data-kind="priority">${['均衡','客运','货运'].map((x) => `<option ${alloc[r.id].priority === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
        <div class="ad-seg-delay"><span>客运侧晚点 +${r.paxDelay} 分</span><span>货运侧晚点 +${r.freightDelay} 分</span><span>${r.note}</span></div>
      </div>`;
    }).join('');
    const delays = Object.entries(ev.stationDelay).map(([id, d]) => `<div class="ad-delay"><b>${STATIONS[id].name}</b><span>接班积压 +${d} 分</span></div>`).join('');
    return `<div class="ad-traffic"><div><h3>区段车流分配</h3><p>每班只有这么多区间能力。客运拿得多，货运排队；货运拿得多，客车待避。上游压车会顺着区段往下一站传。</p>${rows}</div><div><h3>跨站积压</h3><div class="ad-delay-list">${delays}</div><p class="ad-note">积压会在下一班发车时加到首站，继续沿运行方向传。改分配后立即影响当前班。</p><button data-act="applyTraffic">套用到本班</button></div></div>`;
  }

  function ledger() {
    const L = dailyReport();
    const rows = (career.data.ledger || []).slice(0, 8).map((x) => `<div class="ad-ledger-row"><div><b>第 ${x.shift} 班 · ${x.scene || ''}</b><span>准点 ${x.punctuality}% · 晚点 ${x.late} · 事故 ${x.incidents}</span></div><b class="${x.net >= 0 ? 'pos' : 'neg'}">${money(x.net)}</b></div>`).join('');
    const lines = (career.data.ledger[0]?.lines || []).map((l) => `<div class="ad-line"><span class="tag">${l.type}</span><span>${escapeHtml(l.name)}</span><b class="${l.kind === 'in' ? 'pos' : 'neg'}">${l.kind === 'in' ? '+' : '-'}${money(l.amount)}</b></div>`).join('');
    const t = trend();
    const max = Math.max(1, ...t.map((x) => Math.abs(x.net)));
    return `<div class="ad-ledger"><div class="ad-sum"><div><span>本日收入</span><b>${money(L.income)}</b></div><div><span>本日支出</span><b>${money(L.cost)}</b></div><div><span>净利</span><b class="${L.net >= 0 ? 'pos' : 'neg'}">${money(L.net)}</b></div><div><span>准点</span><b>${L.punctuality}%</b></div></div>
      <div class="ad-trend">${t.map((x) => `<i class="${x.net >= 0 ? 'pos' : 'neg'}" style="height:${Math.abs(x.net) / max * 100}%" title="${money(x.net)}"></i>`).join('')}</div>
      <div class="ad-two"><div><h3>最近班次</h3>${rows || '<p class="ad-empty">还没有交班记录。</p>'}</div><div><h3>上一班明细</h3>${lines || '<p class="ad-empty">明细在交班后生成。</p>'}</div></div></div>`;
  }

  function contracts() {
    const list = offers();
    const active = career.data.contracts || [];
    return `<div class="ad-contracts"><h3>本期合同 · 三选一</h3><div class="ad-offers">${list.map((o) => `<div class="ad-offer ${o.color}"><div class="ad-offer-top"><b>${o.name}</b><em>${o.type}</em></div><p>${o.risk}</p><div class="ad-offer-num"><span>${money(o.reward)}/班</span><span>${o.days} 班</span><span>${o.extra ? `加 ${o.extra} 列` : '无车次'}</span></div><button data-act="sign:${o.id}">签</button></div>`).join('')}</div>
      <button class="ad-refresh" data-act="refresh">刷新合同</button>
      <h3>已签</h3>${active.length ? active.map((c) => `<div class="ad-active"><b>${c.name}</b><span>${money(c.reward)}/班 · 剩 ${c.left} 班</span><button data-act="drop:${c.id}">违约</button></div>`).join('') : '<p class="ad-empty">没有合同。合同车次会在下一班运行图里出现。</p>'}</div>`;
  }

  function staff() {
    const roster = (career.data.staff || []).map((id, i) => {
      const r = staffRow(id);
      const name = career.data.staffNames?.[id] || NAMES[i % NAMES.length];
      const tired = r.rest ? 'rest' : r.fatigue > 70 ? 'tired' : '';
      return `<div class="ad-person ${tired}"><div class="ad-avatar">${name.slice(0, 1)}</div><div class="ad-person-main"><b>${name}</b><span>${r.role.name} · ${r.role.effect}</span><small>${r.rest ? `休班，还剩 ${r.rest} 班` : `疲劳 ${r.fatigue}/100 · 培训 ${r.trained}/3`}</small>${bar(r.fatigue, r.fatigue > 70 ? 'bad' : r.fatigue > 50 ? 'warn' : 'ok')}</div>
        <div class="ad-person-act">${r.rest ? `<button data-act="recall:${id}">归队</button>` : `<button data-act="rest:${id}">休班</button><button data-act="train:${id}">培训</button>`}</div></div>`;
    }).join('');
    const hire = STAFF.map((s) => `<div class="ad-hire"><div><b>${s.name}</b><span>${s.effect}</span></div><span>${money(s.cost)}</span><button data-act="hire:${s.id}" ${career.data.staff.includes(s.id) ? 'disabled' : ''}>${career.data.staff.includes(s.id) ? '在岗' : '招'}</button></div>`).join('');
    return `<div class="ad-staff"><div><h3>在岗</h3>${roster || '<p class="ad-empty">只有站长和 1 名值班员。</p>'}<p class="ad-note">疲劳 90 自动休班。休班或疲劳过高的人不提供岗位加成，事件会排队并拖晚点。</p></div><div><h3>招聘</h3>${hire}</div></div>`;
  }

  function duty() {
    const dlc = Object.values(career.data.dlc || {}).filter((x) => x.enabled);
    const weather = dlcOn('weather');
    return `<div class="ad-duty"><div><span>班次</span><b>第 ${(career.data.shiftIndex || 0) + 1} 班</b></div><div><span>日期</span><b>第 ${Math.floor((career.data.shiftIndex || 0) / 3) + 1} 日</b></div><div><span>合同</span><b>${(career.data.contracts || []).length} / 2</b></div><div><span>在建</span><b>${(career.data.builds || []).length} / 1</b></div><button data-act="end">结束本班并日结</button><p>本班结束后必须确认日结，才能开下一班。</p></div>
    <div class="ad-dlc"><h3>已启用附加包</h3>${dlc.length ? dlc.map((x) => `<span class="ad-chip">${x.name}</span>`).join('') : '<p class="ad-empty">主线基础玩法。</p>'}
    ${weather ? `<div class="ad-weather"><h3>天气控制 · 恶劣天气包</h3>${['晴','小雨','暴雨','大雪','大雾','大风'].map((w) => `<button data-act="weather:${w}">${w}</button>`).join('')}</div>` : ''}
    <div class="ad-mech"><h3>机制包已接线</h3>${activeMechanics().length ? activeMechanics().map(([f, n, d]) => `<div class="ad-mech-row"><b>${n}</b><span>${d}</span></div>`).join('') : '<p class="ad-empty">没有安装机制包。</p>'}</div>
    <div class="ad-audio"><h3>语音与环境音</h3><p>目录 ${catalogStats().total} 条，按班次、天气、时段组合。没有音频文件时走系统语音与程序化底层音。</p><button data-act="speak">播报一条站台广播</button></div></div>`;
  }

  function render() {
    const content = tab === 'overview' ? overview() : tab === 'assets' ? upgrades() : tab === 'traffic' ? traffic() : tab === 'ledger' ? ledger() : tab === 'contracts' ? contracts() : tab === 'staff' ? staff() : duty();
    root.innerHTML = head() + tabs() + `<div class="ad-body">${content}</div>`;
  }

  root.addEventListener('click', (e) => {
    const t = e.target.closest('[data-tab],[data-station],[data-act]');
    if (!t) return;
    if (t.dataset.tab) { tab = t.dataset.tab; render(); return; }
    if (t.dataset.station) { station = t.dataset.station; career.data.currentStation = station; saveCareer(); tab = 'assets'; render(); return; }
    const act = t.dataset.act || '';
    if (act.startsWith('build:')) {
      const [, st, id] = act.split(':');
      const r = startBuild(id, st);
      toast(r.msg, r.ok ? 'ok' : 'err');
      if (r.ok) tickBuildsSoon();
      render();
    } else if (act.startsWith('sign:')) {
      const r = sign(act.slice(5));
      toast(r.msg, r.ok ? 'ok' : 'err');
      render();
    } else if (act.startsWith('drop:')) {
      drop(act.slice(5));
      toast('已违约，声誉和罚款会在日结里体现', 'warn');
      profile.data.reputation = Math.max(0, profile.data.reputation - 4);
      saveProfile();
      render();
    } else if (act.startsWith('rest:')) {
      const r = restStaff(act.slice(5)); toast(r.msg, r.ok ? 'ok' : 'err'); render();
    } else if (act.startsWith('recall:')) {
      const r = recallStaff(act.slice(7)); toast(r.msg, r.ok ? 'ok' : 'err'); render();
    } else if (act.startsWith('train:')) {
      const r = trainStaff(act.slice(6)); toast(r.msg, r.ok ? 'ok' : 'err'); render();
    } else if (act.startsWith('hire:')) {
      const id = act.slice(5);
      const s = STAFF.find((x) => x.id === id);
      if (!s) return;
      if (profile.data.credits < s.cost) { toast(`资金不足，还差 ${money(s.cost - profile.data.credits)}`, 'err'); return; }
      profile.data.credits -= s.cost;
      saveProfile();
      career.data.staff.push(id);
      career.data.staffNames[id] = NAMES[(career.data.staff.length - 1) % NAMES.length];
      saveCareer();
      toast(`${s.name} 已到岗`, 'ok');
      render();
    } else if (act === 'refresh') {
      refreshOffers();
      toast('合同已刷新', 'ok');
      render();
    } else if (act === 'end') {
      toast('在本班结束时点“交班”才会结算', 'warn');
    } else if (act.startsWith('weather:')) {
      if (ctx && ctx.sim) { ctx.sim.setWeather(act.slice(8)); toast(`天气改为${act.slice(8)}`, 'ok'); }
    } else if (act.startsWith('fix:')) {
      const r = repairFacility(act.slice(4)); toast(r.msg, r.ok ? 'ok' : 'err'); render();
    } else if (act === 'applyTraffic') {
      if (ctx && ctx.sim) { applyTraffic(ctx.sim); toast('车流分配已套用到本班', 'ok'); }
    } else if (act === 'speak') {
      const cue = pickCue('pa', Date.now());
      if (ctx && ctx.audio) ctx.audio.announce(cue.text);
      toast(cue.text, 'ok');

    } else if (act.startsWith('go:')) {
      tab = act.slice(3);
      render();
    }
  });

  root.addEventListener('input', (e) => {
    const r = e.target.closest('input[data-seg]');
    if (!r) return;
    const out = root.querySelector(`[data-out="pax:${r.dataset.seg}"]`);
    if (out) out.textContent = `${r.value}%`;
  });

  root.addEventListener('change', (e) => {
    const t = e.target.closest('[data-seg]');
    if (!t || !t.dataset.kind) return;
    const seg = t.dataset.seg;
    if (t.dataset.kind === 'pax') setAllocation(seg, t.value);
    if (t.dataset.kind === 'priority') setAllocation(seg, allocations()[seg].pax, t.value);
    if (ctx && ctx.sim) applyTraffic(ctx.sim);
    render();
  });

  function tickBuildsSoon() {
    if (ctx && ctx.refreshCareer) ctx.refreshCareer();
  }

  render();
  return api;
}
