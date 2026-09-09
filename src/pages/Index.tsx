import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTheme } from "next-themes";
import {
  ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend,
  BarChart, Bar, Cell,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, TrendingUp, TrendingDown, Wallet, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { formatBDT } from "@/lib/format";
import {
  computeDueRows, dateToYm,
  type DuesFund, type DuesMember, type DuesSubscription, type DuesTxn,
} from "@/lib/dues";
import { TREND_COLORS, categoricalColor } from "@/lib/chartColors";

interface IncomeTxn {
  id: string;
  fund_id: string;
  member_id: string | null;
  amount: number;
  date: string; // txn_date
  for_month: string | null;
  donor_name: string | null;
  is_anonymous: boolean;
  created_at: string;
}

interface ExpenseTxn {
  id: string;
  fund_id: string;
  amount: number;
  date: string; // expense_date
  payee: string | null;
  created_at: string;
}

interface FundSummary {
  id: string;
  name: string;
  income: number;
  expense: number;
  balance: number;
}

const ALL = "all";

const monthKey = (d: string) => d.slice(0, 7); // YYYY-MM

const monthLabel = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
};

const shortMonthLabel = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return `${new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "short" })} '${String(y).slice(2)}`;
};

export default function Index() {
  const { user, isAdmin } = useAuth();
  const { resolvedTheme } = useTheme();
  const mode: "light" | "dark" = resolvedTheme === "dark" ? "dark" : "light";

  const [funds, setFunds] = useState<DuesFund[]>([]);
  const [members, setMembers] = useState<DuesMember[]>([]);
  const [subs, setSubs] = useState<DuesSubscription[]>([]);
  const [incomes, setIncomes] = useState<IncomeTxn[]>([]);
  const [expenses, setExpenses] = useState<ExpenseTxn[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState<string>(ALL);
  // Section 6.2 — custom date range filter, independent of the month dropdown.
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  useEffect(() => {
    const load = async () => {
      const [
        { data: fundsData },
        { data: txns },
        { data: exps },
        { data: membersData },
        { data: subsData },
      ] = await Promise.all([
        supabase.from("funds").select("id, name, code, is_one_time, sort_order").eq("is_active", true).order("sort_order"),
        supabase
          .from("transactions")
          .select("id, fund_id, member_id, amount, txn_date, for_month, donor_name, is_anonymous, created_at")
          .order("created_at", { ascending: false }),
        supabase.from("expenses").select("id, fund_id, amount, expense_date, payee, created_at").order("created_at", { ascending: false }),
        supabase.from("members").select("id, full_name, member_no, is_active"),
        supabase.from("member_fund_subscriptions").select("*").eq("is_active", true),
      ]);

      setFunds((fundsData ?? []) as DuesFund[]);
      setIncomes(
        (txns ?? []).map((t) => ({
          id: t.id,
          fund_id: t.fund_id,
          member_id: t.member_id,
          amount: Number(t.amount),
          date: t.txn_date,
          for_month: t.for_month,
          donor_name: t.donor_name,
          is_anonymous: t.is_anonymous ?? false,
          created_at: t.created_at,
        }))
      );
      setExpenses(
        (exps ?? []).map((e) => ({
          id: e.id,
          fund_id: e.fund_id,
          amount: Number(e.amount),
          date: e.expense_date,
          payee: e.payee,
          created_at: e.created_at,
        }))
      );
      setMembers((membersData ?? []) as DuesMember[]);
      setSubs(((subsData ?? []) as DuesSubscription[]).map((s) => ({ ...s, monthly_amount: Number(s.monthly_amount) })));
      setLoading(false);
    };
    load();
  }, []);

  const monthOptions = useMemo(() => {
    const set = new Set<string>();
    incomes.forEach((t) => set.add(monthKey(t.date)));
    expenses.forEach((t) => set.add(monthKey(t.date)));
    return Array.from(set).sort().reverse();
  }, [incomes, expenses]);

  const hasCustomRange = !!(fromDate || toDate);

  const summaries: FundSummary[] = useMemo(() => {
    const filterFn = (t: { date: string }) => {
      if (hasCustomRange) {
        if (fromDate && t.date < fromDate) return false;
        if (toDate && t.date > toDate) return false;
        return true;
      }
      return month === ALL || monthKey(t.date) === month;
    };
    const incomeMap = new Map<string, number>();
    incomes.filter(filterFn).forEach((t) => {
      incomeMap.set(t.fund_id, (incomeMap.get(t.fund_id) ?? 0) + t.amount);
    });
    const expenseMap = new Map<string, number>();
    expenses.filter(filterFn).forEach((t) => {
      expenseMap.set(t.fund_id, (expenseMap.get(t.fund_id) ?? 0) + t.amount);
    });
    return funds.map((f) => {
      const income = incomeMap.get(f.id) ?? 0;
      const expense = expenseMap.get(f.id) ?? 0;
      return { id: f.id, name: f.name, income, expense, balance: income - expense };
    });
  }, [funds, incomes, expenses, month, hasCustomRange, fromDate, toDate]);

  const totals = summaries.reduce(
    (acc, s) => ({
      income: acc.income + s.income,
      expense: acc.expense + s.expense,
      balance: acc.balance + s.balance,
    }),
    { income: 0, expense: 0, balance: 0 }
  );

  // Section B.6 — income vs expense trend, last 6 months present in the data.
  // Independent of the month/range filter above (a single month has no trend).
  const trendData = useMemo(() => {
    const map = new Map<string, { month: string; income: number; expense: number }>();
    incomes.forEach((t) => {
      const k = monthKey(t.date);
      const cur = map.get(k) ?? { month: k, income: 0, expense: 0 };
      cur.income += t.amount;
      map.set(k, cur);
    });
    expenses.forEach((t) => {
      const k = monthKey(t.date);
      const cur = map.get(k) ?? { month: k, income: 0, expense: 0 };
      cur.expense += t.amount;
      map.set(k, cur);
    });
    return Array.from(map.values())
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-6)
      .map((d) => ({ ...d, label: shortMonthLabel(d.month) }));
  }, [incomes, expenses]);

  // Section B.7 — fund balance breakdown for the same filtered range as the
  // summary cards above. Funds beyond the 8-slot categorical ramp fold into
  // "Other" rather than generating a new hue (see dataviz skill).
  const fundChartData = useMemo(() => {
    const withActivity = summaries.filter((s) => s.income !== 0 || s.expense !== 0);
    const sorted = [...withActivity].sort((a, b) => b.balance - a.balance);
    if (sorted.length <= 8) return sorted;
    const head = sorted.slice(0, 7);
    const rest = sorted.slice(7);
    const other = rest.reduce(
      (acc, s) => ({ ...acc, income: acc.income + s.income, expense: acc.expense + s.expense, balance: acc.balance + s.balance }),
      { id: "other", name: `Other (${rest.length})`, income: 0, expense: 0, balance: 0 }
    );
    return [...head, other];
  }, [summaries]);

  // Section B.8 — dues health: outstanding, collection rate, top 5 by due.
  // Always as-of the current month, independent of the dashboard's own
  // income/expense filter (dues are a running balance, not a per-range sum).
  const dueRows = useMemo(() => {
    if (!members.length) return [];
    const fundMap = new Map(funds.map((f) => [f.id, f]));
    const memberMap = new Map(members.map((m) => [m.id, m]));
    const duesTxns: DuesTxn[] = incomes.map((t) => ({
      member_id: t.member_id,
      fund_id: t.fund_id,
      amount: t.amount,
      txn_date: t.date,
      for_month: t.for_month,
    }));
    return computeDueRows(subs, fundMap, memberMap, duesTxns, dateToYm(new Date()));
  }, [funds, members, subs, incomes]);

  const duesHealth = useMemo(() => {
    const totalExpected = dueRows.reduce((s, r) => s + r.expected, 0);
    const totalPaid = dueRows.reduce((s, r) => s + r.paid, 0);
    const totalOutstanding = dueRows.reduce((s, r) => s + Math.max(r.due, 0), 0);
    const collectionRate = totalExpected > 0 ? (totalPaid / totalExpected) * 100 : 100;
    const byMember = new Map<string, { name: string; due: number }>();
    for (const r of dueRows) {
      if (r.due <= 0) continue;
      const cur = byMember.get(r.memberId) ?? { name: r.memberName, due: 0 };
      cur.due += r.due;
      byMember.set(r.memberId, cur);
    }
    const top5 = [...byMember.values()].sort((a, b) => b.due - a.due).slice(0, 5);
    return { totalExpected, totalPaid, totalOutstanding, collectionRate, top5 };
  }, [dueRows]);

  // Section B.9 — recent activity: last income/expense entries, newest first.
  const activity = useMemo(() => {
    const memberMap = new Map(members.map((m) => [m.id, m]));
    const fundMap = new Map(funds.map((f) => [f.id, f]));
    const incomeItems = incomes.slice(0, 15).map((t) => ({
      id: `inc-${t.id}`,
      type: "income" as const,
      date: t.date,
      created_at: t.created_at,
      label: t.is_anonymous ? "Anonymous donation" : (t.member_id ? memberMap.get(t.member_id)?.full_name : null) ?? t.donor_name ?? "Donor",
      sub: fundMap.get(t.fund_id)?.name ?? "—",
      amount: t.amount,
    }));
    const expenseItems = expenses.slice(0, 15).map((e) => ({
      id: `exp-${e.id}`,
      type: "expense" as const,
      date: e.date,
      created_at: e.created_at,
      label: e.payee ?? "Expense",
      sub: fundMap.get(e.fund_id)?.name ?? "—",
      amount: e.amount,
    }));
    return [...incomeItems, ...expenseItems]
      .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
      .slice(0, 10);
  }, [incomes, expenses, members, funds]);

  const trendColors = TREND_COLORS[mode];

  return (
    <AppLayout>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Dashboard</h2>
          <p className="text-sm text-muted-foreground">
            Welcome back{user?.user_metadata?.full_name ? `, ${user.user_metadata.full_name}` : ""}.
            {!isAdmin && " (Awaiting admin role)"}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="month-filter" className="text-xs text-muted-foreground">Filter by month</Label>
            <Select value={month} onValueChange={setMonth} disabled={hasCustomRange}>
              <SelectTrigger id="month-filter" className="w-[220px]">
                <SelectValue placeholder="All time" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All time</SelectItem>
                {monthOptions.map((m) => (
                  <SelectItem key={m} value={m}>{monthLabel(m)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* Section 6.2 — custom date range, overrides the month dropdown when set. */}
          <div className="flex flex-col gap-1">
            <Label htmlFor="dash-from" className="text-xs text-muted-foreground">From</Label>
            <Input id="dash-from" type="date" className="w-[160px]"
              value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="dash-to" className="text-xs text-muted-foreground">To</Label>
            <Input id="dash-to" type="date" className="w-[160px]"
              value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
          {hasCustomRange && (
            <Button variant="ghost" size="sm" onClick={() => { setFromDate(""); setToDate(""); }}>
              Clear range
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="mb-6 grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Income</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">৳ {formatBDT(totals.income)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Expense</CardTitle>
                <TrendingDown className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">৳ {formatBDT(totals.expense)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Net Balance</CardTitle>
                <Wallet className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">৳ {formatBDT(totals.balance)}</div>
              </CardContent>
            </Card>
          </div>

          <div className="mb-6 grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Income vs Expense Trend</CardTitle>
                <CardDescription>Last {trendData.length} month{trendData.length === 1 ? "" : "s"} with activity</CardDescription>
              </CardHeader>
              <CardContent>
                {trendData.length === 0 ? (
                  <p className="py-16 text-center text-sm text-muted-foreground">Not enough data yet.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={trendData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                      <YAxis
                        tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                        axisLine={false}
                        tickLine={false}
                        width={64}
                        tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
                      />
                      <Tooltip
                        formatter={(value: number, name: string) => [`৳ ${formatBDT(value)}`, name]}
                        contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      {/* Expense is dashed in addition to its color — the light-mode
                          income/expense pair sits in the CVD warn band, so color
                          alone isn't enough (see dataviz skill / chartColors.ts). */}
                      <Line type="monotone" dataKey="income" name="Income" stroke={trendColors.income} strokeWidth={2} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="expense" name="Expense" stroke={trendColors.expense} strokeWidth={2} strokeDasharray="5 4" dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Fund Balance Breakdown</CardTitle>
                <CardDescription>
                  {hasCustomRange
                    ? `${fromDate || "…"} to ${toDate || "…"}`
                    : month === ALL ? "All time" : monthLabel(month)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {fundChartData.length === 0 ? (
                  <p className="py-16 text-center text-sm text-muted-foreground">No fund activity in this range.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={Math.max(180, fundChartData.length * 36)}>
                    <BarChart data={fundChartData} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                      <XAxis
                        type="number"
                        tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
                      />
                      <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                      <Tooltip
                        formatter={(value: number) => `৳ ${formatBDT(value)}`}
                        contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                      />
                      <Bar dataKey="balance" radius={[0, 4, 4, 0]}>
                        {fundChartData.map((entry, i) => (
                          <Cell key={entry.id} fill={categoricalColor(i, mode)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="mb-6 grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Dues Health</CardTitle>
                <CardDescription>As of {monthLabel(dateToYm(new Date()))}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-xs text-muted-foreground">Outstanding</p>
                    <p className="text-lg font-semibold">৳ {formatBDT(duesHealth.totalOutstanding)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Collection rate</p>
                    <p className="text-lg font-semibold">{duesHealth.collectionRate.toFixed(0)}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Expected</p>
                    <p className="text-lg font-semibold">৳ {formatBDT(duesHealth.totalExpected)}</p>
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">Top 5 by amount due</p>
                  {duesHealth.top5.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No outstanding dues. 🎉</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {duesHealth.top5.map((m) => (
                        <li key={m.name} className="flex items-center justify-between text-sm">
                          <span className="truncate">{m.name}</span>
                          <Badge variant="destructive" className="font-mono font-normal">৳ {formatBDT(m.due)}</Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <Button variant="link" size="sm" className="h-auto p-0" asChild>
                  <Link to="/dues">View full Dues tab →</Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recent Activity</CardTitle>
                <CardDescription>Latest income and expense entries</CardDescription>
              </CardHeader>
              <CardContent>
                {activity.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nothing recorded yet.</p>
                ) : (
                  <ul className="divide-y">
                    {activity.map((a) => (
                      <li key={a.id}>
                        <Link
                          to={a.type === "income" ? "/income" : "/expenses"}
                          className="-mx-1 flex items-center justify-between gap-3 rounded px-1 py-2 text-sm hover:bg-muted/50"
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            {a.type === "income" ? (
                              <ArrowDownCircle className="h-4 w-4 shrink-0 text-primary" />
                            ) : (
                              <ArrowUpCircle className="h-4 w-4 shrink-0 text-destructive" />
                            )}
                            <div className="min-w-0">
                              <p className="truncate font-medium">{a.label}</p>
                              <p className="truncate text-xs text-muted-foreground">{a.sub}</p>
                            </div>
                          </div>
                          <span className="shrink-0 font-mono text-sm">
                            {a.type === "income" ? "+" : "−"}৳{formatBDT(a.amount)}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          <h3 className="mb-3 text-lg font-semibold">
            Fund Balances{" "}
            {hasCustomRange ? (
              <span className="text-sm font-normal text-muted-foreground">
                — {fromDate || "…"} to {toDate || "…"}
              </span>
            ) : (
              month !== ALL && <span className="text-sm font-normal text-muted-foreground">— {monthLabel(month)}</span>
            )}
          </h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {summaries.map((s) => (
              <Card key={s.id}>
                <CardHeader>
                  <CardTitle className="text-base">{s.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Income</span>
                    <span>৳ {formatBDT(s.income)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Expense</span>
                    <span>৳ {formatBDT(s.expense)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-1 font-semibold">
                    <span>Balance</span>
                    <span>৳ {formatBDT(s.balance)}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </AppLayout>
  );
}
