// Not present: cp, lsp, q*, t*, u*, v*, z*
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
  | "viridis";
export type EcmwfRgbStop = { pos: number; color: [number, number, number] };
export type EcmwfColorMap = { gradient: string; stops: EcmwfRgbStop[] };

export const ecmwfColorMaps: Record<EcmwfColorMapKey, EcmwfColorMap> = {
  coolwarm: {
    gradient: "linear-gradient(to top, #3b4cc0, #bcb8b7, #b40426)",
    stops: [
      { pos: 0.0, color: [59, 76, 192] },
      { pos: 0.5, color: [188, 184, 183] },
      { pos: 1.0, color: [180, 4, 38] },
    ],
  },
  thermal: {
    gradient:
      "linear-gradient(to top, #053061, #2166ac, #4393c3, #92c5de, #f4a582, #d6604d, #b2182b, #67001f)",
    stops: [
      { pos: 0.0, color: [5, 48, 97] },
      { pos: 0.14, color: [33, 102, 172] },
      { pos: 0.29, color: [67, 147, 195] },
      { pos: 0.43, color: [146, 197, 222] },
      { pos: 0.57, color: [244, 165, 130] },
      { pos: 0.71, color: [214, 96, 77] },
      { pos: 0.86, color: [178, 24, 43] },
      { pos: 1.0, color: [103, 0, 31] },
    ],
  },
  GnBu: {
    gradient: "linear-gradient(to top, #f7fcf0, #7bccc4, #084081)",
    stops: [
      { pos: 0.0, color: [247, 252, 240] },
      { pos: 0.5, color: [123, 204, 196] },
      { pos: 1.0, color: [8, 64, 129] },
    ],
  },
  YlGnBu: {
    gradient: "linear-gradient(to top, #ffffd9, #41b6c4, #081d58)",
    stops: [
      { pos: 0.0, color: [255, 255, 217] },
      { pos: 0.5, color: [65, 182, 196] },
      { pos: 1.0, color: [8, 29, 88] },
    ],
  },
  Purples: {
    gradient: "linear-gradient(to top, #f2f0f7, #9e9ac8, #3f007d)",
    stops: [
      { pos: 0.0, color: [242, 240, 247] },
      { pos: 0.5, color: [158, 154, 200] },
      { pos: 1.0, color: [63, 0, 125] },
    ],
  },
  Blues: {
    gradient: "linear-gradient(to top, #eff3ff, #6baed6, #08519c)",
    stops: [
      { pos: 0.0, color: [239, 243, 255] },
      { pos: 0.5, color: [107, 174, 214] },
      { pos: 1.0, color: [8, 81, 156] },
    ],
  },
  Reds: {
    gradient: "linear-gradient(to top, #fee0d2, #fc9272, #cb181d)",
    stops: [
      { pos: 0.0, color: [254, 224, 210] },
      { pos: 0.5, color: [252, 146, 114] },
      { pos: 1.0, color: [203, 24, 29] },
    ],
  },
  RdBu_r: {
    gradient:
      "linear-gradient(to top, #053061, #2166ac, #f7f7f7, #b2182b, #67001f)",
    stops: [
      { pos: 0.0, color: [5, 48, 97] },
      { pos: 0.5, color: [247, 247, 247] },
      { pos: 1.0, color: [103, 0, 31] },
    ],
  },
  Greys_trunc: {
    gradient: "linear-gradient(to top, #f7f7f7, #bdbdbd, #636363)",
    stops: [
      { pos: 0.0, color: [247, 247, 247] },
      { pos: 0.5, color: [189, 189, 189] },
      { pos: 1.0, color: [99, 99, 99] },
    ],
  },
  viridis: {
    gradient: "linear-gradient(to top, #440154, #218f8d, #fde725)",
    stops: [
      { pos: 0.0, color: [68, 1, 84] },
      { pos: 0.5, color: [33, 143, 141] },
      { pos: 1.0, color: [253, 231, 37] },
    ],
  },
};

export const ecmwfDefaultVar_CMAPS: Partial<
  Record<EcmwfVariableKey, EcmwfColorMapKey>
> = {
  d2m: "coolwarm",
  i10fg: "Reds",
  lcc: "Greys_trunc",
  msl: "viridis",
  sh2: "GnBu",
  swvl1: "YlGnBu",
  t2m: "thermal",
  tcc: "Greys_trunc",
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

export function ecmwfColorMapStopsForZarrLayer(
  colormap: EcmwfColorMapKey,
): Array<[number, number, number]> {
  return ecmwfColorMaps[colormap].stops.map((stop) => stop.color);
}
