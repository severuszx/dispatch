import { el, fmtClock } from './util.js';
import { sim } from './sim.js';

export function buildOrderLogPanel(body) {
  const wrap = el('div', 'pane ord-pane');
  const head = el('div', 'pane-title', '行车日志');
  head.append(el('span', 'ord-tag-ro', '只读'));
  head.append(el('span', 'ord-total mono', '0'));
  wrap.append(head);
  const bar = el('div', 'ord-bar');
  let cur = '全部';
  const chips = el('div', 'ord-chips');
  ['全部', '调度命令', '车机联控'].forEach((f) => {
    const b = el('button', `chip ${f === '全部' ? 'on' : ''}`, f);
    b.addEventListener('click', () => {
      chips.querySelectorAll('.chip').forEach((x) => x.classList.remove('on'));
      b.classList.add('on');
      cur = f;
      render(true);
    });
    chips.append(b);
  });
  const stick = el('span', 'ord-stick', '跟随最新');
  bar.append(chips, stick);
  wrap.append(bar);
  const feed = el('div', 'ord-feed');
  wrap.append(feed);
  let follow = true;
  feed.addEventListener('scroll', () => {
    follow = feed.scrollTop + feed.clientHeight >= feed.scrollHeight - 24;
    stick.classList.toggle('off', !follow);
    stick.textContent = follow ? '跟随最新' : '已暂停跟随';
  });

  function rows() {
    const merged = [];
    (sim.orderFeed || []).forEach((x) => merged.push(x));
    (sim.radioFeed || []).forEach((x) => merged.push(x));
    merged.sort((a, b) => a.t - b.t);
    return merged.filter((x) => {
      if (cur === '全部') return true;
      if (cur === '调度命令') return x.kind === 'order';
      return x.kind === 'radio';
    });
  }

  function render(force) {
    const list = rows();
    const total = head.querySelector('.ord-total');
    total.textContent = String(list.length);
    const nearBottom = follow || force;
    const html = list.map((x) => {
      const kind = x.kind === 'order' ? '命令' : '联控';
      const cls = x.kind === 'order' ? 'order' : 'radio';
      return `<div class="ord-row ${cls}"><span class="ord-t">${fmtClock(x.t)}</span><span class="ord-k">${kind}</span><span class="ord-s">${x.speaker || ''}</span><span class="ord-x">${x.text}</span></div>`;
    }).join('');
    feed.innerHTML = html || '<div class="ord-empty">本场景命令库尚未载入，等待调度台发布。</div>';
    if (nearBottom) feed.scrollTop = feed.scrollHeight;
  }

  render(true);
  sim.subscribe((s, evt) => { if (evt === 'tick') render(false); });
  body.append(wrap);
  return { update: () => render(false) };
}
