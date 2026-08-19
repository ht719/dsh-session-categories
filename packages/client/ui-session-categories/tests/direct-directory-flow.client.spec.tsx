// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import type { DirectoryFlowOwnerProps } from '../src/client/contract/slots.ts'
import { DirectDirectoryFlow } from '../src/client/DirectDirectoryFlow.tsx'

afterEach(cleanup)

function owner(overrides: Partial<DirectoryFlowOwnerProps> = {}): DirectoryFlowOwnerProps {
  return {
    open: true,
    busy: false,
    onPicked: vi.fn(),
    onCancel: vi.fn(),
    onError: vi.fn(),
    ...overrides,
  }
}

describe('DirectDirectoryFlow', () => {
  it('runs one chooser per open edge and reports its outcome', async () => {
    const first = owner()
    const pick = vi.fn(async () => '/tmp/picked')
    const view = render(<DirectDirectoryFlow {...first} pick={pick} />)
    await act(async () => {})
    expect(pick).toHaveBeenCalledOnce()
    expect(first.onPicked).toHaveBeenCalledWith('/tmp/picked')

    view.rerender(<DirectDirectoryFlow {...first} pick={pick} />)
    await act(async () => {})
    expect(pick).toHaveBeenCalledOnce()

    view.rerender(<DirectDirectoryFlow {...first} open={false} pick={pick} />)
    view.rerender(<DirectDirectoryFlow {...first} open pick={pick} />)
    await act(async () => {})
    expect(pick).toHaveBeenCalledTimes(2)
  })

  it('reports cancellation and failures through the latest owner callbacks', async () => {
    const cancelled = owner()
    const cancelView = render(<DirectDirectoryFlow {...cancelled} pick={async () => null} />)
    await act(async () => {})
    expect(cancelled.onCancel).toHaveBeenCalledOnce()
    cancelView.unmount()

    const failed = owner()
    render(<DirectDirectoryFlow {...failed} pick={async () => { throw new Error('chooser failed') }} />)
    await act(async () => {})
    expect(failed.onError).toHaveBeenCalledWith('chooser failed')
  })

  it('drops a chooser settlement after unmount', async () => {
    let settle: ((path: string | null) => void) | undefined
    const picked = owner()
    const view = render(<DirectDirectoryFlow
      {...picked}
      pick={() => new Promise(resolve => { settle = resolve })}
    />)
    await act(async () => {})
    view.unmount()
    await act(async () => { settle?.('/tmp/late') })
    expect(picked.onPicked).not.toHaveBeenCalled()
  })
})
