import { describe, it, expect } from "vitest";
import { ymToHeader, monthRange, exportFileName } from "./excelExport";

describe("ymToHeader", () => {
  it("formats YYYY-MM as the sheet's Month_Year header", () => {
    expect(ymToHeader("2024-08")).toBe("August_2024");
    expect(ymToHeader("2026-12")).toBe("December_2026");
  });
});

describe("monthRange", () => {
  it("lists every month inclusive of both ends", () => {
    expect(monthRange("2024-11", "2025-02")).toEqual(["2024-11", "2024-12", "2025-01", "2025-02"]);
  });

  it("returns a single month when start equals end", () => {
    expect(monthRange("2024-08", "2024-08")).toEqual(["2024-08"]);
  });
});

describe("exportFileName", () => {
  it("stamps the target month and the export date", () => {
    expect(exportFileName("2026-09", new Date(2026, 8, 8))).toBe("Prottoy_Summary_2026-09_2026-09-08.xlsx");
  });
});
