<script lang="ts">
  import { onMount } from 'svelte'
  import maplibregl from 'maplibre-gl'
  import {
    createEcmwfSmokeLayer,
    ECMWF_SMOKE_LAYER_ID,
    ECMWF_SMOKE_REF_PATH,
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

  <aside class="overlay">
    <h1>ECMWF MapLibre smoke</h1>
    <div class="meta">
      <span>ref: <code>{ECMWF_SMOKE_REF_PATH}</code></span>
      <span>variable: <code>{ECMWF_SMOKE_VARIABLE}</code></span>
      <span>units: <code>{ECMWF_SMOKE_UNITS}</code></span>
      <span>timeIndex: <code>{ECMWF_SMOKE_TIME_INDEX}</code></span>
      <span>stepIndex: <code>{ECMWF_SMOKE_STEP_INDEX}</code></span>
      <span>local range coalescing: <code>{localRangeCoalescing ? 'on' : 'off'}</code></span>
    </div>
    <details class="dev-tools">
      <summary>Dev tools</summary>
      <label>
        <input type="checkbox" bind:checked={localRangeCoalescing} disabled={reloadingLayer} />
        local range coalescing
      </label>
      <button type="button" onclick={reloadLayer} disabled={reloadingLayer || !mapInstance}>
        {reloadingLayer ? 'Reloading…' : 'Reload layer'}
      </button>
    </details>
    <div class="legend" aria-hidden="true"></div>
    <div class="legend-labels" aria-label="thermal color scale">
      <span>{ECMWF_SMOKE_CLIM[0]} {ECMWF_SMOKE_UNITS}</span>
      <span>{ECMWF_SMOKE_CLIM[1]} {ECMWF_SMOKE_UNITS}</span>
    </div>
    <p>loading: <code>{status.loadingState.loading ? 'true' : 'false'}</code></p>
    <p>metadata: <code>{status.loadingState.metadata ? 'true' : 'false'}</code></p>
    <p>chunks: <code>{status.loadingState.chunks ? 'true' : 'false'}</code></p>
    <p>layerAdded: <code>{layerAdded ? 'true' : 'false'}</code></p>
    <p class="hint">Toggle local range coalescing in Dev tools, then reload the layer to compare network behavior.</p>
    {#if status.error}
      <p class="error">{status.error}</p>
    {/if}
  </aside>
</main>
