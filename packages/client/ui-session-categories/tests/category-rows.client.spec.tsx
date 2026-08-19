// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, createEvent, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { SessionId, WorkspaceId } from '@deepseek-ai/dsh-client-runtime/client'
import type { SessionCategoryId } from '@deepseek-ai/dsh-session-categories/types'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import { CategoryRowItem, SessionNodeItem } from '../src/client/rows/Rows.tsx'
import type { CategoryNode, SessionNode } from '../src/client/tree.ts'
import { zh } from '../src/client/locales.ts'

afterEach(cleanup)

const t = makeTranslate(zh, commonZh) as never
const cid = (id: string) => id as SessionCategoryId
const sid = (id: string) => id as SessionId
const wid = (id: string) => id as WorkspaceId
const node: CategoryNode = {
  id: cid('research'), title: 'Research', expanded: false, containsCurrent: false,
  sessionCount: 0, sessions: [], children: [],
}

function transfer(payload?: string) {
  const values = new Map<string, string>()
  if (payload !== undefined) values.set('application/x-dsh-session-category', payload)
  return {
    effectAllowed: '', dropEffect: '',
    types: [...values.keys()],
    setData: vi.fn((type: string, value: string) => { values.set(type, value) }),
    getData: vi.fn((type: string) => values.get(type) ?? ''),
  }
}

describe('category rows', () => {
  it('expands and renames a fixed-height category row', () => {
    const onToggle = vi.fn()
    const onRename = vi.fn(async () => ({ ok: true as const }))
    render(<CategoryRowItem node={node} workspaceId={wid('one')} depth={0}
      categoryOptions={[{ id: node.id, title: node.title, depth: 0 }]} invalidMoveTargetIds={[node.id]}
      invalidCategorySourceIds={[node.id]}
      onToggle={onToggle} onCreate={vi.fn()}
      onRename={onRename} onMove={vi.fn()} onDropPayload={vi.fn()} t={t} />)

    const row = screen.getByRole('treeitem', { name: /Research/ })
    expect(row.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(row)
    expect(onToggle).toHaveBeenCalledOnce()

    fireEvent.click(screen.getByRole('button', { name: '分类“Research”的操作' }))
    fireEvent.click(screen.getByRole('menuitem', { name: '重命名' }))
    const input = screen.getByRole('textbox', { name: '分类名称' })
    fireEvent.change(input, { target: { value: 'Ideas' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onRename).toHaveBeenCalledWith(node.id, 'Ideas')
  })

  it('publishes typed category drag data and rejects foreign or descendant drops', () => {
    const onDropPayload = vi.fn()
    const view = render(<CategoryRowItem node={node} workspaceId={wid('one')} depth={1}
      categoryOptions={[{ id: node.id, title: node.title, depth: 0 }, { id: cid('parent'), title: 'Parent', depth: 0 }]}
      invalidMoveTargetIds={[node.id]}
      invalidCategorySourceIds={[node.id, cid('parent') ]}
      onToggle={vi.fn()} onCreate={vi.fn()} onRename={vi.fn()} onMove={vi.fn()}
      onDropPayload={onDropPayload} t={t} />)
    const row = screen.getByRole('treeitem', { name: /Research/ })
    const ownTransfer = transfer()
    fireEvent.dragStart(row, { dataTransfer: ownTransfer })
    expect(ownTransfer.setData).toHaveBeenCalledWith(
      'application/x-dsh-session-category',
      JSON.stringify({ kind: 'category', workspaceId: 'one', categoryId: 'research' }),
    )

    const foreign = transfer(JSON.stringify({ kind: 'session', workspaceId: 'two', sessionIds: ['s'] }))
    fireEvent.drop(row, { dataTransfer: foreign })
    const descendant = transfer(JSON.stringify({ kind: 'category', workspaceId: 'one', categoryId: 'parent' }))
    fireEvent.drop(row, { dataTransfer: descendant })
    expect(onDropPayload).not.toHaveBeenCalled()

    const local = transfer(JSON.stringify({ kind: 'session', workspaceId: 'one', sessionIds: ['s'] }))
    fireEvent.drop(row, { dataTransfer: local })
    expect(onDropPayload).toHaveBeenCalledWith(
      { kind: 'session', workspaceId: wid('one'), sessionIds: [sid('s')] }, node.id,
    )
  })

  it('accepts a protected dragover by MIME type and reads the payload on drop', () => {
    const onDropPayload = vi.fn()
    render(<CategoryRowItem node={node} workspaceId={wid('one')} depth={0}
      categoryOptions={[{ id: node.id, title: node.title, depth: 0 }]}
      invalidMoveTargetIds={[node.id]} invalidCategorySourceIds={[node.id]}
      onToggle={vi.fn()} onCreate={vi.fn()} onRename={vi.fn()} onMove={vi.fn()}
      onDelete={vi.fn()} onDropPayload={onDropPayload} t={t} />)
    const row = screen.getByRole('treeitem', { name: /Research/ })
    const protectedTransfer = {
      effectAllowed: '', dropEffect: '', types: ['application/x-dsh-session-category'],
      getData: vi.fn(() => ''),
    }
    const dragOver = createEvent.dragOver(row, { dataTransfer: protectedTransfer })

    fireEvent(row, dragOver)
    expect(dragOver.defaultPrevented).toBe(true)
    expect(protectedTransfer.getData).not.toHaveBeenCalled()
    expect(row.getAttribute('data-category-drop-target')).toBe('true')

    fireEvent.dragLeave(row, { relatedTarget: document.body })
    expect(row.getAttribute('data-category-drop-target')).toBeNull()

    const dropped = transfer(JSON.stringify({ kind: 'session', workspaceId: 'one', sessionIds: ['s'] }))
    fireEvent.dragOver(row, { dataTransfer: protectedTransfer })
    fireEvent.drop(row, { dataTransfer: dropped })
    expect(onDropPayload).toHaveBeenCalledWith(
      { kind: 'session', workspaceId: wid('one'), sessionIds: [sid('s')] }, node.id,
    )
    expect(row.getAttribute('data-category-drop-target')).toBeNull()
  })

  it('offers the current workspace categories and unclassified in a session menu', () => {
    const session: SessionNode = {
      id: sid('session'), title: 'Session', blank: false, running: false,
      runningSubagentCount: 0, completed: false, updatedAt: 0,
    }
    const onMove = vi.fn()
    render(<SessionNodeItem node={session} currentId={undefined} now={0} onOpen={vi.fn()}
      onRename={vi.fn()} onFork={vi.fn()} onArchive={vi.fn()} t={t}
      categoryMove={{ categories: [{ id: cid('research'), title: 'Research', depth: 0 }], onMove }} />)
    fireEvent.click(screen.getByRole('button', { name: '会话“Session”的操作' }))
    fireEvent.mouseEnter(screen.getByRole('menuitem', { name: '移动到分类…' }).parentElement!)
    expect(screen.getByRole('menuitem', { name: '未分类' })).toBeTruthy()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Research' }))
    expect(onMove).toHaveBeenCalledWith(cid('research'))
  })

  it('names the category move root separately from unclassified sessions', () => {
    render(<CategoryRowItem node={node} workspaceId={wid('one')} depth={0}
      categoryOptions={[{ id: node.id, title: node.title, depth: 0 }]} invalidMoveTargetIds={[node.id]}
      invalidCategorySourceIds={[node.id]} onToggle={vi.fn()} onCreate={vi.fn()}
      onRename={vi.fn()} onMove={vi.fn()} onDropPayload={vi.fn()} t={t} />)
    fireEvent.click(screen.getByRole('button', { name: '分类“Research”的操作' }))
    fireEvent.mouseEnter(screen.getByRole('menuitem', { name: '移动到分类…' }).parentElement!)
    expect(screen.getByRole('menuitem', { name: '分类根目录' })).toBeTruthy()
    expect(screen.queryByRole('menuitem', { name: '未分类' })).toBeNull()
  })

  it('uses the category plus for a session, keeps new category in the menu, and icons the move entry', () => {
    const onCreateSession = vi.fn()
    const onCreateCategory = vi.fn()
    render(<CategoryRowItem node={node} workspaceId={wid('one')} depth={0}
      categoryOptions={[{ id: node.id, title: node.title, depth: 0 }]} invalidMoveTargetIds={[node.id]}
      invalidCategorySourceIds={[node.id]} onToggle={vi.fn()} onCreate={onCreateSession}
      onCreateCategory={onCreateCategory} onRename={vi.fn()} onMove={vi.fn()} onDelete={vi.fn()}
      onDropPayload={vi.fn()} t={t} />)

    fireEvent.click(screen.getByRole('button', { name: '在“Research”中新建会话' }))
    expect(onCreateSession).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: '分类“Research”的操作' }))
    expect(screen.getByRole('menuitem', { name: '移动到分类…' }).querySelector('svg')).toBeTruthy()
    fireEvent.mouseEnter(screen.getByRole('menuitem', { name: '移动到分类…' }).parentElement!)
    expect(screen.getByRole('menuitem', { name: '分类根目录' }).querySelector('svg')).toBeTruthy()
    fireEvent.click(screen.getByRole('menuitem', { name: '新建子分类' }))
    expect(onCreateCategory).toHaveBeenCalledWith(node.id)
  })

  it('keeps a rejected category move actionable and surfaces its error', async () => {
    const onMove = vi.fn(async () => { throw new Error('move rejected') })
    render(<CategoryRowItem node={node} workspaceId={wid('one')} depth={0}
      categoryOptions={[{ id: node.id, title: node.title, depth: 0 }]} invalidMoveTargetIds={[node.id]}
      invalidCategorySourceIds={[node.id]} onToggle={vi.fn()} onCreate={vi.fn()}
      onRename={vi.fn()} onMove={onMove} onDropPayload={vi.fn()} t={t} />)
    fireEvent.click(screen.getByRole('button', { name: '分类“Research”的操作' }))
    fireEvent.mouseEnter(screen.getByRole('menuitem', { name: '移动到分类…' }).parentElement!)
    fireEvent.click(screen.getByRole('menuitem', { name: '分类根目录' }))
    await waitFor(() => { expect(screen.getByRole('alert').textContent).toContain('move rejected') })
    expect(screen.getAllByRole('menu').length).toBeGreaterThan(0)
  })

  it('surfaces a rejected session category assignment without dropping the promise', async () => {
    const session: SessionNode = {
      id: sid('session'), title: 'Session', blank: false, running: false,
      runningSubagentCount: 0, completed: false, updatedAt: 0,
    }
    const onMove = vi.fn(async () => ({
      ok: false as const, error: { code: 'revision-conflict', message: 'assignment rejected' },
    }))
    render(<SessionNodeItem node={session} currentId={undefined} now={0} onOpen={vi.fn()}
      onRename={vi.fn()} onFork={vi.fn()} onArchive={vi.fn()} t={t}
      categoryMove={{ categories: [{ id: cid('research'), title: 'Research', depth: 0 }], onMove }} />)
    fireEvent.click(screen.getByRole('button', { name: '会话“Session”的操作' }))
    fireEvent.mouseEnter(screen.getByRole('menuitem', { name: '移动到分类…' }).parentElement!)
    expect(screen.getByRole('menuitem', { name: '未分类' }).querySelector('svg')).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: 'Research' }).querySelector('svg')).toBeTruthy()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Research' }))
    await waitFor(() => { expect(screen.getByRole('alert').textContent).toContain('assignment rejected') })
  })
})
