// Shared, finite content catalogue. No network or presentation dependencies.
const freeze = list => Object.freeze(list.map(item => Object.freeze(item)));

export const GOODS = freeze([
  { id: 'bread', name: '面包', icon: '🍞', color: '#e7b76b', tag: 'cargo' },
  { id: 'apple', name: '苹果', icon: '🍎', color: '#ed7968', tag: 'cargo' },
  { id: 'milk', name: '牛奶', icon: '🥛', color: '#afdbea', tag: 'cargo' },
  { id: 'flowers', name: '鲜花', icon: '🌼', color: '#efb3cc', tag: 'cargo' },
  { id: 'water', name: '清水', icon: '💧', color: '#72c7e5', tag: 'water' },
  { id: 'tools', name: '工具', icon: '🔧', color: '#d7a373', tag: 'tools' },
  { id: 'parcel', name: '包裹', icon: '📦', color: '#cda273', tag: 'cargo' },
  { id: 'book', name: '图书', icon: '📚', color: '#97b7e6', tag: 'cargo' },
  { id: 'seeds', name: '种子', icon: '🌱', color: '#91c593', tag: 'cargo' },
  { id: 'icecream', name: '冰激凌', icon: '🍦', color: '#f5c6a7', tag: 'cold' },
  { id: 'ball', name: '皮球', icon: '⚽', color: '#d8bbde', tag: 'cargo' },
  { id: 'passenger', name: '小乘客', icon: '🧒', color: '#f4ca68', tag: 'passenger' },
]);

export const VEHICLES = freeze([
  { id: 'van', name: '小货车', icon: '🚐', color: '#f4c566', capacity: 3, model: 'van', supports: ['cargo'] },
  { id: 'truck', name: '大卡车', icon: '🚚', color: '#e98b70', capacity: 6, model: 'truck', supports: ['cargo'] },
  { id: 'fridge', name: '冷藏车', icon: '🚛', color: '#9bcfe0', capacity: 4, model: 'fridge', supports: ['cargo', 'cold'] },
  { id: 'tanker', name: '消防车', icon: '🚒', color: '#e77c54', capacity: 4, model: 'tanker', supports: ['cargo', 'water'] },
  { id: 'repair', name: '维修车', icon: '🛻', color: '#e8ad72', capacity: 4, model: 'repair', supports: ['cargo', 'tools'] },
  { id: 'bus', name: '接送车', icon: '🚙', color: '#e4c25e', capacity: 4, model: 'bus', supports: ['cargo', 'passenger'] },
  { id: 'taxi', name: '出租车', icon: '🚕', color: '#f3c65d', capacity: 3, model: 'taxi', supports: ['cargo', 'passenger'] },
  { id: 'tractor', name: '拖拉机', icon: '🚜', color: '#e3c26c', capacity: 4, model: 'tractor', supports: ['cargo', 'tools', 'water'] },
  { id: 'ambulance', name: '救护车', icon: '🚑', color: '#e8977f', capacity: 3, model: 'ambulance', supports: ['cargo', 'passenger'] },
  { id: 'police', name: '巡逻车', icon: '🚓', color: '#9cbacf', capacity: 3, model: 'police', supports: ['cargo', 'tools'] },
]);

export const PLACES = freeze([
  { id: 'depot', name: '仓库', icon: '📦', color: '#efbf6b' },
  { id: 'park', name: '公园', icon: '🌳', color: '#87c89b' },
  { id: 'school', name: '学校', icon: '🏫', color: '#e7b67a' },
  { id: 'hospital', name: '医院', icon: '🏥', color: '#e7a3a0' },
  { id: 'farm', name: '农场', icon: '🌻', color: '#b5cd80' },
  { id: 'cafe', name: '餐厅', icon: '☕', color: '#d8a188' },
  { id: 'garage', name: '车库', icon: '🔧', color: '#97b6d9' },
  { id: 'shop', name: '商店', icon: '🛒', color: '#e9bc82' },
  { id: 'camp', name: '营地', icon: '⛺', color: '#94bd8a' },
]);

export const THEMES = freeze([
  { id: 'town', name: '晴天小镇', icon: '☀', color: '#b7dac3' },
  { id: 'farm', name: '田园小镇', icon: '🌻', color: '#d5df9c' },
  { id: 'coast', name: '海边小镇', icon: '🌊', color: '#b6dfe4' },
]);

export const DIFFICULTIES = freeze([
  { id: 'easy', name: '轻松', icon: '●', color: '#a7d3b2', description: '记住一种物品，送到一个地方。' },
  { id: 'normal', name: '记忆', icon: '●●', color: '#f2cd82', description: '记住两种物品，送到同一个地方。' },
  { id: 'challenge', name: '配对', icon: '●●●', color: '#c6b5e3', description: '将两种物品送到两个地方，先去哪边都可以。' },
]);

export const TEMPLATES = freeze([
  { id: 'picnic', name: '公园野餐', title: '给朋友准备野餐', goods: ['bread', 'apple', 'milk', 'icecream'], places: ['park', 'cafe'] },
  { id: 'garden', name: '花园帮手', title: '让花园更漂亮', goods: ['flowers', 'seeds', 'water'], places: ['farm', 'park'] },
  { id: 'school', name: '开学礼物', title: '送去快乐学习包', goods: ['book', 'ball', 'parcel'], places: ['school', 'park'] },
  { id: 'care', name: '爱心补给', title: '给邻居送一份关心', goods: ['milk', 'flowers', 'bread', 'apple'], places: ['hospital', 'cafe'] },
  { id: 'repair', name: '车库帮忙', title: '一起照顾小汽车', goods: ['tools', 'parcel', 'book'], requiredGood: 'tools', places: ['garage', 'farm'] },
  { id: 'shuttle', name: '快乐出游', title: '和朋友一起出发', goods: ['passenger', 'ball', 'book'], requiredGood: 'passenger', places: ['school', 'park'] },
  { id: 'restock', name: '商店补货', title: '帮商店和餐厅补满货架', goods: ['bread', 'apple', 'milk', 'parcel'], places: ['shop', 'cafe'] },
  { id: 'camping', name: '营地补给', title: '给营地和公园送去物资', goods: ['water', 'bread', 'parcel', 'seeds'], places: ['camp', 'park'] },
]);

export const EVENTS = freeze([
  { id: 'roadworks', name: '前面在修路', title: '换条路也能到！', message: '一小段路正在修。选一条办法，继续帮忙。', options: [{ id: 'detour', label: '看看绕行路线' }, { id: 'reopen', label: '请工人开放便道' }] },
  { id: 'capacity', name: '货箱小变化', title: '给物品找好位置', message: '车里先留一个安全位置。可以加小拖车一次送，也可以把其余物品暂存仓库，分次来取。', options: [{ id: 'trailer', label: '装上小拖车' }, { id: 'two-trips', label: '暂存仓库，分次来取' }] },
  { id: 'shortage', name: '仓库换货架', title: '补货也有办法', message: '一个货架正在补货。可以找备用箱，也可以去车库取货。', options: [{ id: 'reserve', label: '打开备用箱' }, { id: 'pickup', label: '去车库补货' }] },
  { id: 'repair', name: '轮胎需要照顾', title: '小车也要休息', message: '轮胎有些软。点三下给轮胎打气，也可以请朋友一次修好。', options: [{ id: 'pump', label: '给轮胎打气（0/3）' }, { id: 'helper', label: '请朋友来修理' }] },
]);
