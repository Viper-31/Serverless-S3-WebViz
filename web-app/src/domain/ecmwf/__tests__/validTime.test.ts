import { describe, expect, it } from "vitest";
import { formatEcmwfValidTimeSeconds } from "../validTime";

describe("ecmwfValidTime contract", () => {
  it("formats valid_time epoch seconds as UTC DD-MM-YYYY hh:mm AM/PM", () => {
    expect(formatEcmwfValidTimeSeconds(1708387200)).toBe("20-02-2024 12:00 AM");
    expect(formatEcmwfValidTimeSeconds(1708430400)).toBe("20-02-2024 12:00 PM");
  });

  it("falls back to raw text when valid_time cannot be formatted", () => {
    expect(formatEcmwfValidTimeSeconds("not-a-valid-time")).toBe(
      "not-a-valid-time",
    );
  });
});
