# `@deepseek-ai/dsh-client-ui-session-categories`

[English](README.md) | 中文

此 Web 客户端插件把 Host 分类投影到 Workspace 左侧导航栏。它支持嵌套文件夹、展开状态、行内重命名、分类和对话拖拽，以及“移动到分类…”操作。删除前需要确认，并明确提示对话将被归档。

展开的分类使用轻量嵌套容器显示。每级分类增加固定缩进和轻微明暗层次；会话在所属分类基础上再缩进一级，合法拖拽目标显示内嵌高亮且不会改变行高。

折叠 Workspace 后，Workspace 行会显示一个提示其中包含分类和会话的层级图标。分类行的加号现在用于在该分类下新建会话；新建子分类放在分类操作菜单中，移动到分类菜单项带有文件夹图标。

插件只以 `-10` 优先级 shadow `sidebar.workspaces` 根 slot，不重复声明内置 directory-picker 子 slot；备用选择器直接调用原生 `ctx.workspaces.pickDirectory()` 服务。生成的 Host Remote 通过 `$mount()` 挂载，并在获得焦点、页面可见、重连以及同标签页 `BroadcastChannel` 更新时刷新。

这是源码级开发包。最终用户安装自包含的 `@deepseek-ai/dsh-session-categories` 包，不需要修改 dsh 核心源码。
