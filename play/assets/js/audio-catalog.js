const TRAINS = ['K117', 'K389', 'K822', 'Z95', 'T7', 'K1295', 'X8000', 'X1001', 'K101', 'K102', '6065', '6066', 'K205', 'K206', 'Z19', 'Z20', 'T41', 'T42', 'K755', 'K756'];
const DEST = ['北京西', '广州', '上海', '西安', '成都', '重庆', '郑州', '武汉', '信阳', '南阳', '襄阳', '安康', '汉中', '宝鸡', '兰州', '西宁', '乌鲁木齐', '拉萨', '昆明', '贵阳', '南宁', '长沙', '南昌', '福州', '厦门', '杭州', '南京', '合肥', '太原', '石家庄'];
const PLAT = ['1 站台', '2 站台', '3 站台', '4 站台', '1 道', '2 道', '3 道', '4 道'];
const STATE = ['正点到达', '晚点 5 分', '晚点 12 分', '晚点 28 分', '晚点 45 分', '临时停车', '变更股道', '停止检票', '开始检票', '即将发车'];
const REASON = ['因前车待避', '因信号故障', '因客流较大', '因设备检修', '因天气影响', '因邻站压车', '因施工天窗', '因车底接续'];
const AMB = ['候车厅人声', '站台脚步', '雨棚滴水', '继电器跳动', '道岔转辙', '货车溜放', '驼峰减速器', '风笛远鸣', '接触网嗡鸣', '站房空调', '夜风穿堂', '雨打车窗', '雪压雨棚', '铁轨伸缩', '列车进站制动', '列车出站加速', '调车机怠速', '对讲机底噪'];
const PERIOD = ['清晨', '白班', '晚高峰', '夜间'];
const WEATHER = ['晴', '小雨', '暴雨', '大雪', '大雾', '大风'];

function idx(seed, arr) {
  return arr[seed % arr.length];
}

export function buildCatalog() {
  const out = [];
  let i = 0;
  for (let t = 0; t < TRAINS.length; t += 1) {
    for (let d = 0; d < DEST.length; d += 1) {
      for (let p = 0; p < 4; p += 1) {
        const st = (t + d + p) % STATE.length;
        const text = `旅客们请注意，${TRAINS[t]} 次列车，开往${DEST[d]}，${PLAT[p]}，${STATE[st]}。`;
        out.push({ id: `pa-${i}`, kind: 'pa', text, voice: true, weight: 2 });
        i += 1;
      }
    }
  }
  for (let t = 0; t < TRAINS.length; t += 1) {
    for (let r = 0; r < REASON.length; r += 1) {
      out.push({ id: `pa-late-${t}-${r}`, kind: 'pa', text: `${TRAINS[t]} 次，开往${DEST[(t + r) % DEST.length]}，${REASON[r]}，${STATE[(r + 1) % STATE.length]}。`, voice: true, weight: 1 });
    }
  }
  out.push({ id: 'pa-safe-1', kind: 'pa', text: '请旅客站在安全线以内，不要靠近站台边缘。', voice: true, weight: 2 });
  out.push({ id: 'pa-safe-2', kind: 'pa', text: '站台禁止吸烟，禁止翻越护栏。', voice: true, weight: 1 });
  out.push({ id: 'pa-safe-3', kind: 'pa', text: '携带大件行李的旅客，请乘坐无障碍电梯。', voice: true, weight: 1 });
  out.push({ id: 'pa-safe-4', kind: 'pa', text: '列车即将进站，请退到黄色安全线以内。', voice: true, weight: 2 });

  for (let t = 0; t < TRAINS.length; t += 1) {
    for (let p = 0; p < PLAT.length; p += 1) {
      out.push({ id: `rd-${t}-${p}`, kind: 'radio', text: `${TRAINS[t]} 次，${PLAT[p]} 接车，注意邻线。`, voice: true, weight: 1 });
      out.push({ id: `rd-dep-${t}-${p}`, kind: 'radio', text: `${TRAINS[t]} 次，${PLAT[p]} 发车，司机确认信号。`, voice: true, weight: 1 });
    }
  }
  out.push({ id: 'rd-1', kind: 'radio', text: '调度，K117 压迫站外，请求先接。', voice: true, weight: 2 });
  out.push({ id: 'rd-2', kind: 'radio', text: '本站接管，停止自动放行。', voice: true, weight: 2 });
  out.push({ id: 'rd-3', kind: 'radio', text: '区间封锁，停止发车。', voice: true, weight: 2 });

  for (let a = 0; a < AMB.length; a += 1) {
    for (let p = 0; p < PERIOD.length; p += 1) {
      for (let w = 0; w < WEATHER.length; w += 1) {
        out.push({ id: `amb-${a}-${p}-${w}`, kind: 'ambient', text: `${PERIOD[p]}${WEATHER[w]} · ${AMB[a]}`, amb: a, period: p, weather: w, weight: 1 });
      }
    }
  }
  out.push({ id: 'alert-red', kind: 'alert', text: '红光带报警。', voice: true, weight: 2 });
  out.push({ id: 'alert-switch', kind: 'alert', text: '道岔失表。', voice: true, weight: 2 });
  out.push({ id: 'alert-power', kind: 'alert', text: '供电中断。', voice: true, weight: 2 });
  out.push({ id: 'alert-emergency', kind: 'alert', text: '启动应急预案。', voice: true, weight: 3 });
  return out;
}

export const CATALOG = buildCatalog();

export function pickCue(kind, seed) {
  const list = CATALOG.filter((x) => x.kind === kind);
  return idx(Math.abs(seed), list);
}

export function catalogStats() {
  return CATALOG.reduce((a, x) => { a[x.kind] = (a[x.kind] || 0) + 1; a.total += 1; return a; }, { total: 0 });
}
