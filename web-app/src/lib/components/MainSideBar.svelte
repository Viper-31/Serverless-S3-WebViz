<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import {
    clampMainSideBarWidth,
    collapseMainSideBar,
    expandMainSideBar,
    type MainSideBarState,
  } from "./mainSideBarState";

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
    onMainSideBarStateChange: (next: MainSideBarState) => void
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
    onMainSideBarStateChange,
  }: Props = $props();

  let isResizing = $state(false);

  function currentState(): MainSideBarState {
    return { collapsed, widthPx, previousWidthPx };
  }

  function toggleCollapsed() {
    const next = collapsed
      ? expandMainSideBar(currentState(), window.innerWidth)
      : collapseMainSideBar(currentState());
    onMainSideBarStateChange(next);
  }

  function handleMouseMove(event: MouseEvent) {
    if (!isResizing) return;

    event.preventDefault();
    const nextWidthPx = clampMainSideBarWidth(
      event.clientX,
      window.innerWidth,
    );
    onMainSideBarStateChange({
      collapsed: false,
      widthPx: nextWidthPx,
      previousWidthPx: nextWidthPx,
    });
  }

  function stopResize() {
    isResizing = false;
    window.removeEventListener("mousemove", handleMouseMove);
    window.removeEventListener("mouseup", stopResize);
  }

  function startResize(event: MouseEvent) {
    if (collapsed) return;

    event.preventDefault();
    isResizing = true;
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", stopResize);
  }

  onMount(() => {
    function clampToViewport() {
      if (collapsed) return;
      const nextWidthPx = clampMainSideBarWidth(widthPx, window.innerWidth);
      if (nextWidthPx !== widthPx) {
        onMainSideBarStateChange({
          collapsed: false,
          widthPx: nextWidthPx,
          previousWidthPx: nextWidthPx,
        });
      }
    }

    clampToViewport();
    window.addEventListener("resize", clampToViewport);

    return () => {
      window.removeEventListener("resize", clampToViewport);
    };
  });

  onDestroy(() => {
    stopResize();
  });
</script>

<aside
  class="mainSideBar"
  class:collapsed
  class:resizing={isResizing}
  style={`--main-sidebar-width: ${widthPx}px`}
  aria-label="Dataset main sidebar"
>
  <button
    class="collapse-button"
    type="button"
    aria-label={collapsed ? 'Expand main sidebar' : 'Collapse main sidebar'}
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
    class:active={isResizing}
    type="button"
    aria-label="Resize main sidebar"
    title="Drag to resize"
    onmousedown={startResize}
  ></button>
</aside>

<style>
  .mainSideBar {
    position: absolute;
    top: 0;
    left: 0;
    z-index: 2;
    width: var(--main-sidebar-width);
    height: 100%;
    max-width: 35vw;
    min-width: min(240px, 35vw);
    padding: 1rem 1.25rem 1rem 1rem;
    border: 0 solid var(--panel-border);
    border-right-width: 1px;
    border-radius: 0 16px 16px 0;
    background: var(--panel);
    backdrop-filter: blur(14px);
    box-shadow: 0 18px 50px rgba(0, 0, 0, 0.35);
    transition: width 140ms ease, min-width 140ms ease, padding 140ms ease;
  }

  .mainSideBar.resizing {
    transition: none;
  }

  .mainSideBar.collapsed {
    width: 2.75rem;
    min-width: 2.75rem;
    padding: 0.5rem;
  }

  .sidebar-content {
    height: 100%;
    overflow: auto;
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
    top: 50%;
    right: -0.9rem;
    z-index: 2;
    display: grid;
    width: 1.8rem;
    height: 1.8rem;
    place-items: center;
    border-radius: 999px;
    transform: translateY(-50%);
    cursor: pointer;
  }

  .resize-handle {
    position: absolute;
    top: 0;
    right: -0.25rem;
    bottom: 0;
    width: 0.5rem;
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
    cursor: ew-resize;
  }

  .resize-handle.active {
    background: rgba(255, 255, 255, 0.08);
  }

  .collapsed .resize-handle {
    display: none;
  }
</style>
