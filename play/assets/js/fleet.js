const OVERRIDE = {
  K101: { model: '25G', loco: 'HXD3D' },
  K102: { model: '25G', loco: 'SS7E' },
  '货1': { model: 'C70', loco: 'HXD3C' },
  K845: { model: '25G', loco: 'HXD3D' },
  K846: { model: '25G', loco: 'HXD3D' },
  X101: { model: 'X6K', loco: 'HXD3C' },
  X102: { model: 'X6K', loco: 'HXD3C' },
};

export function sceneBureau(scene) {
  const id = scene && scene.id ? scene.id : '';
  if (id === 't1') return '京局';
  if (/^h4|^h5|veh|mar/.test(id)) return '武局';
  if (scene && scene.line === 'qinglan') return '西局';
  if (scene && scene.line === 'jiangwan') return '广局';
  return '上局';
}

export function sceneRoute(scene, dir, stationName) {
  const id = scene && scene.id ? scene.id : '';
  if (id === 't1') return dir > 0 ? { from: '石家庄', to: '北京西', section: '实训—北京西方向' } : { from: '信阳', to: '广州', section: '实训—广州方向' };
  if (id === 'h1') return dir > 0 ? { from: '徐州', to: '上海', section: '蚌埠—南京方向' } : { from: '上海', to: '徐州', section: '蚌埠—徐州方向' };
  if (id === 'h2') return dir > 0 ? { from: '合肥', to: '蚌埠东', section: '上行区间' } : { from: '徐州', to: '蚌埠东', section: '下行区间' };
  if (id === 'h3' || id === 'h4') return { from: '入库线', to: stationName, section: '入库线' };
  if (id === 'h5') return dir > 0 ? { from: '阜阳', to: '襄阳北', section: '上行到达线' } : { from: '武汉', to: '襄阳北', section: '下行到达线' };
  return dir > 0 ? { from: '上行方向', to: '下行方向', section: '上行区间' } : { from: '下行方向', to: '上行方向', section: '下行区间' };
}

export function trainClass(raw) {
  const type = String((raw && raw.type) || '');
  const no = String((raw && raw.no) || '');
  if (type === '货' || type === '路用' || type === 'X' || type === 'N' || type === 'G') return '货物列车';
  if (type === '检') return '轨道检测车';
  if (type === '修') return '检修车';
  if (type === '工') return '工程作业车';
  if (no.startsWith('Z')) return '直达特快';
  if (no.startsWith('T')) return '特快旅客';
  if (no.startsWith('K')) return '快速旅客';
  if (no.startsWith('G')) return '高速动车';
  if (no.startsWith('D')) return '动车组';
  if (type === '调车') return '调车作业';
  if (type === '机车') return '单机';
  return '普通旅客';
}

export function trainSpec(raw, fallbackBureau) {
  const no = String((raw && raw.no) || '');
  const key = no.replace(/^0+/, '');
  const type = String((raw && raw.type) || '');
  const head = (key.match(/^[A-Z]{1,2}/) || [''])[0];
  const bureau = (raw && raw.bureau) || fallbackBureau || '上局';
  const override = OVERRIDE[no] || OVERRIDE[key];
  if (override) return { ...override, bureau };
  if (type === '调') return { model: 'DF7G', loco: '调车机', bureau };
  if (type === '检') return { model: 'SY25K', loco: 'HXD3D', bureau };
  if (type === '修') return { model: 'N17', loco: 'DF7G', bureau };
  if (type === '工') return { model: 'X6K', loco: 'DF7G', bureau };
  if (type === '救援') return { model: 'N17', loco: 'DF7G', bureau };
  if (head === 'G') return { model: 'CR400AF', loco: '动车组自走', bureau };
  if (head === 'D') return { model: 'CRH380A', loco: '动车组自走', bureau };
  if (head === 'Z') return { model: '25T', loco: 'HXD3D', bureau };
  if (head === 'T') return { model: '25K', loco: 'SS9', bureau };
  if (head === 'K') return { model: '25G', loco: 'HXD3D', bureau };
  if (head === 'X') return { model: 'X6K', loco: 'HXD3C', bureau };
  if (type === '货' || type === '路用' || /^\d/.test(key)) return { model: 'C70', loco: 'HXD3C', bureau };
  if (type === '专运' || type === '机') return { model: '25T', loco: 'HXD3D', bureau };
  return { model: '25G', loco: 'DF11', bureau };
}
