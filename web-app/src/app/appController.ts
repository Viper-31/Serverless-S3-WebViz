import {
  ecmwfRefCatalog,
  loadInventoryCatalog,
  type InventoryCatalog,
} from "@/datasets/inventory_parser";
import {
  ecmwfDisplayConfigForVariable,
  type EcmwfColorMapKey,
  type EcmwfVariableKey,
} from "@/features/display";
import {
  createEcmwfState,
  createEcmwfRasterLayerRequest,
  updateEcmwfDisplayOverride,
  updateEcmwfStateForDate,
  updateEcmwfStateForGlobalTimeIndex,
  updateEcmwfStateForStepIndex,
  updateEcmwfStateForVariable,
  type EcmwfProviderState,
} from "@/features/selection";
import {
  ecmwfTimeIndexToDate,
  formatEcmwfValidTimeSeconds,
  mapEcmwfTimeToGlobalIndex,
} from "@/features/time_navigation";
import type { RasterRenderer } from "@/rendering-layer/Renderer";

export type LoadingState = {
  loading: boolean;
  metadata: boolean;
  chunks: boolean;
  error?: Error | null | undefined;
};
export type AppState = {
  localRangeCoalescing: boolean;
  mapReady: boolean;
  layerAdded: boolean;
  reloadingLayer: boolean;
  loadingState: LoadingState;
  error: string | null;
  validTimeLabel: string;
  validTimeError: string | null;
  catalog: InventoryCatalog;
  ecmwf: EcmwfProviderState;
  timeSliderActive: boolean;
  stepSliderActive: boolean;
};

export type AppControllerDeps = {
  loadInventoryCatalog?: typeof loadInventoryCatalog;
};

export interface AppController {
  subscribe(listener: Listener): () => boolean;
  getState(): AppState;
  init(isCancelled?: () => boolean): Promise<void>;
  attachRenderer(nextRenderer: RasterRenderer): Promise<void>;
  teardown(): void;
  setLocalRangeCoalescing(next: boolean): void;
  setLoadingState(next: unknown): void;
  reload(): Promise<void>;
  setDate(dateIso: string): Promise<void>;
  setTimeSliderActive(active: boolean): void;
  setGlobalTimeIndex(index: number): Promise<void>;
  commitGlobalTimeIndex(): Promise<void>;
  setStepSliderActive(active: boolean): void;
  setStepIndex(stepIndex: number): void;
  commitStepIndex(): Promise<void>;
  setVariable(variableKey: EcmwfVariableKey): Promise<void>;
  setDisplayOverride(override: {
    clim: [number, number];
    colormap: EcmwfColorMapKey;
  }): void;
  getDisplaySettings(): ReturnType<typeof ecmwfDisplayConfigForVariable>;
  getSelectedDate(): ReturnType<typeof ecmwfTimeIndexToDate>;
  getGlobalTimeIndex(): number;
  getMaxGlobalTimeIndex(): number;
}

type Listener = (state: AppState) => void;

type AppControllerContext = {
  state: AppState;
  renderer: RasterRenderer | null;
  validTimeToken: number;
  layerToken: number;
  lastCommittedSelectionKey: string;
  lastRenderedRefPath: string;
  setState(patch: Partial<AppState>): void;
  setEcmwf(ecmwf: EcmwfProviderState): void;
};

type SelectionOptions = {
  nextEcmwf: EcmwfProviderState;
  forceReplace: boolean;
};

const initialEcmwf = createEcmwfState("t2m", "2024-01-02");
const initialState: AppState = {
  localRangeCoalescing: true,
  mapReady: false,
  layerAdded: false,
  reloadingLayer: false,
  loadingState: { loading: true, metadata: true, chunks: true, error: null },
  error: null,
  validTimeLabel: "Loading valid time…",
  validTimeError: null,
  catalog: { ecmwf: ecmwfRefCatalog, dpird: [] },
  ecmwf: initialEcmwf,
  timeSliderActive: false,
  stepSliderActive: false,
};

function selectionKey(s: EcmwfProviderState): string {
  return `${s.refPath}|${s.ecmwfTimeIndex}|${s.ecmwfStepIndex}`;
}

async function refreshValidTime(
  ctx: AppControllerContext,
  next = ctx.state.ecmwf,
) {
  if (!ctx.renderer || ctx.state.timeSliderActive || ctx.state.stepSliderActive)
    return;
  const token = ++ctx.validTimeToken;
  ctx.setState({ validTimeError: null });
  try {
    const value = await ctx.renderer.readValidTime(
      createEcmwfRasterLayerRequest(next).selector,
    );
    if (token !== ctx.validTimeToken) return;
    ctx.setState({
      validTimeLabel: formatEcmwfValidTimeSeconds(value),
      validTimeError: null,
    });
    ctx.lastCommittedSelectionKey = selectionKey(next);
  } catch (error) {
    if (token !== ctx.validTimeToken) return;
    ctx.setState({
      validTimeLabel: "valid_time unavailable",
      validTimeError: error instanceof Error ? error.message : String(error),
    });
  }
}

async function commitSelection(
  ctx: AppControllerContext,
  options: SelectionOptions,
) {
  if (!ctx.renderer || ctx.state.timeSliderActive || ctx.state.stepSliderActive)
    return;
  const { nextEcmwf, forceReplace } = options;
  const nextRequest = createEcmwfRasterLayerRequest(nextEcmwf);
  const key = selectionKey(nextEcmwf);
  if (
    !forceReplace &&
    key === ctx.lastCommittedSelectionKey &&
    ctx.state.validTimeLabel !== "valid_time unavailable"
  )
    return;
  ctx.setState({ reloadingLayer: true, error: null, validTimeError: null });
  const token = ++ctx.layerToken;
  try {
    if (
      !forceReplace &&
      ctx.renderer.hasLayer() &&
      ctx.lastRenderedRefPath === nextRequest.refPath
    ) {
      await ctx.renderer.updateSelector(nextRequest.selector);
    } else {
      await ctx.renderer.replace(nextRequest);
      ctx.lastRenderedRefPath = nextRequest.refPath;
    }
    if (token !== ctx.layerToken) return;
    ctx.setState({ layerAdded: true, reloadingLayer: false });
    await refreshValidTime(ctx, nextEcmwf);
  } catch (error) {
    if (token !== ctx.layerToken) return;
    ctx.setState({
      reloadingLayer: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export function createAppController(deps: AppControllerDeps): AppController {
  const runtime: AppControllerContext = {
    state: { ...initialState },
    renderer: null,
    validTimeToken: 0,
    layerToken: 0,
    lastCommittedSelectionKey: "",
    lastRenderedRefPath: "",
    setState(patch: Partial<AppState>) {
      runtime.state = { ...runtime.state, ...patch };
      listeners.forEach((listener) => listener(runtime.state));
    },
    setEcmwf(ecmwf: EcmwfProviderState) {
      runtime.setState({ ecmwf });
    },
  };
  const listeners = new Set<Listener>();
  const state = () => runtime.state;
  const setState = (patch: Partial<AppState>) => runtime.setState(patch);
  const setEcmwf = (ecmwf: EcmwfProviderState) => runtime.setEcmwf(ecmwf);
  const deriveSelectedDate = () =>
    ecmwfTimeIndexToDate(
      state().ecmwf.refStartDate,
      state().ecmwf.ecmwfTimeIndex,
    );
  const deriveDisplaySettings = () =>
    ecmwfDisplayConfigForVariable(
      state().ecmwf.variableKey,
      state().ecmwf.overrideByVar,
    );
  const deriveGlobalTimeIndex = () =>
    mapEcmwfTimeToGlobalIndex(
      state().ecmwf.refStartDate,
      state().ecmwf.ecmwfTimeIndex,
      state().catalog.ecmwf,
    );
  const deriveMaxGlobalTimeIndex = () =>
    Math.max(0, state().catalog.ecmwf.length * 14 - 1);

  return {
    subscribe(listener: Listener) {
      listeners.add(listener);
      listener(state());
      return () => listeners.delete(listener);
    },
    getState: () => state(),
    async init(isCancelled: () => boolean = () => false) {
      const catalog = await (
        deps.loadInventoryCatalog ?? loadInventoryCatalog
      )();
      if (isCancelled()) return;
      if (catalog.ecmwf.length) {
        setState({ catalog });
        setEcmwf(
          updateEcmwfStateForDate(
            state().ecmwf,
            deriveSelectedDate(),
            catalog.ecmwf,
          ),
        );
      }
    },
    async attachRenderer(nextRenderer: RasterRenderer) {
      runtime.renderer = nextRenderer;
      setState({ mapReady: true });
      await commitSelection(runtime, {
        nextEcmwf: state().ecmwf,
        forceReplace: true,
      });
    },
    teardown() {
      runtime.validTimeToken += 1;
      runtime.layerToken += 1;
      runtime.renderer = null;
      runtime.lastRenderedRefPath = "";
      setState({ mapReady: false, layerAdded: false, reloadingLayer: false });
    },
    setLocalRangeCoalescing(next: boolean) {
      setState({ localRangeCoalescing: next });
    },
    setLoadingState(next: unknown) {
      const loadingState = next as {
        loading: boolean;
        metadata: boolean;
        chunks: boolean;
        error?: Error | null | undefined;
      };
      setState({ loadingState, error: loadingState.error?.message ?? null });
    },
    async reload() {
      if (runtime.renderer)
        await commitSelection(runtime, {
          nextEcmwf: state().ecmwf,
          forceReplace: true,
        });
    },
    async setDate(dateIso: string) {
      setState({
        validTimeLabel: "Loading valid time…",
        error: null,
        validTimeError: null,
      });
      try {
        setEcmwf(
          updateEcmwfStateForDate(
            state().ecmwf,
            dateIso,
            state().catalog.ecmwf,
          ),
        );
        if (runtime.renderer)
          await commitSelection(runtime, {
            nextEcmwf: state().ecmwf,
            forceReplace: false,
          });
      } catch (error) {
        setState({
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
    setTimeSliderActive(active: boolean) {
      setState({ timeSliderActive: active });
    },
    async setGlobalTimeIndex(index: number) {
      try {
        setEcmwf(
          updateEcmwfStateForGlobalTimeIndex(
            state().ecmwf,
            index,
            state().catalog.ecmwf,
          ),
        );
        setState({
          validTimeLabel: "Release slider to update valid time…",
          error: null,
        });
      } catch (error) {
        setState({
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
    async commitGlobalTimeIndex() {
      setState({ timeSliderActive: false });
      if (runtime.renderer)
        await commitSelection(runtime, {
          nextEcmwf: state().ecmwf,
          forceReplace: false,
        });
    },
    setStepSliderActive(active: boolean) {
      setState({ stepSliderActive: active });
    },
    setStepIndex(stepIndex: number) {
      try {
        setEcmwf(updateEcmwfStateForStepIndex(state().ecmwf, stepIndex));
        setState({
          validTimeLabel: "Release slider to update valid time…",
          error: null,
        });
      } catch (error) {
        setState({
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
    async commitStepIndex() {
      setState({ stepSliderActive: false });
      if (runtime.renderer)
        await commitSelection(runtime, {
          nextEcmwf: state().ecmwf,
          forceReplace: false,
        });
    },
    async setVariable(variableKey: EcmwfVariableKey) {
      try {
        const next = updateEcmwfStateForVariable(state().ecmwf, variableKey);
        setEcmwf(next);
        setState({
          error: null,
          validTimeError: null,
          reloadingLayer: runtime.renderer?.hasLayer() ?? false,
        });
        if (runtime.renderer?.hasLayer()) {
          try {
            await runtime.renderer.updateVariableDisplay({
              variableId: variableKey,
              display: createEcmwfRasterLayerRequest(next).display,
            });
          } finally {
            setState({ reloadingLayer: false });
          }
        }
        if (runtime.renderer) await refreshValidTime(runtime, next);
      } catch (error) {
        setState({
          reloadingLayer: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
    setDisplayOverride(override: {
      clim: [number, number];
      colormap: EcmwfColorMapKey;
    }) {
      const next = updateEcmwfDisplayOverride(
        state().ecmwf,
        state().ecmwf.variableKey,
        override,
      );
      setEcmwf(next);
      if (runtime.renderer?.hasLayer())
        void runtime.renderer.updateVariableDisplay({
          variableId: next.variableKey,
          display: createEcmwfRasterLayerRequest(next).display,
        });
    },
    getDisplaySettings() {
      return deriveDisplaySettings();
    },
    getSelectedDate() {
      return deriveSelectedDate();
    },
    getGlobalTimeIndex() {
      return deriveGlobalTimeIndex();
    },
    getMaxGlobalTimeIndex() {
      return deriveMaxGlobalTimeIndex();
    },
  };
}
