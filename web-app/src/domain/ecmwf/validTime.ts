function rawValidTime(value: unknown): string {
  return String(value);
}

function twoDigits(value: number): string {
  return String(value).padStart(2, "0");
}

function utcAmPmHour(hour: number): { hour12: number; suffix: "AM" | "PM" } {
  const suffix = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return { hour12, suffix };
}

export function formatEcmwfValidTimeSeconds(value: unknown): string {
  try {
    const seconds = typeof value === "bigint" ? Number(value) : Number(value);
    if (!Number.isFinite(seconds)) return rawValidTime(value);

    const date = new Date(seconds * 1000);
    if (Number.isNaN(date.getTime())) return rawValidTime(value);

    const { hour12, suffix } = utcAmPmHour(date.getUTCHours());
    return `${twoDigits(date.getUTCDate())}-${twoDigits(date.getUTCMonth() + 1)}-${date.getUTCFullYear()} ${twoDigits(hour12)}:${twoDigits(date.getUTCMinutes())} ${suffix}`;
  } catch {
    return rawValidTime(value);
  }
}
