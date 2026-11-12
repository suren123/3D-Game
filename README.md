# 3D-Game

用于开发 3D 网页游戏的项目仓库。

## 当前阶段

项目处于需求梳理与技术选型阶段。目前仅初始化协作文档和文档目录，没有游戏代码、可运行工程或依赖。

游戏引擎和框架尚未确定。后续由主 Agent 先明确游戏需求，再评估并记录技术选型，之后建立实际开发工程。本次不预设玩法，也不创建资源目录。

## 文档入口

- [项目协作规范](AGENTS.md)
- [多 Agent 协作技能](.agents/skills/multi-agent-dev/SKILL.md)
- [游戏开发与验证技能](.agents/skills/game-development/SKILL.md)
- [协作配置包安装与使用说明](docs/agent-setup.md)
- [游戏需求记录](docs/requirements.md)
- [技术选型流程与决策记录](docs/technology-selection.md)

## 项目结构

```text
3D-Game/
├── README.md
├── AGENTS.md
├── .gitignore
├── .agents/skills/
│   ├── multi-agent-dev/SKILL.md
│   └── game-development/SKILL.md
└── docs/
    ├── agent-setup.md
    ├── requirements.md
    └── technology-selection.md
```

## 开发约定

- 开始项目工作前阅读 `AGENTS.md`。
- 主 Agent 负责需求梳理、技术选型、任务协调和最终验证；是否委派取决于任务复杂度和真实工具能力。
- 先在需求记录中区分已确认信息与待确认项，再更新技术选型结论。
- 技术选型完成后再补充安装、开发、构建和测试命令；当前没有可运行命令。
- 后续本对话的开发操作以本仓库为工作目录；仓库文件不保证不同云端任务共享工作区或运行状态。

协作配置已按本项目需要修订；初始上传版本保留在 Git 历史中。默认 AUTO 模式按任务独立性与真实工具能力委派，入口和使用方法见协作规范与配置说明。
