# Kenney 小镇车辆与建筑增量

本批优先使用下载库中的完整 Kenney 模型，保留原始几何、材质、UV 和纹理像素。并非按名称假定模型用途：`bus` 的实际模型是休旅接送车，`tanker` 的实际模型是消防车；库中未找到现成公交车或罐车。原谷仓农场、公园保留；学校／医院／商店在后续组合模型复查中修正接点与附件，详见下文。

## 接口与尺寸

`src/v2/town-assets.js` 导出 `TOWN_MODELS = [{id,path}]` 和 `TOWN_CATALOG`。后者含名称、来源、用途说明、`bounds`、`runtimeScale` 和 `front`。`runtimeScale` 是建议实际摆放比例，模型文件已经完成等比缩放和居中落地，不要再统一加建筑 1.24 倍。所有模型均 XZ 居中、最低点 Y=0；车辆前向 +Z 与现有原版 van 一致，建筑入口 -Z。

| ID | 显示名称 | 原包 / 原始 GLB | 分发尺寸 X×Y×Z | runtimeScale |
| --- | --- | --- | --- | --- |
| taxi | 出租车 | Car Kit / taxi | 1.500×1.500×2.750 | 1.16 |
| tractor | 拖拉机 | Car Kit / tractor | 1.342×1.602×2.202 | 1.16 |
| ambulance | 救护车 | Car Kit / ambulance | 1.500×1.800×3.250 | 1.16 |
| police | 巡逻车 | Car Kit / police | 1.500×1.300×3.100 | 1.16 |
| bus | 接送车 | Car Kit / suv-luxury | 1.500×1.300×2.850 | 1.16 |
| tanker | 消防车 | Car Kit / firetruck | 1.500×1.700×3.400 | 1.16 |
| depot | 仓库 | City Industrial / building-k | 4.299×3.488×3.015 | 1 |
| garage | 车库 | City Industrial / building-j | 3.183×3.910×4.030 | 1 |
| cafe | 餐厅 | City Commercial / building-k + Food Kit / cup-coffee | 4.376×3.220×1.978 | 1 |
| home-g | 双翼平房 | City Suburban / building-type-g | 4.404×2.333×3.578 | 1 |
| home-k | 斜顶住宅 | City Suburban / building-type-k | 3.108×3.880×3.442 | 1 |
| home-m | 转角平房 | City Suburban / building-type-m | 4.338×2.240×4.338 | 1 |
| home-q | 车棚住宅 | City Suburban / building-type-q | 4.185×3.098×2.989 | 1 |
| town-trash | 街边纸篓 | Coaster Kit / trash | 0.721×0.743×0.721 | 1 |
| town-traffic-light | 交通信号灯 | City Roads / traffic-light | 0.376×1.648×0.288 | 1 |
| town-road-sign | 街道路牌 | City Roads / road-sign-street | 0.628×1.520×0.628 | 1 |
| town-low-fence | 低矮围栏 | City Suburban / fence-low | 3.060×0.408×2.010 | 1 |

车辆实际运行宽为约 1.56–1.74 米，适配 3 米车道。新增住宅在初版基础上统一等比增加 1.35 倍，改善汽车与住宅的比例，保持最大横向占地≤4.5、高≤4.0。

信号灯和路牌只是静态场景装饰。`fence-low` 原件是分开的两段低围栏，旋转 0 时沿 Z 轴平行，runtime1 两栏 X 约为±1.44、Z范围±1.005，中央 -Z 入口始终开放。单件占地包括中间空隙，不能按单根狭长栏杆处理。住宅放大后，围栏放在住宅中心建议额外等比 1.7：两栏 X 约±2.448、内缘±2.295、Z范围±1.709，总占地 5.202×3.417、高 .694，可在 6×6 地块包住新住宅两侧。不能用 runtime1 放在大住宅中心，否则侧栏会穿入建筑；不要旋转 90° 使横栏挡住 -Z 入口。

仓库保留锯齿采光屋顶，并增加独立包裹标识；车库保留拱顶、车库门和前庭绿植，并增加独立扳手标识。餐厅保留横向商业楼和原版黄色长雨棚，屋顶摆放原版 Kenney 咖啡杯。它们是项目用途组合，未将原包字母建筑称作官方专用仓库／餐厅。四栋新增住宅分别具有双翼、单斜顶、L形和平顶车棚轮廓，未用重复换色计数。

## 可复现与许可证

首次从素材库导入：

```sh
python scripts/import_kenney_town.py --library /workspace/kenney-3d-library/2026-11-12
```

仅使用随仓库保存的源文件离线重建：

```sh
python scripts/import_kenney_town.py
```

脚本复用现有 GLB composer 的读取、合并和标牌几何辅助，该共享脚本在后续严格复查中增加真实屋面定位。原始输入位于 `public/models/kenney-town/_sources/`，各包许可证位于 `licenses/`。`sources.json` 逐层记录官方来源、原库路径、输入 GLB/PNG/许可证 SHA-256、分发 GLB SHA-256、字节数和最终包围盒。所有选中源均为 CC0-1.0；17 个运行 GLB 共 2,261,980 字节（约 2.26 MB），原始输入仅用于重建。每个分发 GLB 内嵌自己的原包 PNG，不依赖同名外部贴图，也不覆盖源材质。

包版本核对源许可证：Car Kit 3.1、City Industrial/Suburban 2.0、City Commercial 2.1、Food Kit 2.0、City Roads 2.2、Coaster Kit 1.0。项目添加的包裹／扳手标识独立于源建筑几何，属于项目组合层。

## 实际验证

- 已阅读素材库 `building-recommendations.md`、`scene-recommendations.md`，实际查看 Car Kit、City Industrial/Commercial/Suburban 官方全件预览。
- 先用 Babylon.js 实际渲染候选建筑和车辆接触表，再选字母文件；实际分发的 17 个 GLB 再全部渲染，0 页面异常、0 请求失败。
- 初次选材接触表：[town-preview.jpg](previews/goal/town-preview.jpg)。这张历史图包含后来确认的标识悬空问题，不能当最终拼装质量证明；修正后实际游戏图见[逐件复查](model-quality-review.md)。车辆和住宅几何未因该修正而更换。
- 住宅比例对照：[town-scale-preview.jpg](previews/goal/town-scale-preview.jpg)。每格是同场景内 runtime1 住宅和 runtime1.16 消防车，均未按单件单独缩放；验证放大后的实际相对尺寸。4 组渲染通过、0 页面异常／请求失败。
- 包围盒检查通过：全部居中落地，车辆宽≤1.7、长≤3.6，任务建筑占地≤5.6×5.6、高≤5.5。
- 源保真检查通过：18 个源模型层的完整原始二进制数据仍逐字节存在于分发 GLB，所有源材质属性保持，PNG 像素文件字节原样嵌入。
- 离线重建通过：17 个 GLB、来源记录和 JS metadata 重新生成后 SHA-256 完全一致；ESM 导入通过、17 个 ID 唯一。

渲染环境为云端 Chromium + SwiftShader、Babylon.js 9.35.0，256×256 单件图。17件接触表每件自动适配相机，仅验证各件外观、材质、朝向和加载；另附的四组比例图可验证住宅与车的相对尺寸。整镇摆放、iPad 性能和儿童辨识度仍由主 Agent 集成与试玩验证。

七件组合曾漏检悬空、附属物穿插与入口问题，已重新严格修复；本批仓库/车库支柱按真实四角屋面定位，餐厅杯放在实际屋面，详见[组合复查证据](model-quality-review.md)。原先的缩略图检查不等同于这些接点已验收。
