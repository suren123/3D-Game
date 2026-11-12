# Kenney 小镇地标改造样板

本目录分发三栋 **Kenney 原建筑主体 + 项目新增功能标识** 的组合 GLB。
`school` / `hospital` 是项目改造用途，不能称为官方现成学校/医院。

| 输出 | Kenney 主体 | 项目新增 | Kenney 补充 |
| --- | --- | --- | --- |
| `school.glb` | City Kit (Suburban) `building-type-b.glb` | 蓝色打开书本、米色书页和金色书脊标识 | 原建筑自带绿植 |
| `hospital.glb` | City Kit (Commercial) `building-c.glb` | 米色牌上的大红色医疗十字、小红色入口雨篷 | 原建筑自带绿植 |
| `shop.glb` | City Kit (Commercial) `building-e.glb` | 大橙色购物篮标识 | 原主体绿色入口雨篷；Mini Shop `display-fruit.glb` |

原建筑的顶点、材质、UV、贴图全部保留；只加统一比例、整体居中/落地变换和独立新增网格。每个源素材包的 `colormap.png` 分别内嵌，不会因同名覆盖。模型正面为 -Z，适配 (+X,-Z) 固定镜头，游戏摆放 scale=1。全组合 XZ 中心为原点、地面 y=0。

离线重生成（无需下载/新依赖）：

```sh
python scripts/compose_kenney_landmarks.py
```

`_sources/` 保存不可变的原始 GLB 和各包原贴图。重新导入本次完整资料库后重生成：

```sh
python scripts/compose_kenney_landmarks.py --import-library /workspace/kenney-3d-library/2026-11-12
```

`sources.json` 记录逐层来源、原包路径、源文件/贴图 SHA-256、改造内容、GLB 尺寸和分发 SHA-256。三份 `*-License.txt` 是原包原样 CC0 许可证；项目新增标识/雨篷属于本项目自建部分，不能冒称 Kenney 原作。

仓库 `docs/previews/kenney/` 中的 `*-preview.png` / `landmarks-preview.jpg` 使用项目的实际 Babylon 图标渲染器、当前光照与原始材质，视角与游戏约定一致。它们用于人工核对，不进入资源清单。官方对照图片与结果见 `docs/kenney-landmark-notes.md`。
