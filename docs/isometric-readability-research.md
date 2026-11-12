# 斜俯视小镇：沿路自然与建筑可辨识

检索日期：2026-11-12。范围是建筑朝向、道路连接、识别与遮挡；本次仅研究，不修改游戏实现。

## 结论

**固定投影不要求所有建筑同向。道路决定接近关系，模型设计和画面布局保证识别。** 将所有房子统一朝镜头，能临时修复背面无特征的问题，但不能代替街区、入口与多面识别设计。以下来源没有提供适用于所有游戏的统一朝向算法；也不能把其他游戏的镜头条件直接等同于本项目固定镜头。

## 五项可核查证据

### 1. Anno 117：建筑、占地与道路连接是不同层

[官方 DevBlog: Roads & building in the grid](https://www.anno-union.com/devblog-roads-building-in-the-grid/)，2025-03-28；同页官方 Ubi-Thorlof 回复，2025-04-13。

- **作者明确说法：**旋转会调整逻辑占地与地面基座，建筑 mesh 本身不随之缩放；道路经过建筑角落时，可以生成短小的装饰连接，让连接关系看得见。
- 官方回复：“Buildings will auto-rotate to match the nearest road – but you can still manually turn them as before.”
- **对本项目的启示：**沿路入口和辨认建筑不必靠同一个朝向解决。可以保留沿路朝向，另用院门、引道和侧面特征表达用途；这条应用建议属于我们的推导。

### 2. Anno 1800：俯视时，屋顶与外露用途比墙面碎细节重要

[Ubisoft 对 3D Artist David Shelton 的制作采访](https://news.ubisoft.com/en-us/article/69SwK8nqv5rDUdEzqbNt6h/create-the-unknown-how-anno-1800-put-a-creative-spin-on-the-industrial-revolution)，2019-09-12。

- **作者明确说法：**从上方看，屋顶和大尺度表面变化比砖缝突出；工厂会把熔铁锅、制皂设备等放到室外，直接展示用途。
- 原文：“When viewed from above, roofs and large-scale weathering effects become much more prominent than grout between bricks.”
- **对本项目的启示：**医院十字、餐厅大杯、车库扳手、学校书本应在屋顶或两侧可见；识别不应只押在朝镜头的那扇门上。具体标记方案是我们的建议。

### 3. Dorfromantik：在游戏实际视角检验轮廓和明暗

[Toukana Interactive 制作访谈：How Dorfromantik Expands Its Cozy World Through Minimalist Design](https://80.lv/articles/how-dorfromantik-expands-its-cozy-world-through-minimalist-design)，2026-05-25。证据来自开发者回答，区别于文章导语。

- **作者明确说法：**早期把模型放进 Unity 检查比例和可读性，尤其检查略俯视角；轮廓优先，灰度检查明暗关系；模型使用轮廓纹理和 AO，场景主要是一盏太阳光并抬亮暗部。
- 原文：“The silhouette needs to be clear and the asset has to read well from the in-game perspective.”
- **对本项目的启示：**缩到真实游玩大小再判断屋顶、侧面和树木是否清晰；先检查灰度分离，再调色和补细节。AO、阴影应帮助分体块，不能把门面压黑。

### 4. Monument Valley：先验证整屏空间，再做美术

[Ken Wong 原始问答：Building Beautiful Worlds](https://architizer.com/blog/practice/materials/an-interview-with-ken-wong-of-monument-valley/)。当前可访问正文未标发布日期，检索结果约为 2016 年；不据此声称具体日月。

- **作者明确说法：**每屏围绕一个解谜或几何想法，先做可玩的白盒，测试和迭代后再加颜色与细节；重要原则是解谜所需信息都在单屏内。
- 原文：“everything you need to solve a puzzle is contained within a screen.”
- **对本项目的启示：**建筑单独看得清不够，还要在全镇构图里看得到、点得到。可借鉴整屏构图方法；该采访没有证明其建筑存在道路朝向或多面招牌算法。

### 5. GDC 关卡设计圆桌：固定镜头的遮挡要在布局阶段处理

[GDC 2018 Level Design Workshop: An expert roundtable Q&A](https://www.gamedeveloper.com/design/gdc-2018-level-design-workshop-an-expert-roundtable-q-a)，2018-02-23，Christopher Totten 等开发者原始问答。

- **作者明确说法：**确定相机后先做测试关卡，找出重要物体的可视限制；等距视角中，高楼、桥梁遮住角色时，可以避免这样的布置，或采用淡出、轮廓显示等方案。
- **对本项目的启示：**先通过前排低矮、后排较高、错位留空、树木移后等布局措施减少遮挡；确有必要再做淡出。具体街区安排是我们的建议，圆桌没有规定“前低后高”的算法。

## 对当前小镇的建议（项目设计推导，非上述游戏实现内幕）

1. **道路自然。**为每个地点区分道路停靠点、短引道、院门和建筑体块；把门口实际连到最近的合法道路。建筑可沿街转向，转角地块可用转角入口、小广场或院落过渡。
2. **两面可认。**为固定镜头会看到的两个立面保留清晰特征；转角店招、侧门、雨棚与屋顶标记都可以承担识别。无需把每一面都复制成同样的正门，也不必把完整房子永远旋回相机。
3. **先布置再补牌。**限制遮住其他地点或道路的前景高度，打散屋顶和树冠投影的重合；商店与营地应有不同轮廓。地点牌作辅助，不能靠牌遮住模型后再靠引线解释模型。
4. **用深度服务辨认。**保留柔和接地阴影、适量 AO、可分辨的屋顶和侧墙明暗；以真实游玩尺寸与灰度截图检查，不以模型图鉴大图清楚作为通过标准。
5. **按实际任务验收。**在多种随机种子、全镇缩放下，分别检查沿路入口可信、关键特征可见、地点触区可点、牌和树不遮其他地点；再请目标年龄孩子辨认。不要把统一旋转、减少细节或加亮灯光中的任何一项单独当作完整解法。

## 证据边界

本记录没有把截图印象当成开发实现证据；“两面设计”“前低后高”“停靠点—引道—院门”均明确作为本项目建议。检索也定位到 Oskar Stålberg 的 [SGC21 原始演讲](https://www.youtube.com/watch?v=Uxeo9c-PX-w)，但本次工具无法取得演讲正文，因此没有采用第三方自动转录推断 Townscaper 的内部规则，也没有为凑齐游戏名单补写 SimCity 或战棋的实现细节。
