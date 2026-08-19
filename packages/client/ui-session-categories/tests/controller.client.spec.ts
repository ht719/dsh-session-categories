import { describe, expect, it, vi } from 'vitest'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace'
import type {
  SessionCategoryId, SessionCategoryOperationId, SessionCategorySnapshot,
} from '@deepseek-ai/dsh-session-categories/types'
import {
  SessionCategoriesController, type SessionCategoriesChannel,
  type SessionCategoriesRemote,
} from '../src/client/controller.ts'

const wid = (value: string): WorkspaceId => value as WorkspaceId
const cid = (value: string): SessionCategoryId => value as SessionCategoryId
const sid = (value: string): SessionId => value as SessionId
const oid = (value: string): SessionCategoryOperationId => value as SessionCategoryOperationId

function snapshot(workspaceId: WorkspaceId, revision: number): SessionCategorySnapshot {
  return {
    revision,
    categories: [{ id: cid(`c-${revision}`), workspaceId, parentId: null, title: `R${revision}`, order: 0 }],
    assignments: [],
  }
}

type Script = Partial<Record<keyof SessionCategoriesRemote, (request: never) => Promise<unknown>>>

function fakeRemote(script: Script = {}) {
  const calls: { method: keyof SessionCategoriesRemote; request: unknown }[] = []
  const method = (name: keyof SessionCategoriesRemote) => async (request: never): Promise<never> => {
    calls.push({ method: name, request })
    const run = script[name]
    const value = run === undefined ? { ok: true, value: snapshot(wid('w1'), 1) } : await run(request)
    return { ok: true, value } as never
  }
  const remote = {
    get: method('get'), create: method('create'), rename: method('rename'),
    moveCategory: method('moveCategory'), reorderCategory: method('reorderCategory'),
    assignSession: method('assignSession'), moveSessions: method('moveSessions'),
    deleteCategory: method('deleteCategory'),
  } as SessionCategoriesRemote
  return { remote, calls }
}

class FakeTarget {
  readonly listeners = new Map<string, Set<() => void>>()
  addEventListener(type: string, listener: () => void): void {
    const listeners = this.listeners.get(type) ?? new Set()
    listeners.add(listener)
    this.listeners.set(type, listeners)
  }
  removeEventListener(type: string, listener: () => void): void { this.listeners.get(type)?.delete(listener) }
  emit(type: string): void { for (const listener of this.listeners.get(type) ?? []) listener() }
}

class FakeChannel implements SessionCategoriesChannel {
  onmessage: ((event: MessageEvent<unknown>) => void) | null = null
  readonly postMessage = vi.fn()
  readonly close = vi.fn()
}

describe('SessionCategoriesController', () => {
  it('loads one workspace, publishes loading and keeps concurrent reads on one call', async () => {
    let release!: (value: unknown) => void
    const pending = new Promise(resolve => { release = resolve })
    const { remote, calls } = fakeRemote({ get: () => pending })
    const controller = new SessionCategoriesController(remote)
    const statuses: string[] = []
    controller.subscribe(() => { statuses.push(controller.getSnapshot().status) })

    expect(controller.getSnapshot()).toEqual({ status: 'cold', snapshots: {}, error: null })
    const first = controller.ensure(wid('w1'))
    const second = controller.ensure(wid('w1'))
    expect(controller.getSnapshot().status).toBe('loading')
    release({ ok: true, value: snapshot(wid('w1'), 4) })

    await Promise.all([first, second])
    expect(calls.filter(call => call.method === 'get')).toHaveLength(1)
    expect(controller.getSnapshot().snapshots.w1?.revision).toBe(4)
    expect(statuses).toEqual(['loading', 'ready'])
  })

  it('publishes carrier and thrown read failures as displayable errors', async () => {
    const carried = fakeRemote()
    carried.remote.get = vi.fn().mockResolvedValue({ ok: false, error: { code: 'offline', message: 'socket closed' } })
    const carrierController = new SessionCategoriesController(carried.remote)
    await expect(carrierController.ensure(wid('w1'))).resolves.toMatchObject({ ok: false })
    expect(carrierController.getSnapshot()).toMatchObject({ status: 'error', error: 'socket closed' })

    const thrown = fakeRemote({ get: () => Promise.reject(new Error('disconnected')) })
    const thrownController = new SessionCategoriesController(thrown.remote)
    await thrownController.ensure(wid('w1'))
    expect(thrownController.getSnapshot()).toMatchObject({ status: 'error', error: 'disconnected' })
  })

  it('serializes mutations, sends the latest revision, and adopts successful snapshots', async () => {
    let releaseCreate!: (value: unknown) => void
    const createPending = new Promise(resolve => { releaseCreate = resolve })
    const w1 = wid('w1')
    const { remote, calls } = fakeRemote({
      get: () => Promise.resolve({ ok: true, value: snapshot(w1, 4) }),
      create: () => createPending,
      rename: () => Promise.resolve({ ok: true, value: snapshot(w1, 6) }),
    })
    const controller = new SessionCategoriesController(remote)
    await controller.ensure(w1)

    const creating = controller.create(w1, null, 'Research')
    const renaming = controller.rename(cid('c-5'), 'Notes')
    await Promise.resolve()
    expect(calls.filter(call => call.method === 'rename')).toHaveLength(0)
    releaseCreate({ ok: true, value: snapshot(w1, 5) })
    await Promise.all([creating, renaming])

    expect(calls.find(call => call.method === 'create')?.request).toMatchObject({ expectedRevision: 4 })
    expect(calls.find(call => call.method === 'rename')?.request).toMatchObject({ expectedRevision: 5 })
    expect(controller.getSnapshot().snapshots.w1?.revision).toBe(6)
  })

  it('refreshes after a revision conflict and returns the business failure', async () => {
    const w1 = wid('w1')
    let reads = 0
    const { remote, calls } = fakeRemote({
      get: () => Promise.resolve({ ok: true, value: snapshot(w1, ++reads === 1 ? 2 : 3) }),
      create: () => Promise.resolve({ ok: false, error: { code: 'revision-conflict', revision: 3 } }),
    })
    const controller = new SessionCategoriesController(remote)
    await controller.ensure(w1)

    await expect(controller.create(w1, null, 'Research')).resolves.toMatchObject({
      ok: false, error: { code: 'revision-conflict' },
    })
    expect(calls.filter(call => call.method === 'get')).toHaveLength(2)
    expect(controller.getSnapshot().snapshots.w1?.revision).toBe(3)
  })

  it('maps mutation carrier failures without broadcasting', async () => {
    const w1 = wid('w1')
    const channel = new FakeChannel()
    const { remote } = fakeRemote({ get: () => Promise.resolve({ ok: true, value: snapshot(w1, 1) }) })
    remote.create = vi.fn().mockResolvedValue({ ok: false, error: { code: 'offline', message: 'socket closed' } })
    const controller = new SessionCategoriesController(remote, { channelFactory: () => channel })

    await expect(controller.create(w1, null, 'Research')).resolves.toEqual({
      ok: false, error: { code: 'offline', message: 'socket closed' },
    })
    expect(channel.postMessage).not.toHaveBeenCalled()
  })

  it('broadcasts successful mutations and refreshes loaded workspaces on peer messages', async () => {
    const w1 = wid('w1')
    let revision = 0
    const channel = new FakeChannel()
    const { remote, calls } = fakeRemote({
      get: () => Promise.resolve({ ok: true, value: snapshot(w1, ++revision) }),
      create: () => Promise.resolve({ ok: true, value: snapshot(w1, 3) }),
    })
    const controller = new SessionCategoriesController(remote, { channelFactory: () => channel })
    await controller.create(w1, null, 'Research')
    expect(channel.postMessage).toHaveBeenCalledWith({ type: 'refresh', workspaceId: 'w1' })

    channel.onmessage?.({ data: { type: 'refresh', workspaceId: 'w1' } } as MessageEvent)
    await vi.waitFor(() => { expect(calls.filter(call => call.method === 'get')).toHaveLength(2) })
  })

  it('refreshes every loaded workspace on visibility, focus, and explicit resync', async () => {
    const windowTarget = new FakeTarget()
    const documentTarget = Object.assign(new FakeTarget(), { visibilityState: 'hidden' })
    const { remote, calls } = fakeRemote()
    const controller = new SessionCategoriesController(remote, { windowTarget, documentTarget })
    await Promise.all([controller.ensure(wid('w1')), controller.ensure(wid('w2'))])

    windowTarget.emit('focus')
    await vi.waitFor(() => { expect(calls.filter(call => call.method === 'get')).toHaveLength(4) })
    await new Promise<void>(resolve => { queueMicrotask(resolve) })
    documentTarget.emit('visibilitychange')
    expect(calls.filter(call => call.method === 'get')).toHaveLength(4)
    documentTarget.visibilityState = 'visible'
    documentTarget.emit('visibilitychange')
    await vi.waitFor(() => { expect(calls.filter(call => call.method === 'get')).toHaveLength(6) })
    await new Promise<void>(resolve => { queueMicrotask(resolve) })
    await controller.resyncLoaded()
    expect(calls.filter(call => call.method === 'get')).toHaveLength(8)
  })

  it('supplies all mutation request variants from the latest loaded snapshot', async () => {
    const w1 = wid('w1')
    const { remote, calls } = fakeRemote({ get: () => Promise.resolve({ ok: true, value: snapshot(w1, 8) }) })
    const controller = new SessionCategoriesController(remote)
    await controller.ensure(w1)
    await controller.moveCategory(cid('c-8'), null, cid('before'))
    await controller.reorderCategory(cid('c-1'))
    await controller.assignSessions(w1, [sid('s1')], cid('c-1'))
    await controller.deleteCategory(cid('c-1'), oid('op1'))

    expect(calls.slice(-4).map(call => call.method)).toEqual([
      'moveCategory', 'reorderCategory', 'moveSessions', 'deleteCategory',
    ])
    expect(calls.slice(-4).map(call => call.request)).toEqual([
      { categoryId: 'c-8', parentId: null, beforeCategoryId: 'before', expectedRevision: 8 },
      { categoryId: 'c-1', expectedRevision: 1 },
      { sessionIds: ['s1'], categoryId: 'c-1', expectedRevision: 1 },
      { categoryId: 'c-1', operationId: 'op1', expectedRevision: 1 },
    ])
  })

  it('disposes listeners, event sources, and the channel and refuses later work', async () => {
    const windowTarget = new FakeTarget()
    const documentTarget = Object.assign(new FakeTarget(), { visibilityState: 'visible' })
    const channel = new FakeChannel()
    const { remote, calls } = fakeRemote()
    const controller = new SessionCategoriesController(remote, { channelFactory: () => channel, windowTarget, documentTarget })
    const listener = vi.fn()
    controller.subscribe(listener)
    controller.dispose()
    const before = controller.getSnapshot()

    await expect(controller.ensure(wid('w1'))).resolves.toMatchObject({ ok: false, error: { code: 'disposed' } })
    windowTarget.emit('focus')
    channel.onmessage?.({ data: { type: 'refresh', workspaceId: 'w1' } } as MessageEvent)
    expect(calls).toHaveLength(0)
    expect(controller.getSnapshot()).toBe(before)
    expect(listener).not.toHaveBeenCalled()
    expect(windowTarget.listeners.get('focus')).toHaveLength(0)
    expect(documentTarget.listeners.get('visibilitychange')).toHaveLength(0)
    expect(channel.close).toHaveBeenCalledOnce()
  })
})
