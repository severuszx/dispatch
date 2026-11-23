import { dlcOn } from './dlc.js';

export const MECHANICS = [
  ['shunt', '调车作业', '货列到站后必须逐列启动摘挂任务，未启动不能发车。'],
  ['window', '施工天窗', '每班自动开一处 40 分钟股道封锁，占用能力。'],
  ['degrade', '设备降级', '故障率提高，红光带/道岔失表更频繁。'],
  ['crew', '乘务交路', '每 3 小时触发一次叫班/继乘，增加停站时间。'],
  ['pax', '客运组织', '办客站停全部 +1 分，站台周转更紧。'],
  ['dangerous', '危险品', '货列中随机一列挂危险品，必须开检查任务后才能发。'],
  ['emergency', '应急指挥', '出现责任事故后，后续列车额外扣 2 分钟恢复时间。'],
];

export function activeMechanics() {
  return MECHANICS.filter(([f]) => dlcOn(f));
}

export function applyMechanics(sim) {
  if (!sim || !sim.trains) return [];
  const applied = [];
  if (dlcOn('degrade')) {
    sim.mechanicFaultBoost = 1.3;
    applied.push('故障率 +30%');
  }
  if (dlcOn('pax')) {
    sim.conditions.extraDwell = (sim.conditions.extraDwell || 0) + 1;
    applied.push('办客停站 +1 分');
  }
  if (dlcOn('crew')) {
    sim.mechanicCrew = true;
    applied.push('每 3 小时乘务叫班');
  }
  if (dlcOn('emergency')) {
    sim.mechanicEmergency = true;
    applied.push('事故后恢复 +2 分');
  }
  if (dlcOn('shunt')) {
    const freight = sim.trains.filter((t) => t.freight).slice(0, 3);
    for (const f of freight) {
      f.tasks = f.tasks || [];
      if ((f.tasks || []).some((x) => x.kind === 'plan')) continue;
      f.tasks.push({ id: `${f.id}-plan`, kind: 'plan', title: '调车计划', min: 5, left: 5, state: 'wait' });
      f.tasks.push({ id: `${f.id}-pull`, kind: 'pull', title: '牵出', min: 4, left: 4, state: 'wait' });
      f.tasks.push({ id: `${f.id}-push`, kind: 'push', title: '推送', min: 5, left: 5, state: 'wait' });
    }
    if (freight.length) applied.push(`${freight.length} 列货车走计划—牵出—推送`);
  }
  if (dlcOn('crew')) {
    const pool = ['HXD3D-0188', 'HXD3C-0271', 'SS9-0042'];
    sim.trains.forEach((t, i) => {
      if (/^G|^D/.test(t.no || '')) return;
      t.loco = pool[i % pool.length];
      t.locoBound = true;
    });
    sim.locoAt = {};
    applied.push('机车号绑定 3 台，30 分内重复出车加 1 分');
  }
  if (dlcOn('pax')) sim.mechanicPlatform = true;
  if (dlcOn('dangerous')) {
    const f = sim.trains.find((t) => t.freight && t.type === 'X') || sim.trains.find((t) => t.freight);
    if (f) {
      f.haz = '硝酸铵';
      f.tasks = f.tasks || [];
      f.tasks.push({ id: `${f.id}-haz`, kind: 'check', title: '危险品检查', min: 8, left: 8, state: 'wait' });
      applied.push(`${f.no} 挂危险品，待检查`);
    }
  }
  if (dlcOn('window')) {
    const st = sim.focusStation;
    const list = sim.tracks.get(st) || [];
    const tr = list.find((x) => x.no === 2 && !x.train) || list.find((x) => !x.train);
    if (tr) {
      tr.blocked = true;
      tr.until = (sim.startClock || sim.clock) + 40;
      applied.push(`${sim.stations[st]?.name || st} ${tr.no} 道天窗 40 分`);
    }
  }
  if (applied.length) sim.pushLog(`机制包生效：${applied.join('；')}`);
  sim.mechanicApplied = applied;
  return applied;
}
