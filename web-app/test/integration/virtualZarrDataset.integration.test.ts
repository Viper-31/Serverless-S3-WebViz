import { describe, expect, it } from 'vitest'

const runOnline = process.env.RUN_ONLINE_INTEGRATION === '1' || process.env.RUN_LIVE_PAWSEY_TESTS === '1'
const runVirtualZarr = process.env.RUN_VIRTUAL_ZARR_INTEGRATION === '1'
const onlineDescribe = runOnline && runVirtualZarr ? describe : describe.skip

onlineDescribe('virtualZarrDataset integration smoke', () => {
  it('can be wired to the real zarrita stack when optional deps are available', async () => {
    let zarr: any
    let storage: any

    try {
      const zarrPackage = 'zarrita'
      const storagePackage = '@zarrita/storage'
      ;[zarr, storage] = await Promise.all([
        import(/* @vite-ignore */ zarrPackage),
        import(/* @vite-ignore */ storagePackage),
      ])
    } catch (error) {
      throw new Error('Install @zarrita/storage from Windows before enabling this integration test.')
    }

    const { createVirtualZarrDataset } = await import('../../src/lib/virtualZarrDataset')

    const dataset = await createVirtualZarrDataset({
      refSpec: {
        version: 1,
        refs: {
          '.zgroup': '{"zarr_format":2}',
          '.zattrs': '{}',
        },
      },
      dependencies: { zarr, ReferenceStore: storage.ReferenceStore },
    })

    expect(dataset.preparedRefSpec).toEqual({
      version: 1,
      refs: {
        '.zgroup': '{"zarr_format":2}',
        '.zattrs': '{}',
      },
    })
    expect(dataset.store).toBeTruthy()
    expect(dataset.root).toBeTruthy()
  })
})
