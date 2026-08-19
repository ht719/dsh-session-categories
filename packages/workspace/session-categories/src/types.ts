/**
 * Public durable values and Remote request/result vocabulary for Session categories.
 * This module contains types only so generated Remote clients do not import Host runtime code.
 * @module @deepseek-ai/dsh-session-categories/types
 */

import type { Branded } from '@deepseek-ai/dsh-brand'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace'

/** Stable identity of one category. */
export type SessionCategoryId = Branded<'SessionCategoryId'>

/** Stable identity of one recoverable archive operation. */
export type SessionCategoryOperationId = Branded<'SessionCategoryOperationId'>

/** One ordered category belonging to a Workspace. */
export interface SessionCategory {
  readonly id: SessionCategoryId
  readonly workspaceId: WorkspaceId
  readonly parentId: SessionCategoryId | null
  readonly title: string
  readonly order: number
}

/** One Session's optional category membership. */
export interface SessionCategoryAssignment {
  readonly sessionId: SessionId
  readonly categoryId: SessionCategoryId
}

/** Durable progress for a recursive category deletion. */
export interface PendingCategoryArchive {
  readonly operationId: SessionCategoryOperationId
  readonly categoryIds: readonly SessionCategoryId[]
  readonly sessionIds: readonly SessionId[]
}

/** Complete durable document owned by the Host service. */
export interface SessionCategoryDocument {
  readonly version: 1
  readonly revision: number
  readonly categories: readonly SessionCategory[]
  readonly assignments: readonly SessionCategoryAssignment[]
  readonly pendingArchive: readonly PendingCategoryArchive[]
}

/** Workspace-scoped state returned to Remote consumers. */
export interface SessionCategorySnapshot {
  readonly revision: number
  readonly categories: readonly SessionCategory[]
  readonly assignments: readonly SessionCategoryAssignment[]
}

/** Read the category state for one Workspace. */
export interface SessionCategoryGetRequest {
  readonly workspaceId: WorkspaceId
}

/** Create an ordered category. */
export interface SessionCategoryCreateRequest {
  readonly workspaceId: WorkspaceId
  readonly parentId: SessionCategoryId | null
  readonly title: string
  readonly beforeCategoryId?: SessionCategoryId
  readonly expectedRevision: number
}

/** Rename one category. */
export interface SessionCategoryRenameRequest {
  readonly categoryId: SessionCategoryId
  readonly title: string
  readonly expectedRevision: number
}

/** Move one category to a parent and ordered position. */
export interface SessionCategoryMoveRequest {
  readonly categoryId: SessionCategoryId
  readonly parentId: SessionCategoryId | null
  readonly beforeCategoryId?: SessionCategoryId
  readonly expectedRevision: number
}

/** Reorder one category among its current siblings. */
export interface SessionCategoryReorderRequest {
  readonly categoryId: SessionCategoryId
  readonly beforeCategoryId?: SessionCategoryId
  readonly expectedRevision: number
}

/** Set or clear one Session's category membership. */
export interface SessionCategoryAssignRequest {
  readonly sessionId: SessionId
  readonly categoryId: SessionCategoryId | null
  readonly expectedRevision: number
}

/** Set or clear category membership for multiple Sessions. */
export interface SessionCategoryMoveSessionsRequest {
  readonly sessionIds: readonly SessionId[]
  readonly categoryId: SessionCategoryId | null
  readonly expectedRevision: number
}

/** Recursively delete a category and archive its assigned Sessions. */
export interface SessionCategoryDeleteRequest {
  readonly categoryId: SessionCategoryId
  readonly operationId: SessionCategoryOperationId
  readonly expectedRevision: number
}

/** The caller based a mutation on an obsolete document revision. */
export interface SessionCategoryRevisionConflict {
  readonly code: 'revision-conflict'
  readonly revision: number
}

/** The addressed Workspace does not exist. */
export interface SessionCategoryWorkspaceNotFound {
  readonly code: 'workspace-not-found'
  readonly workspaceId: WorkspaceId
}

/** The addressed category does not exist. */
export interface SessionCategoryNotFound {
  readonly code: 'category-not-found'
  readonly categoryId: SessionCategoryId
}

/** The requested parent category does not exist. */
export interface SessionCategoryParentNotFound {
  readonly code: 'parent-not-found'
  readonly parentId: SessionCategoryId
}

/** The requested mutation would cross Workspace ownership. */
export interface SessionCategoryCrossWorkspace {
  readonly code: 'cross-workspace'
}

/** The requested parent would create a category cycle. */
export interface SessionCategoryCycle {
  readonly code: 'cycle'
}

/** The requested ordered insertion anchor does not exist in the target siblings. */
export interface SessionCategoryAnchorNotFound {
  readonly code: 'anchor-not-found'
  readonly anchorId: SessionCategoryId
}

/** A Session is not attached to the category's Workspace. */
export interface SessionCategorySessionNotInWorkspace {
  readonly code: 'session-not-in-workspace'
  readonly sessionId: SessionId
}

/** A recursive deletion could not archive every assigned Session. */
export interface SessionCategoryArchiveFailed {
  readonly code: 'archive-failed'
  readonly operationId: SessionCategoryOperationId
}

/** Stable business failures returned by Session category mutations. */
export type SessionCategoryFailure =
  | SessionCategoryRevisionConflict
  | SessionCategoryWorkspaceNotFound
  | SessionCategoryNotFound
  | SessionCategoryParentNotFound
  | SessionCategoryCrossWorkspace
  | SessionCategoryCycle
  | SessionCategoryAnchorNotFound
  | SessionCategorySessionNotInWorkspace
  | SessionCategoryArchiveFailed

/** Successful Session category operation result. */
export interface SessionCategorySuccess {
  readonly ok: true
  readonly value: SessionCategorySnapshot
}

/** Rejected Session category operation result. */
export interface SessionCategoryRejected {
  readonly ok: false
  readonly error: SessionCategoryFailure
}

/** Result returned by every Session category mutation. */
export type SessionCategoryMutationResult = SessionCategorySuccess | SessionCategoryRejected

/** Result returned when reading one Workspace's categories. */
export type SessionCategoryGetResult =
  | SessionCategorySuccess
  | { readonly ok: false; readonly error: SessionCategoryWorkspaceNotFound }
