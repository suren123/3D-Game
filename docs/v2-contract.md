# V2 实施合同（主 Agent，2026-11-12）

用户批准：iPad Air 4 横屏；Babylon.js + 官方 GUI、单个可见 Canvas；全量预加载后离线游玩；6 车 / 12 物品 / 8 任务模板 / 9 地点 / 3 地图主题 / 4 可恢复事件；种子地图每轮固定、每轮 3 单；三个明确难度；不计时、不扣分。首个小闭环后扩展完整内容。

## 文件归属

- rules Agent：`src/v2/rules.js`、`src/v2/catalog.js`、`tests/v2-rules.test.js`。
- world Agent：`src/v2/world.js`、`scripts/generate_models.mjs`、`public/models/town-v2/`（离线导出可复用 GLB）。
- UI Agent：`src/v2/ui.js`。
- 主 Agent：其余文件，包括入口、资源、音频、依赖、合同、集成、浏览器测试、文档、Git。
- 不再委派；不自行 Git 提交或切换分支。接口变更先协商。

## Catalog（rules 导出，先创建此文件）

`GOODS` / `VEHICLES` / `PLACES` / `THEMES` 均为数组；每项 `{id,name,icon,color}`。icon 使用 Unicode 简洁图形或 emoji；车辆与地点GUI使用实际GLB烘焙的预加载PNG，其余图标画简洁形状。GOODS 12 件；VEHICLES 6 辆额外 `{capacity,model}`（model 可暂设 id）；PLACES 为 depot（仓库、出发点）、park、school、hospital、farm、cafe、garage、shop、camp，显示名统一两字；THEMES town/farm/coast。DIFFICULTIES 数组 easy/normal/challenge。可额外导出 TEMPLATES/EVENTS。

## Rules（唯一玩法状态拥有者）

`createGame({seed=1,difficulty='easy',saved={}}={})` → `{getState(),dispatch(command),subscribe(listener)}`。深拷贝快照，subscribe 不立即调用，listener(state,events)。纯 JS，无 DOM、时钟、引擎、网络。

`generateMap(seed)` → `{seed,theme,nodes:[{id,x,z}],edges:[[nodeId,nodeId]],places:[{id,nodeId,x,z}],depot:'depot'}`。x/z 大致 -12..12，Y 向上；地图所有地点可达，每轮固定，布局/路网/主题随种子变化。`findRoute(map,fromPlaceId,toPlaceId,blockedEdges=[])` → 路点 `{x,z}` 数组，无路返回 []。

state 至少：`{seed,difficulty,map,phase,round:0,mission,vehicleId,location:'depot',cargo:[],completed:[],message,paused:false,event:null,history:[],rewardCount:0}`。

- phases：`brief`（任务卡） / `selectVehicle` / `loading`（仓库选货） / `explore`（驾驶选地点） / `moving` / `delivery`（选交出货物） / `event` / `reward`（本单） / `sessionComplete`。
- mission `{id,title,steps:[{goodId,quantity,placeId}],shelf:[goodId],vehicleChoices:[vehicleId],ordered:boolean}`。easy 1 件 1 站、数量 1–2、2–3 货架选项；normal 2 件 2 站；challenge 最多 3 步 / 2 站有顺序。每次只增加一种主要复杂度，完整指令只在 brief/免费提示里显示。
- cargo `[{goodId,quantity}]`，completed 为已完成 step 索引。event `{id,title,message,options:[{id,label}]}`。
- 命令 `{type,...}`：`ACK_BRIEF`、`SELECT_VEHICLE {vehicleId}`、`LOAD {goodId}`（每次 +1，允许错货）、`UNLOAD {goodId}`、`DEPART`、`TRAVEL {placeId}`（合法后 phase moving）、`ARRIVE`（仅 root world 完成动画调用）、`DELIVER {goodId}`（一次交 1 个单位或按 rules 明确一致处理）、`RESOLVE_EVENT {optionId}`、`NEXT`（下一单/第3单后 sessionComplete）、`NEW_SESSION {seed,difficulty}`、`PAUSE {value}`。错货、错地、错顺序保留任务，清晰反馈，不自动给奖励。仓库可随时补货，禁止软锁。
- semantic events 数组：`{type:'travel',route,placeId}`、`{type:'feedback',kind:'success'|'gentle',text}`、`{type:'reward'}`、`{type:'cargo'}`、`{type:'event'}`、`{type:'session'}`。指令语音由 root 根据快照合成预生成词组队列，rules 不处理音频。
- 事件最多每轮1次，easy 无；发生在正常交付后，无阻断死路/不可恢复损失。roadworks / capacity / shortage / repair 四种，必须不同的可玩恢复选择，保留原任务。每种有可验证效果。

## World（纯表现，禁止发奖励）

`createWorld(scene,{assets,onPlaceTap,onArrival,reducedMotion=false})` → `{setMap(map),sync(state),travel(route,placeId),update(dt),setPaused(bool),overview(),setModelPreview(id|null,zoom),effect(kind),getState(),dispose()}`。scene 为 root 创建的 Babylon Scene；world 创建 camera/light。assets 为已加载模型 AssetContainer Map，key 支持 vehicle IDs 与 building/tree 等；不得在 World 内发任何网络请求。模型实际所需 keys 与 root 协调。

setMap 必须清理上一地图实例/粒子，复用材质与容器；车辆真正在合法道路上行驶，完成再 onArrival。点地点依靠 mesh.metadata.placeId + root/scene拾取，扩大透明拾取域>=80px（或 UI投影热点）。相机固定角度，装好出发自动全镇，驾驶保持全镇。任务建筑正面不得背对镜头。`getState()` 含 position/moving/location/meshCount/particleCount；可额外提供 `projectPlaces()` 给 GUI，返回像素坐标与 id（先通知 UI）。地图占据屏幕中部大部分；大城市感但视觉不挤。出发/停车/雨/成功粒子有上限，暂停冻结。

## UI（只用 Babylon GUI，禁止 HTML 游戏控件）

`createUI(scene,{onCommand,onSpeak,onSound,onOverview,onReducedMotion,onNewSession})` → `{render(state),loading({progress,text,error}),ready(),setSettings({sound,reducedMotion}),getBounds(),dispose()}`。

使用 `AdvancedDynamicTexture.CreateFullscreenUI` 单可见Canvas；1180×820逻辑尺度自适应。主要游戏GUI按钮>=72px，设置/图鉴>=64px，字22–28px；支持遮挡防穿透、按下抬起同区才接受、移出/取消/第二指不误触。loading→ready 顶层开始按钮 `{type:'START'}` 由 root 截获并解锁 AudioContext；显示 brief；ACK_BRIEF 进选车、装货、驾驶、交付。进入主游戏后再听/再看免费，不能一直展示答案；库存显示已选货非正确答案；选择地点显示所有地方名称而非高亮正确目标。ui 自己可维护帮助/货架/提示/设置面板状态，暂停覆盖层、声音/减少动态/难度/新地图入口。

onSpeak() 重放当前完整任务，onSound(bool)，onReducedMotion(bool)，onNewSession(difficulty)；新地图 seed由root生成。getBounds() 返回可见可用按钮 `{id:{x,y,width,height}}`，浏览器测试只按坐标点，禁止测试hook作弊改状态。稳定按钮 ID：start, ack, vehicle-ID, load-ID, unload-ID, depart, place-ID, deliver-ID, next, hint, listen, pause, resume, sound, settings, difficulty-ID, new-session, event-OPTIONID。GUI位置应根据实际control measure转换到 CSS px。

## 主 Agent 整合

新入口 `src/v2/main.js`。所有模型/纹理、所有音效与有限中文语句词组在开始前完成下载、解析、解码和渲染预热，失败有 Canvas 重试提示。无运行时在线 TTS/远端字体/CDN。独立美术RNG不影响玩法。保存 v2 key并迁移 v1声音和历史贴纸，保留 v1 key。

云端 Chromium 实际 Canvas 点击、1000 seeds、正确与错误流程、4事件、离线换图换任务、长按/多指/暂停/旋转测试；iPad 真机帧率仍待实测。稳定版 tag `v1-stable-before-canvas`，开发分支 `feat/canvas-town-v2`。

## 模型图鉴与素材身份

设置内model-viewer打开，分类models-vehicle/place/decoration，model-next/previous与model-zoom-in/out操作，model-back返回设置。MODEL_CATALOG必须与RESOURCE_MANIFEST.models一一覆盖；全部预览复用预加载容器。图鉴只改世界显示，不改任务、货物或位置，游戏暂停，退出恢复。世界setModelPreview隐藏地图/车辆/粒子，使用同scene与GUI、固定45°俯视，关闭恢复小镇相机。

资源URL携带manifest版本参数，防止部署后旧模型和旧地点语音命中同名缓存。无运行时远程字体/在线语音/模型下载。
