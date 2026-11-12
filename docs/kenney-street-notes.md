# Kenney 道路与街边装饰

本轮只接入本机库 `/workspace/kenney-3d-library/2026-11-12` 中精选的10个GLB。City Kit Roads 2.2提供5种道路及路灯、施工围栏、锥桶；Coaster Kit 1.0提供长椅、花卉。原始PNG已嵌入GLB；不改原始几何、UV、配色、材质和节点变换。来源、原模型/纹理SHA256、分发SHA256和完整原版许可证保存在 `public/models/kenney-streets/licenses/`。重建：`python scripts/import_kenney_streets.py`。

## 拼接规则

- 原版 `road-straight` 沿X轴，不是Z轴。所有选中路口为1×1，弯角选 `road-bend-square`；不把2×2的 `road-curve` 塞进1×1路口。
- Babylon glTF加载器转换Z方向后：直路开口为±X，尽头为+X，方形街角为-X/-Z，丁字为±X/-Z。`planStreets()`按真实 `map.edges` 匹配15种非空连接组合，缺边不开口。
- 节点各占一块3.75×3.75路砖；边段仅填两个节点占地区域之间的空隙，按剩余长度分段并只缩放局部X轴，接缝不重叠。8和9世界单位的随机间距均精确闭合。
- 原版可行车道占路砖宽度80%。3.75总宽保留原有3.0车道；若用旧3.65肩宽，车道会缩成2.92，最长车辆转弯的保守足迹会轻擦路缘。现有2.5转弯半径与运动路径不改。
- 原版路面Y=.01、路缘Y=.02。路砖基准Y=.1625，缩放后路面正好Y=.2，与既有车轮基准一致。

## 街边布置与生命周期

长椅、花卉、路灯只在少量道路中点外侧的空地布置，避开已放地标及住宅。使用原版木色、橙白/金属色，未加自制替代外观。施工事件使用真实围栏与两个锥桶；事件解除及时销毁。所有街道与装饰都复用已预加载容器的 `instantiate()`，加入现有地图实例清理，不发新网络请求；子网格不可拾取，避免抢地点触摸。

原程序box路肩/路面/虚线、圆盘路口、box斑马线、程序围栏/锥桶已去掉。植被继续使用现有Kenney自然模型，农田原bush改为已加载的Nature `hedge`。

## 验证

`node --test tests/street-layout.test.js tests/v2-motion.test.js`：8项通过，包括全部15种节点连接方向、1000地图接缝与缺边、两种节点间距/左右转弯的最长车辆保守足迹、原版GLB路缘三角面测得的开口朝向、原有运动测试和三主题装饰实例/施工销毁回归。NullEngine实际执行world布置在seed2/7/14分别生成6/3/6个普通街景装饰，三类均包含；该测试容器使用替身，不替代GLB加载与渲染验收。运行快照新增只读 `world.streetInfo` 以记录实际路砖、路口、路边模型及施工模型。

已查看官方 `city-kit-roads/preview-1.png` 与原版单模型 `road-straight`、`road-bend-square`、`road-intersection`、`road-end` 预览。实际浏览器截图与最终整合结果由本轮验收补充；云端软件渲染不代表iPad真机性能。
