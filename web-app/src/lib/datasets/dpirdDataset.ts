export const dpirdDatasetDimensions = ['station', 'time'] as const

export function dpirdDatasetFrame(input: { time: string; [key: string]: unknown }) {
  return { ...input, keyedBy: 'time' as const }
}

export function dpirdDatasetSeries(input: { station: string; variable: string; [key: string]: unknown }) {
  return { ...input, keyedBy: 'station+variable' as const }
}
