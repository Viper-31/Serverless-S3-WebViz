<script lang="ts">
  import { onMount } from 'svelte'
  import maplibregl from 'maplibre-gl'
  import DevToolsMenu from './lib/components/DevToolsMenu.svelte'
  import MainSideBar from './lib/components/MainSideBar.svelte'
  import { getDefaultMainSideBarWidth, type MainSideBarState } from './lib/components/mainSideBarState'
  import {
    createEcmwfSmokeLayer,
    ECMWF_SMOKE_LAYER_ID,
    ECMWF_SMOKE_REF,
    ECMWF_SMOKE_CLIM,
    ECMWF_SMOKE_STEP_INDEX,
    ECMWF_SMOKE_TIME_INDEX,
    ECMWF_SMOKE_UNITS,
    ECMWF_SMOKE_VARIABLE,
    type EcmwfSmokeLoadingState,
  } from './lib/mapRendering/ecmwfSmokeLayer'


  type Status = { loadingState: EcmwfSmokeLoadingState; error: string | null }

  let mapNode: HTMLDivElement | undefined
  let status: Status = { loadingState: { loading: true, metadata: true, chunks: true, error: null }, error: null }
  let layerAdded = false
  let localRangeCoalescing = true
  let mapInstance: maplibregl.Map | undefined
  let reloadingLayer = false
  const initialMainSideBarWidthPx = getDefaultMainSideBarWidth(typeof window === 'undefined' ? 1024 : window.innerWidth)
  let mainSideBarState: MainSideBarState = {
    collapsed: false,
    widthPx: initialMainSideBarWidthPx,
    previousWidthPx: initialMainSideBarWidthPx,
  }

  async function loadLayer(map: maplibregl.Map, isCancelled: () => boolean) {
    reloadingLayer = true
    layerAdded = false
    status = { loadingState: { loading: true, metadata: true, chunks: true, error: null }, error: null }

    if (map.getLayer(ECMWF_SMOKE_LAYER_ID)) {
      map.removeLayer(ECMWF_SMOKE_LAYER_ID)
    }

    const layer = await createEcmwfSmokeLayer({
      localRangeCoalescing,
      onLoadingStateChange(next) {
        if (isCancelled()) return
        status = { loadingState: next, error: next.error?.message ?? null }
      },
    })

    if (isCancelled()) {
      reloadingLayer = false
      return
    }

    map.addLayer(layer as maplibregl.CustomLayerInterface)
    layerAdded = true
    reloadingLayer = false
  }

  function reloadLayer() {
    if (!mapInstance) return
    void loadLayer(mapInstance, () => false).catch((error: unknown) => {
      status = { loadingState: status.loadingState, error: error instanceof Error ? error.message : String(error) }
      reloadingLayer = false
    })
  }

  function updateMainSideBarState(next: MainSideBarState) {
    mainSideBarState = next
  }

  function updateLocalRangeCoalescing(next: boolean) {
    localRangeCoalescing = next
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
      void loadLayer(map, () => cancelled).catch((error: unknown) => {
        if (cancelled) return
        status = { loadingState: status.loadingState, error: error instanceof Error ? error.message : String(error) }
        reloadingLayer = false
      })
    })

    return () => {
      cancelled = true
      mapInstance = undefined
      map.remove()
    }
  })
</script>

<svelte:head>
  <title>ECMWF smoke</title>
</svelte:head>

<main class="shell">
  <div class="map" bind:this={mapNode}></div>

  <MainSideBar
    ref={ECMWF_SMOKE_REF}
    variable={ECMWF_SMOKE_VARIABLE}
    units={ECMWF_SMOKE_UNITS}
    timeIndex={ECMWF_SMOKE_TIME_INDEX}
    stepIndex={ECMWF_SMOKE_STEP_INDEX}
    clim={ECMWF_SMOKE_CLIM}
    collapsed={mainSideBarState.collapsed}
    widthPx={mainSideBarState.widthPx}
    previousWidthPx={mainSideBarState.previousWidthPx}
    error={status.error}
    onMainSideBarStateChange={updateMainSideBarState}
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
