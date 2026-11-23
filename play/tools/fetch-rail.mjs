import https from 'node:https';
import fs from 'node:fs';

const DATE = '2026-11-22';
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

const pairs = [
  ['JOF', 'LDF'], ['LDF', 'NFF'], ['NFF', 'XFN'], ['XFN', 'HHQ'], ['HHQ', 'LZZ'],
  ['LZZ', 'HHQ'], ['HHQ', 'XFN'], ['XFN', 'NFF'], ['NFF', 'LDF'], ['LDF', 'JOF'],
  ['XAY', 'NFF'], ['NFF', 'XUN'], ['XUN', 'HFH'], ['HFH', 'NJH'],
  ['NJH', 'HFH'], ['HFH', 'XUN'], ['XUN', 'NFF'], ['NFF', 'XAY'], ['XAY', 'HFH'], ['XAY', 'NJH']
];

await req('https://kyfw.12306.cn/otn/leftTicket/init');
const found = new Map();
for (const [from, to] of pairs) {
  const url = `https://kyfw.12306.cn/otn/leftTicket/queryG?leftTicketDTO.train_date=${DATE}&leftTicketDTO.from_station=${from}&leftTicketDTO.to_station=${to}&purpose_codes=ADULT`;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const r = await req(url);
      const j = JSON.parse(r.body);
      const lines = j?.data?.result || [];
      console.log(from, to, lines.length);
      for (const line of lines) {
        const f = line.split('|');
        if (!f[2] || !f[3]) continue;
        if (!found.has(f[2])) found.set(f[2], { trainNo: f[2], code: f[3], from: f[6], to: f[7], start: f[8], end: f[9], corridors: [] });
        found.get(f[2]).corridors.push(`${from}-${to}`);
      }
      break;
    } catch (e) {
      console.log('RETRY', from, to, e.message);
      await wait(1200);
    }
  }
  await wait(450);
}

console.log('TRAINS', found.size);
const stops = {};
for (const [no, meta] of found.entries()) {
  const url = `https://kyfw.12306.cn/otn/czxx/queryByTrainNo?train_no=${no}&from_station_telecode=${meta.from}&to_station_telecode=${meta.to}&depart_date=${DATE}`;
  let ok = false;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const r = await req(url);
      const j = JSON.parse(r.body);
      if (j?.data?.data?.length) {
        stops[no] = { ...meta, stops: j.data.data.map((s) => ({
          name: s.station_name, no: Number(s.station_no), arr: s.arrive_time, dep: s.start_time,
          stop: s.stopover_time, day: 0
        })) };
        ok = true;
        break;
      }
    } catch (e) { await wait(1000); }
    await wait(900);
  }
  if (!ok) console.log('STOP_FAIL', no, meta.code);
  await wait(380);
}

fs.writeFileSync('data/rail-2026-11-22.json', JSON.stringify({ date: DATE, source: '12306', fetchedAt: new Date().toISOString(), trains: stops }, null, 1));
console.log('SAVED', Object.keys(stops).length, fs.statSync('data/rail-2026-11-22.json').size);
