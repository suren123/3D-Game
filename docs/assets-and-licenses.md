# V2 资源与许可证

核验日期：2026-11-13。当前运行资源的唯一清单是 `src/v2/resource-manifest.js`；`npm run check:assets` 核对文件、GLB 外部纹理、语音文案和许可证。V1 资源作为历史参考保留，不属于当前运行清单。

## 实际使用

| 资源 | 来源与用途 | 许可 |
| --- | --- | --- |
| Car Kit 3.1 | https://kenney.nl/assets/car-kit ；van、truck、delivery、truck-flat，分别作为小货车、大卡车、冷藏车和维修车基础车型，共享原始 `Textures/colormap.png` | CC0 1.0，保留原License.txt |
| City Kit Suburban 2.0 | https://kenney.nl/assets/city-kit-suburban ；3种住宅、花箱及原始共享纹理 | CC0，`public/models/kenney-suburban/License.txt` |
| Nature Kit 2.1 | https://kenney.nl/assets/nature-kit ；橡树、高树、灌木，以及营地敞口帐篷tent_smallOpen（源输入与许可另保存在kenney-mini） | CC0，`public/models/kenney-nature/License.txt` |
| Interface Sounds | https://kenney.nl/assets/interface-sounds ；click_001、pluck_001、confirmation_001 三个短音效 | CC0 1.0，保留原License.txt |
| Mini Shop 2.1 | https://kenney.nl/assets/mini-shop ；当前商店使用 `display-fruit`，旧货架/收银台组合保留为源参考 | CC0 1.0，原文随kenney-landmarks与kenney-mini保存 |
| Mini Forest 1.0 | https://kenney.nl/assets/mini-forest ；松树 `tree`、路旗 `flag`、石头 `stones`组合进营地地标；旧帐篷 `tent`只作历史源参考，不再放入 `town-v2/camp.glb` | CC0 1.0，原文 `public/models/kenney-mini/mini-forest-License.txt` |
| 旧版16个小镇 GLB（当前仅公园、农场与营地） | `public/models/town-v2/`：原14个原创模型增加圆角和明显地标，新增商店、营地由原创外壳/地台与上述Kenney Mini模型组合，生成器 `scripts/generate_models.mjs` | 原创部分归本项目；Mini几何与原色图为CC0，不能将这两个组合模型称为纯原创 |
| City Kit Commercial 2.1 + Suburban 2.0 | building-c医院、building-type-b学校、building-e商店；增加项目大标识；医院旧附加雨篷已撤下，保留原门面，三栋原始房壳保留 | CC0原几何与色图，项目新增部分单独标记；kenney-landmarks/sources.json及三份原License |
| City Kit Roads 2.2 | 原版直路、圆弧转角、丁字/十字/尽头路片、方头路灯、施工栏与锥桶 | CC0，kenney-streets/licenses；原图与SHA记录 |
| Coaster Kit 1.0 | 原版长椅、花卉 | CC0，kenney-streets/licenses/coaster-kit-License.txt |
| 主屏幕应用图标 | `scripts/generate_app_icons.mjs` 生成180/192/512/32像素PNG，沿用项目小车造型 | 项目原创，无新增第三方资源 |
| GUI 图形 | `src/v2/ui.js` 的物品、按钮矢量图标；地点和车辆图标由实际分发GLB离线渲染为 `public/icons/models/` 的PNG，`sources.json`记录模型哈希 | 矢量图形项目原创；渲染图沿用所用模型许可，无远程字体 |
| 中文语音 | edge-tts 7.3.1 根据项目公开文案生成的52段MP3 | 非Kenney资源，不标为CC0；生成工具不随网页分发 |
| Babylon.js 9.35.0 / GUI / GLTF loader | 游戏运行引擎与GUI，精确锁定版本 | Apache-2.0，原文随 `public/licenses/` 分发 |

Kenney 文件来自官方原始下载，无第三方镜像。CC0 允许个人、教育及商业使用；仍保留来源和许可。Car Kit 原始 GLB 的外部贴图路径大小写保持不变，不需要 Draco 或额外在线解码器。

音效由原OGG转换为WAV，PCM16、单声道、22050Hz，音量为原始0.5，合计21690字节。原创模型为离线导出的GLB2.0，嵌入二进制和颜色；两个Mini组合地标嵌入其原始PNG色图，均无外部贴图请求。视觉样板保留原始PBR材料、共享模型材料并加入实时阴影。

## 旧版Mini组合资源选择与再生成

以下记录旧版Mini商店的可重生成源资产；当前运行商店映射为`kenney-landmarks/shop.glb`，营地仍用`town-v2/camp.glb`。

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
| `town-v2/shop.glb`（历史组合，当前运行shop另见kenney-landmarks） | 4.050 × 3.320 × 3.800 | 466816 |
| 旧Mini版营地（历史尺寸，当前版本见camp-sources.json） | 4.200 × 2.666 × 4.200 | 248628 |

7个精选独立GLB合计469580字节，作为可编辑源资源保留；运行清单只需商店、营地两个组合地标，无需重复预加载这些独立模型。组合生成使用Python标准库，`node scripts/generate_models.mjs` 会调用离线组合流程，不访问网络；项目所用Three.js仅在离线生成圆角几何时使用，不增加V2运行时引擎。地标仍为Y向上、地台Y=0、正面-Z，兼容世界1.24倍缩放。医院大十字、学校校门、仓库包裹、谷仓X门、咖啡屋杯子与车库扳手都随模型分发。

## 中文语音与预加载

工具 https://github.com/rany2/edge-tts ，音色 `zh-CN-XiaoxiaoNeural`，rate `-10%`、volume `-10%`。`src/v2/dialogue.js` 是有限文案源，生成器 `scripts/generate_voice_v2.py` 复用严格TLS与ffprobe校验流程，`public/audio/voice-v2/manifest.json` 记录文案与文件对应。任务通过已生成的物品、数量、地点、连接词组合，不在游玩期间联网合成或使用浏览器在线语音后备。

上一版样板包含32个模型、51个声音、15个模型图标、2个共享纹理，共100个运行资源文件/4480057字节；当前44模型版本以文末和构建检查为准，另有首屏打包的引擎JS和CSS。所有语音和音效在开始前解码成AudioBuffer；第一次点击解锁音频设备。声音不可解码或资源缺失会在Canvas提示重试，不带着缺失资源开局。

## 参考但未引入

Kenney UI Pack、UI Audio仅作为候选；City Kit Roads已经引入当前版本。没有调用 image2 或其他生图工具。V1黄色出租车、旧语音与Three.js源码保留在仓库历史参考，V2入口不会请求它们。

Three.js 0.180.0及其MIT许可仍随旧版参考保留；Vite为MIT构建工具。真实扬声器听感、目标设备显示效果需用户试玩，不把可解码与云端截图等同于真机验收。

浏览器可能自行延后请求安装用manifest或Apple图标。游戏离线验证单独核对模型、纹理、声音与运行代码；浏览器安装探测请求不等同于游玩中的资源懒加载。

营地已换用Nature Kit敞口帐篷，原Mini蓝帐篷保留历史源文件。当前节点变换、材质例外、各层源文件和SHA记录在`public/models/town-v2/camp-sources.json`；`python scripts/import_mini_assets.py --rebuild-camp`仅重建营地，不覆盖其他模型。任务地标不会按随机街区位置转成背面。

## 当前Kenney道路与建筑再生成

`python scripts/compose_kenney_landmarks.py` 使用随库原始输入离线生成三栋建筑；`python scripts/import_kenney_streets.py --library /workspace/kenney-3d-library/2026-11-12` 从本地完整原包库导入精选道路/道具，不访问网络。原包来源、原始和分发hash、所有依赖纹理均记录。构建检查验证许可证、分发hash与图标hash。预加载与图标烘焙不再全局覆写粗糙度或金属度；仅Nature Kit 2.1三件植被及营地帐篷布/木材修正旧导出文件的metallic=1为0，匹配官方哑光树叶/树干外观，原色和粗糙度不改。详见[官方预览与场景对照](kenney-visual-reference.md)。

## 2026-11-13 Kenney资源扩展

`public/models/kenney-town/`新增17个可复现GLB，覆盖4个新增车型、2个旧车型替换、3个建筑替换、4种住宅和4种道具。来源包含Car Kit、City Kit Industrial/Commercial/Suburban/Roads、Coaster与Food Kit；原始源文件、原始License和SHA记录一并保留，几何和贴图颜色不作全局重绘。餐厅杯子等组合件在图鉴单独标明。

运行资源合计44模型、19实物图标、52语音及3音效、2外部纹理；最终文件与体积以构建的`check:assets`结果为准。[逐件来源与尺寸](kenney-town-assets.md)及`kenney-town/sources.json`可审计。资源预览图放在文档目录，游戏无需下载。
