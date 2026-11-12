# V2 资源与许可证

核验日期：2026-11-12。当前运行资源的唯一清单是 `src/v2/resource-manifest.js`；`npm run check:assets` 核对文件、GLB 外部纹理、语音文案和许可证。V1 资源作为历史参考保留，不属于当前运行清单。

## 实际使用

| 资源 | 来源与用途 | 许可 |
| --- | --- | --- |
| Car Kit 3.1 | https://kenney.nl/assets/car-kit ；van、truck、delivery、truck-flat，分别作为小货车、大卡车、冷藏车和维修车基础车型，共享原始 `Textures/colormap.png` | CC0 1.0，保留原License.txt |
| City Kit Suburban 2.0 | https://kenney.nl/assets/city-kit-suburban ；3种住宅、花箱及原始共享纹理 | CC0，`public/models/kenney-suburban/License.txt` |
| Nature Kit 2.1 | https://kenney.nl/assets/nature-kit ；橡树、高树和灌木 | CC0，`public/models/kenney-nature/License.txt` |
| Interface Sounds | https://kenney.nl/assets/interface-sounds ；click_001、pluck_001、confirmation_001 三个短音效 | CC0 1.0，保留原License.txt |
| Mini Shop 2.1 | https://kenney.nl/assets/mini-shop ；精选货架 `shelf-boxes`、果蔬台 `display-fruit`、收银台 `cash-register`，组合进商店地标 `town-v2/shop.glb` | CC0 1.0，原文 `public/models/kenney-mini/mini-shop-License.txt` |
| Mini Forest 1.0 | https://kenney.nl/assets/mini-forest ；精选帐篷 `tent`、松树 `tree`、路旗 `flag`、石头 `stones`，组合进营地地标 `town-v2/camp.glb` | CC0 1.0，原文 `public/models/kenney-mini/mini-forest-License.txt` |
| 16 个小镇 GLB | `public/models/town-v2/`：原14个原创模型增加圆角和明显地标，新增商店、营地由原创外壳/地台与上述Kenney Mini模型组合，生成器 `scripts/generate_models.mjs` | 原创部分归本项目；Mini几何与原色图为CC0，不能将这两个组合模型称为纯原创 |
| 主屏幕应用图标 | `scripts/generate_app_icons.mjs` 生成180/192/512/32像素PNG，沿用项目小车造型 | 项目原创，无新增第三方资源 |
| GUI 图形 | `src/v2/ui.js` 的物品、按钮矢量图标；地点和车辆图标由实际分发GLB离线渲染为 `public/icons/models/` 的PNG，`sources.json`记录模型哈希 | 矢量图形项目原创；渲染图沿用所用模型许可，无远程字体 |
| 中文语音 | edge-tts 7.3.1 根据项目公开文案生成的48段MP3 | 非Kenney资源，不标为CC0；生成工具不随网页分发 |
| Babylon.js 9.35.0 / GUI / GLTF loader | 游戏运行引擎与GUI，精确锁定版本 | Apache-2.0，原文随 `public/licenses/` 分发 |

Kenney 文件来自官方原始下载，无第三方镜像。CC0 允许个人、教育及商业使用；仍保留来源和许可。Car Kit 原始 GLB 的外部贴图路径大小写保持不变，不需要 Draco 或额外在线解码器。

音效由原OGG转换为WAV，PCM16、单声道、22050Hz，音量为原始0.5，合计21690字节。原创模型为离线导出的GLB2.0，嵌入二进制和颜色；两个Mini组合地标嵌入其原始PNG色图，均无外部贴图请求。视觉样板保留原始PBR材料、共享模型材料并加入实时阴影。

## Mini资源选择与再生成

已查看两套官方预览后按实际场景选择7个模型，未将整套FBX、OBJ、预览、角色或武器放入项目。`scripts/import_mini_assets.py --download` 通过官方资产页取得下载，仅将所选GLB及原License写入 `public/models/kenney-mini/`；压缩包仅缓存在 `/tmp`。临时下载链接和Cookie不进入仓库或日志。`sources.json` 记录来源页、原包路径、原始与分发文件SHA-256、许可和字节数。模型仅把原有共享PNG嵌入GLB，保留原几何、材质、UV和节点变换。

| 可复用模型路径（相对public/models/） | X × Y × Z 单位 | 字节 |
| --- | --- | ---: |
| `kenney-mini/shop-shelf-boxes.glb` | 0.800 × 0.850 × 0.700 | 115836 |
| `kenney-mini/shop-display-fruit.glb` | 0.600 × 0.516 × 0.600 | 100264 |
| `kenney-mini/shop-cash-register.glb` | 0.900 × 0.591 × 0.850 | 69536 |
| `kenney-mini/forest-tent.glb` | 1.262 × 1.000 × 1.075 | 88608 |
| `kenney-mini/forest-tree.glb` | 0.927 × 1.684 × 0.883 | 34184 |
| `kenney-mini/forest-flag.glb` | 0.432 × 0.750 × 0.156 | 27316 |
| `kenney-mini/forest-stones.glb` | 0.904 × 0.454 × 0.852 | 33836 |
| `town-v2/shop.glb`（运行地标id `shop`） | 4.050 × 3.320 × 3.800 | 466816 |
| `town-v2/camp.glb`（运行地标id `camp`） | 4.200 × 2.666 × 4.200 | 248628 |

7个精选独立GLB合计469580字节，作为可编辑源资源保留；运行清单只需商店、营地两个组合地标，无需重复预加载这些独立模型。组合生成使用Python标准库，`node scripts/generate_models.mjs` 会调用离线组合流程，不访问网络；项目所用Three.js仅在离线生成圆角几何时使用，不增加V2运行时引擎。地标仍为Y向上、地台Y=0、正面-Z，兼容世界1.24倍缩放。医院大十字、学校校门、仓库包裹、谷仓X门、咖啡屋杯子与车库扳手都随模型分发。

## 中文语音与预加载

工具 https://github.com/rany2/edge-tts ，音色 `zh-CN-XiaoxiaoNeural`，rate `-10%`、volume `-10%`。`src/v2/dialogue.js` 是有限文案源，生成器 `scripts/generate_voice_v2.py` 复用严格TLS与ffprobe校验流程，`public/audio/voice-v2/manifest.json` 记录文案与文件对应。任务通过已生成的物品、数量、地点、连接词组合，不在游玩期间联网合成或使用浏览器在线语音后备。

当前样板包含27个模型、51个声音、15个模型图标、2个共享纹理，共95个运行资源文件；当前原始资源4743831字节（约4.74MB；准确值随内容变化由检查脚本给出），另有首屏打包的引擎JS和CSS。所有语音和音效在开始前解码成AudioBuffer；第一次点击解锁音频设备。声音不可解码或资源缺失会在Canvas提示重试，不带着缺失资源开局。

## 参考但未引入

Kenney City Kit (Roads)、UI Pack、UI Audio 已参考风格或作为候选；本轮没有导入它们的资源文件。没有调用 image2 或其他生图工具。V1黄色出租车、旧语音与Three.js源码保留在仓库历史参考，V2入口不会请求它们。

Three.js 0.180.0及其MIT许可仍随旧版参考保留；Vite为MIT构建工具。真实扬声器听感、目标设备显示效果需用户试玩，不把可解码与云端截图等同于真机验收。

浏览器可能自行延后请求安装用manifest或Apple图标。游戏离线验证单独核对模型、纹理、声音与运行代码；浏览器安装探测请求不等同于游玩中的资源懒加载。

营地组合中的帐篷按固定镜头校正旋转180°，入口面向可见正面；这仅改变组合节点变换，保留原始Mini源GLB。任务地标不会再按随机街区位置转成背面。
