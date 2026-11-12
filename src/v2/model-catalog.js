// Display-only descriptions of the finite, preloaded model collection.
// Official URLs are source text; the viewer does not navigate or fetch them.
import { STREET_CATALOG } from './street-assets.js';
const car = { sourceType: 'kenney', sourceLabel: 'Kenney素材', packLabel: 'Car Kit 3.1', sourceUrl: 'https://kenney.nl/assets/car-kit' };
const original = { sourceType: 'original', sourceLabel: '项目自建', packLabel: '小镇原创模型', sourceUrl: '' };
const suburban = { sourceType: 'kenney', sourceLabel: 'Kenney素材', packLabel: 'City Kit Suburban 2.0', sourceUrl: 'https://kenney.nl/assets/city-kit-suburban' };
const nature = { sourceType: 'kenney', sourceLabel: 'Kenney素材', packLabel: 'Nature Kit 2.1', sourceUrl: 'https://kenney.nl/assets/nature-kit' };

export const MODEL_CATALOG = Object.freeze([
  { id: 'van', name: '小货车', category: 'vehicle', ...car, details: 'Kenney原始厢式车，保留原模型和配色。' },
  { id: 'truck', name: '大卡车', category: 'vehicle', ...car, details: 'Kenney原始货车，保留原模型和配色。' },
  { id: 'fridge', name: '冷藏车', category: 'vehicle', ...car, details: '选用Kenney原始配送车作为冷藏车。' },
  { id: 'tanker', name: '洒水车', category: 'vehicle', ...original, details: '项目自建圆角车身与蓝色水罐。' },
  { id: 'repair', name: '维修车', category: 'vehicle', ...car, details: '选用Kenney原始平板货车作为维修车。' },
  { id: 'bus', name: '小巴士', category: 'vehicle', ...original, details: '项目自建黄色车厢与连续车窗。' },
  { id: 'depot', name: '仓库', category: 'place', ...original, details: '屋顶大包裹和堆放的箱子标出仓库。' },
  { id: 'park', name: '公园', category: 'place', ...original, details: '项目自建喷泉、圆形地台与彩色花丛。' },
  { id: 'school', name: '学校', category: 'place', sourceType:'combined', sourceLabel:'组合模型', packLabel:'City Kit Suburban 2.0', sourceUrl:suburban.sourceUrl, details:'Kenney双坡顶住宅，增加项目制作的大书本标识，改作学校。' },
  { id: 'hospital', name: '医院', category: 'place', sourceType:'combined', sourceLabel:'组合模型', packLabel:'City Kit Commercial 2.1', sourceUrl:'https://kenney.nl/assets/city-kit-commercial', details:'Kenney低层白楼，增加项目制作的医疗标识，改作医院。' },
  { id: 'farm', name: '农场', category: 'place', ...original, details: '项目自建谷仓、交叉门板与种植区。' },
  { id: 'cafe', name: '餐厅', category: 'place', ...original, details: '项目自建条纹雨棚与屋顶大杯子。' },
  { id: 'garage', name: '车库', category: 'place', ...original, details: '项目自建卷帘门、扳手标记与车位。' },
  { id: 'shop', name: '商店', category: 'place', sourceType: 'combined', sourceLabel: '组合模型', packLabel: 'City Kit Commercial 2.1', sourceUrl: 'https://kenney.nl/assets/city-kit-commercial', details: 'Kenney商业楼与入口雨篷，增加项目制作的购物篮标识。' },
  { id: 'camp', name: '营地', category: 'place', sourceType: 'combined', sourceLabel: '组合模型', packLabel: 'Mini Forest 1.0', sourceUrl: 'https://kenney.nl/assets/mini-forest', details: '自建地台与木箱，组合Kenney帐篷、松树、旗和石头。' },
  { id: 'home-a', name: '住宅甲', category: 'decoration', ...suburban, details: 'Kenney原始住宅building-type-a。' },
  { id: 'home-c', name: '住宅乙', category: 'decoration', ...suburban, details: 'Kenney原始住宅building-type-c。' },
  { id: 'home-f', name: '住宅丙', category: 'decoration', ...suburban, details: 'Kenney原始住宅building-type-f。' },
  { id: 'planter', name: '花盆', category: 'decoration', ...suburban, details: 'Kenney原始街区花盆，保留原模型和配色。' },
  { id: 'oak', name: '橡树', category: 'decoration', ...nature, details: 'Kenney原始橡树tree_oak。' },
  { id: 'poplar', name: '高树', category: 'decoration', ...nature, details: 'Kenney原始树木tree_default。' },
  { id: 'hedge', name: '树篱', category: 'decoration', ...nature, details: 'Kenney原始灌木plant_bush。' },
  ...STREET_CATALOG,
].map(item => Object.freeze(item)));
