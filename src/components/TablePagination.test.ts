import { describe, it, expect } from "vitest";
import { paginationRange } from "./TablePagination";

describe("paginationRange", () => {
  it("lists every page when there are few enough to fit", () => {
    expect(paginationRange(1, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(paginationRange(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("windows around the current page for long lists", () => {
    // 515 income rows at 10/page — the case that broke the layout.
    expect(paginationRange(26, 52)).toEqual([1, "gap", 25, 26, 27, "gap", 52]);
  });

  it("keeps first and last page reachable", () => {
    const range = paginationRange(26, 52);
    expect(range[0]).toBe(1);
    expect(range[range.length - 1]).toBe(52);
  });

  it("does not emit a gap between consecutive pages", () => {
    const range = paginationRange(2, 52);
    expect(range).toEqual([1, 2, 3, 4, "gap", 52]);
  });

  it("stays one-sided near the end without duplicating pages", () => {
    const range = paginationRange(51, 52);
    expect(range).toEqual([1, "gap", 49, 50, 51, 52]);
    expect(new Set(range).size).toBe(range.length);
  });

  it("never renders more than a bounded number of entries", () => {
    for (let page = 1; page <= 52; page++) {
      expect(paginationRange(page, 52).length).toBeLessThanOrEqual(8);
    }
  });
});
