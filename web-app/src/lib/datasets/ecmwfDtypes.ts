export type EcmwfDtypeLike = { is(dtype: string): boolean };

export const ecmwfExpectedDtypes = {
  display: "float32",
  latitude: "float64",
  longitude: "float64",
  step: "float64",
  time: "int64",
  valid_time: "float64",
} as const;

export function validateEcmwfDtypes(
  arrays: Partial<
    Record<keyof typeof ecmwfExpectedDtypes, EcmwfDtypeLike | undefined>
  >,
): true {
  for (const [key, dtype] of Object.entries(ecmwfExpectedDtypes) as [
    keyof typeof ecmwfExpectedDtypes,
    string,
  ][]) {
    const value = arrays[key];
    if (!value || !value.is(dtype))
      throw new Error(`dtype mismatch for ${key}`);
  }
  return true;
}
