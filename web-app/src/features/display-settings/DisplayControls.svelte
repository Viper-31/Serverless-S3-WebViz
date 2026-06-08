<script lang="ts">
  import {
    Dropdown,
    DropdownMenu,
    DropdownToggle,
  } from "@sveltestrap/sveltestrap";
  import {
    ecmwfColorMaps,
    type EcmwfColorMapKey,
  } from "@/features/display-settings/display";
  type Props = {
    displayClim: readonly [number, number];
    displayColormap: EcmwfColorMapKey;
    onDisplayOverrideChange: (override: {
      clim: [number, number];
      colormap: EcmwfColorMapKey;
    }) => void;
  };

  let { displayClim, displayColormap, onDisplayOverrideChange }: Props =
    $props();

  function handleClimMinChange(event: Event) {
    onDisplayOverrideChange({
      clim: [
        Number((event.currentTarget as HTMLInputElement).value),
        displayClim[1],
      ],
      colormap: displayColormap,
    });
  }
  function handleClimMaxChange(event: Event) {
    onDisplayOverrideChange({
      clim: [
        displayClim[0],
        Number((event.currentTarget as HTMLInputElement).value),
      ],
      colormap: displayColormap,
    });
  }
  function handleColormapChange(event: Event) {
    onDisplayOverrideChange({
      clim: [displayClim[0], displayClim[1]],
      colormap: (event.currentTarget as HTMLSelectElement)
        .value as EcmwfColorMapKey,
    });
  }
</script>

<div class="dropdown-row">
  <span class="section-label">Display overrides</span>
  <Dropdown direction="down">
    <DropdownToggle caret class="sidebar-dropdown-toggle"
      >{displayColormap}</DropdownToggle
    >
    <DropdownMenu class="display-menu">
      <div role="group" aria-label="Display settings">
        <label
          ><span>Colour map</span><select
            value={displayColormap}
            onchange={handleColormapChange}
            >{#each Object.keys(ecmwfColorMaps) as key}<option value={key}
                >{key}</option
              >{/each}</select
          ></label
        >
        <label
          ><span>clim min</span><input
            type="number"
            value={displayClim[0]}
            step="any"
            onchange={handleClimMinChange}
          /></label
        >
        <label
          ><span>clim max</span><input
            type="number"
            value={displayClim[1]}
            step="any"
            onchange={handleClimMaxChange}
          /></label
        >
      </div>
    </DropdownMenu>
  </Dropdown>
</div>

<style>
  .dropdown-row {
    display: grid;
    gap: 0.45rem;
    margin: 0.25rem 0 0.5rem;
  }

  .section-label {
    color: #9ca3af;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  :global(.display-menu) {
    border: 1px solid rgba(148, 163, 184, 0.24);
    color: var(--text);
    background: rgba(15, 23, 42, 0.98);
    box-shadow: 0 18px 48px rgba(0, 0, 0, 0.36);
  }

  :global(.display-menu label) {
    display: grid;
    gap: 0.35rem;
    min-width: 13rem;
    padding: 0.35rem 0.75rem;
  }

  :global(.display-menu span) {
    color: var(--muted);
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  :global(.display-menu select),
  :global(.display-menu input) {
    width: 100%;
    border: 1px solid rgba(148, 163, 184, 0.28);
    border-radius: 8px;
    padding: 0.4rem 0.55rem;
    color: var(--text);
    color-scheme: dark;
    background: rgba(2, 6, 23, 0.8);
  }

  :global(.display-menu select:focus),
  :global(.display-menu input:focus) {
    border-color: rgba(125, 211, 252, 0.72);
    box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.18);
    outline: none;
  }
</style>
