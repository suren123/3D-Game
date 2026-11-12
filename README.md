# 小车忙忙镇 · Little Town Drivers

给 4–6 岁儿童的汽车小镇记忆游戏，目标设备 **iPad Air 4 横屏**。真 3D 小镇使用固定斜俯视镜头；记住要带的物品与目的地，点选装车，让小车自己开过去，再选物品交给朋友。

**试玩：https://suren123.github.io/3D-Game/**

当前版本保留暖色玩具小镇画风、右侧独立操作区与[iPad 主屏幕启动适配](docs/ipad-installation.md)，加入 Kenney Mini 商店与营地、模型实物图标、4×4 街区以及平滑行驶和短装卸动画。

## V2 玩法

- 6 种车辆、12 种物品、8 类随机委托、9 个两字命名地点；晴天小镇、田园、海边 3 种主题。
- 4×4 街区包含环路与支路；每局 3 单，同局地点固定，下一局重新生成地图、道路与任务。
- 轻松：记住 1 种物品与 1 个地点；记忆：2 种物品和 2 个地点；挑战：最多 3 个有序步骤。
- 先看图听任务，主动点“记住了”；随后自主选车、装货、选地点、交货。“再看 / 再听”随时免费，没有倒计时、扣分或生命值。
- 入门没有突发事件；其他难度每局最多一次修路、补货、载量变化或轮胎维修。可以绕行、找备用货架、分趟取货、打气或求助。
- 全 Canvas 界面：左侧小镇、右侧任务/装货/交货面板；装好出发自动展示全镇，驾驶只保留设置、暂停和帮助，六辆候选车可分页选择。
- [设置 → 模型图鉴](docs/model-library.md)：查看27个资源模型，区分Kenney、自建与组合来源；固定45°斜俯视、大按钮缩放，退出保留游戏进度。
- 主屏幕独立窗口声明、本地图标和安全区适配；竖屏提示横置并暂停，横屏恢复。Safari无法保证网页强制锁定方向。

这些机制提供记忆与调整策略的练习机会，不等于已验证的认知训练效果。趣味性、难度和操作手感仍需要儿童实际试玩反馈。

## 加载与性能

Babylon.js 9.35.0 + 官方 GUI。模型、纹理、15 张实物模型图标、48 段本地中文语音、3 个音效与引擎代码在开始前加载，声音完成解码、材质完成预热；游玩中不调用在线 TTS、CDN 或远程字体。**本次打开加载完成后可断网继续玩和换地图**；没有承诺关闭页面后离线重开，当前没有 Service Worker。

本次视觉样板加入 Kenney 住宅与植被、PBR 材质及实时柔和阴影，同时保留地图点击修复。用户要求先确认画面，再继续性能优化。保留有上限的粒子池，渲染像素比上限 1.25，最高 30 FPS。真实 iPad Air 4 / Safari 和用户电脑的帧率仍需实测，云端软件渲染不能替代真机验收。

## 开发与测试

建议 Node 24。首次安装需要网络。

```bash
npm ci --cache /tmp/little-town-npm-cache
npm run dev
npm test
npm run check:assets
npm run build
```

开发地址默认 `http://localhost:5173`；云端 localhost 需要端口转发，不能直接从 iPad 访问。构建结果 `dist/` 支持普通静态托管和子目录。

在有 Python Playwright 与 `/usr/bin/chromium` 的环境中验证实际 Canvas 坐标触控：

```bash
# 一个终端运行静态服务，另一个执行测试
python -m http.server 5173 --bind 127.0.0.1 --directory dist
python tests/v2_browser.py
```

`TOWN_URL` 可覆盖测试地址。`?test=1` 只暴露状态和按钮屏幕坐标，不提供跳关或改状态接口。输出放在忽略提交的 `artifacts/`。旧 `src/*.js` 和旧浏览器脚本保留作 V1 实现参考，当前入口为 `src/v2/main.js`，请使用 V2 浏览器脚本。

## 资源再生成

```bash
node scripts/generate_models.mjs
# 另开 Vite 服务在 5174 后，重烘焙车辆与地标图标
TOWN_DEV_URL=http://127.0.0.1:5174/ python scripts/bake_model_icons.py
/workspace/tools/edge-tts/.venv/bin/python scripts/generate_voice_v2.py
/workspace/tools/edge-tts/.venv/bin/python scripts/generate_voice_v2.py --verify-only
```

模型生成使用随仓库保存的 Mini 素材，不需要联网；修改模型后须重新烘焙图标，资产检查会核对来源哈希。语音生成需要 edge-tts 7.3.1、Node 和 ffprobe，并使用在线服务；生成后的游戏播放本地 MP3。保持 TLS 校验，生成工具环境不提交。

## 发布与协作

推送 `main` 后 GitHub Actions 执行 Node 24、`npm ci`、`npm test`、构建和 Pages 发布。[发布记录](https://github.com/suren123/3D-Game/actions/workflows/pages.yml)。稳定回退点：`v1-stable-before-canvas`。V2 使用独立本地保存键，保留 V1 声音偏好和历史贴纸数据，不删除旧保存键。

- [协作规范](AGENTS.md) / [Agent 使用说明](docs/agent-setup.md)
- [多 Agent Skill](.agents/skills/multi-agent-dev/SKILL.md) / [游戏开发 Skill](.agents/skills/game-development/SKILL.md)
- [玩法设计](docs/game-design.md) / [需求](docs/requirements.md) / [选型](docs/technology-selection.md)
- [模块合同](docs/v2-contract.md) / [资源许可](docs/assets-and-licenses.md)
- [验证记录](docs/validation.md) / [任务状态](docs/task-state.md)

建筑朝向与道路布局的后续依据见[斜俯视游戏研究](docs/isometric-readability-research.md)，其中明确区分开发者证据和本项目建议。
