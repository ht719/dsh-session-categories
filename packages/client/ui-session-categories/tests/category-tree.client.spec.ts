import { describe, expect, it } from 'vitest'
import type { SessionId, SessionSummary } from '@deepseek-ai/dsh-client-runtime/client'
import type {
  SessionCategory, SessionCategoryId, SessionCategorySnapshot,
} from '@deepseek-ai/dsh-session-categories/types'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace'
import { buildCategoryTree } from '../src/client/tree.ts'
import { createWorkspaceViewStore } from '../src/client/stores.ts'

const sid = (id: string) => id as SessionId
const cid = (id: string) => id as SessionCategoryId
const wid = (id: string) => id as WorkspaceId
const category = (id: string, parentId: string | null, order: number): SessionCategory => ({
  id: cid(id), workspaceId: wid('workspace'), parentId: parentId === null ? null : cid(parentId), title: id, order,
})
const session = (id: string, updatedAt = 0): SessionSummary => ({
  id: sid(id), displayTitle: id, running: false, blank: false, updatedAt,
})
const snapshot = (
  categories: readonly SessionCategory[],
  assignments: readonly [sessionId: string, categoryId: string][],
): SessionCategorySnapshot => ({
  revision: 1,
  categories,
  assignments: assignments.map(([sessionId, categoryId]) => ({ sessionId: sid(sessionId), categoryId: cid(categoryId) })),
})

describe('buildCategoryTree', () => {
  it('projects arbitrary depth in stable sibling order', () => {
    const result = buildCategoryTree(
      snapshot([
        category('second', null, 1), category('grandchild', 'child', 0),
        category('first', null, 0), category('child', 'first', 0),
      ], [['deep', 'grandchild']]),
      [session('deep')],
      { expandedCategories: [cid('first'), cid('child'), cid('grandchild')] },
    )

    expect(result.categories.map(node => node.id)).toEqual([cid('first'), cid('second')])
    expect(result.categories[0]!.children[0]!.children[0]).toMatchObject({
      id: cid('grandchild'), sessions: [{ id: sid('deep') }],
    })
  })

  it('places each session once and appends unclassified sessions in input order', () => {
    const duplicate = snapshot(
      [category('first', null, 0), category('second', null, 1)],
      [['owned', 'first'], ['owned', 'second'], ['other', 'second']],
    )
    const result = buildCategoryTree(
      duplicate,
      [session('owned'), session('loose'), session('other')],
      { expandedCategories: [cid('first'), cid('second')] },
    )

    expect(result.categories[0]!.sessions.map(node => node.id)).toEqual([sid('owned')])
    expect(result.categories[1]!.sessions.map(node => node.id)).toEqual([sid('other')])
    expect(result.unclassifiedSessions.map(node => node.id)).toEqual([sid('loose')])
  })

  it('hides collapsed descendants while preserving their counts', () => {
    const result = buildCategoryTree(
      snapshot([category('parent', null, 0), category('child', 'parent', 0)], [['nested', 'child']]),
      [session('nested')],
      { expandedCategories: [] },
    )

    expect(result.categories[0]).toMatchObject({
      id: cid('parent'), expanded: false, sessionCount: 1, children: [], sessions: [],
    })
  })

  it('keeps the selected session ancestor chain visible through collapsed categories', () => {
    const result = buildCategoryTree(
      snapshot([
        category('parent', null, 0), category('child', 'parent', 0), category('leaf', 'child', 0),
      ], [['selected', 'leaf']]),
      [session('selected')],
      { expandedCategories: [], currentSessionId: sid('selected') },
    )

    const parent = result.categories[0]!
    const child = parent.children[0]!
    const leaf = child.children[0]!
    expect([parent, child, leaf].map(node => [node.id, node.expanded, node.containsCurrent])).toEqual([
      [cid('parent'), true, true], [cid('child'), true, true], [cid('leaf'), true, true],
    ])
    expect(leaf.sessions.map(node => node.id)).toEqual([sid('selected')])
  })

  it('honors an explicit collapsed state for the selected session category', () => {
    const result = buildCategoryTree(
      snapshot([category('folder', null, 0)], [['selected', 'folder']]),
      [session('selected')],
      {
        expandedCategories: [],
        expandedCategoryState: { [cid('folder')]: false },
        currentSessionId: sid('selected'),
      },
    )

    expect(result.categories[0]).toMatchObject({
      id: cid('folder'), expanded: false, containsCurrent: true, sessions: [], children: [],
    })
  })

  it('filters search visibility without changing category ownership', () => {
    const owned = session('owned')
    owned.displayTitle = 'Needle'
    const hidden = session('hidden')
    hidden.displayTitle = 'Haystack'
    const result = buildCategoryTree(
      snapshot([category('folder', null, 0)], [['owned', 'folder'], ['hidden', 'folder']]),
      [owned, hidden],
      { expandedCategories: [cid('folder')], query: ' needle ' },
    )

    expect(result.categories[0]).toMatchObject({
      id: cid('folder'), sessionCount: 2, sessions: [{ id: sid('owned') }],
    })
    expect(result.unclassifiedSessions).toEqual([])
  })

  it('falls back to unclassified when an assignment names a stale category', () => {
    const result = buildCategoryTree(snapshot([], [['orphan', 'deleted']]), [session('orphan')], {
      expandedCategories: [],
    })
    expect(result.categories).toEqual([])
    expect(result.unclassifiedSessions.map(node => node.id)).toEqual([sid('orphan')])
  })

  it('throws when the Host snapshot contains a category cycle', () => {
    expect(() => buildCategoryTree(
      snapshot([category('a', 'b', 0), category('b', 'a', 0)], []),
      [],
      { expandedCategories: [] },
    )).toThrow(/category cycle/i)
  })
})

describe('category expansion view state', () => {
  it('stores expansion and removes keys outside the retained category set', () => {
    const store = createWorkspaceViewStore().create()
    expect(store.getSnapshot().categoryExpansion).toEqual({})
    store.actions.setCategoryExpanded('kept', true)
    store.actions.setCategoryExpanded('removed', false)

    store.actions.retainCategoryKeys(['kept'])

    expect(store.getSnapshot().categoryExpansion).toEqual({ kept: true })
  })
})
