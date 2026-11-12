# V2 资源与许可证

核验日期：2026-11-12。当前运行资源的唯一清单是 `src/v2/resource-manifest.js`；`npm run check:assets` 核对文件、GLB 外部纹理、语音文案和许可证。V1 资源作为历史参考保留，不属于当前运行清单。

## 实际使用

| 资源 | 来源与用途 | 许可 |
| --- | --- | --- |
| Car Kit 3.1 | https://kenney.nl/assets/car-kit ；van、truck、delivery、truck-flat，分别作为小货车、大卡车、冷藏车和维修车基础车型，共享原始 `Textures/colormap.png` | CC0 1.0，保留原License.txt |
| City Kit Suburban 2.0 | https://kenney.nl/assets/city-kit-suburban ；3种住宅、花箱及原始共享纹理 | CC0，`public/models/kenney-suburban/License.txt` |
| Nature Kit 2.1 | https://kenney.nl/assets/nature-kit ；橡树、高树和灌木 | CC0，`public/models/kenney-nature/License.txt` |
| Interface Sounds | https://kenney.nl/assets/interface-sounds ；click_001、pluck_001、confirmation_001 三个短音效 | CC0 1.0，保留原License.txt |
| 14 个原创 GLB | `public/models/town-v2/`：7地点、房子、树、灌木、长椅、花丛、巴士、洒水车，由 `scripts/generate_models.mjs` 生成 | 项目原创，无第三方纹理 |
| GUI 图形 | `src/v2/ui.js` 的矢量物品、地点、车辆、按钮图标 | 项目原创，无图片或远程字体 |
| 中文语音 | edge-tts 7.3.1 根据项目公开文案生成的46段MP3 | 非Kenney资源，不标为CC0；生成工具不随网页分发 |
| Babylon.js 9.35.0 / GUI / GLTF loader | 游戏运行引擎与GUI，精确锁定版本 | Apache-2.0，原文随 `public/licenses/` 分发 |

Kenney 文件来自官方原始下载，无第三方镜像。CC0 允许个人、教育及商业使用；仍保留来源和许可。Car Kit 原始 GLB 的外部贴图路径大小写保持不变，不需要 Draco 或额外在线解码器。

音效由原OGG转换为WAV，PCM16、单声道、22050Hz，音量为原始0.5，合计21690字节。原创模型为离线导出的GLB2.0，嵌入二进制和颜色，无外部贴图；视觉样板保留原始PBR材料、共享模型材料并加入实时阴影。

## 中文语音与预加载

工具 https://github.com/rany2/edge-tts ，音色 `zh-CN-XiaoxiaoNeural`，rate `-10%`、volume `-10%`。`src/v2/dialogue.js` 是有限文案源，生成器 `scripts/generate_voice_v2.py` 复用严格TLS与ffprobe校验流程，`public/audio/voice-v2/manifest.json` 记录文案与文件对应。任务通过已生成的物品、数量、地点、连接词组合，不在游玩期间联网合成或使用浏览器在线语音后备。

视觉样板包含25个模型、49个声音、2个共享纹理共76个运行资源文件，当前原始资源总计约2.48MB（准确值由检查脚本给出），另有首屏打包的引擎JS和CSS。所有语音和音效在开始前解码成AudioBuffer；第一次点击解锁音频设备。声音不可解码或资源缺失会在Canvas提示重试，不带着缺失资源开局。

## 参考但未引入

Kenney City Kit (Roads)、UI Pack、UI Audio 已参考风格或作为候选；本轮没有导入它们的资源文件。没有调用 image2 或其他生图工具。V1黄色出租车、旧语音与Three.js源码保留在仓库历史参考，V2入口不会请求它们。

Three.js 0.180.0及其MIT许可仍随旧版参考保留；Vite为MIT构建工具。真实扬声器听感、目标设备显示效果需用户试玩，不把可解码与云端截图等同于真机验收。
