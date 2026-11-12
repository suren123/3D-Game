# 小车忙忙镇 · Little Town Drivers

适合 4–6 岁儿童的 2.5D 斜俯视汽车小镇网页原型，优先为 iPad 横屏设计。点击地点或底部大按钮，汽车沿道路自动行驶，到站帮个小忙，收集快乐贴纸。

## 原型内容

- 三个双步骤任务：送面包、送小花、洗洗车；可切换、重复，无倒计时或扣分。
- 六个地点、固定正交相机、自动寻路驾驶与大触控按钮。
- 货物装载、送达后的场景变化、洗车泡泡、彩纸和贴纸册。
- 暂停、帮助、可关闭的短音效与 19 句预生成中文引导；贴纸保存在本机浏览器。
- WebGL 不可用、模型加载失败和浏览器存储拒绝时有对应回退。

## 本地运行

需要 Node.js 20.19+ 或 22.12+（建议 Node 24），首次下载依赖需要网络。

```bash
npm ci --cache /tmp/little-town-npm-cache
npm run dev
```

在运行该命令的电脑打开终端显示的地址（默认 `http://localhost:5173`）。同一局域网内的 iPad 可打开该电脑的局域网 IP 加 `:5173`；需网络与防火墙允许。云端的 localhost 不是 iPad 可直接访问的地址，需要平台端口转发或另行静态托管。

```bash
npm test
npm run build
npm run preview
```

构建结果位于 `dist/`，可放在普通静态服务器上；使用相对路径，支持子目录。请通过 HTTP(S) 访问，不直接用 `file://` 打开，浏览器对模块和模型纹理的加载有安全限制。游戏运行不依赖外部 CDN、账号或后端；首次加载后未实现完整离线缓存/PWA。

## 浏览器验证

源码包含纯逻辑测试以及生产构建的交互回归脚本。已有 Python Playwright 和 Chromium 的环境可运行：

```bash
# 先在另一个终端运行 npm run build 和下方服务
python -m http.server 5173 --bind 127.0.0.1 --directory dist
# 然后运行
python tests/browser_smoke.py
python tests/browser_media.py
```

可通过 `GAME_TEST_URL` 和 `CHROMIUM_PATH` 覆盖测试地址及浏览器路径。测试输出写入已忽略的 `artifacts/`。`?test=1` 仅提供只读状态快照以核验实际汽车位置，不提供跳关或修改游戏状态的接口。

## 技术与资源

Three.js 0.180.0 + 原生 JavaScript/HTML/CSS + Vite 8.3.8。固定场景没有额外物理引擎或 UI 框架。Kenney Car Kit 黄色汽车和 Interface Sounds 短音效为 CC0；其余建筑、道路、树木及 UI 为程序几何或自绘 SVG。详见[资源来源与许可证](docs/assets-and-licenses.md)。

## 协作与设计文档

- [项目协作规范](AGENTS.md) / [Agent 使用说明](docs/agent-setup.md)
- [多 Agent 协作 Skill](.agents/skills/multi-agent-dev/SKILL.md) / [游戏开发与验证 Skill](.agents/skills/game-development/SKILL.md)
- [玩法、场景与交互方案](docs/game-design.md)
- [需求记录](docs/requirements.md) / [技术选型](docs/technology-selection.md)
- [实际验证结果与限制](docs/validation.md) / [当前任务状态](docs/task-state.md)

## 已知边界

需要支持 WebGL 2 的浏览器。云端 Chromium 的触控模拟不能替代真实 iPad Safari，真实设备的声音、手感、性能与儿童试玩仍需验证。暂无多人、购买、账号或云存档。中文引导使用随游戏分发的本地 MP3；单个文件失败时尝试浏览器中文语音，图标、短文案和大按钮始终可用。

## 重新生成中文提示音（可选）

已生成的 19 个 MP3 位于 `public/audio/voice/`，普通运行不需要 Python 或 TTS 服务。

生成工具采用 [edge-tts](https://github.com/rany2/edge-tts) 7.3.1，声线 `zh-CN-XiaoxiaoNeural`，语速 -10%、音量 -10%。生成需要联网；脚本只发送项目的公开提示文案，播放时读取本地音频。重新生成需要 Python 3、Node.js 和 ffmpeg 的 ffprobe：

```bash
python -m venv .venv-voice
.venv-voice/bin/pip install edge-tts==7.3.1
.venv-voice/bin/python scripts/generate_voice.py
.venv-voice/bin/python scripts/generate_voice.py --verify-only
npm run build
```

当前云端已安装于 `/workspace/tools/edge-tts/.venv`，也可直接使用其中的 Python 运行脚本。脚本读取 `src/game.js` 的实际文案，核对有效旧文件并跳过；文案改变时重新生成对应文件。工具保持 TLS 校验，生成失败不会把空文件当作有效语音。
