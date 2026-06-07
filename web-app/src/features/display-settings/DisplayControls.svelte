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
    margin: 0.25rem 0 0.5rem;
  }

  .section-label {
    color: #9ca3af;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
</style>
