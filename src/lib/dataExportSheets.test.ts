import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import {
  buildIncomeSheet, buildExpensesSheet, buildMembersSheet, buildFundsSheet,
  buildDuesSheet, buildMeetingsSheet, buildBloodDonorsSheet, buildWorkbook,
  multiSheetFileName, SHEET_LABELS, SHEET_ORDER,
} from "./dataExportSheets";

function sheetToRows(ws: XLSX.WorkSheet): unknown[][] {
  return XLSX.utils.sheet_to_json(ws, { header: 1 }) as unknown[][];
}

describe("buildIncomeSheet", () => {
  it("puts a header row first and maps the payment method to its label", () => {
    const ws = buildIncomeSheet([
      { txn_date: "2026-09-01", receipt_no: "PF-2026-0001", payer: "Md Nurullah", fund_name: "Registration Fee", payment_method: "bkash", amount: 100, for_month: "2026-09-01", is_anonymous: false },
    ]);
    const rows = sheetToRows(ws);
    expect(rows[0]).toEqual(["Date", "Receipt No", "Donor / Member", "Anonymous", "Fund", "Method", "Amount", "For Month"]);
    expect(rows[1]).toEqual(["2026-09-01", "PF-2026-0001", "Md Nurullah", "No", "Registration Fee", "bKash", 100, "2026-09"]);
  });

  it("shows a dash for a null receipt or for-month", () => {
    const ws = buildIncomeSheet([
      { txn_date: "2026-09-01", receipt_no: null, payer: "Donor", fund_name: "Zakat", payment_method: "cash", amount: 500, for_month: null, is_anonymous: false },
    ]);
    const rows = sheetToRows(ws);
    expect(rows[1][1]).toBe("—");
    expect(rows[1][7]).toBe("—");
  });

  it("hides the donor's name on an anonymous donation", () => {
    const ws = buildIncomeSheet([
      { txn_date: "2026-09-01", receipt_no: "PF-2026-0002", payer: "Md Nurullah", fund_name: "Zakat", payment_method: "cash", amount: 500, for_month: null, is_anonymous: true },
    ]);
    const rows = sheetToRows(ws);
    expect(rows[1][2]).toBe("Anonymous");
    expect(rows[1][3]).toBe("Yes");
  });
});

describe("buildExpensesSheet", () => {
  it("shapes rows with header first", () => {
    const ws = buildExpensesSheet([
      { expense_date: "2026-09-01", fund_name: "Sports", category: "Ball", payee: "Md Nurullah", description: null, amount: 40 },
    ]);
    const rows = sheetToRows(ws);
    expect(rows[0]).toEqual(["Date", "Fund", "Category", "Payee", "Description", "Amount"]);
    expect(rows[1]).toEqual(["2026-09-01", "Sports", "Ball", "Md Nurullah", "—", 40]);
  });
});

describe("buildMembersSheet", () => {
  it("shapes rows with header first", () => {
    const ws = buildMembersSheet([
      { member_no: 1, full_name: "Md Nurullah", email: null, mobile: "017", types: "Founding", reference_person: null, joining_date: "2024-08-09", fund_subscriptions: "Monthly Founding", total_monthly: 100, is_active: true },
    ]);
    const rows = sheetToRows(ws);
    expect(rows[0][0]).toBe("Member No");
    expect(rows[1]).toEqual([1, "Md Nurullah", "—", "017", "Founding", "—", "2024-08-09", "Monthly Founding", 100, "Active"]);
  });
});

describe("buildFundsSheet / buildMeetingsSheet / buildBloodDonorsSheet", () => {
  it("build without throwing and put a header row first", () => {
    expect(sheetToRows(buildFundsSheet([{ code: "ZAKAT", name: "Zakat", description: null, is_one_time: true, is_active: true }]))[0][0]).toBe("Code");
    expect(sheetToRows(buildMeetingsSheet([{ meeting_no: 1, meeting_date: "2024-08-09", location: null, duration: null, next_meeting_date: null }]))[0][0]).toBe("Meeting No");
    expect(sheetToRows(buildBloodDonorsSheet([{ sl: 1, name: "Md Nurullah", blood_group: "B-", mobile: null, present_address: null, permanent_address: null, reference_person: null, last_donation_date: null }]))[0][0]).toBe("SL");
  });
});

describe("buildDuesSheet", () => {
  it("shapes rows with header first", () => {
    const ws = buildDuesSheet([
      { member_no: 1, member_name: "Md Nurullah", fund_name: "Monthly Founding", monthly_amount: 100, months: 3, joining_month: "2024-08", expected: 300, paid: 200, due: 100 },
    ]);
    const rows = sheetToRows(ws);
    expect(rows[0]).toEqual(["Member No", "Member", "Fund", "Monthly Amount", "Months", "Joining Month", "Expected", "Paid", "Due"]);
    expect(rows[1]).toEqual([1, "Md Nurullah", "Monthly Founding", 100, 3, "2024-08", 300, 200, 100]);
  });
});

describe("buildWorkbook", () => {
  it("appends one sheet per entry, named from SHEET_LABELS", () => {
    const wb = buildWorkbook([
      { key: "income", ws: buildIncomeSheet([]) },
      { key: "meetings", ws: buildMeetingsSheet([]) },
    ]);
    expect(wb.SheetNames).toEqual(["Income", "Meetings"]);
  });
});

describe("SHEET_ORDER / SHEET_LABELS", () => {
  it("has a label for every key in the canonical order", () => {
    for (const key of SHEET_ORDER) {
      expect(SHEET_LABELS[key]).toBeTruthy();
    }
  });
});

describe("multiSheetFileName", () => {
  it("stamps just the export date when no range is given", () => {
    expect(multiSheetFileName(new Date(2026, 8, 9))).toBe("Prottoy_Export_2026-09-09.xlsx");
  });

  it("includes the date range when both ends are given", () => {
    expect(multiSheetFileName(new Date(2026, 8, 9), "2026-01-01", "2026-08-31"))
      .toBe("Prottoy_Export_2026-01-01_to_2026-08-31_2026-09-09.xlsx");
  });
});
