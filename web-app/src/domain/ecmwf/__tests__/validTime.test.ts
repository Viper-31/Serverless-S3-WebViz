import { describe, expect, it } from "vitest";
import { formatEcmwfValidTimeNs } from "../validTime";

describe("ecmwfValidTime contract", () => {
  it("formats valid_time epoch nanoseconds as UTC DD-MM-YYYY hh:mm AM/PM", () => {
    expect(formatEcmwfValidTimeNs(1708387200000000000)).toBe(
      "20-02-2024 12:00 AM",
    );
    expect(formatEcmwfValidTimeNs(1708430400000000000)).toBe(
      "20-02-2024 12:00 PM",
    );
  });

  it("falls back to raw text when valid_time cannot be formatted", () => {
    expect(formatEcmwfValidTimeNs("not-a-valid-time")).toBe("not-a-valid-time");
  });
});
