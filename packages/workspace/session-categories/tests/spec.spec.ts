import { describe, expect, test } from 'vitest'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'
import { sessionCategoryDocumentSchema } from '../src/spec.ts'
import type { SessionCategory, SessionCategoryId } from '../src/types.ts'

const cid = (value: string): SessionCategoryId => value as SessionCategoryId
const sid = (value: string): SessionId => value as SessionId
const wid = (value: string): WorkspaceId => value as WorkspaceId

const category = (
  id: string,
  workspaceId: string,
  parentId: string | null,
  order: number,
): SessionCategory => ({
  id: cid(id),
  workspaceId: wid(workspaceId),
  parentId: parentId === null ? null : cid(parentId),
  title: id,
  order,
})

const empty = {
  version: 1 as const,
  revision: 0,
  categories: [],
  assignments: [],
  pendingArchive: [],
}

describe('session category document schema', () => {
  test('accepts an empty document', () => {
    expect(sessionCategoryDocumentSchema.parse(empty)).toEqual(empty)
  })

  test('rejects duplicate category ids', () => {
    expect(() => sessionCategoryDocumentSchema.parse({
      ...empty,
      categories: [category('a', 'w1', null, 0), category('a', 'w1', null, 1)],
    })).toThrow(/duplicate category id/)
  })

  test('rejects a parent from another Workspace', () => {
    expect(() => sessionCategoryDocumentSchema.parse({
      ...empty,
      categories: [category('parent', 'w1', null, 0), category('child', 'w2', 'parent', 0)],
    })).toThrow(/parent.*same Workspace/)
  })

  test('rejects cyclic parent chains', () => {
    expect(() => sessionCategoryDocumentSchema.parse({
      ...empty,
      categories: [category('a', 'w1', 'b', 0), category('b', 'w1', 'a', 0)],
    })).toThrow(/category parent cycle/)
  })

  test('rejects duplicate Session assignments', () => {
    expect(() => sessionCategoryDocumentSchema.parse({
      ...empty,
      categories: [category('a', 'w1', null, 0)],
      assignments: [
        { sessionId: sid('s1'), categoryId: cid('a') },
        { sessionId: sid('s1'), categoryId: cid('a') },
      ],
    })).toThrow(/duplicate Session assignment/)
  })

  test('rejects non-contiguous sibling order', () => {
    expect(() => sessionCategoryDocumentSchema.parse({
      ...empty,
      categories: [category('a', 'w1', null, 0), category('b', 'w1', null, 2)],
    })).toThrow(/sibling order.*0\.\.1/)
  })

  test('rejects an assignment to an unknown category', () => {
    expect(() => sessionCategoryDocumentSchema.parse({
      ...empty,
      assignments: [{ sessionId: sid('s1'), categoryId: cid('missing') }],
    })).toThrow(/unknown assignment category/)
  })

  test('rejects duplicate pending archive operation ids', () => {
    expect(() => sessionCategoryDocumentSchema.parse({
      ...empty,
      pendingArchive: [
        { operationId: 'operation', categoryIds: [], sessionIds: [] },
        { operationId: 'operation', categoryIds: [], sessionIds: [] },
      ],
    })).toThrow(/duplicate pending archive operation/)
  })
})
