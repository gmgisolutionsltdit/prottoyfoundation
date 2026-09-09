// Consolidates a member's profile, fund subscriptions, payment history, dues
// status and receipts into one page — previously scattered across the
// Members table row, two dialogs (edit, subscriptions), and the Dues tab.
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { safeErrorMessage } from "@/lib/errors";
import { formatBDT } from "@/lib/format";
import { formatDMY } from "@/lib/format";
import { computeDueRows, dateToYm, type DuesFund } from "@/lib/dues";
import {
  ArrowLeft, Loader2, Mail, Phone, MapPin, CalendarDays, UserCheck, Wallet, Receipt as ReceiptIcon,
  PlusCircle, Pencil,
} from "lucide-react";

type Member = {
  id: string;
  member_no: number;
  full_name: string;
  email: string | null;
  mobile: string | null;
  address: string | null;
  joining_date: string;
  reference_person: string | null;
  notes: string | null;
  is_active: boolean;
};

type SubRow = {
  id: string;
  fund_id: string;
  monthly_amount: number;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  fund: { name: string; code: string; is_one_time: boolean } | null;
};

type TxnRow = {
  id: string;
  fund_id: string;
  amount: number;
  txn_date: string;
  for_month: string | null;
  payment_method: string;
  is_anonymous: boolean;
  fund_name: string;
  receipt_no: string | null;
};

export default function MemberDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isViewer } = useAuth();

  const [member, setMember] = useState<Member | null>(null);
  const [typeNames, setTypeNames] = useState<string[]>([]);
  const [subs, setSubs] = useState<SubRow[]>([]);
  const [txns, setTxns] = useState<TxnRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    void load(id);
  }, [id]);

  async function load(memberId: string) {
    setLoading(true);
    const [mRes, mtRes, sRes, tRes] = await Promise.all([
      supabase.from("members").select("id, member_no, full_name, email, mobile, address, joining_date, reference_person, notes, is_active").eq("id", memberId).maybeSingle(),
      supabase.from("member_member_types").select("member_types(name)").eq("member_id", memberId),
      supabase.from("member_fund_subscriptions").select("id, fund_id, monthly_amount, start_date, end_date, is_active, funds(name, code, is_one_time)").eq("member_id", memberId),
      supabase.from("transactions").select("id, fund_id, amount, txn_date, for_month, payment_method, is_anonymous, funds(name)").eq("member_id", memberId).order("txn_date", { ascending: false }),
    ]);
    if (mRes.error) toast({ title: "Failed to load member", description: safeErrorMessage(mRes.error), variant: "destructive" });
    if (!mRes.data) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setMember(mRes.data as Member);
    setTypeNames(((mtRes.data ?? []) as { member_types: { name: string } | null }[]).map((r) => r.member_types?.name).filter((n): n is string => !!n));
    setSubs(
      ((sRes.data ?? []) as { id: string; fund_id: string; monthly_amount: number; start_date: string; end_date: string | null; is_active: boolean; funds: { name: string; code: string; is_one_time: boolean } | null }[]).map((s) => ({
        id: s.id, fund_id: s.fund_id, monthly_amount: Number(s.monthly_amount), start_date: s.start_date,
        end_date: s.end_date, is_active: s.is_active, fund: s.funds,
      }))
    );

    const txnRows = (tRes.data ?? []) as { id: string; fund_id: string; amount: number; txn_date: string; for_month: string | null; payment_method: string; is_anonymous: boolean; funds: { name: string } | null }[];
    const txnIds = txnRows.map((t) => t.id);
    const { data: receiptRows } = txnIds.length
      ? await supabase.from("receipts").select("transaction_id, receipt_no").in("transaction_id", txnIds)
      : { data: [] as { transaction_id: string; receipt_no: string }[] };
    const receiptMap = new Map((receiptRows ?? []).map((r) => [r.transaction_id, r.receipt_no]));
    setTxns(
      txnRows.map((t) => ({
        id: t.id, fund_id: t.fund_id, amount: Number(t.amount), txn_date: t.txn_date, for_month: t.for_month,
        payment_method: t.payment_method, is_anonymous: t.is_anonymous ?? false,
        fund_name: t.funds?.name ?? "—", receipt_no: receiptMap.get(t.id) ?? null,
      }))
    );
    setLoading(false);
  }

  const dueRows = useMemo(() => {
    if (!member) return [];
    const fundMap = new Map<string, DuesFund>();
    subs.forEach((s) => {
      if (s.fund) fundMap.set(s.fund_id, { id: s.fund_id, name: s.fund.name, code: s.fund.code, is_one_time: s.fund.is_one_time });
    });
    const memberMap = new Map([[member.id, { id: member.id, full_name: member.full_name, member_no: member.member_no, is_active: member.is_active }]]);
    const activeSubs = subs.filter((s) => s.is_active).map((s) => ({
      id: s.id, member_id: member.id, fund_id: s.fund_id, monthly_amount: s.monthly_amount, start_date: s.start_date, end_date: s.end_date, is_active: s.is_active,
    }));
    const duesTxns = txns.map((t) => ({ member_id: member.id, fund_id: t.fund_id, amount: t.amount, txn_date: t.txn_date, for_month: t.for_month }));
    return computeDueRows(activeSubs, fundMap, memberMap, duesTxns, dateToYm(new Date()));
  }, [member, subs, txns]);

  const totalDue = dueRows.reduce((s, r) => s + Math.max(r.due, 0), 0);
  const totalPaidAllTime = txns.reduce((s, t) => s + t.amount, 0);

  if (loading) {
    return (
      <AppLayout>
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (notFound || !member) {
    return (
      <AppLayout>
        <div className="py-16 text-center">
          <p className="text-lg font-medium">Member not found</p>
          <Button variant="link" onClick={() => navigate("/members")}>Back to Members</Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link to="/members" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to Members
          </Link>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold">{member.full_name}</h2>
            <Badge variant="outline">#{member.member_no}</Badge>
            {member.is_active ? <Badge>Active</Badge> : <Badge variant="secondary">Inactive</Badge>}
          </div>
          {typeNames.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {typeNames.map((t) => <Badge key={t} variant="outline">{t}</Badge>)}
            </div>
          )}
        </div>
        {!isViewer && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to={`/members?q=${encodeURIComponent(member.full_name)}`}>
                <Pencil className="mr-2 h-4 w-4" /> Edit in Members list
              </Link>
            </Button>
            <Button size="sm" asChild>
              <Link to={`/income?newFor=${member.id}`}>
                <PlusCircle className="mr-2 h-4 w-4" /> Record income
              </Link>
            </Button>
          </div>
        )}
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total paid (all time)</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">৳ {formatBDT(totalPaidAllTime)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Outstanding dues</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">৳ {formatBDT(totalDue)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Active subscriptions</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{subs.filter((s) => s.is_active).length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Joined</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{formatDMY(member.joining_date)}</div></CardContent>
        </Card>
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle className="text-base">Profile</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-start gap-2">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <span>{member.email || "—"}</span>
            </div>
            <div className="flex items-start gap-2">
              <Phone className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <span>{member.mobile || "—"}</span>
            </div>
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <span>{member.address || "—"}</span>
            </div>
            <div className="flex items-start gap-2">
              <UserCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <span>Referred by {member.reference_person || "—"}</span>
            </div>
            <div className="flex items-start gap-2">
              <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <span>Joined {formatDMY(member.joining_date)}</span>
            </div>
            {member.notes && (
              <div className="rounded-md border bg-muted/30 p-2 text-xs text-muted-foreground">{member.notes}</div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Wallet className="h-4 w-4" /> Fund Subscriptions &amp; Dues</CardTitle>
            <CardDescription>As of {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}</CardDescription>
          </CardHeader>
          <CardContent>
            {dueRows.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No active subscriptions.</p>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fund</TableHead>
                      <TableHead className="text-right">Monthly</TableHead>
                      <TableHead className="text-right">Expected</TableHead>
                      <TableHead className="text-right">Paid</TableHead>
                      <TableHead className="text-right">Due</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dueRows.map((r) => (
                      <TableRow key={r.key}>
                        <TableCell className="font-medium">{r.fundName}</TableCell>
                        <TableCell className="text-right font-mono">{r.monthly ? `৳ ${formatBDT(r.monthly)}` : "—"}</TableCell>
                        <TableCell className="text-right font-mono">৳ {formatBDT(r.expected)}</TableCell>
                        <TableCell className="text-right font-mono">৳ {formatBDT(r.paid)}</TableCell>
                        <TableCell className="text-right font-mono">
                          {r.due > 0 ? (
                            <Badge variant="destructive" className="font-mono font-normal">৳ {formatBDT(r.due)}</Badge>
                          ) : (
                            <span className="text-muted-foreground">৳ {formatBDT(r.due)}</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><ReceiptIcon className="h-4 w-4" /> Payment History</CardTitle>
          <CardDescription>{txns.length} payment{txns.length === 1 ? "" : "s"} recorded</CardDescription>
        </CardHeader>
        <CardContent>
          {txns.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No payments recorded yet.</p>
          ) : (
            <div className="max-h-[420px] overflow-auto rounded-md border">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-card">
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Receipt</TableHead>
                    <TableHead>Fund</TableHead>
                    <TableHead>For Month</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {txns.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>{formatDMY(t.txn_date)}</TableCell>
                      <TableCell className="font-mono text-xs">{t.receipt_no ?? "—"}</TableCell>
                      <TableCell>{t.fund_name}</TableCell>
                      <TableCell>{t.for_month ? t.for_month.slice(0, 7) : "—"}</TableCell>
                      <TableCell className="text-right font-mono">৳ {formatBDT(t.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </AppLayout>
  );
}
