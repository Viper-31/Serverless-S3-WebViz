<script lang="ts">
  import { Dropdown, DropdownItem, DropdownMenu, DropdownToggle } from '@sveltestrap/sveltestrap'
  import {
    ecmwfColorMaps,
    ecmwfDisplayVariableKeys,
    ecmwfDisplayVariables,
    type EcmwfColorMapKey,
    type EcmwfVariableKey,
  } from '@/features/display'
  import SideBarShell from '@/components/sidebar/SideBarShell.svelte'
  import type { SideBarState } from '@/components/sidebar/sideBarState'

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

  let lastCommittedTimeIndex: number | null = null
  let lastCommittedStepIndex: number | null = null

  function handleDateChange(event: Event) {
    onDateChange((event.currentTarget as HTMLInputElement).value)
  }

  function handleTimeInput(event: Event) {
    lastCommittedTimeIndex = null
    onGlobalTimeIndexInput(Number((event.currentTarget as HTMLInputElement).value))
  }

  function handleStepInput(event: Event) {
    lastCommittedStepIndex = null
    onStepIndexInput(Number((event.currentTarget as HTMLInputElement).value))
  }

  function handleTimePointerDown() {
    lastCommittedTimeIndex = null
    onTimeSliderActiveChange(true)
  }

  function handleTimeCommit() {
    if (lastCommittedTimeIndex === globalTimeIndex) return
    lastCommittedTimeIndex = globalTimeIndex
    onTimeSliderActiveChange(false)
    onGlobalTimeIndexCommit()
  }

  function handleStepPointerDown() {
    lastCommittedStepIndex = null
    onStepSliderActiveChange(true)
  }

  function handleStepCommit() {
    if (lastCommittedStepIndex === ecmwfStepIndex) return
    lastCommittedStepIndex = ecmwfStepIndex
    onStepSliderActiveChange(false)
    onStepIndexCommit()
  }

  function handleClimMinChange(event: Event) {
    onDisplayOverrideChange({ clim: [Number((event.currentTarget as HTMLInputElement).value), displayClim[1]], colormap: displayColormap })
  }

  function handleClimMaxChange(event: Event) {
    onDisplayOverrideChange({ clim: [displayClim[0], Number((event.currentTarget as HTMLInputElement).value)], colormap: displayColormap })
  }

  function handleColormapChange(event: Event) {
    onDisplayOverrideChange({ clim: [displayClim[0], displayClim[1]], colormap: (event.currentTarget as HTMLSelectElement).value as EcmwfColorMapKey })
  }
</script>

<SideBarShell sideBarState={{ collapsed, widthPx, previousWidthPx }} onStateChange={onMainSideBarStateChange}>
  <div class="sidebar-inner" style={`--ecmwf-legend-gradient: ${ecmwfColorMaps[displayColormap].gradient}`}>
    <h1>ECMWF configuration</h1>

    <section class="submenu" aria-label="ECMWF configuration">
      <div class="field-group">
        <label>
          <span>YYYY</span>
          <input class="year-lock" type="text" value="2024" disabled aria-label="Locked year 2024" />
        </label>

        <label>
          <span>Calendar date</span>
          <input type="date" min="2024-01-01" max="2024-12-31" value={selectedDate} onchange={handleDateChange} />
        </label>
      </div>

      <label class="slider-field">
        <span>Time: global {globalTimeIndex}, ref-local {ecmwfTimeIndex}</span>
        <input type="range" min="0" max={maxGlobalTimeIndex} step="1" value={globalTimeIndex} onpointerdown={handleTimePointerDown} onpointerup={handleTimeCommit} onblur={handleTimeCommit} onchange={handleTimeCommit} oninput={handleTimeInput} />
      </label>

      <label class="slider-field">
        <span>Step: {ecmwfStepIndex}</span>
        <input type="range" min="0" max={maxStepIndex} step="1" value={ecmwfStepIndex} onpointerdown={handleStepPointerDown} onpointerup={handleStepCommit} onblur={handleStepCommit} onchange={handleStepCommit} oninput={handleStepInput} />
      </label>

      <div class="dropdown-row">
        <Dropdown direction="down">
          <DropdownToggle caret class="sidebar-dropdown-toggle">Variable: {ecmwfDisplayVariables[variableKey].label}</DropdownToggle>
          <DropdownMenu>
            {#each ecmwfDisplayVariableKeys as key}
              <DropdownItem active={key === variableKey} onclick={() => onVariableChange(key)}>{ecmwfDisplayVariables[key].label}</DropdownItem>
            {/each}
          </DropdownMenu>
        </Dropdown>
      </div>

      <div class="dropdown-row">
        <Dropdown direction="down" autoClose="outside">
          <DropdownToggle caret class="sidebar-dropdown-toggle">Display</DropdownToggle>
          <DropdownMenu end>
            <div class="display-menu" role="group" aria-label="Display settings">
              <label>
                <span>Colour map</span>
                <select value={displayColormap} onchange={handleColormapChange}>
                  {#each Object.keys(ecmwfColorMaps) as key}
                    <option value={key}>{key}</option>
                  {/each}
                </select>
              </label>
              <label>
                <span>clim min</span>
                <input type="number" value={displayClim[0]} step="any" onchange={handleClimMinChange} />
              </label>
              <label>
                <span>clim max</span>
                <input type="number" value={displayClim[1]} step="any" onchange={handleClimMaxChange} />
              </label>
            </div>
          </DropdownMenu>
        </Dropdown>
      </div>
    </section>

    <div class="meta">
      <span>reference: <code>{referencePath}</code></span>
      <span>variable: <code>{variableKey}</code></span>
      <span>clim: <code>{displayClim[0]} – {displayClim[1]}</code></span>
    </div>

    <div class="legend" aria-hidden="true"></div>
    <div class="legend-labels" aria-label="ECMWF color scale"><span>{displayClim[0]}</span><span>{displayClim[1]}</span></div>

    {#if error}
      <p class="error-text">{error}</p>
    {/if}
  </div>
</SideBarShell>

<style>
  .sidebar-inner { height: 100%; }
  h1 { margin: 0 0 0.75rem; font-size: 1.2rem; }
  .submenu, .field-group, .meta, .display-menu { display: grid; gap: 0.65rem; }
  .submenu { margin-bottom: 0.9rem; }
  label { display: grid; gap: 0.25rem; color: var(--muted); font-size: 0.85rem; }
  input, select { min-width: 0; border: 1px solid var(--panel-border); border-radius: 8px; padding: 0.35rem 0.45rem; color: var(--text); background: rgba(255, 255, 255, 0.08); }
  input[type='range'] { padding: 0; }
  .year-lock { color: var(--muted); opacity: 0.65; }
  .dropdown-row :global(.dropdown-menu) { max-height: min(60vh, 420px); overflow: auto; border: 1px solid var(--panel-border); background: rgba(7, 17, 31, 0.96); box-shadow: 0 18px 50px rgba(0, 0, 0, 0.35); }
  .dropdown-row :global(.dropdown-item) { color: var(--text); }
  .dropdown-row :global(.dropdown-item:hover), .dropdown-row :global(.dropdown-item:focus), .dropdown-row :global(.dropdown-item.active) { color: var(--text); background: rgba(255, 255, 255, 0.12); }
  .dropdown-row :global(.sidebar-dropdown-toggle) { width: 100%; border: 1px solid var(--panel-border); color: var(--text); background: rgba(255, 255, 255, 0.08); text-align: left; }
  .display-menu { width: 220px; padding: 0.75rem; }
  .meta { margin-bottom: 0.75rem; color: var(--muted); font-size: 0.82rem; }
  .legend { height: 12px; border-radius: 999px; background: var(--ecmwf-legend-gradient); margin: 0.75rem 0 0.3rem; }
  .legend-labels { display: flex; justify-content: space-between; color: var(--muted); font-size: 0.8rem; margin-bottom: 0.75rem; }
  .error-text { color: var(--error); }
</style>
