/** Package-owned invariant companion. @module @deepseek-ai/dsh-session-categories/invariant */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'
import type { DomainChanged } from '@deepseek-ai/dsh-storage-domain'
import { sessionCategoryDocumentSchema } from './spec.ts'

const PACKAGE_NAME = '@deepseek-ai/dsh-session-categories'

/** Cordis companion plugin name. */
export const name = 'session-categories-invariant'
/** Services required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * The service is the only owner of category writes. Every global domain event
 * must therefore agree with the service's immediately authoritative snapshot.
 */
const install: InvariantInstaller = Object.assign(
  (ctx: Context, fail: (message: string) => never) => {
    ctx.on('domain/changed', (change: DomainChanged) => {
      if (change.domain !== 'session_categories' || change.table !== '') return
      const value = sessionCategoryDocumentSchema.parse(change.value)
      const current = ctx.sessionCategories.snapshotAll()
      if (value.revision !== current.revision || JSON.stringify(value) !== JSON.stringify(current)) {
        fail('session category domain event diverges from ctx.sessionCategories.snapshotAll()')
      }
    })
  },
  { inject: ['sessionCategories'] },
)

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
