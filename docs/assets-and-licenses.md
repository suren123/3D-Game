# 资源来源与许可证

## 已实际采用

| 资源 | 官方来源 | 用途与位置 | 许可证 |
| --- | --- | --- | --- |
| Car Kit 3.1 | https://kenney.nl/assets/car-kit | `public/models/kenney-car/taxi.glb` 与 `Textures/colormap.png`；黄色任务小车 | CC0 1.0，原许可证随模型保存 |
| Interface Sounds | https://kenney.nl/assets/interface-sounds | `public/audio/kenney-interface/` 的点击、到站和完成短音效 | CC0 1.0，原许可证随声音保存 |

核验日期：2026-11-12。由 Kenney 官方下载链接取得，未使用第三方镜像。CC0 允许个人、教育及商业使用，作者不要求强制署名；本项目仍保留来源和原文许可证。CC0 文本：https://creativecommons.org/publicdomain/zero/1.0/

### 模型处理

- 原始 taxi.glb 175,608 字节，外部纹理 12,371 字节，总计约 184 KiB。
- 保持 `Textures/colormap.png` 相对路径和大小写；GLB 并非完全自包含文件。
- Y 向上、+Z 车头，缩放约 0.7；独立车轮按行驶动画滚动。原程序几何车作为加载失败回退。
- 无 Draco 或额外远程解码器依赖。模型和纹理保持原文件，不重新压缩。

### 音效处理

从包内 `click_001.ogg`、`pluck_001.ogg`、`confirmation_001.ogg` 转换为同名 WAV：PCM 16-bit、单声道、22,050 Hz，幅度降至原始 0.5，三个文件总计 21,690 字节。采用 WAV 避免较旧 iPad Safari 对 OGG 支持差异。

通过真实用户手势解锁 Web Audio；保留静音；短音效不叠加播放。声音文件失败时使用低音量合成提示。最终听感需真实扬声器/设备确认，未把文件可解码等同于儿童听感验收。

## 已参考、未引入文件

- [City Kit (Suburban)](https://kenney.nl/assets/city-kit-suburban)：住宅、屋顶和栅栏的玩具比例可用于后续住宅区扩展。
- [City Kit (Roads)](https://kenney.nl/assets/city-kit-roads)：道路、路口与桥适合未来扩地图；当前规则网格与驾驶逻辑已经对齐。
- [Nature Kit](https://kenney.nl/assets/nature-kit)：未来可选少量树木、花丛，不整包加入。
- [UI Pack](https://kenney.nl/assets/ui-pack)：当前自绘暖色 SVG 和大按钮更适合幼儿，不替换成通用控件。
- [UI Audio](https://kenney.nl/assets/ui-audio)：短反馈音备选；本轮统一采用 Interface Sounds。

上述官方页面均标注 CC0；未采用的城市/自然包本轮没有完整解包验证，不对其文件格式作已核实声明。后续实际引入时重新检查具体文件和许可证。

## 原型自制内容与依赖

建筑、道路、植物、任务货物与 UI 图形为本项目程序生成或 SVG 绘制，不依赖远程图片和字体。Three.js、Vite 为 MIT；依赖版本由锁文件固定。Three.js 的版权和 MIT 原文已放在 `public/licenses/three-LICENSE.txt` 并随 dist 分发；Vite 是构建工具，不作为游戏运行时代码分发。

## 中文提示语（本地生成）

用户指定工具：[edge-tts](https://github.com/rany2/edge-tts)，已安装版本 7.3.1。采用 `zh-CN-XiaoxiaoNeural`，rate -10%、volume -10%，根据本项目原创公开文案生成，不是 Kenney 音效，也不标作 Kenney CC0 资源。

`public/audio/voice/manifest.json` 将实际文案映射到 19 个本地 MP3：6 句出发、12 句到站/动作奖励、1 句玩法帮助。合计 408,816 字节，总时长 68.136 秒，单句 2.160–6.624 秒。全部经 ffprobe 与 ffmpeg 解码验证；没有据此宣称真机扬声器听感已验证。

脚本 `scripts/generate_voice.py` 可复现，生成阶段调用在线服务；游戏内只播放本地文件。生成工具的 Python 环境不随网页分发。重新生成后的体积和时长以实际检查为准。
