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
  <Dropdown direction="down">
    <DropdownToggle caret class="sidebar-dropdown-toggle"
      >Display: {displayColormap}</DropdownToggle
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

  .sidebar-dropdown-toggle {
    width: 100%;
    text-align: left;
  }

  .display-menu {
    padding: 0.5rem;
    min-width: 18rem;
  }

  .display-menu :global(label) {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    margin-bottom: 0.5rem;
  }

  .display-menu :global(input),
  .display-menu :global(select) {
    width: 100%;
  }
</style>
