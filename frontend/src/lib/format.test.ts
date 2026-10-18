import { describe, expect, it } from "vitest";
import { formatDuration, formatInr, labelise, monthLabel } from "./format";

describe("formatInr", () => {
  it("formats small amounts", () => {
    expect(formatInr(0)).toBe("₹0");
    expect(formatInr(250)).toBe("₹250");
    expect(formatInr(999)).toBe("₹999");
  });

  it("formats with Indian grouping", () => {
    expect(formatInr(1000)).toBe("₹1,000");
    expect(formatInr(39452)).toBe("₹39,452");
    expect(formatInr(1234567)).toBe("₹12,34,567");
  });

  it("keeps negatives readable", () => {
    expect(formatInr(-1500)).toBe("-₹1,500");
  });
});

describe("formatDuration", () => {
  it("handles whole hours", () => {
    expect(formatDuration(4)).toBe("4h");
  });

  it("handles minutes only", () => {
    expect(formatDuration(0.5)).toBe("30m");
  });

  it("handles mixed values", () => {
    expect(formatDuration(4.5)).toBe("4h 30m");
  });
});

describe("labels", () => {
  it("labels months", () => {
    expect(monthLabel(1)).toBe("Jan");
    expect(monthLabel(12)).toBe("Dec");
    expect(monthLabel(13)).toBe("");
  });

  it("capitalises categories", () => {
    expect(labelise("wildlife")).toBe("Wildlife");
    expect(labelise("beach")).toBe("Beach");
  });
});
