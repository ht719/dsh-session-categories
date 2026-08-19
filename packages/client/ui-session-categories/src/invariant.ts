/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-client-ui-session-categories`.
 * @module @deepseek-ai/dsh-client-ui-session-categories/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'
import type { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'

const PACKAGE_NAME = '@deepseek-ai/dsh-client-ui-session-categories'

/** Cordis companion plugin name. */
export const name = 'client-ui-session-categories-invariant'
/** Invariant registry is the only mandatory service; client ledgers are optional during headless startup. */
export const inject = ['invariants']

/**
 * The companion observes the authoritative slot ledger. Once this plugin's
 * Remote namespace and sidebar occupant exist, the occupant must be the
 * lowest-priority winner; when either side is absent there is no relation to
 * validate, which keeps unload and partial activation valid.
 */
const install: InvariantInstaller = Object.assign((ctx: Context, fail: (message: string) => never) => {
  const slots = ctx.reflect.get('slots', false) as SlotRegistry | undefined
  const remote = ctx.reflect.get('remote', false) as { readonly sessionCategories?: unknown } | undefined
  if (slots === undefined || remote === undefined) return
  const check = (): void => {
    const entries = slots.entries('sidebar.workspaces')
    const occupant = entries.find(entry => entry.registrant === PACKAGE_NAME)
    if (occupant === undefined) return
    if (remote.sessionCategories === undefined) {
      fail('sidebar.workspaces category occupant must not outlive its Remote namespace')
    }
    const winner = slots.entriesOfSlot('sidebar.workspaces')[0]
    if (winner !== occupant || (occupant.options.priority ?? 0) !== -10) {
      fail('sidebar.workspaces category occupant must be the winner at priority -10')
    }
  }
  check()
  ctx.effect(() => slots.subscribe('sidebar.workspaces', check), 'ui-session-categories: invariant ledger watch')
})

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
