// Multi-sheet Excel export — one flat, read-only sheet per selected app section.
import * as XLSX from "xlsx";
import { BDT_FMT, downloadWorkbook } from "./excelExport";
import { PAYMENT_LABEL, type PaymentMethod } from "./format";

export type SheetKey =
  | "income" | "expenses" | "members" | "funds" | "dues" | "meetings" | "blood_donors";

export const SHEET_LABELS: Record<SheetKey, string> = {
  income: "Income",
  expenses: "Expenses",
  members: "Members",
  funds: "Funds",
  dues: "Dues",
  meetings: "Meetings",
  blood_donors: "Blood Donors",
};

export const SHEET_ORDER: SheetKey[] = [
  "income", "expenses", "members", "funds", "dues", "meetings", "blood_donors",
];

function buildFlatSheet(
  headers: string[],
  rows: (string | number | null)[][],
  colWidths: number[],
): XLSX.WorkSheet {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws["!cols"] = colWidths.map((wch) => ({ wch }));
  ws["!freeze"] = { xSplit: "0", ySplit: "1" };
  for (let c = 0; c < headers.length; c++) {
    const ref = XLSX.utils.encode_cell({ r: 0, c });
    if (ws[ref]) ws[ref].s = { font: { bold: true } };
  }
  return ws;
}

function applyAmountFormat(ws: XLSX.WorkSheet, rowCount: number, col: number) {
  for (let r = 1; r <= rowCount; r++) {
    const ref = XLSX.utils.encode_cell({ r, c: col });
    if (ws[ref] && typeof ws[ref].v === "number") ws[ref].z = BDT_FMT;
  }
}

// ---------------------------------------------------------------------------
// Income
// ---------------------------------------------------------------------------
export type IncomeExportRow = {
  txn_date: string;
  receipt_no: string | null;
  payer: string;
  fund_name: string;
  payment_method: string;
  amount: number;
  for_month: string | null;
  is_anonymous: boolean;
};

export function buildIncomeSheet(rows: IncomeExportRow[]): XLSX.WorkSheet {
  const aoa = rows.map((r) => [
    r.txn_date,
    r.receipt_no ?? "—",
    r.is_anonymous ? "Anonymous" : r.payer,
    r.is_anonymous ? "Yes" : "No",
    r.fund_name,
    PAYMENT_LABEL[r.payment_method as PaymentMethod] ?? r.payment_method,
    r.amount,
    r.for_month ? r.for_month.slice(0, 7) : "—",
  ]);
  const ws = buildFlatSheet(
    ["Date", "Receipt No", "Donor / Member", "Anonymous", "Fund", "Method", "Amount", "For Month"],
    aoa,
    [12, 14, 26, 11, 20, 10, 12, 12],
  );
  applyAmountFormat(ws, rows.length, 6);
  return ws;
}

// ---------------------------------------------------------------------------
// Expenses
// ---------------------------------------------------------------------------
export type ExpenseExportRow = {
  expense_date: string;
  fund_name: string;
  category: string | null;
  payee: string | null;
  description: string | null;
  amount: number;
};

export function buildExpensesSheet(rows: ExpenseExportRow[]): XLSX.WorkSheet {
  const aoa = rows.map((r) => [
    r.expense_date, r.fund_name, r.category ?? "—", r.payee ?? "—", r.description ?? "—", r.amount,
  ]);
  const ws = buildFlatSheet(
    ["Date", "Fund", "Category", "Payee", "Description", "Amount"],
    aoa,
    [12, 20, 18, 20, 30, 12],
  );
  applyAmountFormat(ws, rows.length, 5);
  return ws;
}

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------
export type MemberExportRow = {
  member_no: number;
  full_name: string;
  email: string | null;
  mobile: string | null;
  types: string;
  reference_person: string | null;
  joining_date: string;
  fund_subscriptions: string;
  total_monthly: number;
  is_active: boolean;
};

export function buildMembersSheet(rows: MemberExportRow[]): XLSX.WorkSheet {
  const aoa = rows.map((r) => [
    r.member_no, r.full_name, r.email ?? "—", r.mobile ?? "—", r.types || "—",
    r.reference_person ?? "—", r.joining_date, r.fund_subscriptions || "—",
    r.total_monthly, r.is_active ? "Active" : "Inactive",
  ]);
  const ws = buildFlatSheet(
    ["Member No", "Name", "Email", "Mobile", "Type(s)", "Reference", "Joined", "Fund Subscriptions", "Total Monthly", "Status"],
    aoa,
    [10, 24, 24, 14, 20, 20, 12, 30, 14, 10],
  );
  applyAmountFormat(ws, rows.length, 8);
  return ws;
}

// ---------------------------------------------------------------------------
// Funds
// ---------------------------------------------------------------------------
export type FundExportRow = {
  code: string;
  name: string;
  description: string | null;
  is_one_time: boolean;
  is_active: boolean;
};

export function buildFundsSheet(rows: FundExportRow[]): XLSX.WorkSheet {
  const aoa = rows.map((r) => [
    r.code, r.name, r.description ?? "—", r.is_one_time ? "One-time" : "Monthly", r.is_active ? "Active" : "Inactive",
  ]);
  return buildFlatSheet(
    ["Code", "Name", "Description", "Type", "Status"],
    aoa,
    [18, 22, 30, 12, 10],
  );
}

// ---------------------------------------------------------------------------
// Dues
// ---------------------------------------------------------------------------
export type DuesExportRow = {
  member_no: number;
  member_name: string;
  fund_name: string;
  monthly_amount: number;
  months: number;
  joining_month: string;
  expected: number;
  paid: number;
  due: number;
};

export function buildDuesSheet(rows: DuesExportRow[]): XLSX.WorkSheet {
  const aoa = rows.map((r) => [
    r.member_no, r.member_name, r.fund_name, r.monthly_amount, r.months,
    r.joining_month, r.expected, r.paid, r.due,
  ]);
  const ws = buildFlatSheet(
    ["Member No", "Member", "Fund", "Monthly Amount", "Months", "Joining Month", "Expected", "Paid", "Due"],
    aoa,
    [10, 24, 20, 14, 10, 14, 12, 12, 12],
  );
  applyAmountFormat(ws, rows.length, 3);
  applyAmountFormat(ws, rows.length, 6);
  applyAmountFormat(ws, rows.length, 7);
  applyAmountFormat(ws, rows.length, 8);
  return ws;
}

// ---------------------------------------------------------------------------
// Meetings
// ---------------------------------------------------------------------------
export type MeetingExportRow = {
  meeting_no: number;
  meeting_date: string;
  location: string | null;
  duration: string | null;
  next_meeting_date: string | null;
};

export function buildMeetingsSheet(rows: MeetingExportRow[]): XLSX.WorkSheet {
  const aoa = rows.map((r) => [
    r.meeting_no, r.meeting_date, r.location ?? "—", r.duration ?? "—", r.next_meeting_date ?? "—",
  ]);
  return buildFlatSheet(
    ["Meeting No", "Date", "Location", "Duration", "Next Meeting Date"],
    aoa,
    [10, 12, 24, 26, 16],
  );
}

// ---------------------------------------------------------------------------
// Blood Donors
// ---------------------------------------------------------------------------
export type BloodDonorExportRow = {
  sl: number;
  name: string;
  blood_group: string;
  mobile: string | null;
  present_address: string | null;
  permanent_address: string | null;
  reference_person: string | null;
  last_donation_date: string | null;
};

export function buildBloodDonorsSheet(rows: BloodDonorExportRow[]): XLSX.WorkSheet {
  const aoa = rows.map((r) => [
    r.sl, r.name, r.blood_group, r.mobile ?? "—", r.present_address ?? "—",
    r.permanent_address ?? "—", r.reference_person ?? "—", r.last_donation_date ?? "—",
  ]);
  return buildFlatSheet(
    ["SL", "Name", "Blood Group", "Mobile", "Present Address", "Permanent Address", "Reference", "Last Donation"],
    aoa,
    [8, 22, 12, 14, 26, 26, 20, 14],
  );
}

// ---------------------------------------------------------------------------
export function buildWorkbook(sheets: { key: SheetKey; ws: XLSX.WorkSheet }[]): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  for (const { key, ws } of sheets) {
    XLSX.utils.book_append_sheet(wb, ws, SHEET_LABELS[key]);
  }
  return wb;
}

/** Prottoy_Export_<stamp>.xlsx, stamp = export date (and range, if given). */
export function multiSheetFileName(exportDate = new Date(), fromDate?: string, toDate?: string): string {
  const stamp = `${exportDate.getFullYear()}-${String(exportDate.getMonth() + 1).padStart(2, "0")}-${String(
    exportDate.getDate(),
  ).padStart(2, "0")}`;
  if (fromDate && toDate) return `Prottoy_Export_${fromDate}_to_${toDate}_${stamp}.xlsx`;
  return `Prottoy_Export_${stamp}.xlsx`;
}

export { downloadWorkbook };
