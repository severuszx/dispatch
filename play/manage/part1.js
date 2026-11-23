const KEY = 'dispatch-manage-v1';
const SLOT = (n) => `dispatch-manage-slot-${n}`;
const TERM = 60;

const STATIONS = [
  { id: 'qinglan', name: '宝鸡', code: '44801', grade: '一等站', km: 0, tracks: 8, platforms: 3, sidings: 3, staff: 36, need: 31, facility: 91, baseTraffic: 140, revenueBase: 18600, costBase: 12100 },
  { id: 'baishu', name: '秦岭', code: '44802', grade: '三等站', km: 45, tracks: 3, platforms: 1, sidings: 1, staff: 14, need: 10, facility: 83, baseTraffic: 42, revenueBase: 7800, costBase: 5200 },
  { id: 'heyuan', name: '凤县', code: '44803', grade: '三等站', km: 108, tracks: 3, platforms: 1, sidings: 2, staff: 12, need: 11, facility: 78, baseTraffic: 50, revenueBase: 8200, costBase: 5600 },
  { id: 'lingkou', name: '略阳', code: '44804', grade: '二等站', km: 200, tracks: 5, platforms: 2, sidings: 2, staff: 24, need: 20, facility: 87, baseTraffic: 88, revenueBase: 12400, costBase: 8800 },
];

const SEGMENTS = [
  { id: 'qing-bai', from: 'qinglan', to: 'baishu', km: 45, capacity: 120, demand: 102, limit: 70 },
  { id: 'bai-he', from: 'baishu', to: 'heyuan', km: 63, capacity: 90, demand: 63, limit: 65 },
  { id: 'he-ling', from: 'heyuan', to: 'lingkou', km: 92, capacity: 75, demand: 55, limit: 60 },
];

const GROUPS = [
  { id: 'signal', name: '信号联锁', cost: 9000, offset: 6 },
  { id: 'track', name: '线路股道', cost: 12000, offset: 0 },
  { id: 'platform', name: '站台雨棚', cost: 6000, offset: 2 },
  { id: 'building', name: '站房候车', cost: 5000, offset: 3 },
  { id: 'power', name: '供电照明', cost: 7000, offset: 1 },
];

const BUILDS = [
  { id: 'track', name: '到发线扩建', desc: '股道 +2，能力 +36 列/日', cost: 120000, days: 12 },
  { id: 'platform', name: '站台改造', desc: '站台 +1，能力 +12 列/日', cost: 90000, days: 9 },
  { id: 'siding', name: '存车线增设', desc: '侧线 +1，能力 +8 列/日', cost: 60000, days: 7 },
  { id: 'facility', name: '设施整修', desc: '五组设施各 +8 状态', cost: 70000, days: 5 },
];

const POLICIES = [
  { id: 'safe', name: '安全整顿', desc: '安全 +6，成本 +2%，准点 -2', effect: { safety: 6, cost: 0.02, punc: -2 } },
  { id: 'income', name: '增收会战', desc: '收入 +8%，安全 -5', effect: { revenue: 0.08, safety: -5 } },
  { id: 'flow', name: '保畅通', desc: '准点 +6，成本 +3%', effect: { punc: 6, cost: 0.03 } },
  { id: 'maint', name: '设备养护', desc: '设施老化减半，成本 +2%', effect: { maintain: 0.5, cost: 0.02 } },
  { id: 'save', name: '节支降耗', desc: '成本 -8%，准点 -5', effect: { cost: -0.08, punc: -5 } },
];

const CONTRACT_POOL = [
  { name: '陕煤电煤', kind: 'freight', station: 'qinglan', add: 16, reward: 4200, penalty: 1600, days: 5 },
  { name: '宝鸡钢材', kind: 'freight', station: 'qinglan', add: 12, reward: 3400, penalty: 1400, days: 6 },
  { name: '秦岭砂石', kind: 'freight', station: 'baishu', add: 8, reward: 2200, penalty: 900, days: 4 },
  { name: '凤县矿石', kind: 'freight', station: 'heyuan', add: 10, reward: 2600, penalty: 1000, days: 5 },
  { name: '略阳水泥', kind: 'freight', station: 'lingkou', add: 14, reward: 3600, penalty: 1500, days: 6 },
  { name: '西安局通勤', kind: 'pax', station: 'baishu', add: 6, reward: 2100, penalty: 700, days: 5 },
  { name: '汉中旅游专列', kind: 'pax', station: 'lingkou', add: 10, reward: 3200, penalty: 1100, days: 4 },
  { name: '宝成线普速', kind: 'pax', station: 'heyuan', add: 8, reward: 2800, penalty: 900, days: 5 },
  { name: '秦岭避暑客流', kind: 'pax', station: 'qinglan', add: 12, reward: 3800, penalty: 1300, days: 4 },
  { name: '略阳集装箱', kind: 'freight', station: 'lingkou', add: 12, reward: 4000, penalty: 1700, days: 7 },
];

let state = null;
let tab = 'overview';
let selected = 'qinglan';

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fm = (n) => `¥${Math.round(n).toLocaleString('zh-CN')}`;
const num = (n, d = 0) => Number(n).toLocaleString('zh-CN', { maximumFractionDigits: d, minimumFractionDigits: d });
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pct = (v) => `${Math.round(v * 100)}%`;
const st = (id) => state.stations[id];
const seg = (id) => SEGMENTS.find((s) => s.id === id);
const stationDef = (id) => STATIONS.find((s) => s.id === id);
