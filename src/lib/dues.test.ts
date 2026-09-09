import { describe, it, expect } from "vitest";
import { computeDueRows, type DuesFund, type DuesMember, type DuesSubscription, type DuesTxn } from "./dues";

const fund: DuesFund = { id: "f1", name: "Monthly", code: "MON", is_one_time: false };
const oneTimeFund: DuesFund = { id: "f2", name: "Registration", code: "REG", is_one_time: true };
const member: DuesMember = { id: "m1", full_name: "Md Nurullah", member_no: 1, is_active: true };
const fundMap = new Map([[fund.id, fund], [oneTimeFund.id, oneTimeFund]]);
const memberMap = new Map([[member.id, member]]);

describe("computeDueRows", () => {
  it("counts a payment toward the month it's FOR, not when it was recorded", () => {
    // Regression case: a payment for August, bulk-entered in September, must
    // still clear August's due — this was the original bug (filtering by
    // txn_date showed a due at an August cutoff despite Sep being paid).
    const sub: DuesSubscription = {
      id: "s1", member_id: "m1", fund_id: "f1", monthly_amount: 300,
      start_date: "2026-08-01", end_date: null, is_active: true,
    };
    const txns: DuesTxn[] = [
      { member_id: "m1", fund_id: "f1", amount: 300, txn_date: "2026-09-08", for_month: "2026-08-01" },
    ];
    const [row] = computeDueRows([sub], fundMap, memberMap, txns, "2026-08");
    expect(row.expected).toBe(300);
    expect(row.paid).toBe(300);
    expect(row.due).toBe(0);
  });

  it("falls back to txn_date when for_month isn't set", () => {
    const sub: DuesSubscription = {
      id: "s1", member_id: "m1", fund_id: "f1", monthly_amount: 300,
      start_date: "2026-08-01", end_date: null, is_active: true,
    };
    const txns: DuesTxn[] = [
      { member_id: "m1", fund_id: "f1", amount: 300, txn_date: "2026-08-15", for_month: null },
    ];
    const [row] = computeDueRows([sub], fundMap, memberMap, txns, "2026-08");
    expect(row.paid).toBe(300);
    expect(row.due).toBe(0);
  });

  it("floors a one-time fund's due at zero even if overpaid", () => {
    const sub: DuesSubscription = {
      id: "s2", member_id: "m1", fund_id: "f2", monthly_amount: 500,
      start_date: "2026-01-01", end_date: null, is_active: true,
    };
    const txns: DuesTxn[] = [
      { member_id: "m1", fund_id: "f2", amount: 700, txn_date: "2026-01-01", for_month: null },
    ];
    const [row] = computeDueRows([sub], fundMap, memberMap, txns, "2026-08");
    expect(row.due).toBe(0);
  });

  it("filters by member and fund", () => {
    const subs: DuesSubscription[] = [
      { id: "s1", member_id: "m1", fund_id: "f1", monthly_amount: 300, start_date: "2026-08-01", end_date: null, is_active: true },
      { id: "s2", member_id: "m1", fund_id: "f2", monthly_amount: 500, start_date: "2026-08-01", end_date: null, is_active: true },
    ];
    const rows = computeDueRows(subs, fundMap, memberMap, [], "2026-08", "m1", new Set(["f1"]));
    expect(rows).toHaveLength(1);
    expect(rows[0].fundName).toBe("Monthly");
  });
});
