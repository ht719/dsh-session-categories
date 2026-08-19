import { Context } from '@deepseek-ai/cordis'
import Storage from '@deepseek-ai/dsh-storage'
import { DomainFacility } from '@deepseek-ai/dsh-storage-domain'
import type { SessionHeader, SessionId } from '@deepseek-ai/dsh-session'
import { MemoryMediaPool, MemoryStorageBackend } from '../../../storage/storage-domain/tests/helpers/memory-backend.ts'
import type { Workspace, WorkspaceId } from '@deepseek-ai/dsh-workspace'
import type { SessionCategoryId } from '../src/types.ts'

export const wid = (value: string): WorkspaceId => value as WorkspaceId
export const sid = (value: string): SessionId => value as SessionId
export const cid = (value: string): SessionCategoryId => value as SessionCategoryId

export interface CategoryHarness {
  readonly ctx: Context
  readonly pool: MemoryMediaPool
  readonly workspaces: Map<WorkspaceId, Workspace>
  readonly dispose: () => Promise<void>
}

export async function setupHarness(): Promise<CategoryHarness> {
  const ctx = new Context()
  await ctx.plugin(Storage)
  const pool = new MemoryMediaPool()
  ctx.storage.backend.register('memory', new MemoryStorageBackend(pool))
  const facility = new DomainFacility(ctx, { backend: 'memory', routes: {} })
  ctx.storage.mount('domain', facility)
  ctx.provide('storageDomain', facility)
  const workspaces = new Map<WorkspaceId, Workspace>()
  ctx.provide('workspaceRegistry', {
    get: (id: WorkspaceId) => workspaces.get(id),
    list: () => [...workspaces.values()],
    archiveSession: async () => {},
  } as never)
  const sessions = new Map<SessionId, SessionHeader>()
  ctx.provide('sessionPersistence', { list: async () => [...sessions.values()] } as never)
  return {
    ctx,
    pool,
    workspaces,
    dispose: async () => { await ctx.fiber.dispose() },
  }
}

export function workspace(id: string, sessionIds: readonly string[] = []): Workspace {
  return {
    id: wid(id), path: `/tmp/${id}`, title: id,
    createdAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString(),
    sessionIds: sessionIds.map(sid),
    setTitle: async () => {}, attachSession: async () => {},
    insertSessionBefore: async () => {}, detachSession: async () => {},
    status: async () => 'ok',
  }
}
