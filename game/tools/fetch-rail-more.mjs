import https from 'node:https';
import fs from 'node:fs';

const DATE = '2026-11-22';
const stations = JSON.parse(fs.readFileSync('tools/stations-55.json', 'utf8'));
const existing = JSON.parse(fs.readFileSync('data/rail-2026-11-22.json', 'utf8'));
const jar = new Map();
function save(res) { (res.headers['set-cookie'] || []).forEach((c) => { const p = c.split(';')[0]; const i = p.indexOf('='); if (i > 0) jar.set(p.slice(0, i), p.slice(i + 1)); }); }
function req(url) {
  return new Promise((resolve, reject) => {
    const r = https.request(url, { headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0',
      Accept: 'application/json, text/javascript, */*; q=0.01',
      'Accept-Language': 'zh-CN,zh;q=0.9',
      'X-Requested-With': 'XMLHttpRequest',
      Referer: 'https://kyfw.12306.cn/otn/leftTicket/init',
      ...(jar.size ? { Cookie: [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ') } : {})
    } }, (res) => { save(res); const c = []; res.on('data', (x) => c.push(x)); res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(c).toString('utf8') })); });
    r.on('error', reject); r.end();
  });
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const lines = ['jiaoliu', 'ningxi'];
const pairs = [];
for (const line of lines) {
  const list = stations.filter((s) => (s.line === line || (s.line === 'both' && line === 'jiaoliu')) && s.code);
  for (let i = 0; i < list.length - 1; i += 1) {
    pairs.push([list[i].code, list[i + 1].code], [list[i + 1].code, list[i].code]);
  }
}
console.log('PAIRS', pairs.length);

await req('https://kyfw.12306.cn/otn/leftTicket/init');
const found = new Map(Object.entries(existing.trains));
for (const [from, to] of pairs) {
  const url = `https://kyfw.12306.cn/otn/leftTicket/queryG?leftTicketDTO.train_date=${DATE}&leftTicketDTO.from_station=${from}&leftTicketDTO.to_station=${to}&purpose_codes=ADULT`;
  try {
    const r = await req(url);
    const j = JSON.parse(r.body);
    const linesOut = j?.data?.result || [];
    if (linesOut.length) console.log(from, to, linesOut.length);
    for (const line of linesOut) {
      const f = line.split('|');
      if (!f[2] || !f[3] || found.has(f[2])) continue;
      found.set(f[2], { trainNo: f[2], code: f[3], from: f[6], to: f[7], start: f[8], end: f[9], corridors: [`${from}-${to}`] });
    }
  } catch (e) { console.log('FAIL', from, to, e.message); }
  await wait(450);
}

console.log('TOTAL_CANDIDATE', found.size);
const missing = [...found.values()].filter((t) => !t.stops);
console.log('NEED_STOPS', missing.length);
for (const meta of missing) {
  const url = `https://kyfw.12306.cn/otn/czxx/queryByTrainNo?train_no=${meta.trainNo}&from_station_telecode=${meta.from}&to_station_telecode=${meta.to}&depart_date=${DATE}`;
  try {
    const r = await req(url);
    const j = JSON.parse(r.body);
    if (j?.data?.data?.length) {
      meta.stops = j.data.data.map((s) => ({ name: s.station_name, no: Number(s.station_no), arr: s.arrive_time, dep: s.start_time, stop: s.stopover_time }));
    } else {
      console.log('NO_STOPS', meta.trainNo, meta.code);
    }
  } catch (e) { console.log('STOP_FAIL', meta.trainNo, e.message); }
  await wait(380);
}

const final = {};
for (const [no, t] of found.entries()) if (t.stops) final[no] = t;
fs.writeFileSync('data/rail-2026-11-22.json', JSON.stringify({ date: DATE, source: '12306', fetchedAt: new Date().toISOString(), trains: final }, null, 1));
console.log('SAVED', Object.keys(final).length, fs.statSync('data/rail-2026-11-22.json').size);
