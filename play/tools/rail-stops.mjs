import https from 'node:https';
const jar = new Map();
function save(res) { (res.headers['set-cookie'] || []).forEach((c) => { const p = c.split(';')[0]; const i = p.indexOf('='); if (i > 0) jar.set(p.slice(0, i), p.slice(i + 1)); }); }
function req(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const r = https.request(url, { method: 'GET', headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0', Accept: '*/*', 'X-Requested-With': 'XMLHttpRequest', Referer: 'https://kyfw.12306.cn/otn/leftTicket/init', ...(opts.headers || {}), ...(jar.size ? { Cookie: [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ') } : {}) } }, (res) => { save(res); const c = []; res.on('data', (x) => c.push(x)); res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(c).toString('utf8') })); });
    r.on('error', reject); r.end();
  });
}
await req('https://kyfw.12306.cn/otn/leftTicket/init');
const url = 'https://kyfw.12306.cn/otn/czxx/queryByTrainNo?train_no=40000K11080L&from_station_telecode=NFF&to_station_telecode=XUN&depart_date=2026-11-22';
const r = await req(url, { headers: { Referer: 'https://kyfw.12306.cn/otn/leftTicket/init' } });
console.log(r.status, r.body.length, r.body.slice(0, 500));
try { const j = JSON.parse(r.body); console.log(Object.keys(j), j.data?.data?.length); console.log(j.data?.data?.slice(0, 5)); } catch (e) { console.log(e.message); }
