function openEvent() {
  const e = state.event;
  if (!e) return;
  modal(e.kicker, e.title, e.body, e.choices.map((c) => ({ label: c.label, tone: c.tone, fn: () => resolveEvent(c, e.station) })));
}

function resolveEvent(choice, stationId) {
  const a = choice.apply || {};
  const target = stationId || selected;
  if (a.cash) state.cash += a.cash;
  if (a.reputation) state.reputation = clamp(state.reputation + a.reputation, 0, 100);
  if (a.superior) state.superior = clamp(state.superior + a.superior, 0, 100);
  if (a.facility) {
    GROUPS.forEach((g) => { groupsOf(target)[g.id] = clamp(groupsOf(target)[g.id] + a.facility, 0, 100); });
  }
  if (a.morale) STATIONS.forEach((d) => { st(d.id).morale = clamp(st(d.id).morale + a.morale, 0, 100); });
  if (a.safety) state.effects.push({ label: choice.label, days: 2, safety: a.safety });
  if (a.punc) state.effects.push({ label: choice.label, days: 2, punc: a.punc });
  if (a.effect) state.effects.push(a.effect);
  state.event = null;
  save(true); closeModal(); renderAll();
  toast('事件已处置，继续推进');
}

function openOver() {
  const total = state.ledger.reduce((a, x) => a + x.net, 0);
  const avgP = state.ledger.length ? Math.round(state.ledger.reduce((a, x) => a + x.punc, 0) / state.ledger.length) : 0;
  modal('任期结束', state.over, `<p>现金 <b>${fm(state.cash)}</b>，累计净利 <b>${fm(total)}</b>，平均准点 <b>${avgP}%</b>，最终评级 <b>${rating()}</b>。</p><p>这局结束了。可以导出结算码留档，或者回入口重开。</p>`, [
    { label: '导出结算码', tone: 'good', fn: () => { navigator.clipboard.writeText(saveCode()); toast('结算码已复制'); } },
    { label: '重开一局', fn: () => { state = fresh(); selected = 'qinglan'; closeModal(); save(true); renderAll(); } },
    { label: '留在本站', fn: closeModal },
  ]);
}

function saveSlot(n) {
  localStorage.setItem(SLOT(n), JSON.stringify({ ...state, selected }));
  toast(`已写入槽位 ${n}`);
  renderAll();
}

function loadSlot(n) {
  try {
    const raw = localStorage.getItem(SLOT(n));
    if (!raw) return;
    applyLoaded(normalize(JSON.parse(raw)));
    toast(`已读取槽位 ${n}`);
  } catch (e) { toast('槽位读取失败'); }
}

function applyLoaded(s) {
  state = normalize(s);
  selected = state.selected || 'qinglan';
  tab = 'overview';
  setNav(); save(true); renderAll();
}

async function cloudSave() {
  try {
    setCloudToken($('mToken').value);
    const r = await uploadCloud(saveCode(), { name: `站长台 D${state.day}` });
    toast(`已上传：${r.id}`);
  } catch (e) { toast(e.message); }
}

function cloudLoad() {
  const id = prompt('填 Gist 编号或链接');
  const clean = parseCloudInput(id || '');
  if (!clean) return;
  downloadCloud(clean).then((r) => { applyLoaded(readCode(r.code)); toast(`已读取云端 ${clean}`); }).catch((e) => toast(e.message));
}

function exportCsv() {
  const rows = ['day,revenue,cost,contract,net,punc,safety'];
  state.ledger.forEach((x) => rows.push([x.day, Math.round(x.revenue), Math.round(x.cost), Math.round(x.contract), Math.round(x.net), x.punc, x.safety].join(',')));
  const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `dispatch-manage-D${state.day}.csv`;
  a.click();
}

document.querySelectorAll('#mNav [data-tab]').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));
$('mNext').addEventListener('click', advance);
$('mSave').addEventListener('click', () => save(false));
$('mBack').addEventListener('click', () => { save(true); location.href = '../index.html'; });
$('mModal').querySelector('.m-modal-shade').addEventListener('click', () => { if (!state.event) closeModal(); });

state = normalize(load() || fresh());
selected = state.selected || 'qinglan';
tab = 'overview';
setNav();
renderAll();
if (!load()) toast('新局开始：接手宝成线四站，撑过 60 天');
