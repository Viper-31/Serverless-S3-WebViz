<script lang="ts">
  import {
    Dropdown,
    DropdownItem,
    DropdownMenu,
    DropdownToggle,
  } from "@sveltestrap/sveltestrap";
  import {
    ecmwfDisplayVariableKeys,
    ecmwfDisplayVariables,
    type EcmwfVariableKey,
  } from "@/features/display-settings/display";
  type Props = {
    variableKey: EcmwfVariableKey;
    onVariableChange: (variableKey: EcmwfVariableKey) => void;
  };

  let { variableKey, onVariableChange }: Props = $props();
</script>

<div class="dropdown-row">
  <Dropdown direction="down">
    <DropdownToggle caret class="sidebar-dropdown-toggle"
      >Variable: {ecmwfDisplayVariables[variableKey].label}</DropdownToggle
    >
    <DropdownMenu>
      {#each ecmwfDisplayVariableKeys as key}
        <DropdownItem
          active={key === variableKey}
          onclick={() => onVariableChange(key)}
          >{ecmwfDisplayVariables[key].label}</DropdownItem
        >
      {/each}
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
</style>
