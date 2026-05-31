import { describe, expect, it } from 'vitest'
import { prepareRefSpec, rewriteRefSpec } from '../../src/lib/refRewrite'

const sourceSpec = {
  version: 1,
  refs: {
    '.zgroup': '{"zarr_format":2}',
    '.zattrs': '{"title":"DPIRD"}',
    'airTemperature/.zarray': '{"shape":[192,105248],"chunks":[96,52624],"dtype":"<f8","fill_value":"NaN","order":"C","filters":[{"id":"shuffle","elementsize":8},{"id":"zlib","level":7}],"dimension_separator":".","compressor":null,"attributes":{},"zarr_format":2}',
    'airTemperature/.zattrs': '{"coordinates":"code lat lon","_ARRAY_DIMENSIONS":["station","time"]}',
    'airTemperature/0.0': ['s3://webviz/DPIRD/dpird_wa_stations.nc', 394727937, 11823953],
  },
}

describe('ref rewrite', () => {
  it('keeps the source spec untouched', () => {
    const before = JSON.stringify(sourceSpec)
    const next = rewriteRefSpec(sourceSpec)
    expect(JSON.stringify(sourceSpec)).toBe(before)
    expect(sourceSpec.refs['airTemperature/0.0'][0]).toBe('s3://webviz/DPIRD/dpird_wa_stations.nc')
    expect(next).not.toBe(sourceSpec)
  })

  it('rewrites s3://webviz refs for prepared spec only', () => {
    const prepared = prepareRefSpec(sourceSpec)
    expect(prepared.refs['airTemperature/0.0'][0]).toBe('https://projects.pawsey.org.au/webviz/DPIRD/dpird_wa_stations.nc')
    expect(sourceSpec.refs['airTemperature/0.0'][0]).toContain('s3://webviz/')
    expect(prepared.refs['airTemperature/.zarray']).toBe(sourceSpec.refs['airTemperature/.zarray'])
  })
})
