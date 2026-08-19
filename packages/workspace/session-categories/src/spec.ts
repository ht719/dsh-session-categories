/**
 * Durable document validation and storage-domain declaration for Session categories.
 * @module @deepseek-ai/dsh-session-categories/src/spec
 */

import { z } from 'zod'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { defineDomain } from '@deepseek-ai/dsh-storage-domain'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace'
import type {
  SessionCategoryDocument,
  SessionCategoryId,
  SessionCategoryOperationId,
} from './types.ts'

const nonNegativeSafeInteger = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
const categoryId = z.string().min(1).transform(value => value as SessionCategoryId)
const operationId = z.string().min(1).transform(value => value as SessionCategoryOperationId)
const sessionId = z.string().min(1).transform(value => value as SessionId)
const workspaceId = z.string().min(1).transform(value => value as WorkspaceId)

const sessionCategorySchema = z.object({
  id: categoryId,
  workspaceId,
  parentId: categoryId.nullable(),
  title: z.string(),
  order: nonNegativeSafeInteger,
})

const sessionCategoryAssignmentSchema = z.object({
  sessionId,
  categoryId,
})

const pendingCategoryArchiveSchema = z.object({
  operationId,
  categoryIds: z.array(categoryId),
  sessionIds: z.array(sessionId),
})

/** Runtime validator for the complete durable Session category document. */
export const sessionCategoryDocumentSchema = z.object({
  version: z.literal(1),
  revision: nonNegativeSafeInteger,
  categories: z.array(sessionCategorySchema),
  assignments: z.array(sessionCategoryAssignmentSchema),
  pendingArchive: z.array(pendingCategoryArchiveSchema),
}).superRefine((document, ctx) => {
  const categories = new Map<string, (typeof document.categories)[number]>()
  document.categories.forEach((category, index) => {
    if (categories.has(category.id)) {
      ctx.addIssue({
        code: 'custom',
        path: ['categories', index, 'id'],
        message: `duplicate category id '${category.id}'`,
      })
    } else {
      categories.set(category.id, category)
    }
  })

  document.categories.forEach((category, index) => {
    if (category.parentId === null) return
    const parent = categories.get(category.parentId)
    if (parent === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['categories', index, 'parentId'],
        message: `unknown parent category '${category.parentId}'`,
      })
    } else if (parent.workspaceId !== category.workspaceId) {
      ctx.addIssue({
        code: 'custom',
        path: ['categories', index, 'parentId'],
        message: 'category parent must belong to the same Workspace',
      })
    }
  })

  document.categories.forEach((category, index) => {
    const visited = new Set<string>([category.id])
    let parentId = category.parentId
    while (parentId !== null) {
      if (visited.has(parentId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['categories', index, 'parentId'],
          message: `category parent cycle includes '${parentId}'`,
        })
        break
      }
      visited.add(parentId)
      parentId = categories.get(parentId)?.parentId ?? null
    }
  })

  const assignments = new Set<string>()
  document.assignments.forEach((assignment, index) => {
    if (assignments.has(assignment.sessionId)) {
      ctx.addIssue({
        code: 'custom',
        path: ['assignments', index, 'sessionId'],
        message: `duplicate Session assignment '${assignment.sessionId}'`,
      })
    }
    assignments.add(assignment.sessionId)
    if (!categories.has(assignment.categoryId)) {
      ctx.addIssue({
        code: 'custom',
        path: ['assignments', index, 'categoryId'],
        message: `unknown assignment category '${assignment.categoryId}'`,
      })
    }
  })

  const siblingOrders = new Map<string, { orders: number[]; indexes: number[] }>()
  document.categories.forEach((category, index) => {
    const key = `${category.workspaceId}\u0000${category.parentId ?? ''}`
    const sibling = siblingOrders.get(key) ?? { orders: [], indexes: [] }
    sibling.orders.push(category.order)
    sibling.indexes.push(index)
    siblingOrders.set(key, sibling)
  })
  siblingOrders.forEach(({ orders, indexes }) => {
    const actual = [...orders].sort((left, right) => left - right)
    const valid = actual.every((order, index) => order === index)
    if (!valid) {
      ctx.addIssue({
        code: 'custom',
        path: ['categories', indexes[0] ?? 0, 'order'],
        message: `sibling order must contain every integer in 0..${orders.length - 1}`,
      })
    }
  })

  const pendingOperations = new Set<string>()
  document.pendingArchive.forEach((pending, index) => {
    if (pendingOperations.has(pending.operationId)) {
      ctx.addIssue({
        code: 'custom',
        path: ['pendingArchive', index, 'operationId'],
        message: `duplicate pending archive operation '${pending.operationId}'`,
      })
    }
    pendingOperations.add(pending.operationId)
  })
}) as unknown as z.ZodType<SessionCategoryDocument>

/** Storage domain holding the authoritative Session category document. */
export const sessionCategoriesDomainSpec = defineDomain({
  name: 'session_categories',
  version: 0,
  global: {
    schema: sessionCategoryDocumentSchema,
    initial: {
      version: 1 as const,
      revision: 0,
      categories: [],
      assignments: [],
      pendingArchive: [],
    },
  },
  tables: {},
})
