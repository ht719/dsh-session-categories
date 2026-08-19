import { clientBundle } from '../../client/tsdown.client.ts'

export default clientBundle(
  '@deepseek-ai/dsh-session-categories',
  [
    'lib/types/index.js',
    'lib/types/invariant.js',
    'lib/types/spec.js',
    'lib/types/types.js',
  ],
  {
    hostPhase: true,
    clientEntry: {
      source: '../../client/ui-session-categories/src/client/index.ts',
      built: '../../client/ui-session-categories/lib/types/client/index.js',
    },
  },
)
