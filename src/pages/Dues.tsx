import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Image as ImageIcon, FileDown, ChevronDown, Receipt, Printer as PrinterIcon } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TablePagination } from "@/components/TablePagination";
import { TableSkeletonRows } from "@/components/TableSkeleton";
import { EmptyState, EmptyStateRow } from "@/components/EmptyState";
import { useUrlParam, useUrlNumberParam } from "@/hooks/useUrlParam";
import { formatBDT } from "@/lib/format";
import { toast } from "@/hooks/use-toast";
import { safeErrorMessage } from "@/lib/errors";

import {
  ALL, computeDueRows, dateToYm,
  type DuesFund as Fund, type DuesMember as Member, type DuesSubscription as Subscription, type DuesTxn as Txn,
} from "@/lib/dues";

export default function Dues() {
  const [funds, setFunds] = useState<Fund[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [txns, setTxns] = useState<Txn[]>([]);
  const [loading, setLoading] = useState(true);

  const today = new Date();
  const defaultEnd = dateToYm(today);
  const [memberFilter, setMemberFilter] = useUrlParam("member", ALL);
  // Section 2.1 — multi-select fund filter; empty set means "all funds".
  // Stored in the URL as a comma-joined list of fund ids.
  const [fundFiltersRaw, setFundFiltersRaw] = useUrlParam("funds", "");
  const fundFilters = useMemo(
    () => new Set(fundFiltersRaw ? fundFiltersRaw.split(",") : []),
    [fundFiltersRaw]
  );
  const setFundFilters = (next: Set<string> | ((prev: Set<string>) => Set<string>)) => {
    const resolved = typeof next === "function" ? next(fundFilters) : next;
    setFundFiltersRaw([...resolved].join(","));
  };
  const [endMonth, setEndMonth] = useUrlParam("upto", defaultEnd);
  // Section 2.2 — sorting.
  const [sortByRaw, setSortBy] = useUrlParam("sort", "member");
  const sortBy = (["member", "memberNo", "amount", "date", "status", "fund"] as const).includes(sortByRaw as "member")
    ? (sortByRaw as "member" | "memberNo" | "amount" | "date" | "status" | "fund")
    : "member";
  const [sortDirRaw, setSortDir] = useUrlParam("dir", "asc");
  const sortDir = sortDirRaw === "desc" ? "desc" : "asc";
  const [page, setPage] = useUrlNumberParam("page", 1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    document.title = "Dues | Prottoy Foundation";
    void load();
  }, []);

  async function load() {
    setLoading(true);
    const [fRes, mRes, sRes, tRes] = await Promise.all([
      supabase.from("funds").select("id,name,code,is_one_time").order("sort_order"),
      supabase.from("members").select("id,full_name,member_no,is_active").order("member_no"),
      supabase.from("member_fund_subscriptions").select("*").eq("is_active", true),
      supabase.from("transactions").select("member_id,fund_id,amount,txn_date,for_month"),
    ]);
    const err = fRes.error || mRes.error || sRes.error || tRes.error;
    if (err) toast({ title: "Failed to load", description: safeErrorMessage(err), variant: "destructive" });
    setFunds((fRes.data ?? []) as Fund[]);
    setMembers((mRes.data ?? []) as Member[]);
    setSubs(((sRes.data ?? []) as Subscription[]).map((s) => ({ ...s, monthly_amount: Number(s.monthly_amount) })));
    setTxns(((tRes.data ?? []) as Txn[]).map((t) => ({ ...t, amount: Number(t.amount) })));
    setLoading(false);
  }

  const memberMap = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const fundMap = useMemo(() => new Map(funds.map((f) => [f.id, f])), [funds]);

  const rows = useMemo(() => {
    return computeDueRows(subs, fundMap, memberMap, txns, endMonth, memberFilter, fundFilters)
      .sort((a, b) => {
        const dir = sortDir === "asc" ? 1 : -1;
        let cmp = 0;
        if (sortBy === "member") cmp = a.memberName.localeCompare(b.memberName);
        else if (sortBy === "memberNo") cmp = a.memberNo - b.memberNo;
        else if (sortBy === "amount") cmp = a.due - b.due;
        else if (sortBy === "date") cmp = a.joiningYm.localeCompare(b.joiningYm);
        else if (sortBy === "fund") cmp = a.fundName.localeCompare(b.fundName);
        else if (sortBy === "status") {
          const rank = (due: number) => (due > 0 ? 2 : due < 0 ? 1 : 0);
          cmp = rank(a.due) - rank(b.due);
        }
        if (cmp !== 0) return cmp * dir;
        // Stable tiebreaker keeps a member's fund rows grouped together.
        return a.memberNo - b.memberNo || a.fundName.localeCompare(b.fundName);
      });
  }, [subs, txns, memberFilter, fundFilters, endMonth, memberMap, fundMap, sortBy, sortDir]);

  useEffect(() => {
    setPage(1);
  }, [memberFilter, fundFilters, endMonth, sortBy, sortDir, pageSize, setPage]);

  const pageMemberIds = useMemo(() => {
    const seen = new Set<string>();
    const ids: string[] = [];
    for (const r of rows) {
      if (!seen.has(r.memberId)) {
        seen.add(r.memberId);
        ids.push(r.memberId);
      }
    }
    return ids;
  }, [rows]);

  const totalPages = Math.max(1, Math.ceil(pageMemberIds.length / pageSize));
  const currentPage = Math.min(page, totalPages);

  const visibleMemberIds = useMemo(
    () => new Set(pageMemberIds.slice((currentPage - 1) * pageSize, currentPage * pageSize)),
    [pageMemberIds, currentPage, pageSize]
  );

  const pageRows = useMemo(() => rows.filter((r) => visibleMemberIds.has(r.memberId)), [rows, visibleMemberIds]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => ({
        expected: acc.expected + r.expected,
        paid: acc.paid + r.paid,
        due: acc.due + r.due,
      }),
      { expected: 0, paid: 0, due: 0 }
    );
  }, [rows]);

  const captureRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  function exportStamp() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  async function renderCanvas() {
    const node = captureRef.current;
    if (!node) throw new Error("Nothing to export");
    const { default: html2canvas } = await import("html2canvas");
    const bg = getComputedStyle(document.body).backgroundColor || "#ffffff";
    return html2canvas(node, {
      backgroundColor: bg,
      scale: 2,
      windowWidth: node.scrollWidth + 48,
      width: node.scrollWidth,
      height: node.scrollHeight,
    });
  }

  async function handleExportImage() {
    setExporting(true);
    try {
      const canvas = await renderCanvas();
      const link = document.createElement("a");
      link.download = `Prottoy_Dues_${endMonth}_${exportStamp()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast({ title: "Image exported" });
    } catch (e) {
      toast({ title: "Export failed", description: safeErrorMessage(e), variant: "destructive" });
    } finally {
      setExporting(false);
    }
  }

  async function handleExportPdf() {
    setExporting(true);
    try {
      const canvas = await renderCanvas();
      const { jsPDF } = await import("jspdf");
      const landscape = canvas.width >= canvas.height;
      const pdf = new jsPDF({ orientation: landscape ? "landscape" : "portrait", unit: "pt", format: "a4" });
      const pw = pdf.internal.pageSize.getWidth();
      const ph = pdf.internal.pageSize.getHeight();
      const margin = 24;
      const scale = Math.min((pw - margin * 2) / canvas.width, (ph - margin * 2) / canvas.height);
      const w = canvas.width * scale;
      const h = canvas.height * scale;
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", (pw - w) / 2, margin, w, h);
      pdf.save(`Prottoy_Dues_${endMonth}_${exportStamp()}.pdf`);
      toast({ title: "PDF exported" });
    } catch (e) {
      toast({ title: "Export failed", description: safeErrorMessage(e), variant: "destructive" });
    } finally {
      setExporting(false);
    }
  }


  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Member Dues</h1>
          <p className="text-sm text-muted-foreground">
            Expected vs paid contributions per member per fund, based on subscriptions.
          </p>
        </div>

        <Card className="print:hidden">
          <CardHeader>
            <CardTitle>Filters</CardTitle>
            <CardDescription>Calculated up to the selected month (inclusive).</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="grid gap-2">
                <Label>Member</Label>
                <Select value={memberFilter} onValueChange={setMemberFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>All members</SelectItem>
                    {members.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        #{m.member_no} — {m.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Fund</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" className="justify-between font-normal">
                      <span className="truncate text-left">
                        {fundFilters.size === 0
                          ? "All funds"
                          : [...fundFilters].map((id) => fundMap.get(id)?.name ?? "?").join(", ")}
                      </span>
                      <ChevronDown className="h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-2" align="start">
                    <div className="max-h-64 space-y-1 overflow-auto">
                      <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-accent">
                        <Checkbox
                          checked={fundFilters.size === 0}
                          onCheckedChange={() => setFundFilters(new Set())}
                        />
                        <span className="text-sm font-medium">All funds</span>
                      </label>
                      {funds.map((f) => (
                        <label key={f.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-accent">
                          <Checkbox
                            checked={fundFilters.has(f.id)}
                            onCheckedChange={() =>
                              setFundFilters((prev) => {
                                const next = new Set(prev);
                                if (next.has(f.id)) next.delete(f.id); else next.add(f.id);
                                return next;
                              })
                            }
                          />
                          <span className="text-sm">{f.name}</span>
                        </label>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
                {fundFilters.size > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {[...fundFilters].map((id) => (
                      <Badge key={id} variant="secondary">{fundMap.get(id)?.name ?? "?"}</Badge>
                    ))}
                  </div>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="endMonth">Up to month</Label>
                <Input
                  id="endMonth"
                  type="month"
                  value={endMonth}
                  onChange={(e) => setEndMonth(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>Sort by</Label>
                <Select value={`${sortBy}:${sortDir}`} onValueChange={(v) => {
                  const [by, dir] = v.split(":");
                  setSortBy(by as typeof sortBy);
                  setSortDir(dir as "asc" | "desc");
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member:asc">Member — A→Z</SelectItem>
                    <SelectItem value="member:desc">Member — Z→A</SelectItem>
                    <SelectItem value="memberNo:asc">Member No — low to high</SelectItem>
                    <SelectItem value="memberNo:desc">Member No — high to low</SelectItem>
                    <SelectItem value="amount:desc">Due amount — high to low</SelectItem>
                    <SelectItem value="amount:asc">Due amount — low to high</SelectItem>
                    <SelectItem value="date:desc">Joining date — newest first</SelectItem>
                    <SelectItem value="date:asc">Joining date — oldest first</SelectItem>
                    <SelectItem value="status:desc">Status — due first</SelectItem>
                    <SelectItem value="status:asc">Status — settled first</SelectItem>
                    <SelectItem value="fund:asc">Fund — A→Z</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
            <div className="space-y-1.5">
              <CardTitle>Dues</CardTitle>
              <CardDescription>
                {loading
                  ? "Loading…"
                  : `${rows.length} subscription rows · ${pageMemberIds.length} members`}
              </CardDescription>
            </div>
            <div className="flex gap-2 print:hidden">
              <Button variant="outline" size="sm" onClick={handleExportImage} disabled={exporting || rows.length === 0}>
                <ImageIcon className="mr-2 h-4 w-4" /> Export image
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportPdf} disabled={exporting || rows.length === 0}>
                <FileDown className="mr-2 h-4 w-4" /> Export PDF
              </Button>
              <Button variant="outline" size="sm" onClick={() => window.print()} disabled={rows.length === 0}>
                <PrinterIcon className="mr-2 h-4 w-4" /> Print
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Mobile card view — added alongside, not instead of, the table
                below: the table stays the export-image/PDF capture target
                (html2canvas can't capture a display:none node), so it's
                left always-rendered rather than hidden on small screens. */}
            <div className="space-y-2 md:hidden print:hidden">
              {loading && Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="animate-pulse rounded-md border p-3">
                  <div className="mb-2 h-4 w-2/3 rounded bg-muted" />
                  <div className="h-3 w-1/3 rounded bg-muted" />
                </div>
              ))}
              {rows.length === 0 && !loading && (
                <EmptyState icon={Receipt} title="No subscriptions match" description="Try a different member, fund, or month filter." />
              )}
              {pageRows.map((r) => (
                <div key={r.key} className="rounded-md border p-3">
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium leading-tight">{r.memberName}</p>
                      <p className="text-xs text-muted-foreground">#{r.memberNo} · {r.fundName}</p>
                    </div>
                    {r.due > 0 ? (
                      <Badge variant="destructive" className="shrink-0 font-mono font-normal">{formatBDT(r.due)}</Badge>
                    ) : r.due < 0 ? (
                      <Badge variant="outline" className="shrink-0 font-mono font-normal text-green-700">+{formatBDT(-r.due)}</Badge>
                    ) : (
                      <Badge variant="outline" className="shrink-0 font-mono font-normal">Clear</Badge>
                    )}
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">Expected</p>
                      <p className="font-mono">{formatBDT(r.expected)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Paid</p>
                      <p className="font-mono">{formatBDT(r.paid)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Joined</p>
                      <p className="whitespace-nowrap">{r.joiningLabel}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Always rendered (not display:none) even on mobile, purely so
                Export image/PDF has a real node to capture from any
                viewport — the card view above is what mobile actually reads. */}
            <div className="rounded-md border overflow-x-auto">
              <div ref={captureRef} className="min-w-max bg-background p-4">
                <div className="mb-3">
                  <p className="text-base font-semibold">Member Dues — up to {new Date(`${endMonth}-01T00:00:00`).toLocaleString("en-US", { month: "long", year: "numeric" })}</p>
                  <p className="text-xs text-muted-foreground">
                    {memberFilter === ALL ? "All members" : memberMap.get(memberFilter)?.full_name} · {fundFilters.size === 0 ? "All funds" : [...fundFilters].map((id) => fundMap.get(id)?.name ?? "?").join(", ")} · {rows.length} rows
                  </p>
                </div>
              <Table className="min-w-max">
                <TableHeader className="sticky top-0 z-10 bg-background">
                  <TableRow>
                    <TableHead className="w-20">Member Number</TableHead>
                    <TableHead>Member Name</TableHead>
                    <TableHead>Fund Name</TableHead>
                    <TableHead>Joining Month</TableHead>
                    <TableHead className="text-right">Monthly Amount</TableHead>
                    <TableHead className="text-right">Total Month</TableHead>
                    <TableHead className="text-right">Expected Amount</TableHead>
                    <TableHead className="text-right">Paid Month</TableHead>
                    <TableHead className="text-right">Paid Amount</TableHead>
                    <TableHead className="text-right">Due Month</TableHead>
                    <TableHead className="text-right">Due Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && <TableSkeletonRows columns={11} />}
                  {rows.length === 0 && !loading && (
                    <EmptyStateRow
                      colSpan={11}
                      icon={Receipt}
                      title="No subscriptions match"
                      description="Try a different member, fund, or month filter."
                    />
                  )}
                  {pageRows.map((r) => (
                    <TableRow key={r.key}>
                      <TableCell className="font-mono">{r.memberNo}</TableCell>
                      <TableCell className="font-medium">{r.memberName}</TableCell>
                      <TableCell>{r.fundName}</TableCell>
                      <TableCell className="whitespace-nowrap">{r.joiningLabel}</TableCell>
                      <TableCell className="text-right font-mono">{formatBDT(r.monthly)}</TableCell>
                      <TableCell className="text-right font-mono">{r.months}</TableCell>
                      <TableCell className="text-right font-mono">{formatBDT(r.expected)}</TableCell>
                      <TableCell className="text-right font-mono">
                        {r.paidMonths === null ? <span className="text-muted-foreground">—</span> : r.paidMonths}
                      </TableCell>
                      <TableCell className={`text-right font-mono ${r.paid > 0 ? "text-green-700" : ""}`}>{formatBDT(r.paid)}</TableCell>
                      <TableCell className="text-right font-mono">
                        {r.dueMonths === null ? <span className="text-muted-foreground">—</span> : r.dueMonths}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {r.due > 0 ? (
                          <span className="text-red-700">{formatBDT(r.due)}</span>
                        ) : r.due < 0 ? (
                          <span className="text-green-700">+{formatBDT(-r.due)}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {rows.length > 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-right font-semibold">Totals</TableCell>
                      <TableCell className="text-right font-mono font-semibold">{formatBDT(totals.expected)}</TableCell>
                      <TableCell />
                      <TableCell className="text-right font-mono font-semibold">{formatBDT(totals.paid)}</TableCell>
                      <TableCell />
                      <TableCell className="text-right font-mono font-semibold">{formatBDT(totals.due)}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
              <div className="flex items-center gap-2">
                <Label htmlFor="pageSize" className="text-xs text-muted-foreground">Rows per page</Label>
                <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                  <SelectTrigger id="pageSize" className="w-20"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="print:hidden">
              <TablePagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setPage}
              />
            </div>

            {/* Printing/exporting only captures the current page of rows
                (same as Export image/PDF above) — bump "Rows per page" to
                show everything you want in the printout. */}
            <p className="mt-2 hidden text-xs text-muted-foreground print:hidden sm:block">
              Tip: increase "Rows per page" before printing to include more rows.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
