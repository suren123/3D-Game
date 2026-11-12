# Codex 多 Agent 中文配置包

本配置包提供项目级工作规则和一个可复用的多 Agent 协作 Skill。

## 文件结构

```text
项目根目录/
├── AGENTS.md
└── .agents/
    └── skills/
        └── multi-agent-dev/
            └── SKILL.md
```

## 安装方法

1. 将 `AGENTS.md` 放到 GitHub 仓库或项目的根目录。
2. 将 `multi-agent-dev` 文件夹放到项目根目录的 `.agents/skills/` 下。
3. 确认最终路径为：
   - `项目根目录/AGENTS.md`
   - `项目根目录/.agents/skills/multi-agent-dev/SKILL.md`
4. 将文件提交到项目仓库，并在新的 Codex 任务中使用该项目。

## 使用方法

自动模式：

```text
请使用 multi-agent-dev 技能，MODE=AUTO。根据任务复杂度决定是否启用多 Agent，并完成实现、测试和交付。
```

手动模式：

```text
请使用 multi-agent-dev 技能，MODE=MANUAL。安排 Explorer、Architect、Developer、Reviewer 四个角色，按职责执行。
```

单 Agent 模式：

```text
请使用 multi-agent-dev 技能，MODE=SINGLE。由你独立完成任务，不创建子 Agent。
```

## 重要说明

- `AGENTS.md` 提供项目级指令；Skill 提供可重复调用的协作流程。
- 配置文件本身不会为 Cloud 环境增加原本不存在的原生 Subagents 能力。
- 如果当前任务环境没有原生子 Agent 创建和结果回收能力，主 Agent 必须如实说明；可以生成独立 Cloud 任务提示词，但不能声称这些任务已经启动。
- 多个独立 Cloud 任务通常有各自的工作区。请通过分支、提交、补丁或明确的文件交接整合结果，不要假设它们自动共享文件。
- 第一次使用时，建议先执行只读能力验证任务，再将其用于大型开发。
