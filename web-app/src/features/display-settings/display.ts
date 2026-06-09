import { type LayerDisplay } from "@/lib/shared/contracts";

export const ecmwfDisplayVariables = {
  d2m: { label: "Dewpoint temperature 2m" },
  i10fg: { label: "Wind gust 10m" },
  lcc: { label: "Low cloud cover" },
  msl: { label: "Mean sea level pressure" },
  sh2: { label: "Specfic humidity 2m" },
  swvl1: { label: "Volumetric soil water layer" },
  t2m: { label: "Temperature 2m" },
  tcc: { label: "Total cloud cover" },
  tp: { label: "Total precipitation" },
  u10: { label: "u wind 10m" },
  v10: { label: "v wind 10m" },
} as const;
export type EcmwfVariableKey = keyof typeof ecmwfDisplayVariables;
export const ecmwfDisplayVariableKeys = Object.keys(
  ecmwfDisplayVariables,
) as EcmwfVariableKey[];
export const ecmwfVarClim: Record<EcmwfVariableKey, [number, number]> = {
  d2m: [-40, 40],
  i10fg: [0, 150],
  lcc: [0, 1],
  msl: [994, 1036],
  sh2: [0, 0.03],
  swvl1: [0, 0.4],
  t2m: [-10, 50],
  tcc: [0, 1],
  tp: [0, 200],
  u10: [-100, 100],
  v10: [-100, 100],
};
export type EcmwfColorMapKey =
  | "coolwarm"
  | "thermal"
  | "GnBu"
  | "YlGnBu"
  | "Purples"
  | "Blues"
  | "Reds"
  | "RdBu_r"
  | "Greys_trunc"
  | "Clouds_dark"
  | "viridis";
export type EcmwfRgbStop = { pos: number; color: [number, number, number] };
export type EcmwfColorMap = { gradient: string; stops: EcmwfRgbStop[] };
export const ecmwfColorMaps: Record<EcmwfColorMapKey, EcmwfColorMap> = {
  coolwarm: {
    gradient: "linear-gradient(to right, #1d4ed8, #f8e58c, #dc2626)",
    stops: [
      { pos: 0, color: [29, 78, 216] },
      { pos: 0.5, color: [248, 229, 140] },
      { pos: 1, color: [220, 38, 38] },
    ],
  },
  thermal: {
    gradient:
      "linear-gradient(to right, #082f49, #0369a1, #38bdf8, #facc15, #f97316, #dc2626, #7f1d1d)",
    stops: [
      { pos: 0, color: [8, 47, 73] },
      { pos: 0.18, color: [3, 105, 161] },
      { pos: 0.36, color: [56, 189, 248] },
      { pos: 0.54, color: [250, 204, 21] },
      { pos: 0.72, color: [249, 115, 22] },
      { pos: 0.9, color: [220, 38, 38] },
      { pos: 1, color: [127, 29, 29] },
    ],
  },
  GnBu: {
    gradient: "linear-gradient(to right, #0f172a, #16a34a, #bae6fd)",
    stops: [
      { pos: 0, color: [15, 23, 42] },
      { pos: 0.5, color: [22, 163, 74] },
      { pos: 1, color: [186, 230, 253] },
    ],
  },
  YlGnBu: {
    gradient: "linear-gradient(to right, #facc15, #15803d, #1e1b4b)",
    stops: [
      { pos: 0, color: [250, 204, 21] },
      { pos: 0.5, color: [21, 128, 61] },
      { pos: 1, color: [30, 27, 75] },
    ],
  },
  Purples: {
    gradient: "linear-gradient(to right, #111827, #7c3aed, #e9d5ff)",
    stops: [
      { pos: 0, color: [17, 24, 39] },
      { pos: 0.5, color: [124, 58, 237] },
      { pos: 1, color: [233, 213, 255] },
    ],
  },
  Blues: {
    gradient: "linear-gradient(to right, #0f172a, #2563eb, #bfdbfe)",
    stops: [
      { pos: 0, color: [15, 23, 42] },
      { pos: 0.5, color: [37, 99, 235] },
      { pos: 1, color: [191, 219, 254] },
    ],
  },
  Reds: {
    gradient: "linear-gradient(to right, #1f0a0a, #ea580c, #fde047)",
    stops: [
      { pos: 0, color: [31, 10, 10] },
      { pos: 0.5, color: [234, 88, 12] },
      { pos: 1, color: [253, 224, 71] },
    ],
  },
  RdBu_r: {
    gradient:
      "linear-gradient(to right, #082f49, #2563eb, #f8e58c, #dc2626, #7f1d1d)",
    stops: [
      { pos: 0, color: [8, 47, 73] },
      { pos: 0.25, color: [37, 99, 235] },
      { pos: 0.5, color: [248, 229, 140] },
      { pos: 0.75, color: [220, 38, 38] },
      { pos: 1, color: [127, 29, 29] },
    ],
  },
  Greys_trunc: {
    gradient: "linear-gradient(to right, #f7f7f7, #bdbdbd, #636363)",
    stops: [
      { pos: 0, color: [247, 247, 247] },
      { pos: 0.5, color: [189, 189, 189] },
      { pos: 1, color: [99, 99, 99] },
    ],
  },
  Clouds_dark: {
    gradient: "linear-gradient(to right, #111827, #6366f1, #f8fafc)",
    stops: [
      { pos: 0, color: [17, 24, 39] },
      { pos: 0.5, color: [99, 102, 241] },
      { pos: 1, color: [248, 250, 252] },
    ],
  },
  viridis: {
    gradient: "linear-gradient(to right, #440154, #218f8d, #fde725)",
    stops: [
      { pos: 0, color: [68, 1, 84] },
      { pos: 0.5, color: [33, 143, 141] },
      { pos: 1, color: [253, 231, 37] },
    ],
  },
};
export const ecmwfDefaultVar_CMAPS: Partial<
  Record<EcmwfVariableKey, EcmwfColorMapKey>
> = {
  d2m: "coolwarm",
  i10fg: "Reds",
  lcc: "Clouds_dark",
  msl: "viridis",
  sh2: "YlGnBu",
  swvl1: "GnBu",
  t2m: "thermal",
  tcc: "Clouds_dark",
  tp: "Blues",
};
export function ecmwfDisplayConfigForVariable(
  variableKey: EcmwfVariableKey,
  overrideByVar: Partial<
    Record<
      EcmwfVariableKey,
      { clim: [number, number]; colormap: EcmwfColorMapKey }
    >
  > = {},
) {
  return (
    overrideByVar[variableKey] ?? {
      clim: ecmwfVarClim[variableKey],
      colormap: ecmwfDefaultVar_CMAPS[variableKey] ?? "viridis",
    }
  );
}
export function ecmwfLayerDisplayForVariable(
  variableKey: EcmwfVariableKey,
  overrideByVar: Partial<
    Record<
      EcmwfVariableKey,
      { clim: [number, number]; colormap: EcmwfColorMapKey }
    >
  > = {},
): LayerDisplay {
  const display = ecmwfDisplayConfigForVariable(variableKey, overrideByVar);
  return {
    clim: display.clim,
    rgbStops: ecmwfColorMaps[display.colormap].stops.map((stop) => stop.color),
  };
}
