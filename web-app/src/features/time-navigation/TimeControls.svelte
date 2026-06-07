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
        {String(ecmwfTimeIndex).padStart(2, "0")}:00 UTC
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
  <label class="slider-field"
    ><span>Step: {ecmwfStepIndex}</span><input
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
    gap: 0.5rem;
  }

  .field-group :global(label) {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .field-group :global(input) {
    width: 100%;
  }
</style>
