import { el, storage } from './util.js';
import { sim } from './sim.js';

const LESSONS = {
  t1: [
    {
      tag: '开始之前',
      title: '这一局只有一个站',
      body: '不用记全线，也不会有别的车站来打扰。你面前只有实训站的 4 条股道、3 列车。先把一列车接进来，再把它放出去，就算过关。',
      tip: '整场游戏只有“接车、发车、处理异常”三类动作。',
    },
    {
      tag: '第 1 步 · 看时间',
      title: '屏幕最上面是值班时钟',
      body: '06:02 是游戏里的时间，不是现实时间。右边有暂停和倍速。时间走得太快看不清，就点暂停。',
      target: '.topbar',
      tip: '游戏里 1 分钟约等于现实 1 秒，倍速只影响游戏时间。',
    },
    {
      tag: '第 2 步 · 认站场图',
      title: '左边这张图，就是整个实训站',
      body: '每一条横线是一条股道，也就是一条能停车的线。旁边写 1、2、3、4 的是股道号。线上写着 K101 的地方，就是这列车现在停的位置。',
      target: '[data-win="ctc"]',
      term: { name: '股道', plain: '车站里一条能停车的线，编号叫几道。' },
      tip: '把站场图当成停车场的俯视图，不是线路地图。',
    },
    {
      tag: '第 3 步 · 点车',
      title: '直接点写着 K101 的车次牌',
      body: '不用去左边菜单找命令。看到哪列车，就点它。点中以后，右边会滑出一张“这列车下一步”的卡片。',
      target: '[data-win="ctc"]',
      action: '在站场图里点一下 K101 的车次牌。',
      tip: '以后每一列车都这样操作：先点车，再选动作。',
    },
    {
      tag: '第 4 步 · 下一步',
      title: '右侧卡片只回答一个问题：它下一步怎么走',
      body: '卡片上会写清车次、停在哪条股道、计划几点发。下面是大按钮：放行出站，还有交回本站、换股道、下发命令。按你要的结果点。',
      target: '#side',
      term: { name: '放行', plain: '允许这列车从车站开出，进入下一段线路。' },
      tip: '卡片没出来，说明车没点中，再点一次车次牌。',
    },
    {
      tag: '第 5 步 · 站控',
      title: '本站已经交到你手里',
      body: '卡片上直接写着“放行出站”，说明这个站由你控制。下面的“交回本站”是还给电脑自动发车，教学关不要点它。',
      target: '.act-main',
      action: '不用点按钮，先确认卡片主按钮是“放行出站”。',
      tip: '只有写着“接管本站”时才需要接管；接管只影响当前这一个站。',
    },
    {
      tag: '第 6 步 · 放行',
      title: '点“放行出站”，这列车才走',
      body: '放行前看一眼股道有没有被别的车顶住。确认空着，再点“放行出站”。放行后，车会按运行图开往下一站，站场图上会空出这条线。',
      target: '.act-main',
      action: '在右侧卡片上点一次“放行出站”。',
      term: { name: '发车', plain: '允许列车从车站开出，进入下一段线路。' },
    },
    {
      tag: '第 7 步 · 看报警',
      title: '红色必须处理，黄色先记下',
      body: '左上角的报警栏会跳提示。红色表示可能冲突、脱轨、设备失效，要马上看；黄色只是晚点或占用偏高，可以先放一放。教学关一路正常的话，它会一直空着，这不代表坏了。',
      target: '[data-win="alarms"]',
      term: { name: '报警', plain: '系统发现异常后给出的提示，不等于已经出事。' },
      tip: '先看报警，再点对应车次，别只凭弹窗下判断。',
    },
    {
      tag: '第 8 步 · 试一次',
      title: '现在轮到你值班',
      body: '刚才只是认识界面。接下来保持正常速度，把剩下的车一列一列点开、接管、放行。遇到红灯先暂停，看清是哪条股道，再决定。',
      tip: '教学关不计分。点“开始值班”后，本关正式开始。',
      finish: true,
    },
  ],
  t2: [
    {
      tag: '第 1 步 · 单线',
      title: '只有一条线，两列车不能并排走',
      body: '单线区间就是两个车站之间只有一条轨道。同一时间里，这个区间只能有一列车。对面有车过来，就必须有一列先进站等。',
      target: '[data-win="ctc"]',
      term: { name: '单线', plain: '两站之间只有一条轨道，双向列车轮流使用。' },
      tip: '单线不是“一条线随便开”，而是“一段只准一列”。',
    },
    {
      tag: '第 2 步 · 区间',
      title: '两站之间的那段路叫区间',
      body: '车站是能停车的地方，区间是两站之间的路。列车开出车站，就进入区间；到下一站进站，才算离开区间。',
      term: { name: '区间', plain: '相邻两站之间的线路段，一次只允许一列车占用。' },
      tip: '站场图只看站内，区间要看运行图或线路图。',
    },
    {
      tag: '第 3 步 · 会车',
      title: '一列进站等，另一列先过',
      body: '两条相反方向的车在同一条单线上相遇，叫会车。做法很简单：让其中一列先进入有股道的车站停住，另一列从正线过去，再放停住的那列走。',
      target: '[data-win="graph"]',
      term: { name: '会车', plain: '相反方向两列车在单线上错开，一列停站让另一列先过。' },
      tip: '不要让两列同时进同一个区间，这是最常见的撞车原因。',
    },
    {
      tag: '第 4 步 · 找会让站',
      title: '点“车站与站场”，看哪站有空股道',
      body: '右侧卡片会显示每个站还有没有空股道。选一个有空股道、又离两列车都不远的站，作为会让站。',
      target: '.rail button[data-panel="station"]',
      action: '打开“车站与站场”。',
      check: '.rail button[data-panel="station"]',
    },
    {
      tag: '第 5 步 · 接管会让站',
      title: '把会让站改成手动',
      body: '点该站右上角的“接管”。之后这站的车由你放行，电脑不会再自动把车放出去。',
      target: '.stc-ctl',
      action: '点一次“接管”。',
      check: '.stc-ctl',
      onEnter(ctx) { ctx.openPanel('station'); },
    },
    {
      tag: '第 6 步 · 先放一列',
      title: '只放一列，另一列必须等',
      body: '在站内列车列表里，先放你要让过去的那一列。点它的“放行”。另一列此时不要动，等第一列到达下一站或离开区间，再放第二列。',
      target: '.stc-rel',
      action: '点一次“放行”。',
      check: '.stc-rel',
    },
    {
      tag: '第 7 步 · 看结果',
      title: '运行图上两条线不能叠在一起',
      body: '放行后看运行图：两列车的斜线应该一前一后，不能在同一时间压在同一段区间。如果叠上了，马上暂停，把其中一列扣在站里。',
      target: '[data-win="graph"]',
      tip: '会车成功不看分数，看两列车是否都安全通过。',
    },
  ],
  t5: [
    {
      tag: '第 1 步 · 命令是什么',
      title: '命令是写下来的正式指令',
      body: '口头说“你走吧”不算。调度命令要写清给谁、在哪个区间、做什么、什么时候生效。写错一个字，现场就可能办错。',
      term: { name: '调度命令', plain: '调度员发给车站或司机的正式书面指令。' },
      target: '[data-win="cmd"]',
    },
    {
      tag: '第 2 步 · 受令者',
      title: '先选这命令发给谁',
      body: '命令终端上方有受令单位。发给车站，车站负责转达司机；发给司机，司机直接执行。教学阶段先发给车站。',
      target: '[data-win="cmd"]',
    },
    {
      tag: '第 3 步 · 区间',
      title: '写清楚在哪个区间生效',
      body: '区间写错，命令就会作用到另一段线路。先看运行图确认列车位置，再选区间。',
      target: '[data-win="cmd"]',
    },
    {
      tag: '第 4 步 · 号码',
      title: '车次号一位都不能错',
      body: 'K101 和 K104 是两列车。号码错，命令就发给了不需要它的车。输入后核对一遍再发送。',
      target: '[data-win="cmd"]',
    },
    {
      tag: '第 5 步 · 发送',
      title: '点发送，再看回执',
      body: '发送后终端会给回执。显示“合规”才算完成；显示退回，按提示改，不要重复硬发。',
      target: '[data-win="cmd"]',
      tip: '命令记录里会留下每一条，事后可以复盘。',
    },
    {
      tag: '第 6 步 · 试一次',
      title: '发一条最简单的命令',
      body: '在命令终端选车站、选区间、填车次，发一条限速或封锁命令。看到合规回执，这一关就懂了。',
      target: '[data-win="cmd"]',
      finish: true,
    },
  ],
};

function glossaryStep(term, index, total) {
  if (!term) return null;
  return {
    tag: `术语 ${index + 1}/${total}`,
    title: term.term,
    body: `${term.plain} 在这游戏里，${term.impact}`,
    term: { name: term.term, plain: term.plain },
    note: term.myth,
    target: '[data-win="ctc"]',
  };
}

function genericSteps(scene, glossary) {
  const terms = (scene.terms || []).map((id) => glossary.find((t) => t.id === id)).filter(Boolean).slice(0, 3);
  const steps = [{
    tag: '本关目标',
    title: scene.title,
    body: `${scene.brief}。本关只教 ${terms.length || 1} 个词，一个一个来。`,
    target: '[data-win="ctc"]',
  }];
  terms.forEach((t, i) => {
    const s = glossaryStep(t, i, terms.length);
    if (s) steps.push(s);
  });
  steps.push({
    tag: '开始',
    title: '词认完了，开始值班',
    body: '不用一次记住全部。遇到不懂的，点左侧“术语图鉴”，随时查。',
    finish: true,
  });
  return steps;
}

export function mountTutorial(scene, glossary, ctx) {
  const old = document.getElementById('tutorialCoach');
  if (old) old.remove();
  const steps = LESSONS[scene.id] || genericSteps(scene, glossary);
  storage('tst-dispatch-tutorial-seen', {});
  let index = 0;
  let done = false;
  let focused = null;

  const box = el('div', 'coach');
  box.id = 'tutorialCoach';
  const top = el('div', 'coach-top');
  const tag = el('span', 'coach-tag mono');
  const progress = el('span', 'coach-progress mono');
  const quit = el('button', 'coach-quit', '退出教学');
  top.append(tag, progress, quit);
  const title = el('div', 'coach-title');
  const bodyEl = el('div', 'coach-body');
  const termEl = el('div', 'coach-term hidden');
  const actionEl = el('div', 'coach-action hidden');
  const foot = el('div', 'coach-foot');
  const skip = el('button', 'btn', '跳过这步');
  const next = el('button', 'btn btn-primary', '下一步');
  foot.append(skip, next);
  box.append(top, title, bodyEl, termEl, actionEl, foot);
  document.body.append(box);

  quit.addEventListener('click', () => finish(true));
  skip.addEventListener('click', () => go(index + 1));
  next.addEventListener('click', () => {
    if (!done) return;
    go(index + 1);
  });
  document.addEventListener('click', onDocClick);

  function onDocClick(e) {
    const step = steps[index];
    if (!step || !step.check || done) return;
    if (e.target.closest(step.check)) {
      done = true;
      next.disabled = false;
      actionEl.classList.add('done');
    }
  }

  function clearFocus() {
    if (focused) focused.classList.remove('coach-target');
    focused = null;
  }

  function go(n) {
    if (n >= steps.length) { finish(false); return; }
    index = n;
    const step = steps[index];
    done = !step.check;
    tag.textContent = step.tag || `第 ${index + 1} 步`;
    progress.textContent = `${index + 1} / ${steps.length}`;
    title.textContent = step.title;
    bodyEl.textContent = step.body;
    if (step.term && ctx.difficulty !== 'easy') {
      termEl.classList.remove('hidden');
      termEl.innerHTML = `<span class="ct-k">术语</span><b>${step.term.name}</b><span>${step.term.plain}</span>`;
    } else {
      termEl.classList.add('hidden');
    }
    if (step.tip || step.note) {
      actionEl.classList.remove('hidden');
      actionEl.classList.remove('done');
      actionEl.innerHTML = `<span class="ca-k">${step.tip ? '提示' : '常见误解'}</span>${step.note || step.tip}`;
    } else if (step.action) {
      actionEl.classList.remove('hidden');
      actionEl.classList.remove('done');
      actionEl.innerHTML = `<span class="ca-k">动手</span>${step.action}`;
    } else {
      actionEl.classList.add('hidden');
    }
    next.textContent = step.finish ? '开始值班' : '下一步';
    next.disabled = !!step.check && !done;
    skip.classList.toggle('hidden', !!step.finish);
    clearFocus();
    if (step.onEnter) step.onEnter(ctx);
    if (step.target) {
      const target = document.querySelector(step.target);
      if (target) {
        focused = target;
        target.classList.add('coach-target');
        target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
    }
    if (step.term) storage('tst-dispatch-last-term', step.term);
  }

  function finish(skipped) {
    document.removeEventListener('click', onDocClick);
    box.remove();
    clearFocus();
    if (!skipped) storage('tst-dispatch-tutorial-done', scene.id);
    ctx.onDone && ctx.onDone(skipped);
  }

  go(0);
  return { close: () => finish(true) };
}
