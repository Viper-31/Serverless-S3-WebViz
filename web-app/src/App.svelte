<script lang="ts">
  import { onMount } from 'svelte'
  import maplibregl from 'maplibre-gl'
  import { Spinner, Styles } from '@sveltestrap/sveltestrap'
  import DevToolsMenu from './components/DevToolsMenu.svelte'
  import MainSideBar from './components/MainSideBar.svelte'
  import { getDefaultMainSideBarWidth, type MainSideBarState } from './components/mainSideBarState'
  import { ECMWF_STEP_INDEX_COUNT } from './datasets/ecmwf/schema'
  import {
    buildEcmwfRefCatalogFromInventoryLedger,
    ecmwfRefCatalog,
    ecmwfTimeIndexToDate,
    mapEcmwfTimeToGlobalIndex,
    type EcmwfInventoryLedger,
    type EcmwfRefCatalogEntry,
  } from './domain/ecmwf/catalog'
  import {
    ecmwfColorMapStopsForZarrLayer,
    type EcmwfColorMapKey,
    type EcmwfVariableKey,
  } from './domain/ecmwf/display'
  import {
    createEcmwfState,
    ecmwfDisplaySettings,
    updateEcmwfDisplayOverride,
    updateEcmwfStateForDate,
    updateEcmwfStateForGlobalTimeIndex,
    updateEcmwfStateForStepIndex,
    updateEcmwfStateForVariable,
    type EcmwfProviderState,
  } from './domain/ecmwf/state'
  import {
    createEcmwfLayer,
    createEcmwfZarrSelector,
    ECMWF_LAYER_ID,
    type EcmwfLayerBundle,
    readEcmwfValidTimeLabel,
  } from './map/ecmwf/createGridLayer'
  import type { LoadingState } from '@carbonplan/zarr-layer'

  type DatasetProvider = 'ECMWF'
  type DatasetState = {
    activeDatasets: DatasetProvider[]
    providerConfigs: {
      ECMWF: EcmwfProviderState
    }
  }

  type Status = { loadingState: LoadingState; error: string | null }

  let mapNode = $state.raw<HTMLDivElement | undefined>(undefined)
  let status = $state<Status>({ loadingState: { loading: true, metadata: true, chunks: true, error: null }, error: null })
  let layerAdded = $state(false)
  let localRangeCoalescing = $state(true)
  let mapInstance = $state.raw<maplibregl.Map | undefined>(undefined)
  let ecmwfLayerBundle = $state.raw<EcmwfLayerBundle | undefined>(undefined)
  let reloadingLayer = $state(false)
  let layerLoadError = $state<string | null>(null)
  let displayValidTime = $state('Loading valid time…')
  let validTimeError = $state<string | null>(null)
  let ecmwfCatalog = $state<EcmwfRefCatalogEntry[]>(ecmwfRefCatalog)
  let layerLoadToken = 0
  let validTimeToken = 0
  let timeSliderActive = $state(false)
  let stepSliderActive = $state(false)
  let lastCommittedSelectionKey = ''

  const initialMainSideBarWidthPx = getDefaultMainSideBarWidth(typeof window === 'undefined' ? 1024 : window.innerWidth)
  let mainSideBarState = $state<MainSideBarState>({
    collapsed: false,
    widthPx: initialMainSideBarWidthPx,
    previousWidthPx: initialMainSideBarWidthPx,
  })

  let datasetState = $state<DatasetState>({
    activeDatasets: ['ECMWF'],
    providerConfigs: {
      ECMWF: createEcmwfState('t2m', '2024-01-02'),
    },
  })

  const ecmwfConfig = $derived(datasetState.providerConfigs.ECMWF)
  const displaySettings = $derived(ecmwfDisplaySettings(ecmwfConfig))
  const selectedDate = $derived(ecmwfTimeIndexToDate(ecmwfConfig.refStartDate, ecmwfConfig.ecmwfTimeIndex))
  const globalTimeIndex = $derived(mapEcmwfTimeToGlobalIndex(ecmwfConfig.refStartDate, ecmwfConfig.ecmwfTimeIndex, ecmwfCatalog))
  const maxGlobalTimeIndex = $derived(Math.max(0, ecmwfCatalog.length * 14 - 1))
  const sideBarError = $derived(layerLoadError ?? validTimeError ?? status.error)

  function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
  }

  function selectionKey(state: EcmwfProviderState) {
    return `${state.refPath}|${state.ecmwfTimeIndex}|${state.ecmwfStepIndex}`
  }

  function setEcmwfConfig(next: EcmwfProviderState) {
    datasetState = {
      ...datasetState,
      providerConfigs: {
        ...datasetState.providerConfigs,
        ECMWF: next,
      },
    }
  }

  function updateMainSideBarState(next: MainSideBarState) {
    mainSideBarState = next
  }

  function updateLocalRangeCoalescing(next: boolean) {
    localRangeCoalescing = next
  }

  async function loadInventoryCatalog() {
    const response = await fetch('/_state/inventory_ledger.json', { credentials: 'omit' })
    if (!response.ok) throw new Error(`Failed to load inventory ledger: HTTP ${response.status}`)
    const ledger = await response.json() as EcmwfInventoryLedger
    const nextCatalog = buildEcmwfRefCatalogFromInventoryLedger(ledger)
    if (nextCatalog.length > 0) ecmwfCatalog = nextCatalog
  }

  async function refreshDisplayValidTime(state: EcmwfProviderState, bundle = ecmwfLayerBundle) {
    if (!bundle || timeSliderActive || stepSliderActive) return

    const token = ++validTimeToken
    validTimeError = null

    try {
      const label = await readEcmwfValidTimeLabel(bundle.store, state)
      if (token !== validTimeToken) return
      displayValidTime = label
      lastCommittedSelectionKey = selectionKey(state)
    } catch (error) {
      if (token !== validTimeToken) return
      validTimeError = errorMessage(error)
      displayValidTime = 'valid_time unavailable'
    }
  }

  async function loadLayer(map: maplibregl.Map, state: EcmwfProviderState, isCancelled: () => boolean) {
    const token = ++layerLoadToken
    reloadingLayer = true
    layerLoadError = null
    validTimeError = null
    status = { loadingState: { loading: true, metadata: true, chunks: true, error: null }, error: null }

    try {
      const nextBundle = await createEcmwfLayer({
        refPath: state.refPath,
        variableKey: state.variableKey,
        ecmwfTimeIndex: state.ecmwfTimeIndex,
        ecmwfStepIndex: state.ecmwfStepIndex,
        display: ecmwfDisplaySettings(state),
        localRangeCoalescing,
        onLoadingStateChange(next) {
          if (isCancelled() || token !== layerLoadToken) return
          status = { loadingState: next, error: next.error?.message ?? null }
        },
      })

      if (isCancelled() || token !== layerLoadToken) return

      if (map.getLayer(ECMWF_LAYER_ID)) {
        map.removeLayer(ECMWF_LAYER_ID)
      }

      map.addLayer(nextBundle.layer as maplibregl.CustomLayerInterface)
      ecmwfLayerBundle = nextBundle
      layerAdded = true
      reloadingLayer = false
      await refreshDisplayValidTime(state, nextBundle)
    } catch (error) {
      if (isCancelled() || token !== layerLoadToken) return
      layerLoadError = errorMessage(error)
      status = { loadingState: status.loadingState, error: layerLoadError }
      reloadingLayer = false
      layerAdded = Boolean(ecmwfLayerBundle)
    }
  }

  async function commitEcmwfSelection() {
    if (timeSliderActive || stepSliderActive) return
    const state = datasetState.providerConfigs.ECMWF
    const key = selectionKey(state)
    if (key === lastCommittedSelectionKey && displayValidTime !== 'valid_time unavailable') return

    if (!mapInstance || !ecmwfLayerBundle || ecmwfLayerBundle.refPath !== state.refPath) {
      if (mapInstance) await loadLayer(mapInstance, state, () => false)
      return
    }

    try {
      layerLoadError = null
      validTimeError = null
      await ecmwfLayerBundle.layer.setSelector(createEcmwfZarrSelector(state))
      await refreshDisplayValidTime(state)
    } catch (error) {
      layerLoadError = errorMessage(error)
    }
  }

  function reloadLayer() {
    if (!mapInstance) return
    void loadLayer(mapInstance, datasetState.providerConfigs.ECMWF, () => false)
  }

  function handleDateChange(dateIso: string) {
    try {
      const next = updateEcmwfStateForDate(datasetState.providerConfigs.ECMWF, dateIso, ecmwfCatalog)
      setEcmwfConfig(next)
      displayValidTime = 'Loading valid time…'
      void loadLayerIfReady(next)
    } catch (error) {
      layerLoadError = errorMessage(error)
    }
  }

  async function loadLayerIfReady(state: EcmwfProviderState) {
    if (!mapInstance) return
    await loadLayer(mapInstance, state, () => false)
  }

  function handleTimeSliderActiveChange(active: boolean) {
    timeSliderActive = active
  }

  function handleGlobalTimeIndexInput(nextGlobalTimeIndex: number) {
    try {
      const next = updateEcmwfStateForGlobalTimeIndex(datasetState.providerConfigs.ECMWF, nextGlobalTimeIndex, ecmwfCatalog)
      setEcmwfConfig(next)
      displayValidTime = 'Release slider to update valid time…'
      layerLoadError = null
    } catch (error) {
      layerLoadError = errorMessage(error)
    }
  }

  function handleGlobalTimeIndexCommit() {
    timeSliderActive = false
    void commitEcmwfSelection()
  }

  function handleStepSliderActiveChange(active: boolean) {
    stepSliderActive = active
  }

  function handleStepIndexInput(stepIndex: number) {
    const next = updateEcmwfStateForStepIndex(datasetState.providerConfigs.ECMWF, stepIndex)
    setEcmwfConfig(next)
    displayValidTime = 'Release slider to update valid time…'
    layerLoadError = null
  }

  function handleStepIndexCommit() {
    stepSliderActive = false
    void commitEcmwfSelection()
  }

  async function handleVariableChange(variableKey: EcmwfVariableKey) {
    const next = updateEcmwfStateForVariable(datasetState.providerConfigs.ECMWF, variableKey)
    setEcmwfConfig(next)
    const nextDisplay = ecmwfDisplaySettings(next)
    layerLoadError = null
    validTimeError = null

    if (!ecmwfLayerBundle) return

    reloadingLayer = true
    try {
      await ecmwfLayerBundle.layer.setVariable(variableKey)
      ecmwfLayerBundle.layer.setClim(nextDisplay.clim)
      ecmwfLayerBundle.layer.setColormap(ecmwfColorMapStopsForZarrLayer(nextDisplay.colormap))
      reloadingLayer = false
      await refreshDisplayValidTime(next)
    } catch (error) {
      reloadingLayer = false
      layerLoadError = errorMessage(error)
    }
  }

  function handleDisplayOverrideChange(override: { clim: [number, number]; colormap: EcmwfColorMapKey }) {
    const state = datasetState.providerConfigs.ECMWF
    const next = updateEcmwfDisplayOverride(state, state.variableKey, override)
    setEcmwfConfig(next)

    if (!ecmwfLayerBundle) return
    ecmwfLayerBundle.layer.setClim(override.clim)
    ecmwfLayerBundle.layer.setColormap(ecmwfColorMapStopsForZarrLayer(override.colormap))
  }

  onMount(() => {
    if (!mapNode) {
      status = { loadingState: status.loadingState, error: 'Map container was not mounted.' }
      return
    }

    let cancelled = false
    const map = new maplibregl.Map({
      container: mapNode,
      style: {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors',
          },
        },
        layers: [
          { id: 'bg', type: 'background', paint: { 'background-color': '#07111f' } },
          { id: 'osm-boundaries', type: 'raster', source: 'osm', paint: { 'raster-opacity': 0.82 } },
        ],
      },
      center: [121, -24],
      zoom: 3,
      pitch: 0,
      bearing: 0,
      attributionControl: { compact: true },
    })
    mapInstance = map

    map.on('load', () => {
      void (async () => {
        try {
          map.setProjection({ type: 'globe' } as maplibregl.ProjectionSpecification)
          await loadInventoryCatalog()
          if (cancelled) return
          const current = datasetState.providerConfigs.ECMWF
          const next = createEcmwfState(current.variableKey, selectedDate, ecmwfCatalog)
          setEcmwfConfig({ ...next, overrideByVar: current.overrideByVar })
          await loadLayer(map, { ...next, overrideByVar: current.overrideByVar }, () => cancelled)
        } catch (error) {
          if (cancelled) return
          layerLoadError = errorMessage(error)
          status = { loadingState: status.loadingState, error: layerLoadError }
          reloadingLayer = false
        }
      })()
    })

    return () => {
      cancelled = true
      mapInstance = undefined
      map.remove()
    }
  })
</script>

<svelte:head>
  <title>ECMWF WebViz</title>
</svelte:head>

<Styles icons={false} />

<main class="shell">
  <div class="map" bind:this={mapNode}></div>

  <div class="valid-time-badge" aria-live="polite">
    {displayValidTime}
  </div>

  {#if reloadingLayer}
    <div class="layer-status" aria-live="polite" aria-label="Loading ECMWF reference">
      <Spinner color="light" />
    </div>
  {:else if layerLoadError}
    <div class="layer-status error-status" aria-live="polite">
      {layerLoadError}
    </div>
  {/if}

  <MainSideBar
    referencePath={ecmwfConfig.refPath}
    selectedDate={selectedDate}
    globalTimeIndex={globalTimeIndex}
    maxGlobalTimeIndex={maxGlobalTimeIndex}
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

  <DevToolsMenu
    localRangeCoalescing={localRangeCoalescing}
    reloadingLayer={reloadingLayer}
    loading={status.loadingState.loading}
    metadata={status.loadingState.metadata}
    chunks={status.loadingState.chunks}
    layerAdded={layerAdded}
    mapReady={Boolean(mapInstance)}
    onLocalRangeCoalescingChange={updateLocalRangeCoalescing}
    onReloadLayer={reloadLayer}
  />
</main>
