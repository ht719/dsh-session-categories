import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import { apply as applyGateway, inject as gatewayInject } from '@deepseek-ai/dsh-api-gateway/client'
import TypertRegistry from '@deepseek-ai/dsh-typert-registry'
import sessionCategoriesRemote from '@deepseek-ai/dsh-session-categories/remote'

describe('session categories generated Remote contribution', () => {
  it('mounts directly through the Client gateway and withdraws on unload', async () => {
    const call = vi.fn<ConnectionHandle['rpc']['call']>().mockResolvedValue({
      ok: true,
      value: { ok: true, value: { revision: 4, categories: [], assignments: [] } },
    })
    const ctx = new Context()
    try {
      await ctx.plugin(TypertRegistry).await()
      ctx.provide('connection', { rpc: { call } } as unknown as ConnectionHandle)
      await ctx.plugin({ inject: gatewayInject, apply: applyGateway }).await()

      const contribution = ctx.plugin(Object.assign(
        (scope: Context) => scope.remote.$mount(sessionCategoriesRemote),
        { inject: ['remote'] },
      ))
      await contribution.await()

      await expect(ctx.remote.sessionCategories.get({ workspaceId: 'workspace-1' as never }))
        .resolves.toEqual({
          ok: true,
          value: { ok: true, value: { revision: 4, categories: [], assignments: [] } },
        })
      expect(call).toHaveBeenCalledWith(
        '/api',
        'sessionCategories/get',
        { args: { request: { workspaceId: 'workspace-1' } } },
        expect.any(AbortSignal),
      )

      await contribution.dispose()
      expect((ctx.remote as unknown as Record<string, unknown>).sessionCategories).toBeUndefined()
      expect(ctx.typert.remotes.list()).toHaveLength(0)
    } finally {
      await ctx.fiber.dispose()
    }
  })
})
