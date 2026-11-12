const entries = [
  ['street-road-straight', '笔直道路', 'road-straight', '带原版虚线及两侧浅色路缘的1×1道路。'],
  ['street-road-corner', '街角道路', 'road-bend-square', '1×1直角道路；原版方形内角为平滑转弯留出路面。'],
  ['street-road-t', '三岔路口', 'road-intersection', '按地图实际三向连接旋转的1×1丁字路口。'],
  ['street-road-cross', '十字路口', 'road-crossroad', '用于四向连接的1×1十字路口。'],
  ['street-road-end', '道路尽头', 'road-end', '用于单向连接节点的1×1尽头道路。'],
  ['street-lamp', '街边路灯', 'light-square', '原版方形灯头，稀疏布置在道路外侧。'],
  ['street-fence', '施工围栏', 'construction-fence', '原版橙色施工设施，用于封路事件。'],
  ['street-cone', '交通锥桶', 'construction-cone', '原版橙白锥桶，用于封路事件。'],
  ['street-bench', '公园长椅', 'bench', '保留原版Coaster木色座椅与金属椅脚。', 'coaster-kit'],
  ['street-flower', '街边花卉', 'flowers', '保留原版Coaster花卉造型与色彩。', 'coaster-kit'],
];

export const STREET_MODELS = entries.map(([id]) => ({id, path: `models/kenney-streets/${id}.glb`}));
export const STREET_CATALOG = entries.map(([id, name, original, details, pack = 'city-kit-roads']) => ({
  id, name, category: 'decoration', sourceType: 'kenney', sourceLabel: 'Kenney素材',
  packLabel: pack === 'coaster-kit' ? 'Coaster Kit 1.0' : 'City Kit Roads 2.2',
  sourceUrl: `https://kenney.nl/assets/${pack}`,
  details: `${details} 原文件：${original}.glb；仅嵌入原始纹理。`,
}));
