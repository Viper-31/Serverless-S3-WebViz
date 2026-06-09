<script lang="ts">
  import type { EcmwfVariableKey } from "@/features/display-settings/display";

  type Props = {
    referencePath: string;
    variableKey: EcmwfVariableKey;
    localRangeCoalescing: boolean;
    reloadingLayer: boolean;
    loading: boolean;
    metadata: boolean;
    chunks: boolean;
    layerAdded: boolean;
    mapReady: boolean;
    onLocalRangeCoalescingChange: (next: boolean) => void;
    onReloadLayer: () => void;
  };

  let {
    referencePath,
    variableKey,
    localRangeCoalescing,
    reloadingLayer,
    loading,
    metadata,
    chunks,
    layerAdded,
    mapReady,
    onLocalRangeCoalescingChange,
    onReloadLayer,
  }: Props = $props();

  let expanded = $state(false);

  function toggleExpanded() {
    expanded = !expanded;
  }

  function handleLocalRangeCoalescingChange(event: Event) {
    onLocalRangeCoalescingChange(
      (event.currentTarget as HTMLInputElement).checked,
    );
  }
</script>

<aside class="devToolsMenu" class:expanded aria-label="Dev tools">
  <button
    class="dev-tools-toggle"
    type="button"
    aria-label={expanded ? "Collapse dev tools" : "Expand dev tools"}
    aria-expanded={expanded}
    onclick={toggleExpanded}
  >
    {expanded ? "›" : "‹"}
  </button>

  {#if expanded}
    <div class="dev-tools-content">
      <h2>Dev tools</h2>

      <label>
        <input
          type="checkbox"
          checked={localRangeCoalescing}
          disabled={reloadingLayer}
          onchange={handleLocalRangeCoalescingChange}
        />
        local range coalescing
      </label>

      <button
        class="reload-button"
        type="button"
        onclick={onReloadLayer}
        disabled={reloadingLayer || !mapReady}
      >
        {reloadingLayer ? "Reloading…" : "Reload layer"}
      </button>

      <dl class="flags">
        <div>
          <dt>reference</dt>
          <dd><code>{referencePath}</code></dd>
        </div>
        <div>
          <dt>variable</dt>
          <dd><code>{variableKey}</code></dd>
        </div>
        <div>
          <dt>localRangeCoalescing</dt>
          <dd><code>{localRangeCoalescing ? "true" : "false"}</code></dd>
        </div>
        <div>
          <dt>zarrMetadataloading</dt>
          <dd><code>{loading ? "true" : "false"}</code></dd>
        </div>
        <div>
          <dt>zarrMetadataInit</dt>
          <dd><code>{metadata ? "true" : "false"}</code></dd>
        </div>
        <div>
          <dt>zarrChunksFetching</dt>
          <dd><code>{chunks ? "true" : "false"}</code></dd>
        </div>
        <div>
          <dt>rasterLayerAttachedToMap</dt>
          <dd><code>{layerAdded ? "true" : "false"}</code></dd>
        </div>
      </dl>

      <p class="hint">
        Toggle local range coalescing, then reload the layer to compare network
        behavior.
      </p>
    </div>
  {/if}
</aside>

<style>
  .devToolsMenu {
    position: absolute;
    top: 1rem;
    right: 1rem;
    z-index: 3;
    display: grid;
    justify-items: end;
  }

  .dev-tools-toggle {
    display: grid;
    width: 2.5rem;
    height: 2.5rem;
    place-items: center;
    border-radius: 999px;
    background: #374151;
    color: #ffffff;
    border: 1px solid var(--panel-border);
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    cursor: pointer;
  }

  .reload-button {
    border: 1px solid var(--panel-border);
    color: var(--text);
    background: rgba(255, 255, 255, 0.08);
    cursor: pointer;
  }

  .dev-tools-toggle {
    display: grid;
    width: 2rem;
    height: 2rem;
    place-items: center;
    border-radius: 999px;
    box-shadow: 0 12px 35px rgba(0, 0, 0, 0.28);
  }

  .dev-tools-content {
    width: min(320px, calc(100vw - 2rem));
    margin-top: 0.5rem;
    padding: 1rem;
    border: 1px solid var(--panel-border);
    border-radius: 16px;
    color: var(--muted);
    background: var(--panel);
    backdrop-filter: blur(14px);
    box-shadow: 0 18px 50px rgba(0, 0, 0, 0.35);
  }

  h2 {
    margin: 0 0 0.75rem;
    color: var(--text);
    font-size: 1rem;
  }

  label {
    display: flex;
    gap: 0.4rem;
    align-items: center;
  }

  .reload-button {
    margin-top: 0.65rem;
    border-radius: 999px;
    padding: 0.25rem 0.7rem;
  }

  .reload-button:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }

  .flags {
    display: grid;
    gap: 0.35rem;
    margin: 0.8rem 0;
  }

  .flags div {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
  }

  .flags dt {
    flex: 0 0 auto;
  }

  .flags dd {
    min-width: 0;
    text-align: right;
  }

  .flags code {
    display: inline-block;
    max-width: 190px;
    overflow: hidden;
    text-overflow: ellipsis;
    vertical-align: bottom;
    white-space: nowrap;
  }

  dt,
  dd {
    margin: 0;
  }

  .hint {
    margin: 0;
    color: var(--muted);
    font-size: 0.82rem;
  }
</style>
