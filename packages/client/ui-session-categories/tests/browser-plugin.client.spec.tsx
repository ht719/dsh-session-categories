// @vitest-environment jsdom
import { Context } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import { apply, inject } from '@deepseek-ai/dsh-client-ui-session-categories/client'
import { WorkspaceBrowser } from '../src/client/WorkspaceBrowser.tsx'

class TestBroadcastChannel {
  static readonly instances: TestBroadcastChannel[] = []
  onmessage: ((event: MessageEvent<unknown>) => void) | null = null
  readonly close = vi.fn()
  readonly postMessage = vi.fn()

  constructor(readonly name: string) {
    TestBroadcastChannel.instances.push(this)
  }
}

const FALLBACK = () => null

function categoryRemote() {
  const success = async () => ({
    ok: true as const,
    value: { ok: true as const, value: { revision: 0, categories: [], assignments: [] } },
  })
  return {
    get: success, create: success, rename: success, moveCategory: success,
    reorderCategory: success, assignSession: success, moveSessions: success,
    deleteCategory: success,
  }
}

async function bench() {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  ctx.provide('locale', new LocaleRuntime(ctx))
  ctx.provide('sessions', {
    open: () => undefined,
    search: async () => ({ ok: true, value: { items: [], hasMore: false } }),
    searchResultLimit: 20,
    binding: () => undefined,
    fork: async () => 'forked',
  } as never)
  ctx.provide('workspaces', {
    startSession: () => undefined,
    rename: async () => undefined,
    delete: async () => undefined,
    insertBefore: async () => undefined,
    archiveSession: async () => undefined,
    insertSessionBefore: async () => undefined,
    create: async () => ({ workspaceId: 'created' }),
  } as never)
  const mountDispose = vi.fn()
  const remoteMount = vi.fn(async () => {
      const disposeRemote = ctx.provide('remote.sessionCategories', categoryRemote() as never)
      const owned = ctx.effect(() => () => { mountDispose() }, 'test remote mount')
      return async () => { disposeRemote(); await owned() }
    })
  ctx.provide('remote', {
    $mount: remoteMount,
  } as never)
  const slots = ctx.get('slots') as SlotRegistry
  slots.register({
    name: 'root',
    children: {
      'sidebar.workspaces': { kind: 'single', scope: 'root' },
      'conversation.hero.workspace': { kind: 'single', scope: 'root' },
    },
  } as never, () => null)
  const disposeFallback = slots.register({
    name: 'sidebar.workspaces',
    priority: 0,
    children: { 'sidebar.workspaces.directoryFlow': { kind: 'single', scope: 'root' } },
  } as never, FALLBACK)
  return { ctx, slots, mountDispose, remoteMount, disposeFallback }
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  TestBroadcastChannel.instances.length = 0
})

describe('ui-session-categories browser plugin', () => {
  it('shadows only the Workspace browser and restores the fallback on unload', async () => {
    vi.stubGlobal('BroadcastChannel', TestBroadcastChannel)
    const addWindow = vi.spyOn(window, 'addEventListener')
    const removeWindow = vi.spyOn(window, 'removeEventListener')
    const addDocument = vi.spyOn(document, 'addEventListener')
    const removeDocument = vi.spyOn(document, 'removeEventListener')
    const b = await bench()

    try {
      const fiber = b.ctx.plugin({ name: 'ui-session-categories-test', inject: [...inject], apply })
      await fiber.await()

      expect(b.slots.entries('sidebar.workspaces')).toHaveLength(2)
      expect(b.slots.entriesOfSlot('sidebar.workspaces')).toHaveLength(1)
      expect(b.slots.entriesOfSlot('sidebar.workspaces')[0]).toMatchObject({
        component: WorkspaceBrowser,
        options: { priority: -10 },
        registrant: '@deepseek-ai/dsh-client-ui-session-categories',
      })
      expect(b.slots.entriesOfSlot('sidebar.workspaces')[0]?.children).toBeUndefined()
      expect(b.slots.entries('conversation.hero.workspace')).toHaveLength(0)
      expect(b.slots.spec('sidebar.workspaces.directoryFlow')).toMatchObject({ kind: 'single', scope: 'root' })
      expect(TestBroadcastChannel.instances).toHaveLength(1)
      expect(addWindow).toHaveBeenCalledWith('focus', expect.any(Function))
      expect(addDocument).toHaveBeenCalledWith('visibilitychange', expect.any(Function))

      await fiber.dispose()

      expect(b.slots.entries('sidebar.workspaces')).toHaveLength(1)
      expect(b.slots.entriesOfSlot('sidebar.workspaces')[0]?.component).toBe(FALLBACK)
      expect(b.remoteMount).toHaveBeenCalledOnce()
      expect(TestBroadcastChannel.instances[0]?.onmessage).toBeNull()
      expect(TestBroadcastChannel.instances[0]?.close).toHaveBeenCalledOnce()
      expect(removeWindow).toHaveBeenCalledWith('focus', expect.any(Function))
      expect(removeDocument).toHaveBeenCalledWith('visibilitychange', expect.any(Function))
    } finally {
      b.disposeFallback()
      await b.ctx.fiber.dispose()
    }
  })
})
