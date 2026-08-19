# `@deepseek-ai/dsh-client-ui-session-categories`

English | [中文](README.zh.md)

This Web client plugin projects Host categories into the Workspace sidebar. It supports nested folders, expansion state, inline rename, drag-and-drop for categories and sessions, and a session “Move to category…” action. Deletion requires confirmation and reports that sessions will be archived.

Expanded categories render as light nested containers. Each depth adds a fixed inset and a subtle tonal step; sessions receive one additional inset beyond their category, while a valid drag target gets an inset highlight without changing row dimensions.

When a Workspace is collapsed, its row keeps a compact category/session count. The category-row plus starts a session in that category; creating a child category is available from the category actions menu, whose move action includes a folder icon.

The plugin shadows only the `sidebar.workspaces` root slot at priority `-10`. It does not redeclare the built-in directory-picker child slot; its fallback picker calls the native `ctx.workspaces.pickDirectory()` service directly. The generated Host Remote is mounted with `$mount()` and is refreshed on focus, visibility, reconnect, and same-tab `BroadcastChannel` updates.

This is a source-level development package. End users install the self-contained `@deepseek-ai/dsh-session-categories` package; no core dsh source changes are required.
