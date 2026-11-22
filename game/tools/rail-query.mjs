import https from 'node:https';

const jar = new Map();
function save(res) {
  (res.headers['set-cookie'] || []).forEach((c) => {
    const pair = c.split(';')[0];
    const i = pair.indexOf('=');
    if (i > 0) jar.set(pair.slice(0, i), pair.slice(i + 1));
  });
}
function req(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const r = https.request(url, {
      method: opts.method || 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0',
        Accept: '*/*',
        'X-Requested-With': 'XMLHttpRequest',
        Referer: 'https://kyfw.12306.cn/otn/leftTicket/init',
        ...(opts.headers || {}),
        ...(jar.size ? { Cookie: [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ') } : {})
      }
    }, (res) => {
      save(res);
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }));
    });
    r.on('error', reject);
    r.end();
  });
}

await req('https://kyfw.12306.cn/otn/leftTicket/init');
const base = 'https://kyfw.12306.cn/otn/leftTicket/queryG?leftTicketDTO.train_date=2026-11-22&leftTicketDTO.from_station=NFF&leftTicketDTO.to_station=XUN&purpose_codes=ADULT';
const a = await req(base, { headers: { Accept: 'application/json, text/javascript, */*; q=0.01' } });
const json = JSON.parse(a.body);
console.log('ROOT', Object.keys(json), json.httpstatus, json.data?.result?.length);
for (const line of (json.data?.result || [])) {
  console.log(line.split('|').slice(0, 25).join(' | '));
}
