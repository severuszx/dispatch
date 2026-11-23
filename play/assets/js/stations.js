import { career } from './career.js';
import { trackBonus } from './upgrades.js';
import { facilityRisk } from './facilities.js';

export const STATIONS = {
  qinglan: {
    id: 'qinglan', name: '宝鸡', code: '44801', grade: '一等站', bureau: '西安局集团', division: '宝鸡车务段',
    lines: ['宝成线'], km: 0, tech: '区段站', biz: '客货运', status: '运营', neighborUp: 'baishu', neighborDown: '',
    platforms: [{ type: '基本', faces: 1, lenM: 550 }, { type: '岛式', faces: 2, lenM: 520 }],
    mainTracks: 2, adTracks: 8, sidings: 3, turnouts: 28, signals: 22, maxLen: 1050,
    passengerCap: 3200, freightCap: 120, trainsDay: 140, stopsDay: 46, dwell: { K: 4, T: 3, Z: 5, X: 18, shunt: 28 },
    shunt: true, crewChange: true, locoChange: true, water: true, parcel: true,
    electrified: true, weather: { snow: 2, flood: 2, wind: 1 },
    revenueBase: 18600, costBase: 12100, bottleneck: 0.72,
  },
  baishu: {
    id: 'baishu', name: '秦岭', code: '44802', grade: '三等站', bureau: '西安局集团', division: '宝鸡车务段',
    lines: ['宝成线'], km: 45, tech: '中间站', biz: '客货运', status: '运营', neighborUp: 'qinglan', neighborDown: 'heyuan',
    platforms: [{ type: '基本', faces: 1, lenM: 280 }],
    mainTracks: 2, adTracks: 3, sidings: 1, turnouts: 12, signals: 9, maxLen: 650,
    passengerCap: 420, freightCap: 18, trainsDay: 42, stopsDay: 8, dwell: { K: 3, T: 3, Z: 4, X: 16, shunt: 34 },
    shunt: false, crewChange: false, locoChange: false, water: false, parcel: false,
    electrified: true, weather: { snow: 4, flood: 3, wind: 2 },
    revenueBase: 7800, costBase: 5200, bottleneck: 0.88,
  },
  heyuan: {
    id: 'heyuan', name: '凤县', code: '44803', grade: '三等站', bureau: '西安局集团', division: '宝鸡车务段',
    lines: ['宝成线'], km: 108, tech: '中间站', biz: '客货运', status: '运营', neighborUp: 'baishu', neighborDown: 'lingkou',
    platforms: [{ type: '基本', faces: 1, lenM: 320 }],
    mainTracks: 2, adTracks: 3, sidings: 2, turnouts: 14, signals: 10, maxLen: 700,
    passengerCap: 560, freightCap: 26, trainsDay: 50, stopsDay: 11, dwell: { K: 4, T: 3, Z: 4, X: 17, shunt: 30 },
    shunt: false, crewChange: false, locoChange: false, water: true, parcel: false,
    electrified: true, weather: { snow: 3, flood: 3, wind: 3 },
    revenueBase: 8200, costBase: 5600, bottleneck: 0.81,
  },
  lingkou: {
    id: 'lingkou', name: '略阳', code: '44804', grade: '二等站', bureau: '西安局集团', division: '汉中车务段',
    lines: ['宝成线'], km: 200, tech: '区段站', biz: '客货运', status: '运营', neighborUp: 'heyuan', neighborDown: '',
    platforms: [{ type: '基本', faces: 1, lenM: 480 }, { type: '岛式', faces: 2, lenM: 460 }],
    mainTracks: 2, adTracks: 5, sidings: 2, turnouts: 20, signals: 16, maxLen: 850,
    passengerCap: 1400, freightCap: 60, trainsDay: 88, stopsDay: 28, dwell: { K: 4, T: 3, Z: 5, X: 18, shunt: 26 },
    shunt: false, crewChange: true, locoChange: true, water: true, parcel: true,
    electrified: true, weather: { snow: 3, flood: 4, wind: 2 },
    revenueBase: 12400, costBase: 8800, bottleneck: 0.76,
  },
};

export const SEGMENTS = [
  { id: 'qing-bai', from: 'qinglan', to: 'baishu', km: 45, runMin: 42, block: '半自动闭塞', capacity: 3, limit: 70 },
  { id: 'bai-he', from: 'baishu', to: 'heyuan', km: 63, runMin: 55, block: '半自动闭塞', capacity: 3, limit: 65 },
  { id: 'he-ling', from: 'heyuan', to: 'lingkou', km: 92, runMin: 68, block: '半自动闭塞', capacity: 2, limit: 60 },
];

export function getStation(id) {
  return STATIONS[id] || STATIONS[career.data.currentStation] || STATIONS.qinglan;
}

export function stationList() {
  return ['qinglan', 'baishu', 'heyuan', 'lingkou'].map(getStation);
}

export function withUpgrades(id) {
  const s = getStation(id);
  return { ...s, adTracks: s.adTracks + trackBonus(id), tracksReal: s.adTracks + trackBonus(id) };
}

export function bottleneck(id) {
  const s = getStation(id);
  const aging = career.data.equipmentAge || 0;
  const relief = career.data.region?.relief?.station === id && career.data.region.relief.left > 0 ? 0.08 : 0;
  return Math.max(0.25, Math.min(0.99, s.bottleneck + aging / 500 + facilityRisk(id) - relief));
}

export function segmentBetween(a, b) {
  return SEGMENTS.find((s) => (s.from === a && s.to === b) || (s.from === b && s.to === a));
}

export function networkSummary() {
  return stationList().map((s) => ({ ...s, tracksReal: s.adTracks + trackBonus(s.id), bottleneck: Math.round(bottleneck(s.id) * 100) }));
}
