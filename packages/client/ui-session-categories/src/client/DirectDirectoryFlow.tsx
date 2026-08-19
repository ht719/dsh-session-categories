/** Renderless native directory chooser used directly by the replacement browser. */
import { useEffect, useRef } from 'react'
import type { ReactElement } from 'react'
import type { DirectoryFlowOwnerProps } from './contract/slots.ts'

/** Direct chooser props owned entirely by this package. */
export interface DirectDirectoryFlowProps extends DirectoryFlowOwnerProps {
  /** Ask the Host to open its native single-directory chooser. */
  pick: () => Promise<string | null>
}

/**
 * Run one native chooser per rising `open` edge and report one outcome.
 * @param props - owner conversation and direct Host chooser callback.
 * @returns null because the Host renders the native chooser.
 */
export function DirectDirectoryFlow(props: DirectDirectoryFlowProps): ReactElement | null {
  const { open, pick } = props
  const armed = useRef(false)
  const outcome = useRef(props)
  outcome.current = props
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => { alive.current = false }
  }, [])
  useEffect(() => {
    if (!open) {
      armed.current = false
      return
    }
    if (armed.current) return
    armed.current = true
    pick().then(
      (path) => {
        if (!alive.current) return
        if (path === null) outcome.current.onCancel()
        else outcome.current.onPicked(path)
      },
      (reason: unknown) => {
        if (!alive.current) return
        outcome.current.onError(reason instanceof Error ? reason.message : String(reason))
      },
    )
  }, [open, pick])
  return null
}
