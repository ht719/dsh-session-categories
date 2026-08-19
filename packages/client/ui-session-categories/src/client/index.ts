/**
 * Session-category Workspace browser plugin. Its `sidebar.workspaces`
 * occupant shadows the shipped Workspace browser and drives its native
 * directory chooser directly. The shipped ui-workspace plugin remains the
 * owner of conversation Workspace pickers. Export discipline follows
 * packages/client/AGENTS.md.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-api-gateway/client'
import TYPERT_REMOTE from '@deepseek-ai/dsh-session-categories/remote'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type { WorkspaceBrowserInjected } from './contract/slots.ts'
import { createWorkspaceViewStore } from './stores.ts'
import { SessionCategoriesController, type SessionCategoriesRemote } from './controller.ts'
import { WorkspaceBrowser } from './WorkspaceBrowser.tsx'
import { en, zh, type WorkspaceKey } from './locales.ts'

export type {
  DirectoryFlowOwnerProps, DirectoryFlowSlotName, DirectoryPickingHooks, DirectoryPickingInjected,
  WorkspaceBrowserInjected, WorkspaceBrowserProps, WorkspacePickerInjected, WorkspacePickerProps,
} from './contract/slots.ts'
export type { WorkspaceKey } from './locales.ts'
export { createWorkspaceViewStore } from './stores.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The session-category browsing region and pick/create flow copy. */
    sessionCategories: WorkspaceKey
  }
}

/** Dictionary namespace owned by this plugin. */
const NS = 'sessionCategories'
const PACKAGE_NAME = '@deepseek-ai/dsh-client-ui-session-categories'

/**
 * Required services (cordis fiber inject). The target slot is declared by
 * ui-sidebar, whose activation order relative to this plugin is unconstrained.
 * apply therefore waits through `slots.inject()` instead of assuming order.
 */
export const inject = ['slots', 'sessions', 'workspaces', 'locale', 'remote']

/**
 * Mount the generated Remote namespace and register the category browser
 * after the sidebar declaration is live.
 * @param ctx - client root context.
 */
export async function apply(ctx: ClientContext): Promise<void> {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-session-categories: dictionaries')
  await ctx.remote.$mount(TYPERT_REMOTE)
  const categoriesRemote = ctx.get('remote.sessionCategories') as SessionCategoriesRemote | undefined
  if (categoriesRemote === undefined) throw new Error('session categories Remote did not mount')
  const categories = new SessionCategoriesController(categoriesRemote)
  ctx.effect(() => () => { categories.dispose() }, 'ui-session-categories: controller')
  ctx.on('connection/reset', () => { void categories.resyncLoaded() })

  const searchSessions: WorkspaceBrowserInjected['searchSessions'] = async (query, signal) => {
    const result = await ctx.sessions.search(query, signal)
    if (!result.ok) throw new Error(result.error.message)
    return result.value
  }

  const browserInjected = (): WorkspaceBrowserInjected => ({
    ensureCategories: workspaceId => categories.ensure(workspaceId),
    createCategory: (workspaceId, parentId, title, beforeCategoryId) =>
      categories.create(workspaceId, parentId, title, beforeCategoryId),
    renameCategory: (categoryId, title) => categories.rename(categoryId, title),
    moveCategory: (categoryId, parentId, beforeCategoryId) =>
      categories.moveCategory(categoryId, parentId, beforeCategoryId),
    reorderCategory: (categoryId, beforeCategoryId) => categories.reorderCategory(categoryId, beforeCategoryId),
    assignSessions: (workspaceId, sessionIds, categoryId) =>
      categories.assignSessions(workspaceId, sessionIds, categoryId),
    deleteCategory: (categoryId, operationId) => categories.deleteCategory(categoryId, operationId),
    // Explicit group actions keep their target; unscoped New Session inherits
    // the current Session Workspace before the recent-Workspace fallback.
    startSession: (workspaceId) => { ctx.workspaces.startSession(workspaceId) },
    open: (sessionId) => { ctx.sessions.open(sessionId) },
    searchSessions,
    searchResultLimit: ctx.sessions.searchResultLimit,
    renameSession: async (sessionId, title) => {
      // Row → session-face hop: rename is a per-session verb (ISession), not
      // a list-service verb; the binding resolves any listed session.
      const session = ctx.sessions.binding(sessionId)?.session
      if (session === undefined) throw new Error(`unknown session "${sessionId}"`)
      const result = await session.rename(title)
      if (!result.ok) throw new Error(result.error.message)
    },
    forkSession: (sessionId) => {
      ctx.sessions.fork({ sessionId, increaseTitle: true })
        .then((childId) => { ctx.sessions.open(childId) })
        .catch(() => {
          // Fork or child-rename failure keeps the current selection.
        })
    },
    renameWorkspace: async (workspaceId, title) => { await ctx.workspaces.rename(workspaceId, title) },
    deleteWorkspace: async (workspaceId) => { await ctx.workspaces.delete(workspaceId) },
    insertWorkspaceBefore: async (workspaceId, beforeWorkspaceId) => {
      await ctx.workspaces.insertBefore(workspaceId, beforeWorkspaceId)
    },
    archiveSession: async (sessionId) => { await ctx.workspaces.archiveSession(sessionId) },
    insertSessionBefore: async (workspaceId, sessionId, beforeSessionId) => {
      await ctx.workspaces.insertSessionBefore(workspaceId, sessionId, beforeSessionId)
    },
    createWorkspace: input => ctx.workspaces.create(input),
    pickDirectory: () => ctx.workspaces.pickDirectory(),
    hooks: { categories },
  })
  // This replacement owns no child slots; its directory chooser is direct.
  ctx.slots.inject('sidebar.workspaces', () => ctx.slots.register(
    {
      name: 'sidebar.workspaces',
      priority: -10,
      registrant: PACKAGE_NAME,
      store: createWorkspaceViewStore(),
      inject: browserInjected,
      locale: NS,
    },
    WorkspaceBrowser,
  ))
}
