<script lang="ts">
  import { onMount } from 'svelte'
  import {
    clampSidebarWidth,
    collapseSidebar,
    expandSidebar,
    resizeSidebarWidth,
    type SidebarState,
  } from './sidebarState'

  type Props = {
    refPath: string
    variable: string
    units: string
    timeIndex: number
    stepIndex: number
    clim: readonly [number, number]
    collapsed: boolean
    widthPx: number
    previousWidthPx: number
    error?: string | null
    onSidebarStateChange: (next: SidebarState) => void
  }

  let {
    refPath,
    variable,
    units,
    timeIndex,
    stepIndex,
    clim,
    collapsed,
    widthPx,
    previousWidthPx,
    error = null,
    onSidebarStateChange,
  }: Props = $props()

  function currentState(): SidebarState {
    return { collapsed, widthPx, previousWidthPx }
  }

  function toggleCollapsed() {
    const next = collapsed ? expandSidebar(currentState(), window.innerWidth) : collapseSidebar(currentState())
    onSidebarStateChange(next)
  }

  function startResize(event: PointerEvent) {
    if (collapsed) return

    event.preventDefault()
    const startX = event.clientX
    const startWidthPx = widthPx

    function handlePointerMove(moveEvent: PointerEvent) {
      const nextWidthPx = resizeSidebarWidth(startWidthPx, moveEvent.clientX - startX, window.innerWidth)
      onSidebarStateChange({ collapsed: false, widthPx: nextWidthPx, previousWidthPx: nextWidthPx })
    }

    function stopResize() {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', stopResize)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', stopResize)
  }

  onMount(() => {
    function clampToViewport() {
      if (collapsed) return
      const nextWidthPx = clampSidebarWidth(widthPx, window.innerWidth)
      if (nextWidthPx !== widthPx) {
        onSidebarStateChange({ collapsed: false, widthPx: nextWidthPx, previousWidthPx: nextWidthPx })
      }
    }

    clampToViewport()
    window.addEventListener('resize', clampToViewport)

    return () => {
      window.removeEventListener('resize', clampToViewport)
    }
  })
</script>

<aside
  class="sliderSideBar"
  class:collapsed
  style={`--slider-sidebar-width: ${widthPx}px`}
  aria-label="Dataset slider sidebar"
>
  <button
    class="collapse-button"
    type="button"
    aria-label={collapsed ? 'Expand slider sidebar' : 'Collapse slider sidebar'}
    aria-expanded={!collapsed}
    onclick={toggleCollapsed}
  >
    {collapsed ? '›' : '‹'}
  </button>

  <div class="sidebar-content" aria-hidden={collapsed}>
    <h1>ECMWF MapLibre smoke</h1>
    <div class="meta">
      <span>ref: <code>{refPath}</code></span>
      <span>variable: <code>{variable}</code></span>
      <span>units: <code>{units}</code></span>
      <span>timeIndex: <code>{timeIndex}</code></span>
      <span>stepIndex: <code>{stepIndex}</code></span>
    </div>

    <div class="legend" aria-hidden="true"></div>
    <div class="legend-labels" aria-label="thermal color scale">
      <span>{clim[0]} {units}</span>
      <span>{clim[1]} {units}</span>
    </div>

    {#if error}
      <p class="error">{error}</p>
    {/if}
  </div>

  <button
    class="resize-handle"
    type="button"
    aria-label="Resize slider sidebar"
    title="Drag to resize"
    onpointerdown={startResize}
  ></button>
</aside>

<style>
  .sliderSideBar {
    position: absolute;
    top: 1rem;
    left: 1rem;
    z-index: 2;
    width: var(--slider-sidebar-width);
    max-width: 30vw;
    min-width: min(240px, 30vw);
    padding: 1rem;
    border: 1px solid var(--panel-border);
    border-radius: 16px;
    background: var(--panel);
    backdrop-filter: blur(14px);
    box-shadow: 0 18px 50px rgba(0, 0, 0, 0.35);
    transition: width 140ms ease, min-width 140ms ease, padding 140ms ease;
  }

  .sliderSideBar.collapsed {
    width: 2.75rem;
    min-width: 2.75rem;
    padding: 0.5rem;
  }

  .sidebar-content {
    overflow: hidden;
  }

  .collapsed .sidebar-content {
    display: none;
  }

  h1 {
    margin: 0 0 0.75rem;
    font-size: 1.2rem;
  }

  .meta {
    display: grid;
    gap: 0.25rem;
    margin-bottom: 0.75rem;
    color: var(--muted);
  }

  .legend {
    height: 12px;
    border-radius: 999px;
    background: var(--thermal-gradient);
    margin: 0.75rem 0 0.3rem;
  }

  .legend-labels {
    display: flex;
    justify-content: space-between;
    color: var(--muted);
    font-size: 0.8rem;
    margin-bottom: 0.75rem;
  }

  .error {
    color: var(--error);
  }

  .collapse-button,
  .resize-handle {
    border: 1px solid var(--panel-border);
    color: var(--text);
    background: rgba(255, 255, 255, 0.08);
  }

  .collapse-button {
    position: absolute;
    top: 0.65rem;
    right: 0.65rem;
    display: grid;
    width: 1.8rem;
    height: 1.8rem;
    place-items: center;
    border-radius: 999px;
    cursor: pointer;
  }

  .resize-handle {
    position: absolute;
    top: 0.75rem;
    right: -0.45rem;
    bottom: 0.75rem;
    width: 0.45rem;
    padding: 0;
    border-radius: 999px;
    cursor: ew-resize;
  }

  .collapsed .resize-handle {
    display: none;
  }
</style>
