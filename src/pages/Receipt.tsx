// A standalone, printable receipt for one income transaction — no AppLayout
// chrome, so window.print() from here prints just the receipt itself.
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, Printer } from "lucide-react";
import { formatBDT, formatDMY, PAYMENT_LABEL, type PaymentMethod } from "@/lib/format";

interface ReceiptData {
  receipt_no: string | null;
  txn_date: string;
  amount: number;
  payment_method: string;
  for_month: string | null;
  description: string | null;
  is_anonymous: boolean;
  donor_name: string | null;
  member_name: string | null;
  member_no: number | null;
  fund_name: string;
}

export default function Receipt() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<ReceiptData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const [tRes, rRes] = await Promise.all([
        supabase
          .from("transactions")
          .select("txn_date, amount, payment_method, for_month, description, is_anonymous, donor_name, funds(name), members(full_name, member_no)")
          .eq("id", id)
          .maybeSingle(),
        supabase.from("receipts").select("receipt_no").eq("transaction_id", id).maybeSingle(),
      ]);
      if (!tRes.data) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      const t = tRes.data as unknown as {
        txn_date: string; amount: number; payment_method: string; for_month: string | null;
        description: string | null; is_anonymous: boolean; donor_name: string | null;
        funds: { name: string } | null; members: { full_name: string; member_no: number } | null;
      };
      setData({
        receipt_no: rRes.data?.receipt_no ?? null,
        txn_date: t.txn_date,
        amount: Number(t.amount),
        payment_method: t.payment_method,
        for_month: t.for_month,
        description: t.description,
        is_anonymous: t.is_anonymous ?? false,
        donor_name: t.donor_name,
        member_name: t.members?.full_name ?? null,
        member_no: t.members?.member_no ?? null,
        fund_name: t.funds?.name ?? "—",
      });
      setLoading(false);
    })();
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        <p className="text-lg font-medium">Receipt not found</p>
        <Button variant="link" asChild><Link to="/income">Back to Income</Link></Button>
      </div>
    );
  }

  const payerName = data.is_anonymous
    ? "Anonymous"
    : data.member_name ?? data.donor_name ?? "—";

  return (
    <div className="min-h-screen bg-muted/30 p-6 print:bg-white print:p-0">
      <div className="mx-auto flex max-w-2xl items-center justify-between print:hidden">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/income"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Income</Link>
        </Button>
        <Button size="sm" onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" /> Print
        </Button>
      </div>

      <div className="mx-auto mt-4 max-w-2xl rounded-lg border bg-card p-8 print:mt-0 print:rounded-none print:border-none print:p-4 print:shadow-none">
        <div className="mb-6 flex items-center gap-4 border-b pb-6">
          <img src="/logo.png" alt="Prottoy Foundation" className="h-16 w-16 rounded-full" />
          <div>
            <h1 className="text-xl font-bold">Prottoy Foundation</h1>
            <p className="text-sm text-muted-foreground">Payment Receipt</p>
          </div>
        </div>

        <div className="mb-6 flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Receipt No.</p>
            <p className="font-mono text-lg font-semibold">{data.receipt_no ?? "—"}</p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Date</p>
            <p className="font-medium">{formatDMY(data.txn_date)}</p>
          </div>
        </div>

        <dl className="mb-6 grid grid-cols-2 gap-4 border-y py-4 text-sm">
          <div>
            <dt className="text-muted-foreground">Received from</dt>
            <dd className="font-medium">
              {payerName}
              {data.member_no && !data.is_anonymous && (
                <span className="ml-1 font-normal text-muted-foreground">(#{data.member_no})</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Fund</dt>
            <dd className="font-medium">{data.fund_name}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Payment Method</dt>
            <dd className="font-medium">{PAYMENT_LABEL[data.payment_method as PaymentMethod] ?? data.payment_method}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">For Month</dt>
            <dd className="font-medium">
              {data.for_month
                ? new Date(data.for_month).toLocaleDateString("en-US", { month: "long", year: "numeric" })
                : "—"}
            </dd>
          </div>
          {data.description && (
            <div className="col-span-2">
              <dt className="text-muted-foreground">Note</dt>
              <dd>{data.description}</dd>
            </div>
          )}
        </dl>

        <div className="mb-8 flex items-center justify-between rounded-md bg-muted/50 p-4 print:bg-transparent print:border">
          <span className="text-sm font-medium text-muted-foreground">Amount Received</span>
          <span className="text-2xl font-bold">৳ {formatBDT(data.amount)}</span>
        </div>

        <div className="flex items-end justify-between text-xs text-muted-foreground">
          <p>Thank you for your contribution to Prottoy Foundation.</p>
          <div className="text-right">
            <div className="mb-1 h-10 w-32 border-b" />
            <p>Authorized Signature</p>
          </div>
        </div>
      </div>
    </div>
  );
}
