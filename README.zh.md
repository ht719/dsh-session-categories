# `@deepseek-ai/dsh-session-categories`

[English](README.md) | 中文

此 Host 插件保存按 Workspace 隔离、带 revision 的分类树，以及每个对话唯一的分类归属。它通过 Workspace storage provider 持久化，通过生成的 Typert Remote 提供 CRUD 和归档操作，并清理 Workspace 中已不存在对话的旧归属。

将单个 Web 插件包安装到未修改的 dsh：

```sh
dsh plugin --profile web add @deepseek-ai/dsh-session-categories
dsh --profile web
```

该包包含 Host 入口、Web Client bundle 和 Cordis profile patch，不需要额外安装 Client 或 Bundle 包。

## 界面预览

侧边栏会将会话放入清晰的、可展开和折叠的分类容器中。下图是基于插件当前布局制作的脱敏界面示意图，工作区名称和会话标题均已匿名化。

![dsh 侧边栏中的会话分类](docs/session-categories-overview.png)

在 Workspace 中可以：

- 直接在分类下新建会话；
- 展开或折叠分类，同时保留清晰的层级关系；
- 将会话拖拽到其他分类；
- 通过分类操作菜单新建、重命名或删除分类；
- 使用带文件夹图标的“移动到分类”操作移动会话。

展开的分类使用轻量嵌套容器，每级增加固定缩进和轻微明暗层次。会话在所属分类基础上再缩进一级，拖拽目标高亮不会改变行尺寸。

折叠 Workspace 行会显示一个提示其中包含分类和会话的层级图标。分类行的加号用于在该分类下新建会话；新建子分类放在分类操作菜单中，移动到分类菜单项带有文件夹图标。

递归删除分类会归档其中的对话，不会删除对话的持久化日志。归档重试复用同一 operation id，进程重启后可以恢复。过期 revision、跨 Workspace 对话、移动到自身后代以及未知分类的操作都会被拒绝。

插件作为普通 Cordis 行组合，不要求修改 `ui-workspace`、`ui-slots`、`api-remotes` 或其他 dsh 核心包。

## 从 GitHub 安装

将预构建插件直接安装到未修改的 dsh profile：

```sh
dsh plugin --profile web add github:ht719/dsh-session-categories
dsh --profile web
```

仓库已包含生成后的运行时文件，不需要额外构建。

## 源码布局

仓库根目录是可安装的预构建包。宿主、浏览器端和 bundle 源码分别保留在 `packages/workspace/session-categories/`、`packages/client/ui-session-categories/` 与 `packages/bundle/session-categories/`。
