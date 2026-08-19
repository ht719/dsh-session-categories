import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import * as yaml from 'js-yaml'

const root = resolve(import.meta.dirname, '..')

interface PackageManifest {
  name: string
  dependencies?: Record<string, string>
  dsh?: {
    bundle?: { patch?: string }
    client?: { platform?: string }
  }
  exports?: Record<string, unknown>
  files?: string[]
}

describe('single-package publishing contract', () => {
  it('ships the Host, Client, and profile patch under one package id', async () => {
    const manifest = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8')) as PackageManifest
    const patch = yaml.load(await readFile(resolve(root, 'cordis.patch.yml'), 'utf8')) as Array<{
      insert: Array<{ id: string; name: string }>
    }>

    expect(manifest.name).toBe('@deepseek-ai/dsh-session-categories')
    expect(manifest.dsh).toMatchObject({
      bundle: { patch: './cordis.patch.yml' },
      client: { platform: 'web' },
    })
    expect(manifest.exports?.['./client']).toBeDefined()
    expect(manifest.files).toEqual(expect.arrayContaining(['lib/client.js', 'cordis.patch.yml']))
    expect(manifest.files).toContain('lib/spec.js')
    expect(patch).toEqual([{
      insert: [{ id: 'session-categories', name: '@deepseek-ai/dsh-session-categories' }],
    }])
  })

  it('ships the runtime spec entry imported by the Host bundle', async () => {
    const entry = await readFile(resolve(root, 'lib/index.js'), 'utf8')
    expect(entry).toContain("from \"./spec.js\"")
    await expect(import(resolve(root, 'lib/spec.js'))).resolves.toHaveProperty('sessionCategoriesDomainSpec')
  })

  it('does not publish dependencies on development-only category packages', async () => {
    const manifest = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8')) as PackageManifest
    expect(manifest.dependencies).not.toHaveProperty('@deepseek-ai/dsh-client-ui-session-categories')
    expect(manifest.dependencies).not.toHaveProperty('@deepseek-ai/dsh-session-categories-bundle')
  })

  it('does not publish workspace protocol references', async () => {
    const manifest = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8')) as PackageManifest & {
      peerDependencies?: Record<string, string>
    }
    for (const version of Object.values(manifest.peerDependencies ?? {})) {
      expect(version).not.toMatch(/^workspace:/)
    }
  })
})
