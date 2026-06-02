export const ecmwfDatasetDimensions = ['time', 'step', 'latitude', 'longitude'] as const

export function ecmwfDatasetGridSlice(input: { time: string; step?: string; variable: string; [key: string]: unknown }) {
  if (!input.step) throw new Error('step is required')
  return { ...input, keyedBy: 'time+step+variable' as const }
}
