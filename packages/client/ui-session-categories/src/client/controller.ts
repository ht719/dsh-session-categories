/**
 * Browser object layer for durable Workspace-scoped Session categories.
 * @module @deepseek-ai/dsh-client-ui-session-categories/client/controller
 */
import type { HostObservable } from '@deepseek-ai/dsh-client-ui-slots'
import type { RemoteResult, TypertClientRemote } from '@deepseek-ai/dsh-typert-protocol'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace'
import type {
  SessionCategoryFailure, SessionCategoryId, SessionCategoryMutationResult,
  SessionCategoryOperationId, SessionCategorySnapshot,
} from '@deepseek-ai/dsh-session-categories/types'
import type {} from '@deepseek-ai/dsh-session-categories/remote'

/** Generated Session categories Remote methods used by the client controller. */
export type SessionCategoriesRemote = TypertClientRemote['sessionCategories']

/** Controller load state across every requested Workspace. */
export type SessionCategoriesStatus = 'cold' | 'loading' | 'ready' | 'error'

/** Immutable category snapshots keyed by Workspace id. */
export interface SessionCategoriesView {
  readonly status: SessionCategoriesStatus
  readonly snapshots: Readonly<Record<string, SessionCategorySnapshot>>
  readonly error: string | null
}

/** Settled controller action returned to presentation callbacks. */
export type SessionCategoriesActionResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: SessionCategoryFailure | { readonly code: string; readonly message: string } }

type SessionCategoriesActionFailure = Exclude<SessionCategoriesActionResult, { ok: true }>

/** Minimal BroadcastChannel face used for browser refresh fan-out. */
export interface SessionCategoriesChannel {
  onmessage: ((event: MessageEvent<unknown>) => void) | null
  postMessage(message: unknown): void
  close(): void
}

interface EventTargetLike {
  addEventListener(type: string, listener: () => void): void
  removeEventListener(type: string, listener: () => void): void
}

interface DocumentTargetLike extends EventTargetLike { readonly visibilityState: string }

/** Browser dependencies replaceable by controller unit tests. */
export interface SessionCategoriesControllerOptions {
  readonly channelFactory?: (() => SessionCategoriesChannel) | undefined
  readonly windowTarget?: EventTargetLike | undefined
  readonly documentTarget?: DocumentTargetLike | undefined
}

const INITIAL_VIEW: SessionCategoriesView = Object.freeze({ status: 'cold', snapshots: Object.freeze({}), error: null })
const OK: SessionCategoriesActionResult = Object.freeze({ ok: true })
const DISPOSED: SessionCategoriesActionResult = Object.freeze({
  ok: false,
  error: Object.freeze({ code: 'disposed', message: 'session categories controller is disposed' }),
})

function transportFailure(error: unknown, fallback: string): SessionCategoriesActionFailure {
  if (typeof error === 'object' && error !== null && 'code' in error && 'message' in error) {
    const carried = error as { code: string; message: string }
    return { ok: false, error: { code: carried.code, message: carried.message } }
  }
  return { ok: false, error: { code: 'transport', message: error instanceof Error ? error.message : fallback } }
}

function errorMessage(result: SessionCategoriesActionFailure): string {
  return 'message' in result.error ? result.error.message : result.error.code
}

function sameSnapshot(left: SessionCategorySnapshot | undefined, right: SessionCategorySnapshot): boolean {
  if (left === right) return true
  if (left === undefined || left.revision !== right.revision) return false
  if (left.categories.length !== right.categories.length || left.assignments.length !== right.assignments.length) return false
  return left.categories.every((category, index) => {
    const other = right.categories[index]
    return other !== undefined && category.id === other.id && category.workspaceId === other.workspaceId
      && category.parentId === other.parentId && category.title === other.title && category.order === other.order
  }) && left.assignments.every((assignment, index) => {
    const other = right.assignments[index]
    return other !== undefined && assignment.sessionId === other.sessionId && assignment.categoryId === other.categoryId
  })
}

function isRefreshMessage(value: unknown): value is { type: 'refresh'; workspaceId: string } {
  return typeof value === 'object' && value !== null && (value as { type?: unknown }).type === 'refresh'
    && typeof (value as { workspaceId?: unknown }).workspaceId === 'string'
}

/** Stable observable and serialized Remote client for all loaded Workspaces. */
export class SessionCategoriesController implements HostObservable<SessionCategoriesView> {
  private view = INITIAL_VIEW
  private readonly listeners = new Set<() => void>()
  private readonly loads = new Map<WorkspaceId, Promise<SessionCategoriesActionResult>>()
  private operationTail: Promise<void> = Promise.resolve()
  private readonly channel: SessionCategoriesChannel | undefined
  private readonly windowTarget: EventTargetLike | undefined
  private readonly documentTarget: DocumentTargetLike | undefined
  private disposed = false

  /**
   * @param remote - generated `sessionCategories` Remote namespace.
   * @param options - replaceable browser event and channel dependencies.
   */
  constructor(private readonly remote: SessionCategoriesRemote, options: SessionCategoriesControllerOptions = {}) {
    const defaultChannelFactory = typeof window === 'undefined' || typeof BroadcastChannel === 'undefined'
      ? undefined
      : (): SessionCategoriesChannel => new BroadcastChannel('dsh.session-categories.v1')
    this.channel = (options.channelFactory ?? defaultChannelFactory)?.()
    this.windowTarget = options.windowTarget ?? (typeof window === 'undefined' ? undefined : window)
    this.documentTarget = options.documentTarget ?? (typeof document === 'undefined' ? undefined : document)
    if (this.channel !== undefined) this.channel.onmessage = this.onChannelMessage
    this.windowTarget?.addEventListener('focus', this.onFocus)
    this.documentTarget?.addEventListener('visibilitychange', this.onVisibilityChange)
  }

  /** Return the cached immutable view. */
  getSnapshot = (): SessionCategoriesView => this.view

  /** Subscribe to view replacements. */
  subscribe = (listener: () => void): (() => void) => {
    if (this.disposed) return () => undefined
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  /** Load a Workspace once, sharing an in-flight read. */
  ensure(workspaceId: WorkspaceId): Promise<SessionCategoriesActionResult> {
    if (this.disposed) return Promise.resolve(DISPOSED)
    if (this.view.snapshots[workspaceId] !== undefined) return Promise.resolve(OK)
    return this.refresh(workspaceId)
  }

  /** Re-read one Workspace, sharing an in-flight read. */
  refresh(workspaceId: WorkspaceId): Promise<SessionCategoriesActionResult> {
    if (this.disposed) return Promise.resolve(DISPOSED)
    const existing = this.loads.get(workspaceId)
    if (existing !== undefined) return existing
    this.publish({ status: 'loading', snapshots: this.view.snapshots, error: null })
    const pending = this.load(workspaceId)
    this.loads.set(workspaceId, pending)
    return pending.finally(() => { this.loads.delete(workspaceId) })
  }

  /** Re-read every Workspace already represented in the view. */
  async resyncLoaded(): Promise<void> {
    if (this.disposed) return
    await this.enqueue(async () => {
      await Promise.all(Object.keys(this.view.snapshots).map(async workspaceId => {
        await this.refresh(workspaceId as WorkspaceId)
      }))
      return OK
    })
  }

  /** Create a category within one Workspace. */
  create(workspaceId: WorkspaceId, parentId: SessionCategoryId | null, title: string, beforeCategoryId?: SessionCategoryId): Promise<SessionCategoriesActionResult> {
    return this.mutate(workspaceId, revision => this.remote.create({
      workspaceId, parentId, title, ...(beforeCategoryId === undefined ? {} : { beforeCategoryId }), expectedRevision: revision,
    }))
  }

  /** Rename a loaded category. */
  rename(categoryId: SessionCategoryId, title: string): Promise<SessionCategoriesActionResult> {
    return this.mutateCategory(categoryId, revision => this.remote.rename({ categoryId, title, expectedRevision: revision }))
  }

  /** Move a loaded category to another parent and ordered position. */
  moveCategory(categoryId: SessionCategoryId, parentId: SessionCategoryId | null, beforeCategoryId?: SessionCategoryId): Promise<SessionCategoriesActionResult> {
    return this.mutateCategory(categoryId, revision => this.remote.moveCategory({
      categoryId, parentId, ...(beforeCategoryId === undefined ? {} : { beforeCategoryId }), expectedRevision: revision,
    }))
  }

  /** Reorder a loaded category among its siblings. */
  reorderCategory(categoryId: SessionCategoryId, beforeCategoryId?: SessionCategoryId): Promise<SessionCategoriesActionResult> {
    return this.mutateCategory(categoryId, revision => this.remote.reorderCategory({
      categoryId, ...(beforeCategoryId === undefined ? {} : { beforeCategoryId }), expectedRevision: revision,
    }))
  }

  /** Set or clear category membership for Sessions in one Workspace. */
  assignSessions(workspaceId: WorkspaceId, sessionIds: readonly SessionId[], categoryId: SessionCategoryId | null): Promise<SessionCategoriesActionResult> {
    return this.mutate(workspaceId, revision => this.remote.moveSessions({ sessionIds, categoryId, expectedRevision: revision }))
  }

  /** Recursively delete one loaded category using a retry-stable operation id. */
  deleteCategory(categoryId: SessionCategoryId, operationId: SessionCategoryOperationId): Promise<SessionCategoriesActionResult> {
    return this.mutateCategory(categoryId, revision => this.remote.deleteCategory({ categoryId, operationId, expectedRevision: revision }))
  }

  /** Remove browser listeners, close the channel, and refuse later work. */
  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.listeners.clear()
    this.windowTarget?.removeEventListener('focus', this.onFocus)
    this.documentTarget?.removeEventListener('visibilitychange', this.onVisibilityChange)
    if (this.channel !== undefined) {
      this.channel.onmessage = null
      this.channel.close()
    }
  }

  private readonly onFocus = (): void => { void this.resyncLoaded() }
  private readonly onVisibilityChange = (): void => {
    if (this.documentTarget?.visibilityState === 'visible') void this.resyncLoaded()
  }
  private readonly onChannelMessage = (event: MessageEvent<unknown>): void => {
    if (!isRefreshMessage(event.data) || this.view.snapshots[event.data.workspaceId] === undefined) return
    void this.refresh(event.data.workspaceId as WorkspaceId)
  }

  private async load(workspaceId: WorkspaceId): Promise<SessionCategoriesActionResult> {
    try {
      const carried = await this.remote.get({ workspaceId })
      if (this.disposed) return DISPOSED
      if (!carried.ok) return this.failLoad(transportFailure(carried.error, 'session categories read failed'))
      if (!carried.value.ok) return this.failLoad({ ok: false, error: carried.value.error })
      this.commit(workspaceId, carried.value.value)
      return OK
    } catch (error) {
      if (this.disposed) return DISPOSED
      return this.failLoad(transportFailure(error, 'session categories read failed'))
    }
  }

  private failLoad(result: SessionCategoriesActionFailure): SessionCategoriesActionResult {
    this.publish({ status: 'error', snapshots: this.view.snapshots, error: errorMessage(result) })
    return result
  }

  private mutateCategory(
    categoryId: SessionCategoryId,
    operation: (revision: number) => Promise<RemoteResult<SessionCategoryMutationResult>>,
  ): Promise<SessionCategoriesActionResult> {
    return this.enqueue(async () => {
      const workspaceId = this.workspaceForCategory(categoryId)
      if (workspaceId === undefined) {
        return { ok: false, error: { code: 'category-not-loaded', message: 'category is not loaded' } }
      }
      return await this.mutateNow(workspaceId, operation)
    })
  }

  private mutate(
    workspaceId: WorkspaceId,
    operation: (revision: number) => Promise<RemoteResult<SessionCategoryMutationResult>>,
  ): Promise<SessionCategoriesActionResult> {
    return this.enqueue(async () => await this.mutateNow(workspaceId, operation))
  }

  private enqueue(operation: () => Promise<SessionCategoriesActionResult>): Promise<SessionCategoriesActionResult> {
    const guarded = async (): Promise<SessionCategoriesActionResult> => {
      if (this.disposed) return DISPOSED
      try { return await operation() } catch (error) {
        return transportFailure(error, 'session categories mutation failed')
      }
    }
    const result = this.operationTail.then(guarded, guarded)
    this.operationTail = result.then(() => undefined)
    return result
  }

  private async mutateNow(
    workspaceId: WorkspaceId,
    operation: (revision: number) => Promise<RemoteResult<SessionCategoryMutationResult>>,
  ): Promise<SessionCategoriesActionResult> {
    const loaded = await this.ensure(workspaceId)
    if (!loaded.ok) return loaded
    if (this.disposed) return DISPOSED
    const current = this.view.snapshots[workspaceId]
    if (current === undefined) return { ok: false, error: { code: 'workspace-not-loaded', message: 'workspace is not loaded' } }
    const carried = await operation(current.revision)
    if (this.disposed) return DISPOSED
    if (!carried.ok) return transportFailure(carried.error, 'session categories mutation failed')
    const result = carried.value
    if (!result.ok) {
      if (result.error.code === 'revision-conflict') await this.refresh(workspaceId)
      return { ok: false, error: result.error }
    }
    this.commit(workspaceId, result.value)
    this.channel?.postMessage({ type: 'refresh', workspaceId })
    return OK
  }

  private workspaceForCategory(categoryId: SessionCategoryId): WorkspaceId | undefined {
    for (const [workspaceId, snapshot] of Object.entries(this.view.snapshots)) {
      if (snapshot.categories.some(category => category.id === categoryId)) return workspaceId as WorkspaceId
    }
    return undefined
  }

  private commit(workspaceId: WorkspaceId, snapshot: SessionCategorySnapshot): void {
    const current = this.view.snapshots[workspaceId]
    const snapshots = sameSnapshot(current, snapshot)
      ? this.view.snapshots
      : Object.freeze({ ...this.view.snapshots, [workspaceId]: Object.freeze(snapshot) })
    this.publish({ status: 'ready', snapshots, error: null })
  }

  private publish(next: SessionCategoriesView): void {
    if (this.disposed) return
    if (this.view.status === next.status && this.view.snapshots === next.snapshots && this.view.error === next.error) return
    this.view = Object.freeze(next)
    for (const listener of this.listeners) {
      try { listener() } catch (error) { console.error('[ui-session-categories] subscriber threw:', error) }
    }
  }
}
