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
  <span class="section-label">Variable</span>
  <Dropdown direction="down">
    <DropdownToggle caret class="sidebar-dropdown-toggle"
      >{ecmwfDisplayVariables[variableKey].label}</DropdownToggle
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
</style>
