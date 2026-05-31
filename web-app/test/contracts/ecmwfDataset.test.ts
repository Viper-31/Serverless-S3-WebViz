import { describe, expect, it } from 'vitest'
import { ecmwfDatasetDimensions, ecmwfDatasetGridSlice } from '../../src/lib/datasets/ecmwfDataset'

describe('ecmwfDataset* boundaries', () => {
  it('uses time/step/longitude/latitude semantics and requires step', () => {
    expect(ecmwfDatasetDimensions).toEqual(expect.arrayContaining(['time', 'step', 'longitude', 'latitude']))
    expect(() => ecmwfDatasetGridSlice({ time: '2024-01-01T00:00:00Z', variable: 't2m' })).toThrow(/step/i)
    expect(ecmwfDatasetGridSlice({ time: '2024-01-01T00:00:00Z', step: 'PT1H', variable: 't2m' })).toMatchObject({ keyedBy: 'time+step+variable' })
  })
})
