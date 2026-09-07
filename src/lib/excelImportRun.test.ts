import { describe, it, expect } from "vitest";
import { findDuplicateFlags, dupKey, applySkips, applyTypeMapping } from "./excelImportRun";
import type { ParsedRow } from "./excelSheet";

function row(overrides: Partial<ParsedRow> = {}): ParsedRow {
  return {
    excelRow: 2,
    memberNo: 1,
    fullName: "Test Member",
    referencePerson: null,
    memberType: "General",
    registrationFee: 50,
    registrationDate: "2024-08-01",
    joiningDate: "2024-08-01",
    monthlyFee: 50,
    monthlyFundCode: "MONTHLY_GENERAL",
    payments: [],
    ...overrides,
  };
}

describe("dupKey", () => {
  it("builds a stable member/month key", () => {
    expect(dupKey({ memberNo: 5, forMonth: "2024-08" })).toBe("5|2024-08");
  });
});

describe("findDuplicateFlags", () => {
  it("flags a payment settled in a calendar month later than its due month", () => {
    const rows = [row({ payments: [{ forMonth: "2024-08", txnDate: "2024-10-03", amount: 50 }] })];
    const flags = findDuplicateFlags(rows);
    expect(flags).toHaveLength(1);
    expect(flags[0].reason).toBe("Due month paid in a later month");
  });

  it("does not flag a payment settled in its own due month", () => {
    const rows = [row({ payments: [{ forMonth: "2024-08", txnDate: "2024-08-22", amount: 50 }] })];
    expect(findDuplicateFlags(rows)).toHaveLength(0);
  });
});

describe("applySkips", () => {
  it("removes only the payments matching a skipped member/month key", () => {
    const rows = [
      row({
        memberNo: 1,
        payments: [
          { forMonth: "2024-08", txnDate: "2024-08-01", amount: 50 },
          { forMonth: "2024-09", txnDate: "2024-09-01", amount: 50 },
        ],
      }),
    ];
    const [result] = applySkips(rows, new Set(["1|2024-08"]));
    expect(result.payments).toEqual([{ forMonth: "2024-09", txnDate: "2024-09-01", amount: 50 }]);
  });

  it("returns the same rows untouched when nothing is skipped", () => {
    const rows = [row()];
    expect(applySkips(rows, new Set())).toBe(rows);
  });
});

describe("applyTypeMapping", () => {
  it("remaps memberType and fund code per the provided mapping", () => {
    const rows = [row({ memberType: "Founding & Executive", monthlyFundCode: "MONTHLY_GENERAL" })];
    const [result] = applyTypeMapping(rows, {
      "Founding & Executive": { memberType: "Founding & Executive", fundCode: "MONTHLY_FOUNDING" },
    });
    expect(result.monthlyFundCode).toBe("MONTHLY_FOUNDING");
  });

  it("leaves rows with no matching mapping key untouched", () => {
    const rows = [row({ memberType: "General" })];
    const [result] = applyTypeMapping(rows, {
      "Founding & Executive": { memberType: "Founding & Executive", fundCode: "MONTHLY_FOUNDING" },
    });
    expect(result).toBe(rows[0]);
  });
});
