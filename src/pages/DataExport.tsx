import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";
import { safeErrorMessage } from "@/lib/errors";
import { Download, ShieldAlert, Loader2 } from "lucide-react";
import {
  buildRegAndMonthlyWorkbook, downloadWorkbook, monthRange, exportFileName,
  SHEET_NAME, type ExportMember,
} from "@/lib/excelExport";

export default function DataExport() {
  const { isAdmin, isSuperAdmin, user } = useAuth();
  const canExport = isAdmin || isSuperAdmin;

  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    document.title = "Export | Prottoy Foundation";
  }, []);

  async function exportWorkbook() {
    setExporting(true);
    let fileName = "";
    try {
      const [mRes, fRes, tRes, tyRes, linkRes] = await Promise.all([
        supabase.from("members").select("id,member_no,full_name,reference_person,joining_date").order("member_no"),
        supabase.from("funds").select("id,code,name,is_one_time"),
        supabase.from("transactions").select("member_id,fund_id,amount,txn_date,for_month").not("member_id", "is", null),
        supabase.from("member_types").select("id,name"),
        supabase.from("member_member_types").select("member_id,member_type_id"),
      ]);
      const err = mRes.error || fRes.error || tRes.error || tyRes.error || linkRes.error;
      if (err) throw err;

      const funds = fRes.data ?? [];
      const regFundId = funds.find((f) => f.code === "REGISTRATION")?.id;
      const monthlyFundIds = new Set(funds.filter((f) => f.code.startsWith("MONTHLY_")).map((f) => f.id));
      const typeName = new Map((tyRes.data ?? []).map((t) => [t.id, t.name]));
      const typeNamesByMember = new Map<string, Set<string>>();
      for (const l of linkRes.data ?? []) {
        const name = typeName.get(l.member_type_id);
        if (!name) continue;
        if (!typeNamesByMember.has(l.member_id)) typeNamesByMember.set(l.member_id, new Set());
        typeNamesByMember.get(l.member_id)!.add(name);
      }

      const byMember = new Map<string, ExportMember>();
      for (const m of mRes.data ?? []) {
        const names = typeNamesByMember.get(m.id);
        const memberType = names?.has("Founding") && names?.has("Executive")
          ? "Founding & Executive"
          : names?.size
            ? [...names].join(" & ")
            : "General";
        byMember.set(m.id, {
          member_no: m.member_no,
          full_name: m.full_name,
          reference_person: m.reference_person ?? null,
          member_type: memberType,
          registration_fee: null,
          registration_date: null,
          monthly: {},
        });
      }

      const monthsSeen = new Set<string>();
      for (const t of tRes.data ?? []) {
        const em = t.member_id ? byMember.get(t.member_id) : null;
        if (!em) continue;
        if (t.fund_id === regFundId) {
          em.registration_fee = (em.registration_fee ?? 0) + Number(t.amount);
          if (!em.registration_date || t.txn_date < em.registration_date) em.registration_date = t.txn_date;
          continue;
        }
        if (!monthlyFundIds.has(t.fund_id) || !t.for_month) continue;
        const ym = String(t.for_month).slice(0, 7);
        monthsSeen.add(ym);
        const prev = em.monthly[ym];
        em.monthly[ym] = {
          date: t.txn_date,
          amount: (prev?.amount ?? 0) + Number(t.amount),
        };
      }

      const sortedMonths = [...monthsSeen].sort();
      const months = sortedMonths.length
        ? monthRange(sortedMonths[0], sortedMonths[sortedMonths.length - 1])
        : [];
      const members = [...byMember.values()].sort((a, b) => a.member_no - b.member_no);

      if (members.length === 0) {
        toast({ title: "Nothing to export", description: "No members found.", variant: "destructive" });
        return;
      }

      const wb = buildRegAndMonthlyWorkbook(members, months);
      const targetMonth = sortedMonths.length ? sortedMonths[sortedMonths.length - 1] : new Date().toISOString().slice(0, 7);
      fileName = exportFileName(targetMonth);
      downloadWorkbook(wb, fileName);
      await supabase.from("audit_logs").insert({
        user_id: user?.id ?? null,
        action_type: "excel_export",
        file_name: fileName,
        records_processed: members.length,
        status: "success",
        details: { months: months.length, target_month: targetMonth },
      });
      toast({ title: "Export ready", description: `${members.length} members × ${months.length} months.` });
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
              Generates <span className="font-mono">Prottoy_Summary_&lt;TargetMonth&gt;_&lt;ExportDate&gt;.xlsx</span> as a
              single “{SHEET_NAME}” sheet: member details, registration fee, then a Date/Amount pair per month.
            </CardDescription>
          </CardHeader>
          <CardContent>
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
