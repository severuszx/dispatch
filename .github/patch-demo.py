import json
p = 'play/assets/js/sim.js'
s = open(p).read()
a = """    for (const t of this.trains) {
      if (t.status !== 'station') continue;
      const ft = this.freeTrack(t.station, t.dir, t);
      if (ft) { ft.train = t.id; t.trackNo = ft.no; }
    }"""
b = """    for (const t of this.trains) {
      if (scene.autoDemo) {
        t.autoRelease = true;
        t.release = true;
      }
      if (t.status !== 'station') continue;
      const ft = this.freeTrack(t.station, t.dir, t);
      if (ft) { ft.train = t.id; t.trackNo = ft.no; }
    }"""
assert a in s, 'setup block not found'
s = s.replace(a, b, 1)
s = s.replace("const inYard = raw.arr == null || raw.arr <= start;", "const inYard = !raw.through && (raw.arr == null || raw.arr <= start);", 1)
c = """      if (t.status === 'approach' || t.status === 'pending') {
        if (this.clock < t.planArr) continue;
        if (t.through && !t.trackNo) {"""
d = """      if (t.status === 'approach' || t.status === 'pending') {
        if (this.clock < t.planArr) continue;
        if (this.scene && this.scene.autoTrack && !t.trackNo) {
          const ft = this.freeTrack(t.station, t.dir, t);
          if (ft) { ft.train = t.id; t.trackNo = ft.no; }
        }
        if (t.through && !t.trackNo) {"""
assert c in s, 'approach block not found'
s = s.replace(c, d, 1)
e = """      if (t.status !== 'station') continue;
      for (const task of t.tasks || []) {"""
f = """      if (t.status !== 'station') continue;
      if (this.scene && this.scene.autoDemo && !(t.tasks || []).some((x) => x.state === 'active')) {
        const next = (t.tasks || []).find((x) => x.state === 'wait');
        if (next) { next.state = 'active'; next.left = next.min; }
      }
      for (const task of t.tasks || []) {"""
assert e in s, 'task block not found'
s = s.replace(e, f, 1)
s = s.replace("t.arriveAt = this.clock + 3;", "t.arriveAt = this.clock + (t.through ? 5 : 3);", 1)
open(p, 'w').write(s)
p = 'play/data/hub-baoji.json'
d = json.load(open(p))
extra = [
    {'id':'bj-x1','no':'Z901','type':'Z','yard':'main','arr':360,'dep':365,'through':True,'coaches':18,'priority':2,'crew':1,'dir':1,'model':'25T','loco':'SS9'},
    {'id':'bj-x2','no':'K902','type':'K','yard':'main','arr':364,'dep':369,'through':True,'coaches':18,'priority':3,'crew':1,'dir':0,'model':'25G','loco':'HXD3D'},
    {'id':'bj-x3','no':'货3','type':'货','yard':'main','arr':369,'dep':374,'through':True,'coaches':24,'priority':6,'crew':1,'dir':1,'model':'C70','loco':'HXD3C'},
    {'id':'bj-x4','no':'T904','type':'T','yard':'main','arr':374,'dep':379,'through':True,'coaches':12,'priority':3,'crew':1,'dir':0,'model':'25T','loco':'SS7E'},
]
if not any(t.get('through') for t in d['trains']):
    d['trains'] = extra + d['trains']
json.dump(d, open(p, 'w'), ensure_ascii=False, indent=2)
p = 'play/data/scenarios.json'
d = json.load(open(p))
for x in d:
    if x.get('id') in ('b1', 't1'):
        x['trains'] = 14
        x['autoDemo'] = True
        x['autoTrack'] = True
json.dump(d, open(p, 'w'), ensure_ascii=False, indent=2)
print('patched')
