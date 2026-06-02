<script lang="ts">
  import { onMount } from 'svelte'
  import maplibregl from 'maplibre-gl'
  import {
    createEcmwfSmokeLayer,
    ECMWF_SMOKE_REF_PATH,
    ECMWF_SMOKE_CLIM,
    ECMWF_SMOKE_STEP_INDEX,
    ECMWF_SMOKE_TIME_INDEX,
    ECMWF_SMOKE_UNITS,
    ECMWF_SMOKE_VARIABLE,
    type EcmwfSmokeLoadingState,
  } from './lib/mapRendering/ecmwfSmokeLayer'

  // WA_BOUNDS = [[-42.0, 106.0], [-10.0, 135.0]]; zarr-layer equivalent [106.0, -42.0, 135.0, -10.0]
  // The smoke test lets zarr-layer derive bounds first. Use the zarr-layer bounds above only if derived bounds are wrong.

  type Status = { loadingState: EcmwfSmokeLoadingState; error: string | null }

  let mapNode: HTMLDivElement | undefined
  let status: Status = { loadingState: { loading: true, metadata: true, chunks: true, error: null }, error: null }
  let layerAdded = false

  async function loadLayer(map: maplibregl.Map, isCancelled: () => boolean) {
    const layer = await createEcmwfSmokeLayer({
      onLoadingStateChange(next) {
        if (isCancelled()) return
        status = { loadingState: next, error: next.error?.message ?? null }
      },
    })

    if (isCancelled()) return
    map.addLayer(layer as maplibregl.CustomLayerInterface)
    layerAdded = true
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
        sources: {},
        layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#07111f' } }],
      },
      center: [121, -24],
      zoom: 3,
      pitch: 0,
      bearing: 0,
      attributionControl: false,
    })

    map.on('load', () => {
      void loadLayer(map, () => cancelled).catch((error: unknown) => {
        if (cancelled) return
        status = { loadingState: status.loadingState, error: error instanceof Error ? error.message : String(error) }
      })
    })

    return () => {
      cancelled = true
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
    </div>
    <div class="legend" aria-hidden="true"></div>
    <div class="legend-labels" aria-label="thermal color scale">
      <span>{ECMWF_SMOKE_CLIM[0]} {ECMWF_SMOKE_UNITS}</span>
      <span>{ECMWF_SMOKE_CLIM[1]} {ECMWF_SMOKE_UNITS}</span>
    </div>
    <p>loading: <code>{status.loadingState.loading ? 'true' : 'false'}</code></p>
    <p>metadata: <code>{status.loadingState.metadata ? 'true' : 'false'}</code></p>
    <p>chunks: <code>{status.loadingState.chunks ? 'true' : 'false'}</code></p>
    <p>layerAdded: <code>{layerAdded ? 'true' : 'false'}</code></p>
    {#if status.error}
      <p class="error">{status.error}</p>
    {/if}
  </aside>
</main>
