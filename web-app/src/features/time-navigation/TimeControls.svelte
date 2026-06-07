<script lang="ts">
  type Props = {
    selectedDate: string;
    globalTimeIndex: number;
    maxGlobalTimeIndex: number;
    ecmwfTimeIndex: number;
    ecmwfStepIndex: number;
    maxStepIndex: number;
    onDateChange: (dateIso: string) => void;
    onTimeSliderActiveChange: (active: boolean) => void;
    onGlobalTimeIndexInput: (globalTimeIndex: number) => void;
    onGlobalTimeIndexCommit: () => void;
    onStepSliderActiveChange: (active: boolean) => void;
    onStepIndexInput: (stepIndex: number) => void;
    onStepIndexCommit: () => void;
  };

  let {
    selectedDate,
    globalTimeIndex,
    maxGlobalTimeIndex,
    ecmwfTimeIndex,
    ecmwfStepIndex,
    maxStepIndex,
    onDateChange,
    onTimeSliderActiveChange,
    onGlobalTimeIndexInput,
    onGlobalTimeIndexCommit,
    onStepSliderActiveChange,
    onStepIndexInput,
    onStepIndexCommit,
  }: Props = $props();
  let lastCommittedTimeIndex: number | null = null;
  let lastCommittedStepIndex: number | null = null;

  function handleDateChange(event: Event) {
    onDateChange((event.currentTarget as HTMLInputElement).value);
  }
  function handleTimeInput(event: Event) {
    lastCommittedTimeIndex = null;
    onGlobalTimeIndexInput(
      Number((event.currentTarget as HTMLInputElement).value),
    );
  }
  function handleStepInput(event: Event) {
    lastCommittedStepIndex = null;
    onStepIndexInput(Number((event.currentTarget as HTMLInputElement).value));
  }
  function handleTimePointerDown() {
    lastCommittedTimeIndex = null;
    onTimeSliderActiveChange(true);
  }
  function handleTimeCommit() {
    if (lastCommittedTimeIndex === globalTimeIndex) return;
    lastCommittedTimeIndex = globalTimeIndex;
    onTimeSliderActiveChange(false);
    onGlobalTimeIndexCommit();
  }
  function handleStepPointerDown() {
    lastCommittedStepIndex = null;
    onStepSliderActiveChange(true);
  }
  function handleStepCommit() {
    if (lastCommittedStepIndex === ecmwfStepIndex) return;
    lastCommittedStepIndex = ecmwfStepIndex;
    onStepSliderActiveChange(false);
    onStepIndexCommit();
  }
</script>

<div class="field-group">
  <label class="control-label"
    ><span>Calendar date</span><input
      type="date"
      min="2024-01-01"
      max="2024-12-31"
      value={selectedDate}
      onchange={handleDateChange}
    /></label
  >
  <label class="slider-field control-label"
    ><span
      >Time
      <strong class="value-highlight">
      <!-- One globalTimeIndex increment is +12hr jump, and valid_time needs time to fetch. ecmwfTimeIndex is local to that ref-->
        Time: global {globalTimeIndex} 
      </strong></span
    ><input
      type="range"
      min="0"
      max={maxGlobalTimeIndex}
      step="1"
      value={globalTimeIndex}
      onpointerdown={handleTimePointerDown}
      onpointerup={handleTimeCommit}
      onblur={handleTimeCommit}
      onchange={handleTimeCommit}
      oninput={handleTimeInput}
    />
  </label>
  <label class="slider-field control-label"
    ><span>Step <strong class="value-highlight">{ecmwfStepIndex}</strong></span
    ><input
      type="range"
      min="0"
      max={maxStepIndex}
      step="1"
      value={ecmwfStepIndex}
      onpointerdown={handleStepPointerDown}
      onpointerup={handleStepCommit}
      onblur={handleStepCommit}
      onchange={handleStepCommit}
      oninput={handleStepInput}
    /></label
  >
</div>

<style>
  .field-group {
    display: grid;
    gap: 1.25rem;
  }

  .control-label {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .control-label span {
    color: #9ca3af;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .value-highlight {
    font-weight: 600;
    color: #ffffff;
    text-transform: none;
    letter-spacing: normal;
  }

  .field-group :global(input[type="date"]) {
    width: 100%;
    padding: 0.25rem;
  }

  .slider-field :global(input[type="range"]) {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 4px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 2px;
    outline: none;
    margin-top: 0.25rem;
  }

  .slider-field :global(input[type="range"]::-webkit-slider-thumb) {
    -webkit-appearance: none;
    appearance: none;
    width: 16px;
    height: 16px;
    background: #ffffff;
    border-radius: 50%;
    cursor: pointer;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
    transition: box-shadow 0.2s ease;
  }

  .slider-field :global(input[type="range"]:focus::-webkit-slider-thumb) {
    box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.2);
  }
</style>
