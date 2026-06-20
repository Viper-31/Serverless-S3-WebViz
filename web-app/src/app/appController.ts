import {
  ecmwfRefCatalog,
  loadInventoryCatalog,
  type InventoryCatalog,
} from "@/datasets/inventory_parser";
import {
  ecmwfDisplayConfigForVariable,
  type EcmwfColorMapKey,
  type EcmwfVariableKey,
} from "@/features/display-settings/display";
import {
  createEcmwfState,
  createEcmwfRasterLayerRequest,
  updateEcmwfDisplayOverride,
  updateEcmwfStateForDate,
  updateEcmwfStateForGlobalTimeIndex,
  updateEcmwfStateForStepIndex,
  updateEcmwfStateForVariable,
  type EcmwfProviderState,
} from "@/features/variable-selection/selection";
import {
  ecmwfTimeIndexToDate,
  formatEcmwfValidTimeSeconds,
  mapEcmwfTimeToGlobalIndex,
} from "@/features/time-navigation/time_navigation";
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

const RELEASE_SLIDER_LABEL = "Release slider to update valid time…";
const LOADING_VALID_TIME_LABEL = "Loading valid time…";
const STEPS_PER_TIME_INDEX = 14;

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

// ---------------------------------------------------------------------------
// Module-level helpers
// ---------------------------------------------------------------------------

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function selectionKey(s: EcmwfProviderState): string {
  return `${s.refPath}|${s.ecmwfTimeIndex}|${s.ecmwfStepIndex}`;
}

function isSelectionBusy(ctx: AppControllerContext): boolean {
  return ctx.state.timeSliderActive || ctx.state.stepSliderActive;
}

function captureSelectionError(
  ctx: AppControllerContext,
  error: unknown,
  extra: Partial<AppState> = {},
): void {
  ctx.setState({ error: toErrorMessage(error), ...extra });
}

async function refreshValidTime(
  ctx: AppControllerContext,
  next: EcmwfProviderState = ctx.state.ecmwf,
): Promise<void> {
  if (!ctx.renderer || isSelectionBusy(ctx)) return;

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
      validTimeError: toErrorMessage(error),
    });
  }
}

function isAlreadyCommitted(
  ctx: AppControllerContext,
  key: string,
  forceReplace: boolean,
): boolean {
  return (
    !forceReplace &&
    key === ctx.lastCommittedSelectionKey &&
    ctx.state.validTimeLabel !== "valid_time unavailable"
  );
}

function canUpdateSelectorInline(
  ctx: AppControllerContext,
  refPath: string,
  forceReplace: boolean,
): boolean {
  return (
    !forceReplace &&
    ctx.renderer !== null &&
    ctx.renderer.hasLayer() &&
    ctx.lastRenderedRefPath === refPath
  );
}

function isLayerTokenStale(ctx: AppControllerContext, token: number): boolean {
  return token !== ctx.layerToken;
}

async function commitSelection(
  ctx: AppControllerContext,
  options: SelectionOptions,
): Promise<void> {
  if (!ctx.renderer || isSelectionBusy(ctx)) return;

  const { nextEcmwf, forceReplace } = options;
  const nextRequest = createEcmwfRasterLayerRequest(nextEcmwf);
  const key = selectionKey(nextEcmwf);

  if (isAlreadyCommitted(ctx, key, forceReplace)) return;

  ctx.setState({ error: null, reloadingLayer: true, validTimeError: null });
  const token = ++ctx.layerToken;

  try {
    if (canUpdateSelectorInline(ctx, nextRequest.refPath, forceReplace)) {
      await ctx.renderer!.updateSelector(nextRequest.selector);
    } else {
      await ctx.renderer!.replace(nextRequest);
      if (isLayerTokenStale(ctx, token)) return;
      ctx.lastRenderedRefPath = nextRequest.refPath;
    }

    if (isLayerTokenStale(ctx, token)) return;
    ctx.setState({ layerAdded: true, reloadingLayer: false });
    await refreshValidTime(ctx, nextEcmwf);
  } catch (error) {
    if (isLayerTokenStale(ctx, token)) return;
    captureSelectionError(ctx, error, { reloadingLayer: false });
  }
}

function seedValidTimeLoading(ctx: AppControllerContext): void {
  ctx.setState({
    validTimeLabel: LOADING_VALID_TIME_LABEL,
    error: null,
    validTimeError: null,
  });
}

function stageSliderIndex(
  ctx: AppControllerContext,
  updater: () => EcmwfProviderState,
): void {
  try {
    ctx.setEcmwf(updater());
    ctx.setState({ validTimeLabel: RELEASE_SLIDER_LABEL, error: null });
  } catch (error) {
    captureSelectionError(ctx, error);
  }
}

async function commitSliderIndex(
  ctx: AppControllerContext,
  flagKey: "timeSliderActive" | "stepSliderActive",
): Promise<void> {
  ctx.setState({ [flagKey]: false } as Partial<AppState>);
  if (!ctx.renderer) return;
  await commitSelection(ctx, {
    nextEcmwf: ctx.state.ecmwf,
    forceReplace: false,
  });
}

// ---------------------------------------------------------------------------
// Sub-controllers
// ---------------------------------------------------------------------------

function createLifecycleController(
  deps: AppControllerDeps,
  ctx: AppControllerContext,
  listeners: Set<Listener>,
) {
  return {
    subscribe(listener: Listener) {
      listeners.add(listener);
      listener(ctx.state);
      return () => listeners.delete(listener);
    },
    getState: () => ctx.state,

    async init(isCancelled: () => boolean = () => false) {
      const catalog = await (
        deps.loadInventoryCatalog ?? loadInventoryCatalog
      )();
      if (isCancelled() || !catalog.ecmwf.length) return;
      ctx.setState({ catalog });
      ctx.setEcmwf(
        updateEcmwfStateForDate(
          ctx.state.ecmwf,
          ecmwfTimeIndexToDate(
            ctx.state.ecmwf.refStartDate,
            ctx.state.ecmwf.ecmwfTimeIndex,
          ),
          catalog.ecmwf,
        ),
      );
    },

    async attachRenderer(nextRenderer: RasterRenderer) {
      ctx.renderer = nextRenderer;
      ctx.setState({ mapReady: true });
      await commitSelection(ctx, {
        nextEcmwf: ctx.state.ecmwf,
        forceReplace: true,
      });
    },

    teardown() {
      ctx.validTimeToken += 1;
      ctx.layerToken += 1;
      ctx.renderer = null;
      ctx.lastRenderedRefPath = "";
      ctx.setState({
        mapReady: false,
        layerAdded: false,
        reloadingLayer: false,
      });
    },

    setLocalRangeCoalescing(next: boolean) {
      ctx.setState({ localRangeCoalescing: next });
    },

    setLoadingState(next: unknown) {
      const loadingState = next as LoadingState;
      ctx.setState({
        loadingState,
        error: loadingState.error?.message ?? null,
      });
    },

    async reload() {
      if (!ctx.renderer) return;
      await commitSelection(ctx, {
        nextEcmwf: ctx.state.ecmwf,
        forceReplace: true,
      });
    },
  };
}

function createTimeNavigationController(ctx: AppControllerContext) {
  return {
    async setDate(dateIso: string) {
      seedValidTimeLoading(ctx);
      try {
        ctx.setEcmwf(
          updateEcmwfStateForDate(
            ctx.state.ecmwf,
            dateIso,
            ctx.state.catalog.ecmwf,
          ),
        );
        if (ctx.renderer)
          await commitSelection(ctx, {
            nextEcmwf: ctx.state.ecmwf,
            forceReplace: false,
          });
      } catch (error) {
        captureSelectionError(ctx, error);
      }
    },

    setTimeSliderActive(active: boolean) {
      ctx.setState({ timeSliderActive: active });
    },

    setGlobalTimeIndex(index: number) {
      stageSliderIndex(ctx, () =>
        updateEcmwfStateForGlobalTimeIndex(
          ctx.state.ecmwf,
          index,
          ctx.state.catalog.ecmwf,
        ),
      );
    },

    commitGlobalTimeIndex() {
      return commitSliderIndex(ctx, "timeSliderActive");
    },

    setStepSliderActive(active: boolean) {
      ctx.setState({ stepSliderActive: active });
    },

    setStepIndex(stepIndex: number) {
      stageSliderIndex(ctx, () =>
        updateEcmwfStateForStepIndex(ctx.state.ecmwf, stepIndex),
      );
    },

    commitStepIndex() {
      return commitSliderIndex(ctx, "stepSliderActive");
    },
  };
}

function createVariableSelectionController(ctx: AppControllerContext) {
  async function applyVariableDisplayUpdate(
    variableId: string,
    next: EcmwfProviderState,
  ): Promise<void> {
    if (!ctx.renderer?.hasLayer()) return;
    try {
      await ctx.renderer.updateVariableDisplay({
        variableId,
        display: createEcmwfRasterLayerRequest(next).display,
      });
    } finally {
      ctx.setState({ reloadingLayer: false });
    }
  }

  return {
    async setVariable(variableKey: EcmwfVariableKey) {
      try {
        const next = updateEcmwfStateForVariable(ctx.state.ecmwf, variableKey);
        ctx.setEcmwf(next);
        ctx.setState({
          error: null,
          validTimeError: null,
          reloadingLayer: ctx.renderer?.hasLayer() ?? false,
        });
        await applyVariableDisplayUpdate(variableKey, next);
        if (ctx.renderer) await refreshValidTime(ctx, next);
      } catch (error) {
        captureSelectionError(ctx, error, { reloadingLayer: false });
      }
    },

    setDisplayOverride(override: {
      clim: [number, number];
      colormap: EcmwfColorMapKey;
    }) {
      const next = updateEcmwfDisplayOverride(
        ctx.state.ecmwf,
        ctx.state.ecmwf.variableKey,
        override,
      );
      ctx.setEcmwf(next);
      if (!ctx.renderer?.hasLayer()) return;
      void ctx.renderer.updateVariableDisplay({
        variableId: next.variableKey,
        display: createEcmwfRasterLayerRequest(next).display,
      });
    },
  };
}

function createQueryController(ctx: AppControllerContext) {
  return {
    getDisplaySettings() {
      return ecmwfDisplayConfigForVariable(
        ctx.state.ecmwf.variableKey,
        ctx.state.ecmwf.overrideByVar,
      );
    },
    getSelectedDate() {
      return ecmwfTimeIndexToDate(
        ctx.state.ecmwf.refStartDate,
        ctx.state.ecmwf.ecmwfTimeIndex,
      );
    },
    getGlobalTimeIndex() {
      return mapEcmwfTimeToGlobalIndex(
        ctx.state.ecmwf.refStartDate,
        ctx.state.ecmwf.ecmwfTimeIndex,
        ctx.state.catalog.ecmwf,
      );
    },
    getMaxGlobalTimeIndex() {
      return Math.max(
        0,
        ctx.state.catalog.ecmwf.length * STEPS_PER_TIME_INDEX - 1,
      );
    },
  };
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createAppController(deps: AppControllerDeps): AppController {
  const ctx: AppControllerContext = {
    state: { ...initialState },
    renderer: null,
    validTimeToken: 0,
    layerToken: 0,
    lastCommittedSelectionKey: "",
    lastRenderedRefPath: "",
    setState(patch) {
      ctx.state = { ...ctx.state, ...patch };
      listeners.forEach((listener) => listener(ctx.state));
    },
    setEcmwf(ecmwf) {
      ctx.setState({ ecmwf });
    },
  };
  const listeners = new Set<Listener>();

  return {
    ...createLifecycleController(deps, ctx, listeners),
    ...createTimeNavigationController(ctx),
    ...createVariableSelectionController(ctx),
    ...createQueryController(ctx),
  };
}
