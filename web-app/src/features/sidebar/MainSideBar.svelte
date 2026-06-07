<script lang="ts">
  import SideBarShell from '@/components/sidebar/SideBarShell.svelte'
  import type { SideBarState } from '@/components/sidebar/sideBarState'
  import { ecmwfColorMaps, type EcmwfColorMapKey, type EcmwfVariableKey } from '@/features/display-settings/display'
  import DisplayControls from '@/features/display-settings/DisplayControls.svelte'
  import TimeControls from '@/features/time-navigation/TimeControls.svelte'
  import VariableSelector from '@/features/variable-selection/VariableSelector.svelte'

  type Props = {
    referencePath: string
    selectedDate: string
    globalTimeIndex: number
    maxGlobalTimeIndex: number
    ecmwfTimeIndex: number
    ecmwfStepIndex: number
    maxStepIndex: number
    variableKey: EcmwfVariableKey
    displayClim: readonly [number, number]
    displayColormap: EcmwfColorMapKey
    collapsed: boolean
    widthPx: number
    previousWidthPx: number
    error?: string | null
    onMainSideBarStateChange: (next: SideBarState) => void
    onDateChange: (dateIso: string) => void
    onTimeSliderActiveChange: (active: boolean) => void
    onGlobalTimeIndexInput: (globalTimeIndex: number) => void
    onGlobalTimeIndexCommit: () => void
    onStepSliderActiveChange: (active: boolean) => void
    onStepIndexInput: (stepIndex: number) => void
    onStepIndexCommit: () => void
    onVariableChange: (variableKey: EcmwfVariableKey) => void
    onDisplayOverrideChange: (override: { clim: [number, number]; colormap: EcmwfColorMapKey }) => void
  }

  let {
    referencePath,
    selectedDate,
    globalTimeIndex,
    maxGlobalTimeIndex,
    ecmwfTimeIndex,
    ecmwfStepIndex,
    maxStepIndex,
    variableKey,
    displayClim,
    displayColormap,
    collapsed,
    widthPx,
    previousWidthPx,
    error = null,
    onMainSideBarStateChange,
    onDateChange,
    onTimeSliderActiveChange,
    onGlobalTimeIndexInput,
    onGlobalTimeIndexCommit,
    onStepSliderActiveChange,
    onStepIndexInput,
    onStepIndexCommit,
    onVariableChange,
    onDisplayOverrideChange,
  }: Props = $props()
</script>

<SideBarShell sideBarState={{ collapsed, widthPx, previousWidthPx }} onStateChange={onMainSideBarStateChange}>
  <div class="sidebar-inner" style={`--ecmwf-legend-gradient: ${ecmwfColorMaps[displayColormap].gradient}`}>
    <h1>ECMWF configuration</h1>

    <section class="submenu" aria-label="ECMWF configuration">
      <TimeControls
        {selectedDate}
        {globalTimeIndex}
        {maxGlobalTimeIndex}
        {ecmwfTimeIndex}
        {ecmwfStepIndex}
        {maxStepIndex}
        onDateChange={onDateChange}
        onTimeSliderActiveChange={onTimeSliderActiveChange}
        onGlobalTimeIndexInput={onGlobalTimeIndexInput}
        onGlobalTimeIndexCommit={onGlobalTimeIndexCommit}
        onStepSliderActiveChange={onStepSliderActiveChange}
        onStepIndexInput={onStepIndexInput}
        onStepIndexCommit={onStepIndexCommit}
      />
      <VariableSelector {variableKey} onVariableChange={onVariableChange} />
      <DisplayControls {displayClim} {displayColormap} onDisplayOverrideChange={onDisplayOverrideChange} />
    </section>

    <div class="meta">
      <span>reference: <code>{referencePath}</code></span>
      <span>variable: <code>{variableKey}</code></span>
      <span>clim: <code>{displayClim[0]} – {displayClim[1]}</code></span>
    </div>

    <div class="legend" aria-hidden="true"></div>
    <div class="legend-labels" aria-label="ECMWF color scale">
      <span>{displayClim[0]}</span>
      <span>{displayClim[1]}</span>
    </div>

    {#if error}
      <p class="error-text">{error}</p>
    {/if}
  </div>
</SideBarShell>

<style>
  .sidebar-inner {
    height: 100%;
    overflow: auto;
  }

  h1 {
    margin: 0 0 0.75rem;
    font-size: 1.2rem;
  }

  .submenu {
    display: grid;
    gap: 0.65rem;
    margin-bottom: 0.9rem;
  }

  .meta {
    display: grid;
    gap: 0.65rem;
    margin-bottom: 0.75rem;
    color: var(--muted);
    font-size: 0.82rem;
  }

  .legend {
    height: 12px;
    margin: 0.75rem 0 0.3rem;
    border-radius: 999px;
    background: var(--ecmwf-legend-gradient);
  }

  .legend-labels {
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.75rem;
    color: var(--muted);
    font-size: 0.8rem;
  }

  .error-text {
    color: var(--error);
  }
</style>
