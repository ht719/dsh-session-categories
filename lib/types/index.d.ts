import { Context, Service } from '@deepseek-ai/cordis';
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import type { SessionCategory, SessionCategoryAssignment, SessionCategoryCreateRequest, SessionCategoryDocument, SessionCategoryGetRequest, SessionCategoryGetResult, SessionCategoryId, SessionCategoryMutationResult, SessionCategoryMoveRequest, SessionCategoryMoveSessionsRequest, SessionCategoryRenameRequest, SessionCategoryReorderRequest, SessionCategoryAssignRequest, SessionCategoryDeleteRequest } from './types.ts';
export type * from './types.ts';
export { sessionCategoriesDomainSpec } from './spec.ts';
declare module '@deepseek-ai/cordis' {
    interface Context {
        sessionCategories: SessionCategoriesService;
    }
}
/** Immutable Workspace-projected category state. */
export interface SessionCategorySnapshot {
    readonly revision: number;
    readonly categories: readonly SessionCategory[];
    readonly assignments: readonly SessionCategoryAssignment[];
}
/** Remove source and insert it immediately before anchor, or append. */
export declare function insertBefore<T>(ids: readonly T[], source: T, anchor?: T): readonly T[];
/** Whether assigning a category below parent would create a parent-chain cycle. */
export declare function wouldCycle(categories: readonly SessionCategory[], categoryId: SessionCategoryId, parentId: SessionCategoryId | null): boolean;
/** Durable category service. Mutations are serialized by one settled queue. */
export declare class SessionCategoriesService extends TypertRemoteService {
    static inject: string[];
    private global?;
    private operationTail;
    constructor(ctx: Context);
    protected [Service.init](): Promise<void>;
    /** Read categories and assignments belonging to one Workspace. */
    get(request: SessionCategoryGetRequest): SessionCategoryGetResult;
    /** Create one category. */
    create(request: SessionCategoryCreateRequest): Promise<SessionCategoryMutationResult>;
    /** Rename one category. */
    rename(request: SessionCategoryRenameRequest): Promise<SessionCategoryMutationResult>;
    /** Move one category to another parent and/or sibling position. */
    moveCategory(request: SessionCategoryMoveRequest): Promise<SessionCategoryMutationResult>;
    /** Reorder a category among current siblings. */
    reorderCategory(request: SessionCategoryReorderRequest): Promise<SessionCategoryMutationResult>;
    /** Assign or clear one Session. */
    assignSession(request: SessionCategoryAssignRequest): Promise<SessionCategoryMutationResult>;
    /** Assign or clear multiple Sessions. */
    moveSessions(request: SessionCategoryMoveSessionsRequest): Promise<SessionCategoryMutationResult>;
    /** Recursively remove a category after archiving its assigned Sessions. */
    deleteCategory(request: SessionCategoryDeleteRequest): Promise<SessionCategoryMutationResult>;
    /** Current full document for invariant companions. */
    snapshotAll(): SessionCategoryDocument;
    private enqueue;
    private mutate;
    private changed;
    private noop;
    private prune;
    private snapshot;
    private workspaceForSession;
    private descendants;
    private finishArchive;
    private normalizeOrders;
    private recoverPending;
    private requireGlobal;
}
/** Cordis namespace-import entry for source loaders that retain the module wrapper. */
export declare const apply: typeof SessionCategoriesService;
/** Services required before the category service is initialized. */
export declare const inject: string[];
//# sourceMappingURL=index.d.ts.map