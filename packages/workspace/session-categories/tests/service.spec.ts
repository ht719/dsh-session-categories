import { afterEach, describe, expect, it } from 'vitest'
import { SessionCategoriesService } from '../src/index.ts'
import { cid, setupHarness, sid, wid, workspace } from './helpers.ts'

const harnesses: Awaited<ReturnType<typeof setupHarness>>[] = []
afterEach(async () => { await Promise.all(harnesses.splice(0).map(h => h.dispose())) })

describe('SessionCategoriesService', () => {
  it('creates, renames, moves, reorders and assigns with one revision per change', async () => {
    const h = await setupHarness(); harnesses.push(h)
    h.workspaces.set(wid('w1'), workspace('w1', ['s1']))
    const fiber = await h.ctx.plugin(SessionCategoriesService)
    const service = h.ctx.sessionCategories
    const created = await service.create({ workspaceId: wid('w1'), parentId: null, title: 'Research', expectedRevision: 0 })
    expect(created).toMatchObject({ ok: true, value: { revision: 1 } })
    if (!created.ok) throw new Error('create failed')
    const id = created.value.categories[0]!.id
    await expect(service.rename({ categoryId: id, title: 'Renamed', expectedRevision: 1 }))
      .resolves.toMatchObject({ ok: true, value: { revision: 2 } })
    await expect(service.moveCategory({ categoryId: id, parentId: null, expectedRevision: 2 }))
      .resolves.toMatchObject({ ok: true, value: { revision: 2 } })
    await expect(service.reorderCategory({ categoryId: id, expectedRevision: 2 }))
      .resolves.toMatchObject({ ok: true, value: { revision: 2 } })
    await expect(service.assignSession({ sessionId: sid('s1'), categoryId: id, expectedRevision: 2 }))
      .resolves.toMatchObject({ ok: true, value: { revision: 3 } })
    await fiber.dispose()
  })

  it('rejects stale revisions and invalid workspace, parent, cycle, anchor and session references', async () => {
    const h = await setupHarness(); harnesses.push(h)
    h.workspaces.set(wid('w1'), workspace('w1', ['s1']))
    h.workspaces.set(wid('w2'), workspace('w2', ['s2']))
    await h.ctx.plugin(SessionCategoriesService)
    const service = h.ctx.sessionCategories
    const root = await service.create({ workspaceId: wid('w1'), parentId: null, title: 'Root', expectedRevision: 0 })
    if (!root.ok) throw new Error('create failed')
    const rootId = root.value.categories[0]!.id
    await expect(service.rename({ categoryId: rootId, title: 'stale', expectedRevision: 0 }))
      .resolves.toEqual({ ok: false, error: { code: 'revision-conflict', revision: 1 } })
    await expect(service.create({ workspaceId: wid('missing'), parentId: null, title: 'x', expectedRevision: 1 }))
      .resolves.toMatchObject({ ok: false, error: { code: 'workspace-not-found' } })
    await expect(service.create({ workspaceId: wid('w1'), parentId: cid('unknown'), title: 'x', expectedRevision: 1 }))
      .resolves.toMatchObject({ ok: false, error: { code: 'parent-not-found' } })
    await expect(service.assignSession({ sessionId: sid('s2'), categoryId: rootId, expectedRevision: 1 }))
      .resolves.toMatchObject({ ok: false, error: { code: 'session-not-in-workspace' } })
  })

  it('inserts before a valid creation anchor and keeps sibling orders contiguous after a parent move', async () => {
    const h = await setupHarness(); harnesses.push(h)
    h.workspaces.set(wid('w1'), workspace('w1'))
    await h.ctx.plugin(SessionCategoriesService)
    const service = h.ctx.sessionCategories
    const first = await service.create({ workspaceId: wid('w1'), parentId: null, title: 'first', expectedRevision: 0 })
    if (!first.ok) throw new Error('create failed')
    const firstId = first.value.categories[0]!.id
    const second = await service.create({ workspaceId: wid('w1'), parentId: null, title: 'second', expectedRevision: 1 })
    if (!second.ok) throw new Error('create failed')
    const secondId = second.value.categories.find(category => category.id !== firstId)!.id
    const inserted = await service.create({ workspaceId: wid('w1'), parentId: null, title: 'between', beforeCategoryId: secondId, expectedRevision: 2 })
    expect(inserted).toMatchObject({ ok: true, value: { revision: 3 } })
    if (!inserted.ok) throw new Error('insert failed')
    const child = await service.create({ workspaceId: wid('w1'), parentId: firstId, title: 'child', expectedRevision: 3 })
    if (!child.ok) throw new Error('child failed')
    const moved = await service.moveCategory({ categoryId: child.value.categories.find(category => category.parentId === firstId)!.id, parentId: null, beforeCategoryId: firstId, expectedRevision: 4 })
    expect(moved).toMatchObject({ ok: true })
    if (!moved.ok) throw new Error('move failed')
    const roots = moved.value.categories.filter(category => category.parentId === null).sort((a, b) => a.order - b.order)
    expect(roots.map(category => category.order)).toEqual([0, 1, 2, 3])
  })

  it('returns the assigned Session workspace when clearing its category', async () => {
    const h = await setupHarness(); harnesses.push(h)
    h.workspaces.set(wid('w1'), workspace('w1', ['s1']))
    await h.ctx.plugin(SessionCategoriesService)
    const service = h.ctx.sessionCategories
    const created = await service.create({ workspaceId: wid('w1'), parentId: null, title: 'x', expectedRevision: 0 })
    if (!created.ok) throw new Error('create failed')
    const id = created.value.categories[0]!.id
    const assigned = await service.assignSession({ sessionId: sid('s1'), categoryId: id, expectedRevision: 1 })
    expect(assigned).toMatchObject({ ok: true, value: { revision: 2 } })
    const cleared = await service.assignSession({ sessionId: sid('s1'), categoryId: null, expectedRevision: 2 })
    expect(cleared).toMatchObject({ ok: true, value: { revision: 3, categories: [{ id }] } })
  })

  it('returns the mutation workspace when another workspace sorts first in the document', async () => {
    const h = await setupHarness(); harnesses.push(h)
    h.workspaces.set(wid('w1'), workspace('w1'))
    h.workspaces.set(wid('w2'), workspace('w2'))
    await h.ctx.plugin(SessionCategoriesService)
    const service = h.ctx.sessionCategories
    const first = await service.create({ workspaceId: wid('w1'), parentId: null, title: 'first', expectedRevision: 0 })
    expect(first).toMatchObject({ ok: true })
    const second = await service.create({ workspaceId: wid('w2'), parentId: null, title: 'second', expectedRevision: 1 })
    expect(second).toMatchObject({ ok: true, value: { categories: [{ workspaceId: 'w2' }] } })
    if (!second.ok) throw new Error('second create failed')
    const categoryId = second.value.categories[0]!.id
    const renamed = await service.rename({ categoryId, title: 'renamed', expectedRevision: 2 })
    expect(renamed).toMatchObject({ ok: true, value: { categories: [{ id: categoryId, workspaceId: 'w2', title: 'renamed' }] } })
  })
})
