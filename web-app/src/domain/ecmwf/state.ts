import {
  ecmwfDisplayConfigForVariable,
  type EcmwfColorMapKey,
  type EcmwfVariableKey,
} from "@/domain/ecmwf/display";
import {
  ecmwfDateToTimeIndex,
  findEcmwfRefForDate,
  mapEcmwfGlobalTimeIndex,
  type EcmwfRefCatalogEntry,
} from "@/domain/ecmwf/catalog";

export type EcmwfDisplayOverride = {
  clim: [number, number];
  colormap: EcmwfColorMapKey;
};

export type EcmwfProviderState = {
  refPath: string;
  refStartDate: string;
  ecmwfTimeIndex: number;
  ecmwfStepIndex: number;
  variableKey: EcmwfVariableKey;
  overrideByVar?: Partial<Record<EcmwfVariableKey, EcmwfDisplayOverride>>;
};

export function createEcmwfState(
  variableKey: EcmwfVariableKey,
  dateIso: string,
  catalog?: EcmwfRefCatalogEntry[],
): EcmwfProviderState {
  const ref = findEcmwfRefForDate(dateIso, catalog);
  return {
    refPath: ref.refPath,
    refStartDate: ref.refStartDate,
    ecmwfTimeIndex: ecmwfDateToTimeIndex(dateIso, ref.refStartDate),
    ecmwfStepIndex: 0,
    variableKey,
  };
}

export function updateEcmwfStateForDate(
  state: EcmwfProviderState,
  dateIso: string,
  catalog?: EcmwfRefCatalogEntry[],
): EcmwfProviderState {
  const ref = findEcmwfRefForDate(dateIso, catalog);
  return {
    ...state,
    refPath: ref.refPath,
    refStartDate: ref.refStartDate,
    ecmwfTimeIndex: ecmwfDateToTimeIndex(dateIso, ref.refStartDate),
    ecmwfStepIndex: 0,
  };
}

export function updateEcmwfStateForVariable(
  state: EcmwfProviderState,
  variableKey: EcmwfVariableKey,
): EcmwfProviderState {
  return { ...state, variableKey };
}

export function updateEcmwfStateForGlobalTimeIndex(
  state: EcmwfProviderState,
  globalTimeIndex: number,
  catalog?: EcmwfRefCatalogEntry[],
): EcmwfProviderState {
  const mapped = mapEcmwfGlobalTimeIndex(globalTimeIndex, catalog);
  const refChanged = mapped.refPath !== state.refPath;
  return {
    ...state,
    ...mapped,
    ecmwfStepIndex: refChanged ? 0 : state.ecmwfStepIndex,
  };
}

export function updateEcmwfStateForStepIndex(
  state: EcmwfProviderState,
  ecmwfStepIndex: number,
): EcmwfProviderState {
  return { ...state, ecmwfStepIndex };
}

export function updateEcmwfDisplayOverride(
  state: EcmwfProviderState,
  variableKey: EcmwfVariableKey,
  override: EcmwfDisplayOverride,
): EcmwfProviderState {
  return {
    ...state,
    overrideByVar: {
      ...state.overrideByVar,
      [variableKey]: override,
    },
  };
}

export function ecmwfDisplaySettings(state: EcmwfProviderState) {
  return ecmwfDisplayConfigForVariable(state.variableKey, state.overrideByVar);
}
