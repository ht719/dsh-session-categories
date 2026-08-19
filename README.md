# dsh-session-categories

English | [中文](README.zh.md)

This Host plugin stores a revisioned, Workspace-scoped category tree and the single category assignment for each session. It persists through the Workspace storage provider, exposes CRUD and archive operations through its generated Typert Remote, and prunes assignments for sessions no longer known to the Workspace.

The package contains the Host entry, Web client bundle, and Cordis profile patch. No separate Client or Bundle package is required.

## What it looks like

The sidebar groups sessions inside clear, collapsible category containers. The screenshot below is a redacted UI illustration based on the plugin's current layout; session titles and workspace names are anonymized.

<img src="docs/session-categories-overview.png" alt="Session categories in the dsh sidebar" width="500">

Within a Workspace, you can:

- create a session directly inside a category;
- expand or collapse categories without losing their hierarchy;
- drag a session into another category;
- create, rename, or delete categories from the category actions menu;
- move a session through the folder-icon **Move to category** action.

Expanded categories use light nested containers with a fixed inset and a subtle tonal step at each depth. Sessions receive one additional inset beyond their category, and drag targets highlight without changing row dimensions.

Collapsed Workspace rows show a hierarchy icon indicating that categories and sessions are present. The category-row plus starts a session in that category; child-category creation is in the category actions menu, and the move action has a folder icon.

## Install from GitHub

Install the prebuilt package directly into an unmodified dsh profile:

```sh
dsh plugin --profile web add github:ht719/dsh-session-categories
dsh --profile web
```

The repository includes the generated runtime files, so a separate build step is not required.

## Source layout

The repository root is the installable prebuilt package. Source packages are retained under `packages/workspace/session-categories/`, `packages/client/ui-session-categories/`, and `packages/bundle/session-categories/`.

Deleting a category recursively archives its sessions; it never deletes their durable logs. Archive operations are retried with the same operation id and recover after a restart. Mutations reject stale revisions, cross-Workspace session ids, descendant moves, and assignments to unknown categories.

The plugin is composed as an ordinary Cordis row. It does not require changes to `ui-workspace`, `ui-slots`, `api-remotes`, or other core dsh packages.
