// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { bindSnapshotSelector } from '@deepseek-ai/dsh-client-web-react'
import type { SessionId, SessionListState, SessionSummary, WorkspaceId, WorkspaceListState, WorkspaceView } from '@deepseek-ai/dsh-client-runtime/client'
import type { SessionCategoryId, SessionCategoryOperationId } from '@deepseek-ai/dsh-session-categories/types'
import type { SessionCategoriesView } from '../src/client/controller.ts'
import type { WorkspaceBrowserProps } from '../src/client/contract/slots.ts'
import { createWorkspaceViewStore } from '../src/client/stores.ts'
import { WorkspaceBrowser } from '../src/client/WorkspaceBrowser.tsx'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import { zh } from '../src/client/locales.ts'

afterEach(cleanup)
beforeEach(() => { localStorage.clear() })
const wid = (id: string) => id as WorkspaceId
const sid = (id: string) => id as SessionId
const cid = (id: string) => id as SessionCategoryId
const oid = (id: string) => id as SessionCategoryOperationId
const workspace: WorkspaceView = {
  workspaceId: wid('one'), path: '/one', title: 'One', sessionIds: [],
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
}
const sessions: SessionListState = {
  ids: [], byId: {}, current: undefined, currentAddress: undefined, phase: 'ready',
  subagentsByParent: {}, jobsBySession: {},
}
const workspaces: WorkspaceListState = {
  items: [workspace], archivedSessionIds: [], state: 'idle', phase: 'ready', error: null,
  baselinesReady: true, recentWorkspaceId: workspace.workspaceId,
}
function hook<T>(snapshot: T) { return <S,>(selector: (state: T) => S): S => selector(snapshot) }
const t: WorkspaceBrowserProps['t'] = makeTranslate(zh, commonZh)

const categorySessions = ['s-1', 's-2', 's-3'].map((id): SessionSummary => ({
  id: sid(id), displayTitle: id, running: false, blank: false, updatedAt: 0,
}))
const populatedSessions: SessionListState = {
  ...sessions,
  ids: categorySessions.map(session => session.id),
  byId: Object.fromEntries(categorySessions.map(session => [session.id, session])),
}
const populatedWorkspace: WorkspaceView = {
  ...workspace,
  sessionIds: categorySessions.map(session => session.id),
}
const populatedWorkspaces: WorkspaceListState = { ...workspaces, items: [populatedWorkspace] }
const categorySnapshot = {
  revision: 1,
  categories: [
    { id: cid('root'), workspaceId: wid('one'), parentId: null, title: 'Research', order: 0 },
    { id: cid('child'), workspaceId: wid('one'), parentId: cid('root'), title: 'Notes', order: 0 },
    { id: cid('grandchild'), workspaceId: wid('one'), parentId: cid('child'), title: 'Drafts', order: 0 },
  ],
  assignments: [
    { sessionId: sid('s-1'), categoryId: cid('root') },
    { sessionId: sid('s-2'), categoryId: cid('child') },
    { sessionId: sid('s-3'), categoryId: cid('grandchild') },
  ],
}

function mount(categories: SessionCategoriesView, overrides: Partial<WorkspaceBrowserProps> = {}) {
  const store = createWorkspaceViewStore().create()
  const props: WorkspaceBrowserProps = {
    wide: true, expandSidebar: vi.fn(), useSessions: hook(sessions), useWorkspaces: hook(workspaces),
    useStore: bindSnapshotSelector(store), actions: store.actions,
    useCategories: hook(categories), ensureCategories: vi.fn(async () => ({ ok: true })),
    createCategory: vi.fn(async () => ({ ok: true })), renameCategory: vi.fn(async () => ({ ok: true })),
    moveCategory: vi.fn(async () => ({ ok: true })), reorderCategory: vi.fn(async () => ({ ok: true })),
    assignSessions: vi.fn(async () => ({ ok: true })), deleteCategory: vi.fn(async () => ({ ok: true })),
    startSession: vi.fn(), open: vi.fn(), searchSessions: vi.fn(async () => ({ items: [], hasMore: false })),
    searchResultLimit: 20, renameSession: vi.fn(async () => {}), forkSession: vi.fn(),
    renameWorkspace: vi.fn(async () => {}), deleteWorkspace: vi.fn(async () => {}),
    insertWorkspaceBefore: vi.fn(async () => {}), archiveSession: vi.fn(async () => {}),
    insertSessionBefore: vi.fn(async () => {}), createWorkspace: vi.fn(async () => workspace),
    useDirectoryFlow: hook(true), renderSlot: (() => null) as never, t, ...overrides,
  }
  return { props, ...render(<WorkspaceBrowser {...props} />) }
}

describe('category browser', () => {
  it('shows loading and a retryable category load error', () => {
    const loading = mount({ status: 'loading', snapshots: {}, error: null })
    expect(screen.getByText('正在加载分类…')).toBeTruthy()
    loading.unmount()
    const ensureCategories = vi.fn(async () => ({ ok: true as const }))
    mount({ status: 'error', snapshots: {}, error: 'offline' }, { ensureCategories })
    expect(screen.getByText('无法加载分类')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '重试' }))
    expect(ensureCategories).toHaveBeenCalledWith(wid('one'))
  })

  it('creates a root category from the workspace menu', async () => {
    const createCategory = vi.fn(async () => ({ ok: true as const }))
    mount({ status: 'ready', snapshots: { one: { revision: 0, categories: [], assignments: [] } }, error: null },
      { createCategory })
    fireEvent.click(screen.getByText('One'))
    fireEvent.click(screen.getByRole('button', { name: '工作区“One”的操作' }))
    fireEvent.click(screen.getByRole('menuitem', { name: '新建分类' }))
    const input = screen.getByRole('textbox', { name: '分类名称' })
    fireEvent.change(input, { target: { value: 'Research' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => {
      expect(createCategory).toHaveBeenCalledWith(wid('one'), null, 'Research')
    })
  })

  it('makes a session already in a category draggable to another category', () => {
    mount({ status: 'ready', snapshots: { one: categorySnapshot }, error: null }, {
      useSessions: hook(populatedSessions), useWorkspaces: hook(populatedWorkspaces),
    })
    fireEvent.click(screen.getByRole('treeitem', { name: 'One' }))
    fireEvent.click(screen.getByRole('treeitem', { name: 'Research' }))
    const session = screen.getByRole('treeitem', { name: /s-1/ })
    const setData = vi.fn()

    expect(session.getAttribute('draggable')).toBe('true')
    fireEvent.dragStart(session, { dataTransfer: { effectAllowed: '', setData } })
    expect(setData).toHaveBeenCalledWith(
      'application/x-dsh-session-category',
      JSON.stringify({ kind: 'session', workspaceId: 'one', sessionIds: ['s-1'] }),
    )
  })

  it('assigns the session started from a category plus back to that category', async () => {
    const startSession = vi.fn()
    const assignSessions = vi.fn(async () => ({ ok: true as const }))
    const session = { ...categorySessions[0]!, blank: true }
    mount({ status: 'ready', snapshots: {
      one: { revision: 1, categories: [{ id: cid('root'), workspaceId: wid('one'), parentId: null, title: 'Research', order: 0 }], assignments: [] },
    }, error: null }, {
      useSessions: hook({ ...populatedSessions, ids: [session.id], byId: { [session.id]: session }, current: session.id }),
      useWorkspaces: hook({ ...populatedWorkspaces, items: [{ ...populatedWorkspace, sessionIds: [session.id] }] }),
      startSession, assignSessions,
    })
    await waitFor(() => { expect(screen.getByRole('treeitem', { name: 'Research' })).toBeTruthy() })
    fireEvent.click(screen.getByRole('treeitem', { name: 'Research' }))
    fireEvent.click(screen.getByRole('button', { name: '在“Research”中新建会话' }))
    await waitFor(() => {
      expect(startSession).toHaveBeenCalledWith(wid('one'))
      expect(assignSessions).toHaveBeenCalledWith(wid('one'), [session.id], cid('root'))
    })
  })

  it('projects expanded categories as nested containers with indented session children', () => {
    mount({ status: 'ready', snapshots: { one: categorySnapshot }, error: null }, {
      useSessions: hook(populatedSessions), useWorkspaces: hook(populatedWorkspaces),
    })
    fireEvent.click(screen.getByRole('treeitem', { name: 'One' }))
    const root = screen.getByRole('treeitem', { name: 'Research' })
    fireEvent.click(root)

    expect(root.parentElement?.getAttribute('data-category-container')).toBe('expanded')
    expect(screen.getByRole('treeitem', { name: /s-1/ }).style.getPropertyValue('--category-depth')).toBe('1')

    const child = screen.getByRole('treeitem', { name: 'Notes' })
    fireEvent.click(child)
    expect(child.parentElement?.getAttribute('data-category-container')).toBe('expanded')
    expect(screen.getByRole('treeitem', { name: /s-2/ }).style.getPropertyValue('--category-depth')).toBe('2')
  })

  it('delete category explains recursive archive counts and cancellation', async () => {
    const deleteCategory = vi.fn(async () => ({ ok: true as const }))
    const randomUUID = vi.spyOn(globalThis.crypto, 'randomUUID')
      .mockReturnValueOnce('operation-1').mockReturnValueOnce('operation-2')
    mount({ status: 'ready', snapshots: { one: categorySnapshot }, error: null }, {
      useSessions: hook(populatedSessions), useWorkspaces: hook(populatedWorkspaces), deleteCategory,
    })
    fireEvent.click(screen.getByText('One'))
    fireEvent.click(screen.getByRole('button', { name: '分类“Research”的操作' }))
    fireEvent.click(screen.getByRole('menuitem', { name: '删除分类' }))

    expect(screen.getByRole('dialog', { name: '删除分类' })).toBeTruthy()
    expect(screen.getByText(/“Research”/)).toBeTruthy()
    expect(screen.getByText(/2 个子分类/)).toBeTruthy()
    expect(screen.getByText(/3 个会话/)).toBeTruthy()
    expect(screen.getByText(/会话将归档，日志不会永久删除/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    expect(screen.queryByRole('dialog', { name: '删除分类' })).toBeNull()
    expect(deleteCategory).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: '分类“Research”的操作' }))
    fireEvent.click(screen.getByRole('menuitem', { name: '删除分类' }))
    expect(randomUUID).toHaveBeenCalledTimes(2)
    fireEvent.click(screen.getByRole('button', { name: '删除分类' }))
    await waitFor(() => {
      expect(deleteCategory).toHaveBeenCalledWith(cid('root'), oid('operation-2'))
    })
    randomUUID.mockRestore()
  })

  it('delete category prevents duplicate submits and retries a failure with the same operation id', async () => {
    let settleFirst: ((value: { ok: false; error: { code: string; message: string } }) => void) | undefined
    const deleteCategory = vi.fn()
      .mockImplementationOnce(() => new Promise(resolve => { settleFirst = resolve }))
      .mockResolvedValueOnce({ ok: true as const })
    const randomUUID = vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('operation-1')
    mount({ status: 'ready', snapshots: { one: categorySnapshot }, error: null }, {
      useSessions: hook(populatedSessions), useWorkspaces: hook(populatedWorkspaces), deleteCategory,
    })
    fireEvent.click(screen.getByText('One'))
    fireEvent.click(screen.getByRole('button', { name: '分类“Research”的操作' }))
    fireEvent.click(screen.getByRole('menuitem', { name: '删除分类' }))

    const confirm = screen.getByRole('button', { name: '删除分类' })
    fireEvent.click(confirm)
    fireEvent.click(confirm)
    expect(deleteCategory).toHaveBeenCalledOnce()
    expect(deleteCategory).toHaveBeenCalledWith(cid('root'), oid('operation-1'))
    expect((confirm as HTMLButtonElement).disabled).toBe(true)
    settleFirst?.({ ok: false, error: { code: 'archive-failed', message: 'archive unavailable' } })
    await screen.findByRole('alert')
    expect(screen.getByRole('alert').textContent).toBe('archive unavailable')

    fireEvent.click(screen.getByRole('button', { name: '删除分类' }))
    await waitFor(() => { expect(deleteCategory).toHaveBeenCalledTimes(2) })
    expect(deleteCategory).toHaveBeenLastCalledWith(cid('root'), oid('operation-1'))
    await waitFor(() => { expect(screen.queryByRole('dialog', { name: '删除分类' })).toBeNull() })
    expect(randomUUID).toHaveBeenCalledOnce()
    randomUUID.mockRestore()
  })
})
