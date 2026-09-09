import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { safeErrorMessage } from "@/lib/errors";
import { Download, ShieldAlert, Loader2 } from "lucide-react";
import {
  SHEET_LABELS, SHEET_ORDER, type SheetKey,
  buildIncomeSheet, buildExpensesSheet, buildMembersSheet, buildFundsSheet,
  buildDuesSheet, buildMeetingsSheet, buildBloodDonorsSheet,
  buildWorkbook, downloadWorkbook, multiSheetFileName,
  type IncomeExportRow, type ExpenseExportRow, type MemberExportRow, type FundExportRow,
  type DuesExportRow, type MeetingExportRow, type BloodDonorExportRow,
} from "@/lib/dataExportSheets";

import { computeDueRows, dateToYm, type DuesFund, type DuesMember } from "@/lib/dues";

export default function DataExport() {
  const { isAdmin, isSuperAdmin, user } = useAuth();
  const canExport = isAdmin || isSuperAdmin;

  const [selected, setSelected] = useState<Set<SheetKey>>(new Set(SHEET_ORDER));
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    document.title = "Export | Prottoy Foundation";
  }, []);

  function toggle(key: SheetKey) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  async function buildIncome(): Promise<IncomeExportRow[]> {
    const [t, f, m, r] = await Promise.all([
      supabase.from("transactions").select("id,txn_date,donor_name,member_id,fund_id,payment_method,amount,for_month,is_anonymous").order("txn_date"),
      supabase.from("funds").select("id,name"),
      supabase.from("members").select("id,full_name"),
      supabase.from("receipts").select("transaction_id,receipt_no"),
    ]);
    if (t.error) throw t.error;
    const fundMap = new Map((f.data ?? []).map((x) => [x.id, x.name]));
    const memberMap = new Map((m.data ?? []).map((x) => [x.id, x.full_name]));
    const recMap = new Map((r.data ?? []).map((x) => [x.transaction_id, x.receipt_no]));
    return (t.data ?? [])
      .filter((row) => (!fromDate || row.txn_date >= fromDate) && (!toDate || row.txn_date <= toDate))
      .map((row) => ({
        txn_date: row.txn_date,
        receipt_no: recMap.get(row.id) ?? null,
        payer: (row.member_id ? memberMap.get(row.member_id) : null) ?? row.donor_name ?? "—",
        fund_name: fundMap.get(row.fund_id) ?? "—",
        payment_method: row.payment_method,
        amount: Number(row.amount),
        for_month: row.for_month,
        is_anonymous: row.is_anonymous ?? false,
      }));
  }

  async function buildExpenses(): Promise<ExpenseExportRow[]> {
    const [e, f] = await Promise.all([
      supabase.from("expenses").select("expense_date,fund_id,category,payee,description,amount").order("expense_date"),
      supabase.from("funds").select("id,name"),
    ]);
    if (e.error) throw e.error;
    const fundMap = new Map((f.data ?? []).map((x) => [x.id, x.name]));
    return (e.data ?? [])
      .filter((row) => (!fromDate || row.expense_date >= fromDate) && (!toDate || row.expense_date <= toDate))
      .map((row) => ({
        expense_date: row.expense_date,
        fund_name: fundMap.get(row.fund_id) ?? "—",
        category: row.category,
        payee: row.payee,
        description: row.description,
        amount: Number(row.amount),
      }));
  }

  async function buildMembers(): Promise<MemberExportRow[]> {
    const [m, ty, link, sub, f] = await Promise.all([
      supabase.from("members").select("id,member_no,full_name,email,mobile,reference_person,joining_date,is_active").order("member_no"),
      supabase.from("member_types").select("id,name"),
      supabase.from("member_member_types").select("member_id,member_type_id"),
      supabase.from("member_fund_subscriptions").select("member_id,fund_id,monthly_amount,is_active").eq("is_active", true),
      supabase.from("funds").select("id,name,is_one_time"),
    ]);
    if (m.error) throw m.error;
    const typeName = new Map((ty.data ?? []).map((x) => [x.id, x.name]));
    const typesByMember = new Map<string, string[]>();
    for (const l of link.data ?? []) {
      const name = typeName.get(l.member_type_id);
      if (!name) continue;
      const list = typesByMember.get(l.member_id) ?? [];
      list.push(name);
      typesByMember.set(l.member_id, list);
    }
    const fundName = new Map((f.data ?? []).map((x) => [x.id, x.name]));
    const oneTimeFundIds = new Set((f.data ?? []).filter((x) => x.is_one_time).map((x) => x.id));
    const subsByMember = new Map<string, { fund_id: string; monthly_amount: number }[]>();
    for (const s of sub.data ?? []) {
      const list = subsByMember.get(s.member_id) ?? [];
      list.push({ fund_id: s.fund_id, monthly_amount: Number(s.monthly_amount) });
      subsByMember.set(s.member_id, list);
    }
    return (m.data ?? []).map((row) => {
      const subs = subsByMember.get(row.id) ?? [];
      return {
        member_no: row.member_no,
        full_name: row.full_name,
        email: row.email,
        mobile: row.mobile,
        types: (typesByMember.get(row.id) ?? []).join(", "),
        reference_person: row.reference_person,
        joining_date: row.joining_date,
        fund_subscriptions: subs.map((s) => fundName.get(s.fund_id) ?? "—").join(", "),
        total_monthly: subs.filter((s) => !oneTimeFundIds.has(s.fund_id)).reduce((sum, s) => sum + s.monthly_amount, 0),
        is_active: row.is_active,
      };
    });
  }

  async function buildFunds(): Promise<FundExportRow[]> {
    const { data, error } = await supabase.from("funds").select("code,name,description,is_one_time,is_active").order("sort_order");
    if (error) throw error;
    return data ?? [];
  }

  async function buildDues(): Promise<DuesExportRow[]> {
    const [f, m, s, t] = await Promise.all([
      supabase.from("funds").select("id,name,code,is_one_time"),
      supabase.from("members").select("id,full_name,member_no,is_active"),
      supabase.from("member_fund_subscriptions").select("*").eq("is_active", true),
      supabase.from("transactions").select("member_id,fund_id,amount,txn_date,for_month").not("member_id", "is", null),
    ]);
    if (f.error) throw f.error;
    const fundMap = new Map<string, DuesFund>((f.data ?? []).map((x) => [x.id, x as DuesFund]));
    const memberMap = new Map<string, DuesMember>((m.data ?? []).map((x) => [x.id, x as DuesMember]));
    const endYm = toDate ? toDate.slice(0, 7) : dateToYm(new Date());
    const subs = (s.data ?? []).map((sub) => ({ ...sub, monthly_amount: Number(sub.monthly_amount) }));
    const txns = (t.data ?? []).map((tx) => ({ ...tx, amount: Number(tx.amount) }));

    return computeDueRows(subs, fundMap, memberMap, txns, endYm)
      .map((r) => ({
        member_no: r.memberNo,
        member_name: r.memberName,
        fund_name: r.fundName,
        monthly_amount: r.monthly,
        months: r.months,
        joining_month: r.joiningYm,
        expected: r.expected,
        paid: r.paid,
        due: r.due,
      }))
      .sort((a, b) => a.member_no - b.member_no || a.fund_name.localeCompare(b.fund_name));
  }

  async function buildMeetings(): Promise<MeetingExportRow[]> {
    const { data, error } = await supabase
      .from("meetings")
      .select("meeting_no,meeting_date,location,duration,next_meeting_date")
      .order("meeting_no");
    if (error) throw error;
    return (data ?? []).filter((row) =>
      (!fromDate || row.meeting_date >= fromDate) && (!toDate || row.meeting_date <= toDate));
  }

  async function buildBloodDonors(): Promise<BloodDonorExportRow[]> {
    const { data, error } = await supabase
      .from("blood_donors")
      .select("sl,name,blood_group,mobile,present_address,permanent_address,reference_person,last_donation_date")
      .order("sl");
    if (error) throw error;
    return data ?? [];
  }

  async function exportWorkbook() {
    if (selected.size === 0) {
      toast({ title: "Nothing selected", description: "Pick at least one sheet to export.", variant: "destructive" });
      return;
    }
    setExporting(true);
    let fileName = "";
    let totalRows = 0;
    try {
      const sheets: { key: SheetKey; ws: XLSX.WorkSheet }[] = [];
      const order = SHEET_ORDER.filter((k) => selected.has(k));

      for (const key of order) {
        if (key === "income") {
          const rows = await buildIncome();
          totalRows += rows.length;
          sheets.push({ key, ws: buildIncomeSheet(rows) });
        } else if (key === "expenses") {
          const rows = await buildExpenses();
          totalRows += rows.length;
          sheets.push({ key, ws: buildExpensesSheet(rows) });
        } else if (key === "members") {
          const rows = await buildMembers();
          totalRows += rows.length;
          sheets.push({ key, ws: buildMembersSheet(rows) });
        } else if (key === "funds") {
          const rows = await buildFunds();
          totalRows += rows.length;
          sheets.push({ key, ws: buildFundsSheet(rows) });
        } else if (key === "dues") {
          const rows = await buildDues();
          totalRows += rows.length;
          sheets.push({ key, ws: buildDuesSheet(rows) });
        } else if (key === "meetings") {
          const rows = await buildMeetings();
          totalRows += rows.length;
          sheets.push({ key, ws: buildMeetingsSheet(rows) });
        } else if (key === "blood_donors") {
          const rows = await buildBloodDonors();
          totalRows += rows.length;
          sheets.push({ key, ws: buildBloodDonorsSheet(rows) });
        }
      }

      const wb = buildWorkbook(sheets);
      fileName = multiSheetFileName(new Date(), fromDate || undefined, toDate || undefined);
      downloadWorkbook(wb, fileName);
      await supabase.from("audit_logs").insert({
        user_id: user?.id ?? null,
        action_type: "excel_export",
        file_name: fileName,
        records_processed: totalRows,
        status: "success",
        details: { sheets: order, from_date: fromDate || null, to_date: toDate || null },
      });
      toast({ title: "Export ready", description: `${sheets.length} sheet(s), ${totalRows} rows.` });
    } catch (e) {
      await supabase.from("audit_logs").insert({
        user_id: user?.id ?? null,
        action_type: "excel_export",
        file_name: fileName || null,
        records_processed: 0,
        status: "failed",
        details: { error: safeErrorMessage(e) },
      });
      toast({ title: "Export failed", description: safeErrorMessage(e), variant: "destructive" });
    } finally {
      setExporting(false);
    }
  }

  if (!canExport) {
    return (
      <AppLayout>
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Admins only</AlertTitle>
          <AlertDescription>Exporting records requires an Admin or Super Admin account.</AlertDescription>
        </Alert>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Export</h1>
          <p className="text-sm text-muted-foreground">
            Download current records as an Excel workbook. Exporting is read-only — nothing in the database changes.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-4 w-4" /> Export to Excel
            </CardTitle>
            <CardDescription>
              Pick which sections to include as separate sheets, and optionally a date range. Income, Expenses and
              Meetings are filtered by their own date; Dues uses "To" as the up-to-month cutoff (defaults to the
              current month); Members, Funds and Blood Donors are always exported in full.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <Label className="mb-2 block text-sm font-medium">Sheets to include</Label>
              <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                {SHEET_ORDER.map((key) => (
                  <label key={key} className="flex cursor-pointer items-center gap-2 rounded-md border p-2 hover:bg-accent">
                    <Checkbox checked={selected.has(key)} onCheckedChange={() => toggle(key)} />
                    <span className="text-sm">{SHEET_LABELS[key]}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="grid gap-2">
                <Label htmlFor="ex-from">From</Label>
                <Input id="ex-from" type="date" className="w-full sm:w-40"
                  value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ex-to">To</Label>
                <Input id="ex-to" type="date" className="w-full sm:w-40"
                  value={toDate} onChange={(e) => setToDate(e.target.value)} />
              </div>
              {(fromDate || toDate) && (
                <Button variant="ghost" size="sm" onClick={() => { setFromDate(""); setToDate(""); }}>
                  Clear range
                </Button>
              )}
            </div>

            <Button variant="secondary" onClick={() => void exportWorkbook()} disabled={exporting}>
              {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Download workbook
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
