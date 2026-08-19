import { afterEach, describe, expect, it } from 'vitest'
import { WorkspaceUnknownSessionError } from '@deepseek-ai/dsh-workspace'
import { SessionCategoriesService } from '../src/index.ts'
import type { SessionCategoryOperationId } from '../src/types.ts'
import { setupHarness, sid, wid, workspace } from './helpers.ts'

const harnesses: Awaited<ReturnType<typeof setupHarness>>[] = []
afterEach(async () => { await Promise.all(harnesses.splice(0).map(h => h.dispose())) })

const oid = (value: string): SessionCategoryOperationId => value as SessionCategoryOperationId

async function makeTree(h: Awaited<ReturnType<typeof setupHarness>>) {
  h.workspaces.set(wid('w1'), workspace('w1', ['s1', 's2']))
  await h.ctx.plugin(SessionCategoriesService)
  const service = h.ctx.sessionCategories
  const parent = await service.create({ workspaceId: wid('w1'), parentId: null, title: 'parent', expectedRevision: 0 })
  if (!parent.ok) throw new Error('parent create failed')
  const parentId = parent.value.categories[0]!.id
  const child = await service.create({ workspaceId: wid('w1'), parentId: parentId, title: 'child', expectedRevision: 1 })
  if (!child.ok) throw new Error('child create failed')
  const childId = child.value.categories.find(category => category.parentId === parentId)!.id
  const first = await service.assignSession({ sessionId: sid('s1'), categoryId: parentId, expectedRevision: 2 })
  if (!first.ok) throw new Error('s1 assign failed')
  const second = await service.assignSession({ sessionId: sid('s2'), categoryId: childId, expectedRevision: 3 })
  if (!second.ok) throw new Error('s2 assign failed')
  return { service, parentId, childId, revision: second.value.revision }
}

describe('SessionCategoriesService recursive archive deletion', () => {
  it('persists pending before archiving and retains it after a transient failure', async () => {
    const h = await setupHarness(); harnesses.push(h)
    const calls: string[] = []
    let fail = true
    h.ctx.workspaceRegistry.archiveSession = async (sessionId) => {
      calls.push(sessionId)
      if (fail) throw new Error('temporary archive failure')
    }
    const { service, parentId, revision } = await makeTree(h)

    await expect(service.deleteCategory({ categoryId: parentId, operationId: oid('op-1'), expectedRevision: revision }))
      .resolves.toEqual({ ok: false, error: { code: 'archive-failed', operationId: 'op-1' } })
    expect(service.snapshotAll().pendingArchive).toEqual([{
      operationId: 'op-1',
      categoryIds: [parentId, expect.any(String)],
      sessionIds: ['s1', 's2'],
    }])
    expect(calls).toEqual(['s1'])

    fail = false
    await expect(service.deleteCategory({ categoryId: parentId, operationId: oid('op-1'), expectedRevision: revision }))
      .resolves.toMatchObject({ ok: true, value: { revision: revision + 2, categories: [] } })
    expect(service.snapshotAll().pendingArchive).toEqual([])
    expect(calls).toEqual(['s1', 's1', 's2'])
  })

  it('recovers pending archive operations during service startup', async () => {
    const h = await setupHarness(); harnesses.push(h)
    let fail = true
    h.ctx.workspaceRegistry.archiveSession = async () => { if (fail) throw new Error('temporary archive failure') }
    const { service, parentId, revision } = await makeTree(h)
    await service.deleteCategory({ categoryId: parentId, operationId: oid('op-2'), expectedRevision: revision })
    expect(service.snapshotAll().pendingArchive).toHaveLength(1)

    fail = false
    await (service as unknown as { recoverPending: () => Promise<void> }).recoverPending()
    expect(h.ctx.sessionCategories.snapshotAll().pendingArchive).toEqual([])
    expect(h.ctx.sessionCategories.snapshotAll().categories).toEqual([])
  })

  it('treats unknown and already archived sessions as completed', async () => {
    const h = await setupHarness(); harnesses.push(h)
    h.workspaces.set(wid('w1'), workspace('w1', ['s1']))
    h.ctx.workspaceRegistry.archiveSession = async (sessionId) => {
      if (sessionId === sid('s1')) throw new WorkspaceUnknownSessionError(sessionId)
    }
    await h.ctx.plugin(SessionCategoriesService)
    const service = h.ctx.sessionCategories
    const created = await service.create({ workspaceId: wid('w1'), parentId: null, title: 'x', expectedRevision: 0 })
    if (!created.ok) throw new Error('create failed')
    const assigned = await service.assignSession({ sessionId: sid('s1'), categoryId: created.value.categories[0]!.id, expectedRevision: 1 })
    if (!assigned.ok) throw new Error('assign failed')
    const deleted = await service.deleteCategory({ categoryId: created.value.categories[0]!.id, operationId: oid('op-3'), expectedRevision: 2 })
    expect(deleted).toMatchObject({ ok: true, value: { categories: [] } })
  })

  it('returns archive-failed for non-unknown storage errors', async () => {
    const h = await setupHarness(); harnesses.push(h)
    h.workspaces.set(wid('w1'), workspace('w1', ['s1']))
    h.ctx.workspaceRegistry.archiveSession = async () => { throw new Error('storage unavailable') }
    await h.ctx.plugin(SessionCategoriesService)
    const service = h.ctx.sessionCategories
    const created = await service.create({ workspaceId: wid('w1'), parentId: null, title: 'x', expectedRevision: 0 })
    if (!created.ok) throw new Error('create failed')
    const assigned = await service.assignSession({ sessionId: sid('s1'), categoryId: created.value.categories[0]!.id, expectedRevision: 1 })
    if (!assigned.ok) throw new Error('assign failed')
    const deleted = await service.deleteCategory({ categoryId: created.value.categories[0]!.id, operationId: oid('op-4'), expectedRevision: 2 })
    expect(deleted).toEqual({ ok: false, error: { code: 'archive-failed', operationId: 'op-4' } })
    expect(service.snapshotAll().pendingArchive).toHaveLength(1)
  })
})
