import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import {
  headerToYm,
  ymToHeader,
  fundForMemberType,
  parseRegAndMonthly,
  toImportPayload,
  SHEET_NAME,
} from "./excelSheet";

/** Builds an in-memory "Reg and Monthly" workbook buffer from row arrays. */
function buildWorkbook(rows: (string | number)[][]): ArrayBuffer {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, SHEET_NAME);
  return XLSX.write(wb, { type: "array", bookType: "xlsx" });
}

const HEADER = [
  "Member No", "Member Name", "Reference Person Name", "Member Type", "Fee",
  "Date", "August_2024", "Date", "September_2024", "Date",
];

describe("headerToYm / ymToHeader", () => {
  it("parses a Month_Year header into YYYY-MM", () => {
    expect(headerToYm("August_2024")).toBe("2024-08");
    expect(headerToYm("December_2026")).toBe("2026-12");
  });

  it("is case-insensitive and tolerates spaces instead of underscores", () => {
    expect(headerToYm("august 2024")).toBe("2024-08");
    expect(headerToYm("AUGUST_2024")).toBe("2024-08");
  });

  it("returns null for non-month headers", () => {
    expect(headerToYm("Date")).toBeNull();
    expect(headerToYm("Fee")).toBeNull();
    expect(headerToYm("")).toBeNull();
  });

  it("round-trips through ymToHeader", () => {
    expect(ymToHeader("2024-08")).toBe("August_2024");
    expect(ymToHeader(headerToYm("December_2026")!)).toBe("December_2026");
  });
});

describe("fundForMemberType", () => {
  it("maps Founding/Executive member types to the founding fund", () => {
    expect(fundForMemberType("Founding & Executive")).toEqual({ code: "MONTHLY_FOUNDING", defaultFee: 100 });
    expect(fundForMemberType("Executive")).toEqual({ code: "MONTHLY_FOUNDING", defaultFee: 100 });
  });

  it("falls back to the general fund for anything else", () => {
    expect(fundForMemberType("General")).toEqual({ code: "MONTHLY_GENERAL", defaultFee: 50 });
    expect(fundForMemberType("")).toEqual({ code: "MONTHLY_GENERAL", defaultFee: 50 });
  });
});

describe("parseRegAndMonthly — column pairing", () => {
  // Regression test for the date/amount column-pairing bug: the sheet's
  // layout is Fee, Date(reg), <Month_Year>, Date, <Month_Year>, Date, ... —
  // each amount column's OWN date sits immediately after it, not before.
  it("pairs each month's amount with the date column immediately AFTER it, not before", () => {
    const data = buildWorkbook([
      HEADER,
      [1, "Test Member", "", "General", 50, "2024-08-01", 50, "2024-09-05", 50, "2024-10-03"],
    ]);
    const result = parseRegAndMonthly("test.xlsx", data);

    expect(result.issues.filter((i) => i.level === "error")).toHaveLength(0);
    expect(result.rows).toHaveLength(1);

    const row = result.rows[0];
    expect(row.registrationDate).toBe("2024-08-01");
    expect(row.payments).toEqual([
      { forMonth: "2024-08", txnDate: "2024-09-05", amount: 50 },
      { forMonth: "2024-09", txnDate: "2024-10-03", amount: 50 },
    ]);
  });

  it("defaults to the 1st of the month with a warning when a payment has no date", () => {
    const data = buildWorkbook([
      HEADER,
      [1, "No Date Member", "", "General", 50, "2024-08-01", 50, "", 50, "2024-10-03"],
    ]);
    const result = parseRegAndMonthly("test.xlsx", data);

    const row = result.rows[0];
    expect(row.payments[0]).toEqual({ forMonth: "2024-08", txnDate: "2024-08-01", amount: 50 });
    expect(result.issues.some((i) => i.level === "warning" && i.message.includes("no date"))).toBe(true);
  });
});

describe("parseRegAndMonthly — row validation", () => {
  it("skips rows with no member number and records an error", () => {
    const data = buildWorkbook([HEADER, ["", "Nameless", "", "General", 50, "2024-08-01"]]);
    const result = parseRegAndMonthly("test.xlsx", data);
    expect(result.rows).toHaveLength(0);
    expect(result.issues[0]).toMatchObject({ level: "error" });
  });

  it("skips a duplicate member number and records an error", () => {
    const data = buildWorkbook([
      HEADER,
      [1, "First", "", "General", 50, "2024-08-01"],
      [1, "Duplicate", "", "General", 50, "2024-08-01"],
    ]);
    const result = parseRegAndMonthly("test.xlsx", data);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].fullName).toBe("First");
    expect(result.issues.some((i) => i.level === "error" && i.message.includes("Duplicate"))).toBe(true);
  });

  it("rejects a negative monthly amount", () => {
    const data = buildWorkbook([
      HEADER,
      [1, "Negative", "", "General", 50, "2024-08-01", -50, "2024-08-01"],
    ]);
    const result = parseRegAndMonthly("test.xlsx", data);
    expect(result.rows[0].payments).toHaveLength(0);
    expect(result.issues.some((i) => i.level === "error" && i.message.includes("negative"))).toBe(true);
  });

  it("uses the earliest dated entry as the joining date", () => {
    const data = buildWorkbook([
      HEADER,
      [1, "Late Registration", "", "General", 50, "2024-09-15", 50, "2024-08-01"],
    ]);
    const result = parseRegAndMonthly("test.xlsx", data);
    // registration recorded 2024-09-15, but the August payment was made 2024-08-01
    expect(result.rows[0].joiningDate).toBe("2024-08-01");
  });

  it("infers the monthly fee as the most common positive amount, defaulting on ties", () => {
    const data = buildWorkbook([
      [...HEADER, "October_2024", "Date"],
      [1, "Fee Inference", "", "General", 50, "2024-08-01", 50, "2024-08-01", 100, "2024-09-01"],
    ]);
    const result = parseRegAndMonthly("test.xlsx", data);
    expect(result.rows[0].monthlyFee).toBe(50);
  });
});

describe("toImportPayload", () => {
  it("shapes parsed rows into the RPC payload format", () => {
    const data = buildWorkbook([
      HEADER,
      [1, "Payload Member", "Ref Person", "Founding & Executive", 100, "2024-08-01", 100, "2024-09-05"],
    ]);
    const { rows } = parseRegAndMonthly("test.xlsx", data);
    const payload = toImportPayload(rows);

    expect(payload).toEqual([
      {
        member_no: 1,
        full_name: "Payload Member",
        reference_person: "Ref Person",
        member_type: "Founding & Executive",
        joining_date: "2024-08-01",
        monthly_fee: 100,
        monthly_fund_code: "MONTHLY_FOUNDING",
        registration_fee: 100,
        registration_date: "2024-08-01",
        payments: [{ for_month: "2024-08", txn_date: "2024-09-05", amount: 100 }],
      },
    ]);
  });
});
