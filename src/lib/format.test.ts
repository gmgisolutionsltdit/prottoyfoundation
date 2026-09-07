import { describe, it, expect } from "vitest";
import { formatBDT, formatDMY, PAYMENT_METHODS, PAYMENT_LABEL } from "./format";

describe("formatBDT", () => {
  it("formats a number with thousands separators", () => {
    expect(formatBDT(1234567)).toBe("1,234,567");
  });

  it("accepts a numeric string", () => {
    expect(formatBDT("500")).toBe("500");
  });

  it("caps at 2 decimal places", () => {
    expect(formatBDT(50.5)).toBe("50.5");
    expect(formatBDT(50.999)).toBe("51");
  });
});

describe("formatDMY", () => {
  it("formats an ISO date as DD-Mon-YYYY", () => {
    expect(formatDMY("2026-09-01")).toBe("01-Sep-2026");
    expect(formatDMY("2026-12-25")).toBe("25-Dec-2026");
  });

  it("returns an em dash for null/undefined/empty", () => {
    expect(formatDMY(null)).toBe("—");
    expect(formatDMY(undefined)).toBe("—");
    expect(formatDMY("")).toBe("—");
  });

  it("falls back to the raw string for an unparseable date", () => {
    expect(formatDMY("not-a-date")).toBe("not-a-date");
  });
});

describe("PAYMENT_METHODS / PAYMENT_LABEL", () => {
  it("has a label for every payment method", () => {
    for (const m of PAYMENT_METHODS) {
      expect(PAYMENT_LABEL[m]).toBeTruthy();
    }
  });
});
