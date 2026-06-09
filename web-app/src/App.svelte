<script lang="ts">
  import { onMount } from "svelte";
  import { Spinner, Styles } from "@sveltestrap/sveltestrap";
  import DevToolsPanel from "@/features/dev-tools/DevToolsPanel.svelte";
  import MainSideBar from "@/features/sidebar/MainSideBar.svelte";
  import {
    getDefaultSideBarWidth,
    type SideBarState,
  } from "@/components/sidebar/sideBarState";
  import { ECMWF_STEP_INDEX_COUNT } from "@/datasets/ecmwf/schema";
  import {
    createRendererForContainer,
    type RasterRenderer,
  } from "@/rendering-layer/Renderer";
  import { createAppController } from "@/app/appController";
  import {
    type EcmwfColorMapKey,
    type EcmwfVariableKey,
  } from "@/features/display-settings/display";

  type AppControllerHandle = Omit<
    ReturnType<typeof createAppController>,
    "init"
  > & {
    init(isCancelled?: () => boolean): Promise<void>;
  };

  let mapNode = $state.raw<HTMLDivElement | null>(null);
  const controller: AppControllerHandle = createAppController({});
  let appState = $state(controller.getState());
  let rendererHandle: {
    renderer: RasterRenderer;
    whenReady: Promise<void>;
    remove(): void;
  } | null = null;

  const unsubscribe = controller.subscribe((next: typeof appState) => {
    appState = next;
  });

  const initialMainSideBarWidthPx = getDefaultSideBarWidth(
    typeof window === "undefined" ? 1024 : window.innerWidth,
  );
  let mainSideBarState = $state<SideBarState>({
    collapsed: false,
    widthPx: initialMainSideBarWidthPx,
    previousWidthPx: initialMainSideBarWidthPx,
  });

  function updateMainSideBarState(next: SideBarState) {
    mainSideBarState = next;
  }

  function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  const ecmwfConfig = $derived(appState.ecmwf);
  const displaySettings = $derived.by(() => {
    void appState.ecmwf.variableKey;
    void appState.ecmwf.overrideByVar;
    return controller.getDisplaySettings();
  });
  const selectedDate = $derived.by(() => {
    void appState.ecmwf.refStartDate;
    void appState.ecmwf.ecmwfTimeIndex;
    return controller.getSelectedDate();
  });
  const globalTimeIndex = $derived.by(() => {
    void appState.ecmwf.refStartDate;
    void appState.ecmwf.ecmwfTimeIndex;
    void appState.catalog.ecmwf;
    return controller.getGlobalTimeIndex();
  });
  const maxGlobalTimeIndex = $derived(
    Math.max(0, appState.catalog.ecmwf.length * 14 - 1),
  );
  const sideBarError = $derived(appState.error ?? appState.validTimeError);

  const showLoadingSpinner = $derived(
    !appState.error &&
      (appState.loadingState.loading ||
        appState.loadingState.metadata ||
        appState.loadingState.chunks),
  );

  function updateLocalRangeCoalescing(next: boolean) {
    controller.setLocalRangeCoalescing(next);
  }

  async function initializeApp(
    container: HTMLDivElement,
    isCancelled: () => boolean,
  ) {
    await controller.init(isCancelled);
    if (isCancelled()) return;
    rendererHandle = createRendererForContainer({
      container,
      localRangeCoalescing: () => controller.getState().localRangeCoalescing,
      onLoadingStateChange(next) {
        controller.setLoadingState({ ...next, error: next.error ?? null });
      },
    });
    await rendererHandle.whenReady;
    if (isCancelled()) return;
    await controller.attachRenderer(rendererHandle.renderer);
  }

  function handleDateChange(dateIso: string) {
    void controller.setDate(dateIso);
  }
  function handleTimeSliderActiveChange(active: boolean) {
    controller.setTimeSliderActive(active);
  }
  function handleGlobalTimeIndexInput(nextGlobalTimeIndex: number) {
    void controller.setGlobalTimeIndex(nextGlobalTimeIndex);
  }
  function handleGlobalTimeIndexCommit() {
    void controller.commitGlobalTimeIndex();
  }
  function handleStepSliderActiveChange(active: boolean) {
    controller.setStepSliderActive(active);
  }
  function handleStepIndexInput(stepIndex: number) {
    controller.setStepIndex(stepIndex);
  }
  function handleStepIndexCommit() {
    void controller.commitStepIndex();
  }
  function handleVariableChange(variableKey: EcmwfVariableKey) {
    void controller.setVariable(variableKey);
  }
  function handleDisplayOverrideChange(override: {
    clim: [number, number];
    colormap: EcmwfColorMapKey;
  }) {
    controller.setDisplayOverride(override);
  }
  function reloadLayer() {
    void controller.reload();
  }

  onMount(() => {
    if (!mapNode) {
      appState = { ...appState, error: "Map container is missing" };
      return () => unsubscribe();
    }

    let cancelled = false;
    void (async () => {
      try {
        await initializeApp(mapNode, () => cancelled);
      } catch (error) {
        if (cancelled) return;
        appState = { ...appState, error: errorMessage(error) };
      }
    })();

    return () => {
      cancelled = true;
      rendererHandle?.remove();
      rendererHandle = null;
      unsubscribe();
      controller.teardown();
    };
  });
</script>

<svelte:head>
  <title>Geospatial web visualisation</title>
</svelte:head>

<Styles icons={false} />

<main class="shell">
  <div class="map" bind:this={mapNode}></div>

  <div class="valid-time-badge" aria-live="polite">
    {appState.validTimeLabel}
  </div>

  {#if showLoadingSpinner}
    <div
      class="layer-status"
      aria-live="polite"
      aria-label="Loading ECMWF reference"
    >
      <Spinner color="light" />
    </div>
  {:else if appState.error}
    <div class="layer-status error-status" aria-live="polite">
      {appState.error}
    </div>
  {/if}

  <MainSideBar
    {selectedDate}
    {globalTimeIndex}
    {maxGlobalTimeIndex}
    ecmwfTimeIndex={ecmwfConfig.ecmwfTimeIndex}
    ecmwfStepIndex={ecmwfConfig.ecmwfStepIndex}
    maxStepIndex={ECMWF_STEP_INDEX_COUNT - 1}
    variableKey={ecmwfConfig.variableKey}
    displayClim={displaySettings.clim}
    displayColormap={displaySettings.colormap}
    collapsed={mainSideBarState.collapsed}
    widthPx={mainSideBarState.widthPx}
    previousWidthPx={mainSideBarState.previousWidthPx}
    error={sideBarError}
    onMainSideBarStateChange={updateMainSideBarState}
    onDateChange={handleDateChange}
    onTimeSliderActiveChange={handleTimeSliderActiveChange}
    onGlobalTimeIndexInput={handleGlobalTimeIndexInput}
    onGlobalTimeIndexCommit={handleGlobalTimeIndexCommit}
    onStepSliderActiveChange={handleStepSliderActiveChange}
    onStepIndexInput={handleStepIndexInput}
    onStepIndexCommit={handleStepIndexCommit}
    onVariableChange={handleVariableChange}
    onDisplayOverrideChange={handleDisplayOverrideChange}
  />

  <DevToolsPanel
    referencePath={ecmwfConfig.refPath}
    variableKey={ecmwfConfig.variableKey}
    localRangeCoalescing={appState.localRangeCoalescing}
    reloadingLayer={appState.reloadingLayer}
    loading={appState.loadingState.loading}
    metadata={appState.loadingState.metadata}
    chunks={appState.loadingState.chunks}
    layerAdded={appState.layerAdded}
    mapReady={appState.mapReady}
    onLocalRangeCoalescingChange={updateLocalRangeCoalescing}
    onReloadLayer={reloadLayer}
  />
</main>
