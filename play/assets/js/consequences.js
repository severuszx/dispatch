import { career, saveCareer } from './career.js';
import { profile, saveProfile } from './profile.js';

const KINDS = {
  coverup: { flag: '隐瞒', days: 2, title: '上级抽查', money: -2400, rep: -6, note: '那次没上报的问题被翻出来了。' },
  unsafe: { flag: '冒险', days: 1, title: '险性事件复查', money: -1600, rep: -4, note: '冒险放行的后果开始计价。' },
  safe: { flag: '稳妥', days: 2, title: '安全嘉奖', money: 800, rep: 2, note: '稳妥处置被记入安全档案。' },
  customer: { flag: '投诉', days: 2, title: '旅客投诉回访', money: -600, rep: -3, note: '投诉进了服务考核。' },
  crew: { flag: '疲劳', days: 2, title: '班组疲劳', money: -900, rep: 0, note: '连续处置让班组效率下降。' },
  media: { flag: '舆情', days: 2, title: '舆情跟进', money: -1800, rep: -7, note: '现场被拍，宣传口来问话。' },
  government: { flag: '检查', days: 3, title: '监管检查', money: -2200, rep: -3, note: '检查期还没结束。' },
  equipment: { flag: '带病', days: 1, title: '设备带病运行', money: -1300, rep: -2, note: '没停机修的设备又出了一次。' },
  delay: { flag: '晚点', days: 1, title: '晚点连锁', money: -500, rep: -1, note: '前一班的晚点传到了邻站。' },
};

function classify(br, res) {
  const s = `${br.label} ${br.effect || ''}`;
  if (/瞒|不报|压下|私下|口头/.test(s)) return 'coverup';
  if (/冒险|强行|硬放|闯|越过|不检/.test(s)) return 'unsafe';
  if (/投诉|旅客|旅客情绪|解释/.test(s)) return 'customer';
  if (/连续|加班|疲劳|通宵/.test(s)) return 'crew';
  if (/媒体|拍摄|舆情|记者/.test(s)) return 'media';
  if (/上报|监管|检查|集团/.test(s)) return 'government';
  if (/带病|旁路|短接|不修|维持/.test(s)) return 'equipment';
  if (/限速|封锁|扣车|待避/.test(s)) return 'delay';
  if (res.fail || br.risk === '高') return 'unsafe';
  return 'safe';
}

export function recordChoice(inst, br, res) {
  const kind = classify(br, res);
  const k = KINDS[kind];
  const shift = career.data.shiftIndex || 0;
  career.data.flags = career.data.flags || {};
  career.data.flags[k.flag] = (career.data.flags[k.flag] || 0) + 1;
  career.data.longTail = career.data.longTail || [];
  career.data.longTail.push({
    id: `${inst.code}-${Date.now()}`, kind, title: k.title, note: `${inst.title}：${br.label}。${k.note}`,
    dueShift: shift + k.days + 1, money: k.money, rep: k.rep, source: inst.title,
  });
  career.data.choices = career.data.choices || [];
  career.data.choices.unshift({ at: Date.now(), code: inst.code, title: inst.title, branch: br.label, kind, fail: !!res.fail });
  career.data.choices = career.data.choices.slice(0, 80);
  if (res.fail) career.data.equipmentAge = Math.min(100, (career.data.equipmentAge || 0) + 4);
  saveCareer();
  return { kind, flag: k.flag, due: k.days, title: k.title, money: k.money, note: k.note };
}

export function dueConsequences(shift) {
  const due = [];
  const keep = [];
  for (const x of career.data.longTail || []) {
    if (x.dueShift <= shift + 1) due.push(x);
    else keep.push(x);
  }
  career.data.longTail = keep;
  let money = 0;
  let rep = 0;
  for (const x of due) {
    money += x.money || 0;
    rep += x.rep || 0;
  }
  if (money) {
    profile.data.credits += money;
    saveProfile();
  }
  if (rep) {
    profile.data.reputation = Math.max(0, Math.min(100, profile.data.reputation + rep));
    saveProfile();
  }
  if (due.length) {
    career.data.superior = Math.max(0, Math.min(100, (career.data.superior || 70) + (rep < 0 ? -2 : 1)));
    saveCareer();
  }
  return { due, money, rep };
}

export function choiceFlags() {
  return career.data.flags || {};
}

export function modifierFor(kind) {
  const f = choiceFlags();
  if (kind === 'event' && f['隐瞒']) return 0.8;
  if (kind === 'fine' && f['检查']) return 0.6;
  if (kind === 'fault' && f['带病']) return 0.3;
  return 0;
}
