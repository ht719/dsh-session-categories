import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-session-categories-bundle'

/** Cordis companion plugin name. */
export const name = 'session-categories-bundle-invariant'
/** Invariant service required by the companion. */
export const inject = ['invariants']

/** The bundle owns no state; Host and Client packages own their contributions. */
const install: InvariantInstaller = () => {}

/** Register the bundle's empty companion invariant. */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
