// Shared dues-calculation core, used by the Dues page and the Dashboard's
// dues health widget. Pulled out so both read the exact same "what counts as
// paid" logic — this is the piece that was previously wrong (see the
// for_month vs. txn_date comment below) and shouldn't be re-derived twice.

export type DuesFund = { id: string; name: string; code: string; is_one_time: boolean };
export type DuesMember = { id: string; full_name: string; member_no: number; is_active: boolean };
export type DuesSubscription = {
  id: string;
  member_id: string;
  fund_id: string;
  monthly_amount: number;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
};
export type DuesTxn = { member_id: string | null; fund_id: string; amount: number; txn_date: string; for_month: string | null };

export const ALL = "all";

export function ymToDate(ym: string) {
  return new Date(`${ym}-01T00:00:00`);
}
export function dateToYm(d: Date | string) {
  const dd = typeof d === "string" ? new Date(d) : d;
  return `${dd.getFullYear()}-${String(dd.getMonth() + 1).padStart(2, "0")}`;
}
export function monthsBetween(startYm: string, endYm: string) {
  const s = ymToDate(startYm);
  const e = ymToDate(endYm);
  if (e < s) return 0;
  return (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth()) + 1;
}

export interface DueRow {
  key: string;
  memberId: string;
  memberNo: number;
  memberName: string;
  fundName: string;
  monthly: number;
  months: number;
  joiningYm: string;
  joiningLabel: string;
  joiningReg: number;
  joiningMonthly: number;
  expected: number;
  paid: number;
  due: number;
  paidMonths: number | null;
  dueMonths: number | null;
}

export function computeDueRow(
  s: DuesSubscription,
  fundMap: Map<string, DuesFund>,
  memberMap: Map<string, DuesMember>,
  txns: DuesTxn[],
  endMonth: string,
): DueRow {
  const fund = fundMap.get(s.fund_id);
  const member = memberMap.get(s.member_id);
  const startYm = dateToYm(s.start_date);
  const isOneTime = !!fund?.is_one_time;

  let months: number;
  let expected: number;
  let paid: number;
  if (isOneTime) {
    months = 1;
    expected = s.monthly_amount;
    paid = txns
      .filter((t) => t.member_id === s.member_id && t.fund_id === s.fund_id)
      .reduce((sum, t) => sum + t.amount, 0);
  } else {
    const effectiveStart = startYm > endMonth ? endMonth : startYm;
    months = monthsBetween(effectiveStart, endMonth);
    expected = months * s.monthly_amount;
    // A payment counts toward the month it's FOR (for_month), not the date it
    // happened to be recorded on (txn_date) — historical payments are
    // frequently bulk-entered long after the month they cover, which
    // wrongly excluded them under an earlier cutoff. Falls back to txn_date
    // only when for_month isn't set.
    paid = txns
      .filter((t) => {
        if (t.member_id !== s.member_id || t.fund_id !== s.fund_id) return false;
        const coverageYm = t.for_month ? dateToYm(t.for_month) : dateToYm(t.txn_date);
        return coverageYm <= endMonth && coverageYm >= startYm;
      })
      .reduce((sum, t) => sum + t.amount, 0);
  }
  const rawDue = expected - paid;
  const due = isOneTime ? Math.max(rawDue, 0) : rawDue;
  const monthlyAmount = isOneTime ? 0 : s.monthly_amount;
  const totalMonths = isOneTime ? 0 : months;
  const paidMonths = monthlyAmount > 0 ? Math.floor(paid / monthlyAmount) : null;
  const dueMonths = paidMonths === null ? null : Math.max(totalMonths - paidMonths, 0);

  return {
    key: s.id,
    memberId: s.member_id,
    memberNo: member?.member_no ?? 0,
    memberName: member?.full_name ?? "—",
    fundName: fund?.name ?? "—",
    monthly: monthlyAmount,
    months: totalMonths,
    joiningYm: startYm,
    joiningLabel: ymToDate(startYm).toLocaleString("en-US", { month: "long", year: "numeric" }),
    joiningReg: isOneTime ? s.monthly_amount : 0,
    joiningMonthly: isOneTime ? 0 : s.monthly_amount,
    expected,
    paid,
    due,
    paidMonths,
    dueMonths,
  };
}

export function computeDueRows(
  subs: DuesSubscription[],
  fundMap: Map<string, DuesFund>,
  memberMap: Map<string, DuesMember>,
  txns: DuesTxn[],
  endMonth: string,
  memberFilter: string = ALL,
  fundFilters: Set<string> = new Set(),
): DueRow[] {
  return subs
    .filter((s) => memberFilter === ALL || s.member_id === memberFilter)
    .filter((s) => fundFilters.size === 0 || fundFilters.has(s.fund_id))
    .map((s) => computeDueRow(s, fundMap, memberMap, txns, endMonth));
}
