function renderFinance() {
  const rows = state.ledger.slice(-15).reverse().map((x) => `<div class="m-row"><b class="mono">D${x.day}</b><span>收 ${fm(x.revenue)} · 支 ${fm(x.cost)} · 合同 ${fm(x.contract)}</span><b class="mono" style="margin-left:auto;color:${x.net >= 0 ? '#8dbb9c' : '#e0665c'}">${fm(x.net)}</b></div>`).join('');
  const total = state.ledger.reduce((a, x) => a + x.net, 0);
  return `<div class="m-page-head"><h2>财务</h2><span>现金 ${fm(state.cash)} · 累计净利 ${fm(total)}</span></div>
  <div class="m-grid-4">
    ${stat('累计收入', fm(state.ledger.reduce((a, x) => a + x.revenue, 0)), '含合同')}
    ${stat('累计支出', fm(state.ledger.reduce((a, x) => a + x.cost, 0)), '工资、维护、施工')}
    ${stat('累计净利', fm(total), '不含初始现金')}
    ${stat('日均净利', fm(state.ledger.length ? total / state.ledger.length : 0), `${state.ledger.length} 天`)}
  </div>
  <div class="m-block"><h3>日结流水</h3>${rows || '<div class="m-ins-note">还没有流水，推进一天后生成。</div>'}</div>`;
}

function renderPolicy() {
  const active = state.policy && state.policy.left > 0 ? `<div class="m-ins-note">当前：<b>${esc(state.policy.name)}</b>，剩 ${state.policy.left} 天。</div>` : '<div class="m-ins-note">本周还没有政策。</div>';
  const cards = POLICIES.map((p) => `<div class="m-cell"><b>${p.name}</b><span>${p.desc}</span><div style="margin-top:8px"><button class="m-btn good" data-policy="${p.id}" ${state.cash < 5000 ? 'disabled' : ''}>${state.policy ? '调整（¥5,000）' : '定下本周'}</button></div></div>`).join('');
  return `<div class="m-page-head"><h2>政策</h2><span>每 7 天可定一项，调整花 ¥5,000</span></div>${active}<div class="m-block"><h3>可选口径</h3><div class="m-list">${cards}</div></div>`;
}

function saveCode() {
  const s = { ...state, selected };
  return `MGV1:${btoa(unescape(encodeURIComponent(JSON.stringify(s))))}`;
}

function readCode(code) {
  const t = String(code || '').trim();
  if (!t.startsWith('MGV1:')) throw new Error('不是站长台存档');
  const s = JSON.parse(decodeURIComponent(escape(atob(t.slice(5)))));
  if (!s || s.v !== 1) throw new Error('存档版本不对');
  return normalize(s);
}

function renderSave() {
  const slots = [1, 2, 3].map((n) => {
    let meta = '空';
    try {
      const raw = localStorage.getItem(SLOT(n));
      if (raw) {
        const s = JSON.parse(raw);
        meta = `第 ${s.day} 日 · ${fm(s.cash)}`;
      }
    } catch (e) { meta = '损坏'; }
    return `<div class="m-row"><b>槽位 ${n}</b><span>${meta}</span><button class="m-btn" data-save-slot="${n}">存</button><button class="m-btn" data-load-slot="${n}" ${meta === '空' ? 'disabled' : ''}>读</button></div>`;
  }).join('');
  return `<div class="m-page-head"><h2>存档与云</h2><span>本地、导出码、GitHub Gist</span></div>
  <div class="m-block"><h3>本地槽位</h3>${slots}<div class="m-ins-note">每次推进一天会自动覆盖自动存档。</div></div>
  <div class="m-block"><h3>导出码</h3><textarea id="mCode" style="width:100%;height:92px;background:#0d1316;border:1px solid #2f3e44;color:#c9d3cf;font:10px var(--mono);padding:8px" readonly>${saveCode()}</textarea><div style="margin-top:6px"><button class="m-btn" id="mCopy">复制导出码</button></div></div>
  <div class="m-block"><h3>导入</h3><textarea id="mImport" placeholder="粘贴 MGV1:..." style="width:100%;height:70px;background:#0d1316;border:1px solid #2f3e44;color:#c9d3cf;font:10px var(--mono);padding:8px"></textarea><div style="margin-top:6px"><button class="m-btn" id="mImportGo">载入</button></div></div>
  <div class="m-block"><h3>云端</h3><div class="m-row"><span>GitHub 令牌</span><input id="mToken" type="password" value="${esc(cloudToken())}" placeholder="gist 权限令牌" style="flex:1;height:25px;background:#0d1316;border:1px solid #2f3e44;color:#c9d3cf;padding:0 6px"></div><div class="m-row"><button class="m-btn good" id="mUp">上传云存档</button><span>把当前导出码写入私有 Gist</span></div><div class="m-row"><button class="m-btn" id="mDown">按编号载入</button><span>填 Gist 编号或链接</span></div></div>`;
}

function renderPage(p) {
  const fn = { overview: renderOverview, station: renderStation, assets: renderAssets, staff: renderStaff, contracts: renderContracts, traffic: renderTraffic, finance: renderFinance, policy: renderPolicy, save: renderSave }[tab] || renderOverview;
  $('mPage').innerHTML = fn(p);
  if (tab === 'station') {
    $('mPage').querySelectorAll('[data-build]').forEach((b) => b.addEventListener('click', () => startBuild(b.dataset.build)));
  }
  if (tab === 'assets') {
    $('mPage').querySelectorAll('[data-repair]').forEach((b) => b.addEventListener('click', () => repair(b.dataset.repair)));
  }
  if (tab === 'staff') {
    $('mPage').querySelectorAll('[data-hire]').forEach((b) => b.addEventListener('click', () => hire(b.dataset.hire)));
    $('mPage').querySelectorAll('[data-train]').forEach((b) => b.addEventListener('click', () => trainStaff(b.dataset.train)));
  }
  if (tab === 'contracts') {
    $('mPage').querySelectorAll('[data-sign]').forEach((b) => b.addEventListener('click', () => sign(b.dataset.sign)));
    $('mPage').querySelectorAll('[data-drop]').forEach((b) => b.addEventListener('click', () => drop(b.dataset.drop)));
  }
  if (tab === 'traffic') {
    $('mPage').querySelectorAll('[data-share]').forEach((input) => input.addEventListener('input', () => {
      state.segments[input.dataset.share].pax = Number(input.value);
      input.nextElementSibling.textContent = `${input.value}%`;
      renderTop(); renderMap(project()); renderInspector(project());
    }));
  }
  if (tab === 'policy') {
    $('mPage').querySelectorAll('[data-policy]').forEach((b) => b.addEventListener('click', () => choosePolicy(b.dataset.policy)));
  }
  if (tab === 'save') {
    $('mPage').querySelectorAll('[data-save-slot]').forEach((b) => b.addEventListener('click', () => saveSlot(Number(b.dataset.saveSlot))));
    $('mPage').querySelectorAll('[data-load-slot]').forEach((b) => b.addEventListener('click', () => loadSlot(Number(b.dataset.loadSlot))));
    $('mCopy').addEventListener('click', () => { $('mCode').select(); navigator.clipboard.writeText(saveCode()).then(() => toast('导出码已复制')).catch(() => toast('复制失败，手动选中')); });
    $('mImportGo').addEventListener('click', () => {
      try { applyLoaded(readCode($('mImport').value)); toast('导入成功'); } catch (e) { toast(e.message); }
    });
    $('mToken').addEventListener('change', () => setCloudToken($('mToken').value));
    $('mUp').addEventListener('click', cloudSave);
    $('mDown').addEventListener('click', cloudLoad);
  }
}

function renderFoot(p) {
  const todo = decideList(p)[0] || '按当前节奏推进';
  $('mTodo').textContent = state.over ? `本局已结束：${state.over}` : todo;
  $('mForecast').textContent = `预计日净利 ${fm(p.net)} / 准点 ${p.punc}%`;
  $('mNext').disabled = false;
  $('mNext').textContent = state.over ? '查看结算' : state.event ? '处理事件' : `推进到第 ${state.day + 1} 日`;
}

function renderAll() {
  const p = project();
  renderTop();
  renderMap(p);
  renderPage(p);
  renderInspector(p);
  renderFoot(p);
}
