<script lang="ts">
  import type { Snippet } from 'svelte'
  import { onDestroy, onMount } from 'svelte'
  import { clampSideBarWidth, collapseSideBar, expandSideBar, type SideBarState } from '@/components/sidebar/sideBarState'

  type Props = { sideBarState: SideBarState; onStateChange: (next: SideBarState) => void; ariaLabel?: string; style?: string; children?: Snippet }
  let { sideBarState, onStateChange, ariaLabel = 'Dataset main sidebar', style = '', children }: Props = $props()
  let isResizing = $state(false)

  function toggleCollapsed() { onStateChange(sideBarState.collapsed ? expandSideBar(sideBarState, window.innerWidth) : collapseSideBar(sideBarState)) }
  function handleMouseMove(event: MouseEvent) { if (!isResizing) return; event.preventDefault(); const nextWidthPx = clampSideBarWidth(event.clientX, window.innerWidth); onStateChange({ collapsed: false, widthPx: nextWidthPx, previousWidthPx: nextWidthPx }) }
  function stopResize() { isResizing = false; window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', stopResize) }
  function startResize(event: MouseEvent) { if (sideBarState.collapsed) return; event.preventDefault(); isResizing = true; window.addEventListener('mousemove', handleMouseMove); window.addEventListener('mouseup', stopResize) }

  onMount(() => {
    function clampToViewport() {
      if (sideBarState.collapsed) return
      const nextWidthPx = clampSideBarWidth(sideBarState.widthPx, window.innerWidth)
      if (nextWidthPx !== sideBarState.widthPx) onStateChange({ collapsed: false, widthPx: nextWidthPx, previousWidthPx: nextWidthPx })
    }
    clampToViewport(); window.addEventListener('resize', clampToViewport)
    return () => window.removeEventListener('resize', clampToViewport)
  })

  onDestroy(stopResize)
</script>

<aside class="sideBarShell" class:collapsed={sideBarState.collapsed} class:resizing={isResizing} style={`--side-bar-width: ${sideBarState.widthPx}px; ${style}`} aria-label={ariaLabel}>
  <button class="collapse-button" type="button" aria-label={sideBarState.collapsed ? 'Expand main sidebar' : 'Collapse main sidebar'} aria-expanded={!sideBarState.collapsed} onclick={toggleCollapsed}>{sideBarState.collapsed ? '›' : '‹'}</button>
  <div class="sidebar-content" aria-hidden={sideBarState.collapsed}>{#if children}{@render children()}{/if}</div>
  <button class="resize-handle" class:active={isResizing} type="button" aria-label="Resize main sidebar" title="Drag to resize" onmousedown={startResize}></button>
</aside>

<style>
  .sideBarShell { position:absolute; top:0; left:0; z-index:2; width:var(--side-bar-width); height:100%; max-width:35vw; min-width:min(240px,35vw); padding:1rem 1.25rem 1rem 1rem; border:0 solid var(--panel-border); border-right-width:1px; border-radius:0 16px 16px 0; background:var(--panel); backdrop-filter:blur(14px); box-shadow:0 18px 50px rgba(0,0,0,0.35); transition:width 140ms ease,min-width 140ms ease,padding 140ms ease; }
  .sideBarShell.resizing { transition:none; }
  .sideBarShell.collapsed { width:2.75rem; min-width:2.75rem; padding:0.5rem; }
  .sidebar-content { height:100%; overflow:auto; }
  .collapsed .sidebar-content { display:none; }
  .collapse-button, .resize-handle { border:1px solid var(--panel-border); color:var(--text); background:rgba(255,255,255,0.08); }
  .collapse-button { position:absolute; top:50%; right:-0.9rem; z-index:2; display:grid; width:1.8rem; height:1.8rem; place-items:center; border-radius:999px; transform:translateY(-50%); cursor:pointer; }
  .resize-handle { position:absolute; top:0; right:-0.25rem; bottom:0; width:0.5rem; padding:0; border:0; border-radius:0; background:transparent; cursor:ew-resize; }
  .resize-handle.active { background:rgba(255,255,255,0.08); }
  .collapsed .resize-handle { display:none; }
</style>
