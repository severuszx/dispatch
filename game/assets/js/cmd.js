import { el, on, fmtClock, pad } from './util.js';
import { sim } from './sim.js';

let pendingTrain = null;
let applyPending = null;

const TYPES = [
  { id: '封锁', label: '封锁区间', hint: '区间停止接发，抢修/救援用' },
  { id: '开通', label: '开通区间', hint: '销除封锁，恢复接发' },
  { id: '限速', label: '临时限速', hint: '按毫米/公里设限，需写明起止' },
  { id: '反方向', label: '反方向行车', hint: '单线/双线降级手段' },
  { id: '降弓', label: '降弓通过', hint: '接触网故障区段' },
  { id: '电话闭塞', label: '改电话闭塞', hint: '基本闭塞停用后的降级' },
  { id: '非常站控', label: '转非常站控', hint: '车站接管，调度电话指挥' },
  { id: '救援', label: '救援列车', hint: '需区间封锁配合' },
  { id: '热备', label: '热备替换', hint: '消耗一张底牌' },
  { id: '扣车', label: '扣车待命', hint: '站内扣停，等现场确认' },
  { id: '加开', label: '临时加开', hint: '临客上线，需客调确认' },
];

export function prefillCommand(trainId) {
  pendingTrain = trainId;
  if (applyPending) applyPending();
}

export function buildCommandPanel(body) {
  const wrap = el('div', 'pane cmd-pane');
  const head = el('div', 'pane-title', '调度命令终端');
  head.append(el('span', '', 'CMD-1'));
  wrap.append(head);

  const form = el('div', 'cmd-form');
  const typeRow = el('div', 'cmd-row');
  typeRow.append(el('label', '', '命令类型'));
  const typeSel = el('select');
  TYPES.forEach((t) => {
    const o = el('option', '', t.label);
    o.value = t.id;
    typeSel.append(o);
  });
  typeRow.append(typeSel);
  form.append(typeRow);

  const hintEl = el('div', 'cmd-hint', TYPES[0].hint);
  form.append(hintEl);

  const row2 = el('div', 'cmd-row');
  row2.append(el('label', '', '受令者'));
  const recv = el('input');
  recv.placeholder = '车站值班员 / 司机';
  row2.append(recv);
  form.append(row2);

  const row3 = el('div', 'cmd-row');
  row3.append(el('label', '', '车次'));
  const trainSel = el('select');
  form.append(row3);
  row3.append(trainSel);

  const row4 = el('div', 'cmd-row');
  row4.append(el('label', '', '区间/地点'));
  const place = el('input');
  place.placeholder = '如 青岚—白墅';
  row4.append(place);
  form.append(row4);

  const row5 = el('div', 'cmd-row');
  row5.append(el('label', '', '时长(分)'));
  const mins = el('input');
  mins.type = 'number';
  mins.value = '20';
  mins.min = '1';
  row5.append(mins);
  form.append(row5);

  const row6 = el('div', 'cmd-row');
  row6.append(el('label', '', '命令号'));
  const no = el('input');
  no.value = `TJ-${String(Math.floor(Math.random() * 900) + 100)}`;
  row6.append(no);
  form.append(row6);

  const preview = el('div', 'cmd-preview');
  form.append(preview);
  wrap.append(form);

  const btns = el('div', 'cmd-btns');
  const bIssue = el('button', 'btn btn-primary', '签发命令');
  const bCancel = el('button', 'btn', '作废');
  btns.append(bIssue, bCancel);
  wrap.append(btns);

  const list = el('div', 'cmd-list');
  wrap.append(list);

  const refreshTrains = () => {
    const cur = trainSel.value;
    trainSel.innerHTML = '';
    const opt0 = el('option', '', '（不指定 / 全线）');
    opt0.value = '';
    trainSel.append(opt0);
    sim.trains.forEach((t) => {
      const o = el('option', '', `${t.no} ${t.status === 'running' ? '区间' : t.station}`);
      o.value = t.id;
      trainSel.append(o);
    });
    if (cur) trainSel.value = cur;
  };
  refreshTrains();
  setInterval(refreshTrains, 1500);

  const updatePreview = () => {
    const t = TYPES.find((x) => x.id === typeSel.value);
    hintEl.textContent = t ? t.hint : '';
    const tr = sim.getTrain(trainSel.value);
    const placeTxt = place.value || (tr ? `${sim.stations[tr.station].name}—${sim.stations[sim.nextStation(tr)].name}` : '—');
    preview.textContent = `${no.value}  ${t ? t.label : ''}  ${place.value ? place.value : placeTxt}  ${mins.value} 分\n受令：${recv.value || '—'}${tr ? `  车次：${tr.no}` : ''}`;
  };
  [typeSel, trainSel, place, mins, no, recv].forEach((x) => {
    x.addEventListener('change', updatePreview);
    x.addEventListener('input', updatePreview);
  });
  updatePreview();

  const applyTrain = () => {
    if (!pendingTrain) return;
    const tr = sim.getTrain(pendingTrain);
    if (!tr) return;
    trainSel.value = tr.id;
    const st = sim.stations[tr.station];
    if (st && !recv.value) recv.value = `${st.name}值班员`;
    if (!place.value && tr.station) {
      const next = sim.nextStation(tr);
      if (next) place.value = `${st.name}—${sim.stations[next].name}`;
    }
    pendingTrain = null;
    updatePreview();
  };
  applyPending = applyTrain;
  applyTrain();

  const renderList = () => {
    list.innerHTML = '';
    const rows = sim.decisions.filter((d) => d.event === 'order').slice(-12).reverse();
    if (!rows.length) { list.append(el('div', 'cmd-empty', '还没有签发记录。')); return; }
    rows.forEach((d) => {
      const r = el('div', `cmd-item ${d.risk === '高' ? 'bad' : ''}`);
      r.append(el('span', 'ci-t', fmtClock(d.t)));
      r.append(el('span', 'ci-a', d.title));
      r.append(el('span', 'ci-b', d.branch));
      list.append(r);
    });
  };
  renderList();
  sim.subscribe((s, evt) => { if (evt === 'order' || evt === 'tick') renderList(); });

  on(bIssue, 'click', () => {
    const tr = sim.getTrain(trainSel.value);
    let a = '';
    let b = '';
    if (place.value.includes('—')) { [a, b] = place.value.split('—').map((x) => x.trim()); }
    const stations = Object.entries(sim.stations);
    const findId = (name) => { const hit = stations.find(([, v]) => v.name === name); return hit ? hit[0] : null; };
    const cmd = {
      type: typeSel.value,
      receiver: recv.value.trim(),
      train: tr ? tr.no : '',
      no: no.value.trim(),
      minutes: Number(mins.value) || 20,
      a: findId(a) || (tr ? tr.station : ''),
      b: findId(b) || (tr ? sim.nextStation(tr) : ''),
      place: place.value,
    };
    const res = sim.issueCommand(cmd);
    if (res.ok) {
      const stamp = el('div', 'cmd-stamp', '已受理');
      wrap.append(stamp);
      setTimeout(() => stamp.remove(), 1800);
      no.value = `TJ-${String(Math.floor(Math.random() * 900) + 100)}`;
      updatePreview();
    } else {
      const bad = el('div', 'cmd-stamp bad', '退回');
      wrap.append(bad);
      setTimeout(() => bad.remove(), 1800);
    }
    renderList();
  });
  on(bCancel, 'click', () => {
    place.value = '';
    recv.value = '';
    no.value = `TJ-${String(Math.floor(Math.random() * 900) + 100)}`;
    updatePreview();
  });

  body.append(wrap);
  return {
    update() { updatePreview(); },
  };
}

export function buildRadioPanel(body) {
  const wrap = el('div', 'pane radio-pane');
  const head = el('div', 'pane-title', '调度电话 / 电台');
  head.append(el('span', '', 'RADIO'));
  wrap.append(head);
  const feed = el('div', 'radio-feed');
  wrap.append(feed);
  const chips = el('div', 'radio-chips');
  const CALLS = ['呼叫车站', '呼叫司机', '呼叫邻台', '呼叫救援', '呼叫电务', '呼叫客调'];
  CALLS.forEach((c) => {
    const b = el('button', 'chip', c);
    b.addEventListener('click', () => {
      sim.pushLog(`【通话】${c}：线路接通`);
      sim.alarm('通话', `${c} 已接通`, 'info');
      mention(c);
      sim.emit('radio');
    });
    chips.append(b);
  });
  wrap.append(chips);
  const recent = [];
  function mention(text) {
    recent.push({ t: sim.clock, text });
    render();
  }
  function render() {
    feed.innerHTML = '';
    const evs = sim.eventHistory.slice(-6).map((e) => ({ t: e.resolvedAt || e.at, text: `${e.title} → ${e.outcome}` }));
    const cmds = sim.decisions.filter((d) => d.event === 'order').slice(-6).map((d) => ({ t: d.t, text: `${d.title}：${d.branch}` }));
    const merged = [...evs, ...cmds, ...recent].sort((a, b) => a.t - b.t).slice(-16);
    if (!merged.length) { feed.append(el('div', 'radio-empty', '频道安静。')); return; }
    merged.forEach((m) => {
      const line = el('div', 'radio-line');
      line.append(el('span', 'rl-t', fmtClock(m.t)));
      line.append(el('span', 'rl-x', m.text));
      feed.append(line);
    });
    feed.scrollTop = feed.scrollHeight;
  }
  render();
  sim.subscribe((s, evt) => {
    if (evt === 'tick' && Math.random() < 0.25) {
      const t = s.trains.find((x) => x.status === 'running');
      if (t) {
        const lines = [
          `"调度，${t.no} 正常，前方信号好了。"`,
          `"${t.no} 请求进站。"`,
          `"调度，${s.stations[t.station] ? s.stations[t.station].name : ''} 这边股道空着吗？"`,
          `"${t.no} 收到，复诵完毕。"`,
        ];
        mention(lines[Math.floor(Math.random() * lines.length)]);
      }
    }
    if (evt === 'event' || evt === 'order' || evt === 'resolve') render();
  });
  body.append(wrap);
  return { update() {} };
}
