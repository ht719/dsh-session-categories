var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
/** Host service for durable Workspace-scoped Session categories. */
import { randomUUID } from 'node:crypto';
import { Service } from '@deepseek-ai/cordis';
import { TypertRemoteService, Remote } from '@deepseek-ai/dsh-typert-protocol';
import { WorkspaceUnknownSessionError } from '@deepseek-ai/dsh-workspace';
import { sessionCategoriesDomainSpec } from "./spec.js";
export { sessionCategoriesDomainSpec } from "./spec.js";
const reject = (error) => ({ ok: false, error });
const success = (value) => ({ ok: true, value });
/** Remove source and insert it immediately before anchor, or append. */
export function insertBefore(ids, source, anchor) {
    const sourceIndex = ids.indexOf(source);
    if (sourceIndex < 0)
        return ids;
    if (anchor !== undefined && ids.indexOf(anchor) < 0)
        return ids;
    if (anchor === source)
        return ids;
    const without = ids.filter(value => value !== source);
    const at = anchor === undefined ? without.length : without.indexOf(anchor);
    return [...without.slice(0, at), source, ...without.slice(at)];
}
/** Whether assigning a category below parent would create a parent-chain cycle. */
export function wouldCycle(categories, categoryId, parentId) {
    const byId = new Map(categories.map(category => [category.id, category]));
    let current = parentId;
    while (current !== null) {
        if (current === categoryId)
            return true;
        current = byId.get(current)?.parentId ?? null;
    }
    return false;
}
/** Durable category service. Mutations are serialized by one settled queue. */
let SessionCategoriesService = (() => {
    let _classSuper = TypertRemoteService;
    let _instanceExtraInitializers = [];
    let _get_decorators;
    let _create_decorators;
    let _rename_decorators;
    let _moveCategory_decorators;
    let _reorderCategory_decorators;
    let _assignSession_decorators;
    let _moveSessions_decorators;
    let _deleteCategory_decorators;
    return class SessionCategoriesService extends _classSuper {
        static {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
            _get_decorators = [Remote('get')];
            _create_decorators = [Remote('create')];
            _rename_decorators = [Remote('rename')];
            _moveCategory_decorators = [Remote('moveCategory')];
            _reorderCategory_decorators = [Remote('reorderCategory')];
            _assignSession_decorators = [Remote('assignSession')];
            _moveSessions_decorators = [Remote('moveSessions')];
            _deleteCategory_decorators = [Remote('deleteCategory')];
            __esDecorate(this, null, _get_decorators, { kind: "method", name: "get", static: false, private: false, access: { has: obj => "get" in obj, get: obj => obj.get }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _create_decorators, { kind: "method", name: "create", static: false, private: false, access: { has: obj => "create" in obj, get: obj => obj.create }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _rename_decorators, { kind: "method", name: "rename", static: false, private: false, access: { has: obj => "rename" in obj, get: obj => obj.rename }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _moveCategory_decorators, { kind: "method", name: "moveCategory", static: false, private: false, access: { has: obj => "moveCategory" in obj, get: obj => obj.moveCategory }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _reorderCategory_decorators, { kind: "method", name: "reorderCategory", static: false, private: false, access: { has: obj => "reorderCategory" in obj, get: obj => obj.reorderCategory }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _assignSession_decorators, { kind: "method", name: "assignSession", static: false, private: false, access: { has: obj => "assignSession" in obj, get: obj => obj.assignSession }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _moveSessions_decorators, { kind: "method", name: "moveSessions", static: false, private: false, access: { has: obj => "moveSessions" in obj, get: obj => obj.moveSessions }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _deleteCategory_decorators, { kind: "method", name: "deleteCategory", static: false, private: false, access: { has: obj => "deleteCategory" in obj, get: obj => obj.deleteCategory }, metadata: _metadata }, null, _instanceExtraInitializers);
            if (_metadata) Object.defineProperty(this, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        }
        static inject = ['storageDomain', 'workspaceRegistry'];
        global = __runInitializers(this, _instanceExtraInitializers);
        operationTail = Promise.resolve();
        constructor(ctx) { super(ctx, 'sessionCategories'); }
        async [Service.init]() {
            const domain = await this.ctx.storageDomain.open(sessionCategoriesDomainSpec);
            this.global = domain.global;
            this.ctx.effect(() => async () => { await domain.close(); }, 'session-categories.domainClose');
            await this.recoverPending();
        }
        /** Read categories and assignments belonging to one Workspace. */
        get(request) {
            const workspace = this.ctx.workspaceRegistry.get(request.workspaceId);
            if (workspace === undefined)
                return { ok: false, error: { code: 'workspace-not-found', workspaceId: request.workspaceId } };
            return { ok: true, value: this.snapshot(workspace.id) };
        }
        /** Create one category. */
        create(request) {
            return this.enqueue(() => this.mutate(request.expectedRevision, document => {
                const workspace = this.ctx.workspaceRegistry.get(request.workspaceId);
                if (workspace === undefined)
                    return reject({ code: 'workspace-not-found', workspaceId: request.workspaceId });
                if (request.parentId !== null) {
                    const parent = document.categories.find(category => category.id === request.parentId);
                    if (parent === undefined)
                        return reject({ code: 'parent-not-found', parentId: request.parentId });
                    if (parent.workspaceId !== request.workspaceId)
                        return reject({ code: 'cross-workspace' });
                }
                const siblings = document.categories.filter(category => category.workspaceId === request.workspaceId && category.parentId === request.parentId);
                if (request.beforeCategoryId !== undefined && !siblings.some(category => category.id === request.beforeCategoryId)) {
                    return reject({ code: 'anchor-not-found', anchorId: request.beforeCategoryId });
                }
                const at = request.beforeCategoryId === undefined ? siblings.length : siblings.findIndex(category => category.id === request.beforeCategoryId);
                const id = randomUUID();
                const created = { id, workspaceId: request.workspaceId, parentId: request.parentId, title: request.title, order: at };
                const categories = [...document.categories, created].map(category => category.workspaceId === request.workspaceId && category.parentId === request.parentId && category.id !== id && category.order >= at
                    ? { ...category, order: category.order + 1 } : category);
                return this.changed(request.workspaceId, { ...document, categories: [...categories] });
            }));
        }
        /** Rename one category. */
        rename(request) {
            return this.enqueue(() => this.mutate(request.expectedRevision, document => {
                const category = document.categories.find(item => item.id === request.categoryId);
                if (category === undefined)
                    return reject({ code: 'category-not-found', categoryId: request.categoryId });
                if (category.title === request.title)
                    return this.noop(category.workspaceId, document);
                return this.changed(category.workspaceId, { ...document, categories: document.categories.map(item => item.id === category.id ? { ...item, title: request.title } : item) });
            }));
        }
        /** Move one category to another parent and/or sibling position. */
        moveCategory(request) {
            return this.enqueue(() => this.mutate(request.expectedRevision, document => {
                const category = document.categories.find(item => item.id === request.categoryId);
                if (category === undefined)
                    return reject({ code: 'category-not-found', categoryId: request.categoryId });
                const parent = request.parentId === null ? undefined : document.categories.find(item => item.id === request.parentId);
                if (request.parentId !== null && parent === undefined)
                    return reject({ code: 'parent-not-found', parentId: request.parentId });
                if (parent !== undefined && parent.workspaceId !== category.workspaceId)
                    return reject({ code: 'cross-workspace' });
                if (wouldCycle(document.categories, category.id, request.parentId))
                    return reject({ code: 'cycle' });
                const siblings = document.categories.filter(item => item.workspaceId === category.workspaceId && item.parentId === request.parentId && item.id !== category.id).sort((a, b) => a.order - b.order);
                if (request.beforeCategoryId !== undefined && !siblings.some(item => item.id === request.beforeCategoryId))
                    return reject({ code: 'anchor-not-found', anchorId: request.beforeCategoryId });
                const at = request.beforeCategoryId === undefined ? siblings.length : siblings.findIndex(item => item.id === request.beforeCategoryId);
                const currentSiblings = document.categories.filter(item => item.workspaceId === category.workspaceId && item.parentId === category.parentId).sort((a, b) => a.order - b.order);
                const desiredIds = [...siblings.slice(0, at).map(item => item.id), category.id, ...siblings.slice(at).map(item => item.id)];
                if (category.parentId === request.parentId && desiredIds.every((id, index) => id === currentSiblings[index]?.id)) {
                    return this.noop(category.workspaceId, document);
                }
                const remaining = document.categories.filter(item => item.id !== category.id);
                const groups = new Map();
                for (const item of remaining) {
                    const key = `${item.workspaceId}\u0000${item.parentId ?? ''}`;
                    const group = groups.get(key) ?? [];
                    group.push(item);
                    groups.set(key, group);
                }
                const oldKey = `${category.workspaceId}\u0000${category.parentId ?? ''}`;
                const newKey = `${category.workspaceId}\u0000${request.parentId ?? ''}`;
                for (const key of new Set([oldKey, newKey])) {
                    const group = (groups.get(key) ?? []).sort((a, b) => a.order - b.order);
                    const parentId = key.slice(key.indexOf('\u0000') + 1) || null;
                    const ordered = key === newKey
                        ? [...group.slice(0, at), { ...category, parentId: request.parentId, order: at }, ...group.slice(at)]
                        : group;
                    groups.set(key, ordered.map((item, index) => ({ ...item, order: index, parentId: parentId })));
                }
                const touched = new Set([oldKey, newKey]);
                const categories = remaining.filter(item => !touched.has(`${item.workspaceId}\u0000${item.parentId ?? ''}`));
                for (const key of touched)
                    categories.push(...(groups.get(key) ?? []));
                return this.changed(category.workspaceId, { ...document, categories });
            }));
        }
        /** Reorder a category among current siblings. */
        reorderCategory(request) {
            return this.enqueue(() => this.mutate(request.expectedRevision, document => {
                const category = document.categories.find(item => item.id === request.categoryId);
                if (category === undefined)
                    return reject({ code: 'category-not-found', categoryId: request.categoryId });
                const siblings = document.categories.filter(item => item.workspaceId === category.workspaceId && item.parentId === category.parentId).sort((a, b) => a.order - b.order);
                if (request.beforeCategoryId !== undefined && !siblings.some(item => item.id === request.beforeCategoryId))
                    return reject({ code: 'anchor-not-found', anchorId: request.beforeCategoryId });
                const ids = insertBefore(siblings.map(item => item.id), category.id, request.beforeCategoryId);
                if (ids.every((id, index) => id === siblings[index]?.id))
                    return this.noop(category.workspaceId, document);
                const order = new Map(ids.map((id, index) => [id, index]));
                return this.changed(category.workspaceId, { ...document, categories: document.categories.map(item => order.has(item.id) ? { ...item, order: order.get(item.id) } : item) });
            }));
        }
        /** Assign or clear one Session. */
        assignSession(request) {
            return this.moveSessions({ ...request, sessionIds: [request.sessionId] });
        }
        /** Assign or clear multiple Sessions. */
        moveSessions(request) {
            return this.enqueue(() => this.mutate(request.expectedRevision, document => {
                let category;
                if (request.categoryId !== null) {
                    category = document.categories.find(item => item.id === request.categoryId);
                    if (category === undefined)
                        return reject({ code: 'category-not-found', categoryId: request.categoryId });
                }
                const targetWorkspace = category === undefined ? undefined : this.ctx.workspaceRegistry.get(category.workspaceId);
                if (category !== undefined && targetWorkspace === undefined)
                    return reject({ code: 'workspace-not-found', workspaceId: category.workspaceId });
                if (category !== undefined)
                    for (const sessionId of request.sessionIds)
                        if (!targetWorkspace.sessionIds.includes(sessionId))
                            return reject({ code: 'session-not-in-workspace', sessionId });
                const assignments = request.sessionIds.reduce((items, sessionId) => {
                    const without = items.filter(item => item.sessionId !== sessionId);
                    return category === undefined ? without : [...without, { sessionId, categoryId: category.id }];
                }, [...document.assignments]);
                const workspaceId = category?.workspaceId ?? this.workspaceForSession(request.sessionIds[0]);
                if (assignments.length === document.assignments.length && assignments.every((item, index) => item.sessionId === document.assignments[index]?.sessionId && item.categoryId === document.assignments[index]?.categoryId)) {
                    return workspaceId === undefined ? reject({ code: 'session-not-in-workspace', sessionId: request.sessionIds[0] }) : this.noop(workspaceId, document);
                }
                return this.changed(workspaceId ?? '', { ...document, assignments });
            }));
        }
        /** Recursively remove a category after archiving its assigned Sessions. */
        deleteCategory(request) {
            return this.enqueue(async () => {
                const current = this.requireGlobal().get();
                const pending = current.pendingArchive.find(item => item.operationId === request.operationId);
                if (pending === undefined && current.revision !== request.expectedRevision) {
                    return reject({ code: 'revision-conflict', revision: current.revision });
                }
                if (pending === undefined) {
                    const target = current.categories.find(item => item.id === request.categoryId);
                    if (target === undefined)
                        return success({ revision: current.revision, categories: [], assignments: [] });
                    const categoryIds = this.descendants(current.categories, target.id);
                    const categorySet = new Set(categoryIds);
                    const sessionIds = [...new Set(current.assignments.filter(item => categorySet.has(item.categoryId)).map(item => item.sessionId))];
                    const nextPending = { operationId: request.operationId, categoryIds, sessionIds };
                    await this.requireGlobal().set({ ...current, revision: current.revision + 1, pendingArchive: [...current.pendingArchive, nextPending] });
                    return this.finishArchive(nextPending);
                }
                return this.finishArchive(pending);
            });
        }
        /** Current full document for invariant companions. */
        snapshotAll() { return this.requireGlobal().get(); }
        enqueue(operation) {
            const result = this.operationTail.then(operation, operation);
            this.operationTail = result.then(() => undefined, () => undefined);
            return result;
        }
        mutate(expectedRevision, operation) {
            const current = this.requireGlobal().get();
            if (current.revision !== expectedRevision)
                return Promise.resolve(reject({ code: 'revision-conflict', revision: current.revision }));
            const pruned = this.prune(current);
            const result = operation(pruned);
            if ('ok' in result)
                return Promise.resolve(result);
            if (!result.material && pruned === current)
                return Promise.resolve(success(this.snapshot(result.workspaceId)));
            return this.requireGlobal().set({ ...result.document, revision: current.revision + 1 }).then(() => {
                return success(this.snapshot(result.workspaceId));
            });
        }
        changed(workspaceId, document) {
            return { document, workspaceId: workspaceId, material: true };
        }
        noop(workspaceId, document) {
            return { document, workspaceId, material: false };
        }
        prune(document) {
            const categories = new Set(document.categories.map(category => category.id));
            const workspaces = this.ctx.workspaceRegistry;
            const archived = new Set(workspaces.archivedSessionIds ?? []);
            const assignments = document.assignments.filter(assignment => {
                if (!categories.has(assignment.categoryId) || archived.has(assignment.sessionId))
                    return false;
                const category = document.categories.find(item => item.id === assignment.categoryId);
                const workspace = category === undefined ? undefined : workspaces.get(category.workspaceId);
                return workspace?.sessionIds.includes(assignment.sessionId) ?? false;
            });
            return assignments.length === document.assignments.length ? document : { ...document, assignments };
        }
        snapshot(workspaceId) {
            const document = this.requireGlobal().get();
            const categories = document.categories.filter(category => category.workspaceId === workspaceId);
            const ids = new Set(categories.map(category => category.id));
            return { revision: document.revision, categories, assignments: document.assignments.filter(assignment => ids.has(assignment.categoryId)) };
        }
        workspaceForSession(sessionId) {
            if (sessionId === undefined)
                return undefined;
            const list = this.ctx.workspaceRegistry.list?.() ?? [];
            return list.find(workspace => workspace.sessionIds.includes(sessionId))?.id;
        }
        descendants(categories, root) {
            const result = [];
            const queue = [root];
            while (queue.length > 0) {
                const id = queue.shift();
                result.push(id);
                for (const category of categories)
                    if (category.parentId === id)
                        queue.push(category.id);
            }
            return result;
        }
        async finishArchive(pending) {
            for (const sessionId of pending.sessionIds) {
                try {
                    await this.ctx.workspaceRegistry.archiveSession(sessionId);
                }
                catch (error) {
                    if (error instanceof WorkspaceUnknownSessionError)
                        continue;
                    return reject({ code: 'archive-failed', operationId: pending.operationId });
                }
            }
            const current = this.requireGlobal().get();
            const removed = new Set(pending.categoryIds);
            const workspaceId = current.categories.find(item => removed.has(item.id))?.workspaceId;
            const remaining = current.categories.filter(item => !removed.has(item.id));
            const categories = this.normalizeOrders(remaining);
            const assignments = current.assignments.filter(item => !removed.has(item.categoryId));
            const nextPending = current.pendingArchive.filter(item => item.operationId !== pending.operationId);
            await this.requireGlobal().set({ ...current, revision: current.revision + 1, categories, assignments, pendingArchive: nextPending });
            return success(this.snapshot(workspaceId ?? ''));
        }
        normalizeOrders(categories) {
            const groups = new Map();
            for (const category of categories) {
                const key = `${category.workspaceId}\u0000${category.parentId ?? ''}`;
                const group = groups.get(key) ?? [];
                group.push(category);
                groups.set(key, group);
            }
            const normalized = [];
            for (const group of groups.values()) {
                group.sort((left, right) => left.order - right.order);
                normalized.push(...group.map((category, order) => ({ ...category, order })));
            }
            return normalized;
        }
        async recoverPending() {
            for (const pending of this.requireGlobal().get().pendingArchive) {
                try {
                    const result = await this.finishArchive(pending);
                    if (!result.ok)
                        this.ctx.logger?.warn?.(`session category archive recovery failed for ${pending.operationId}`);
                }
                catch (error) {
                    this.ctx.logger?.warn?.(`session category archive recovery failed for ${pending.operationId}`, error);
                }
            }
        }
        requireGlobal() {
            if (this.global === undefined)
                throw new Error('session categories service is not initialized');
            return this.global;
        }
    };
})();
export { SessionCategoriesService };
/** Cordis namespace-import entry for source loaders that retain the module wrapper. */
export const apply = SessionCategoriesService;
/** Services required before the category service is initialized. */
export const inject = SessionCategoriesService.inject;
//# sourceMappingURL=index.js.map