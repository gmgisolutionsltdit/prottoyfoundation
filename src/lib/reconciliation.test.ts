import { describe, it, expect } from "vitest";
import {
  monthsBetween,
  dateToYm,
  resolveTargetMonth,
  legacyDueRows,
  reconciledDueRows,
  compareDueRows,
  joiningMonthBreakdown,
  type ReconFund,
  type ReconMember,
  type ReconSubscription,
  type ReconTxn,
} from "./reconciliation";

describe("monthsBetween", () => {
  it("is inclusive of both endpoints", () => {
    expect(monthsBetween("2024-08", "2024-08")).toBe(1);
    expect(monthsBetween("2024-08", "2024-10")).toBe(3);
  });

  it("spans a year boundary", () => {
    expect(monthsBetween("2024-11", "2025-02")).toBe(4);
  });

  it("returns 0 when the end precedes the start", () => {
    expect(monthsBetween("2024-10", "2024-08")).toBe(0);
  });
});

describe("dateToYm", () => {
  it("extracts YYYY-MM from an ISO date string", () => {
    expect(dateToYm("2024-08-22")).toBe("2024-08");
  });
});

describe("resolveTargetMonth", () => {
  it("prefers an explicit override above everything else", () => {
    const { targetMonth, source } = resolveTargetMonth({
      override: "2025-01",
      txnDates: ["2026-01-01"],
      excelMonthHeaders: ["2026-02"],
    });
    expect(targetMonth).toBe("2025-01");
    expect(source).toBe("override");
  });

  it("falls back to the latest Excel month header when no override is given", () => {
    const { targetMonth, source } = resolveTargetMonth({
      excelMonthHeaders: ["2024-08", "2024-10", "2024-09"],
      txnDates: ["2023-01-01"],
    });
    expect(targetMonth).toBe("2024-10");
    expect(source).toBe("excel");
  });

  it("falls back to the latest transaction date when no Excel headers exist", () => {
    const { targetMonth, source } = resolveTargetMonth({
      txnDates: ["2024-08-01", "2024-12-15", "2024-10-01"],
    });
    expect(targetMonth).toBe("2024-12");
    expect(source).toBe("transactions");
  });

  it("falls back to the system month when nothing else is available", () => {
    const { targetMonth, source } = resolveTargetMonth({ now: new Date("2026-03-15T00:00:00") });
    expect(targetMonth).toBe("2026-03");
    expect(source).toBe("system");
  });
});

// --- shared fixtures for the Due-row calculators -----------------------

const funds: ReconFund[] = [
  { id: "f-reg", name: "Registration Fee", code: "REGISTRATION", is_one_time: true },
  { id: "f-monthly", name: "Monthly General", code: "MONTHLY_GENERAL", is_one_time: false },
];

const members: ReconMember[] = [
  { id: "m1", full_name: "Member One", member_no: 1, is_active: true, joining_date: "2024-08-01" },
];

function monthlySub(overrides: Partial<ReconSubscription> = {}): ReconSubscription {
  return {
    id: "s1", member_id: "m1", fund_id: "f-monthly", monthly_amount: 50,
    start_date: "2024-08-01", end_date: null, is_active: true, ...overrides,
  };
}

describe("legacyDueRows", () => {
  it("charges monthly_amount x months and nets off payments", () => {
    const txns: ReconTxn[] = [
      { member_id: "m1", fund_id: "f-monthly", amount: 50, txn_date: "2024-08-10" },
    ];
    const [row] = legacyDueRows({ funds, members, subs: [monthlySub()], txns, targetMonth: "2024-09" });
    expect(row.months).toBe(2); // Aug + Sep
    expect(row.expected).toBe(100);
    expect(row.paid).toBe(50);
    expect(row.due).toBe(50);
  });

  it("clamps a subscription starting after the target month to the target month (charges 1)", () => {
    const sub = monthlySub({ start_date: "2025-01-01" });
    const [row] = legacyDueRows({ funds, members, subs: [sub], txns: [], targetMonth: "2024-09" });
    expect(row.months).toBe(1);
    expect(row.expected).toBe(50);
  });

  it("treats a one-time fund as a single flat charge, floored at 0 due", () => {
    const sub: ReconSubscription = {
      id: "s2", member_id: "m1", fund_id: "f-reg", monthly_amount: 50,
      start_date: "2024-08-01", end_date: null, is_active: true,
    };
    const overpaid: ReconTxn[] = [{ member_id: "m1", fund_id: "f-reg", amount: 100, txn_date: "2024-08-01" }];
    const [row] = legacyDueRows({ funds, members, subs: [sub], txns: overpaid, targetMonth: "2024-09" });
    expect(row.expected).toBe(50);
    expect(row.paid).toBe(100);
    expect(row.due).toBe(0); // Math.max(rawDue, 0), not negative
  });
});

describe("reconciledDueRows", () => {
  it("charges nothing when the subscription starts after the target month (N = 0 guard)", () => {
    const sub = monthlySub({ start_date: "2025-01-01" });
    const [row] = reconciledDueRows({ funds, members, subs: [sub], txns: [], targetMonth: "2024-09" });
    expect(row.months).toBe(0);
    expect(row.expected).toBe(0);
  });

  it("counts a payment recorded before the subscription start month toward Paid", () => {
    const txns: ReconTxn[] = [
      { member_id: "m1", fund_id: "f-monthly", amount: 50, txn_date: "2024-07-01" }, // before start_date
    ];
    const [row] = reconciledDueRows({ funds, members, subs: [monthlySub()], txns, targetMonth: "2024-08" });
    expect(row.paid).toBe(50);
  });

  it("zeroes Expected and Due for an exempted one-time fund but keeps monthly funds accruing", () => {
    const regSub: ReconSubscription = {
      id: "s2", member_id: "m1", fund_id: "f-reg", monthly_amount: 50,
      start_date: "2024-08-01", end_date: null, is_active: true,
    };
    const [row] = reconciledDueRows({
      funds, members, subs: [regSub], txns: [], targetMonth: "2024-09",
      exemptions: new Set(["m1:f-reg"]),
    });
    expect(row.expected).toBe(0);
    expect(row.due).toBe(0);
  });
});

describe("compareDueRows", () => {
  it("flags matching rows and explains a guard-triggered difference", () => {
    const sub = monthlySub({ start_date: "2025-01-01" });
    const legacy = legacyDueRows({ funds, members, subs: [sub], txns: [], targetMonth: "2024-09" });
    const next = reconciledDueRows({ funds, members, subs: [sub], txns: [], targetMonth: "2024-09" });
    const [parity] = compareDueRows(legacy, next);

    expect(parity.matches).toBe(false);
    expect(parity.expectedDelta).toBe(-50); // legacy charges 1 month, next charges 0
    expect(parity.reasons[0]).toContain("N = 0");
  });

  it("reports no differences when both formulas agree", () => {
    const [parity] = compareDueRows(
      legacyDueRows({ funds, members, subs: [monthlySub()], txns: [], targetMonth: "2024-08" }),
      reconciledDueRows({ funds, members, subs: [monthlySub()], txns: [], targetMonth: "2024-08" }),
    );
    expect(parity.matches).toBe(true);
    expect(parity.reasons).toHaveLength(0);
  });
});

describe("joiningMonthBreakdown", () => {
  it("lists only subscriptions that started in the member's joining month", () => {
    const subs: ReconSubscription[] = [
      { id: "s1", member_id: "m1", fund_id: "f-reg", monthly_amount: 50, start_date: "2024-08-01", end_date: null, is_active: true },
      { id: "s2", member_id: "m1", fund_id: "f-monthly", monthly_amount: 50, start_date: "2024-09-01", end_date: null, is_active: true },
    ];
    const result = joiningMonthBreakdown(members[0], subs, funds);
    expect(result.month).toBe("2024-08");
    expect(result.lines).toEqual([{ label: "Registration Fee", amount: 50, note: "one-time" }]);
    expect(result.total).toBe(50);
  });
});
