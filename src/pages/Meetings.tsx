import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious,
} from "@/components/ui/pagination";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Plus, Trash2, Pencil, Users, ChevronDown, CalendarDays } from "lucide-react";
import { formatDMY } from "@/lib/format";
import { safeErrorMessage } from "@/lib/errors";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import type { Database } from "@/integrations/supabase/types";

type Meeting = Database["public"]["Tables"]["meetings"]["Row"];
type Member = { id: string; member_no: number; full_name: string };

type AgendaRow = { agenda: string; decision_summary: string };

const agendaRowSchema = z.object({
  agenda: z.string().trim().max(2000).optional().or(z.literal("")),
  decision_summary: z.string().trim().max(4000).optional().or(z.literal("")),
});

const meetingSchema = z.object({
  meeting_no: z.string().trim().regex(/^\d+$/, "Required, must be a number"),
  meeting_date: z.string().min(1, "Meeting date required"),
  location: z.string().trim().max(300).optional().or(z.literal("")),
  duration: z.string().trim().max(300).optional().or(z.literal("")),
  next_meeting_date: z.string().optional().or(z.literal("")),
  next_meeting_location: z.string().trim().max(300).optional().or(z.literal("")),
  next_meeting_duration: z.string().trim().max(300).optional().or(z.literal("")),
  agenda_items: z.array(agendaRowSchema),
  next_agenda_items: z.array(z.string()),
});
type FormValues = z.infer<typeof meetingSchema>;

const emptyForm: FormValues = {
  meeting_no: "",
  meeting_date: new Date().toISOString().slice(0, 10),
  location: "",
  duration: "",
  next_meeting_date: "",
  next_meeting_location: "",
  next_meeting_duration: "",
  agenda_items: [{ agenda: "", decision_summary: "" }],
  next_agenda_items: [""],
};

type MeetingDetail = {
  agendaItems: { id: string; sort_order: number; agenda: string | null; decision_summary: string | null }[];
  nextAgendaItems: { id: string; sort_order: number; item: string }[];
  attendance: { member_id: string; is_present: boolean }[];
};

export default function Meetings() {
  const { isViewer } = useAuth();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [details, setDetails] = useState<Map<string, MeetingDetail>>(new Map());
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Meeting | null>(null);
  const [form, setForm] = useState<FormValues>(emptyForm);
  const [attendeeIds, setAttendeeIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Meeting | null>(null);

  useEffect(() => {
    document.title = "Meetings | Prottoy Foundation";
    // Section 12.1 — reset any open modal state when this route mounts.
    setDialogOpen(false);
    setEditing(null);
    setDeleteTarget(null);

    void fetchAll();
  }, []);

  async function fetchAll() {
    setLoading(true);
    const [mRes, memRes, aiRes, naRes, atRes] = await Promise.all([
      supabase.from("meetings").select("*").order("meeting_no", { ascending: false }),
      supabase.from("members").select("id, member_no, full_name").eq("is_active", true).order("member_no"),
      supabase.from("meeting_agenda_items").select("id, meeting_id, sort_order, agenda, decision_summary").order("sort_order"),
      supabase.from("meeting_next_agenda_items").select("id, meeting_id, sort_order, item").order("sort_order"),
      supabase.from("meeting_attendance").select("meeting_id, member_id, is_present"),
    ]);
    if (mRes.error) toast({ title: "Failed to load meetings", description: safeErrorMessage(mRes.error), variant: "destructive" });
    else setMeetings(mRes.data ?? []);
    if (memRes.error) toast({ title: "Failed to load members", description: safeErrorMessage(memRes.error), variant: "destructive" });
    else setMembers(memRes.data ?? []);

    const map = new Map<string, MeetingDetail>();
    const ensure = (id: string) => {
      if (!map.has(id)) map.set(id, { agendaItems: [], nextAgendaItems: [], attendance: [] });
      return map.get(id)!;
    };
    for (const r of aiRes.data ?? []) ensure(r.meeting_id).agendaItems.push(r);
    for (const r of naRes.data ?? []) ensure(r.meeting_id).nextAgendaItems.push(r);
    for (const r of atRes.data ?? []) ensure(r.meeting_id).attendance.push(r);
    setDetails(map);
    setLoading(false);
  }

  const memberMap = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);

  useEffect(() => {
    setPage(1);
  }, [meetings.length]);

  const totalPages = Math.max(1, Math.ceil(meetings.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = useMemo(
    () => meetings.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [meetings, currentPage]
  );

  const nextSuggestedNo = useMemo(
    () => (meetings.length ? Math.max(...meetings.map((m) => m.meeting_no)) + 1 : 1),
    [meetings]
  );

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm, meeting_no: String(nextSuggestedNo) });
    setAttendeeIds(new Set());
    setDialogOpen(true);
  }

  function openEdit(m: Meeting) {
    const detail = details.get(m.id);
    setEditing(m);
    setForm({
      meeting_no: String(m.meeting_no),
      meeting_date: m.meeting_date,
      location: m.location ?? "",
      duration: m.duration ?? "",
      next_meeting_date: m.next_meeting_date ?? "",
      next_meeting_location: m.next_meeting_location ?? "",
      next_meeting_duration: m.next_meeting_duration ?? "",
      agenda_items: detail?.agendaItems.length
        ? detail.agendaItems.map((a) => ({ agenda: a.agenda ?? "", decision_summary: a.decision_summary ?? "" }))
        : [{ agenda: "", decision_summary: "" }],
      next_agenda_items: detail?.nextAgendaItems.length ? detail.nextAgendaItems.map((n) => n.item) : [""],
    });
    setAttendeeIds(new Set((detail?.attendance ?? []).filter((a) => a.is_present).map((a) => a.member_id)));
    setDialogOpen(true);
  }

  function updateAgendaRow(i: number, patch: Partial<AgendaRow>) {
    setForm((prev) => ({
      ...prev,
      agenda_items: prev.agenda_items.map((row, idx) => (idx === i ? { ...row, ...patch } : row)),
    }));
  }
  function addAgendaRow() {
    setForm((prev) => ({ ...prev, agenda_items: [...prev.agenda_items, { agenda: "", decision_summary: "" }] }));
  }
  function removeAgendaRow(i: number) {
    setForm((prev) => ({ ...prev, agenda_items: prev.agenda_items.filter((_, idx) => idx !== i) }));
  }

  function updateNextAgendaRow(i: number, value: string) {
    setForm((prev) => ({
      ...prev,
      next_agenda_items: prev.next_agenda_items.map((v, idx) => (idx === i ? value : v)),
    }));
  }
  function addNextAgendaRow() {
    setForm((prev) => ({ ...prev, next_agenda_items: [...prev.next_agenda_items, ""] }));
  }
  function removeNextAgendaRow(i: number) {
    setForm((prev) => ({ ...prev, next_agenda_items: prev.next_agenda_items.filter((_, idx) => idx !== i) }));
  }

  function toggleAttendee(id: string) {
    setAttendeeIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = meetingSchema.safeParse(form);
    if (!parsed.success) {
      toast({ title: "Invalid input", description: parsed.error.issues[0]?.message ?? "Check the form", variant: "destructive" });
      return;
    }
    const v = parsed.data;
    setSubmitting(true);
    try {
      const payload: Database["public"]["Tables"]["meetings"]["Insert"] = {
        meeting_no: parseInt(v.meeting_no, 10),
        meeting_date: v.meeting_date,
        location: v.location || null,
        duration: v.duration || null,
        next_meeting_date: v.next_meeting_date || null,
        next_meeting_location: v.next_meeting_location || null,
        next_meeting_duration: v.next_meeting_duration || null,
      };

      let meetingId: string;
      if (editing) {
        const { error } = await supabase.from("meetings").update(payload).eq("id", editing.id);
        if (error) throw error;
        meetingId = editing.id;
        // Child rows are fully owned by this form — simplest correct approach is replace-all.
        await supabase.from("meeting_agenda_items").delete().eq("meeting_id", meetingId);
        await supabase.from("meeting_next_agenda_items").delete().eq("meeting_id", meetingId);
        await supabase.from("meeting_attendance").delete().eq("meeting_id", meetingId);
      } else {
        const { data, error } = await supabase.from("meetings").insert(payload).select("id").single();
        if (error) throw error;
        meetingId = data!.id;
      }

      const agendaRows = v.agenda_items
        .filter((r) => r.agenda?.trim() || r.decision_summary?.trim())
        .map((r, idx) => ({
          meeting_id: meetingId,
          sort_order: idx,
          agenda: r.agenda?.trim() || null,
          decision_summary: r.decision_summary?.trim() || null,
        }));
      if (agendaRows.length) {
        const { error } = await supabase.from("meeting_agenda_items").insert(agendaRows);
        if (error) throw error;
      }

      const nextRows = v.next_agenda_items
        .map((s) => s.trim())
        .filter(Boolean)
        .map((item, idx) => ({ meeting_id: meetingId, sort_order: idx, item }));
      if (nextRows.length) {
        const { error } = await supabase.from("meeting_next_agenda_items").insert(nextRows);
        if (error) throw error;
      }

      if (attendeeIds.size) {
        const { error } = await supabase.from("meeting_attendance").insert(
          [...attendeeIds].map((member_id) => ({ meeting_id: meetingId, member_id, is_present: true }))
        );
        if (error) throw error;
      }

      toast({ title: editing ? "Meeting updated" : "Meeting added" });
      setDialogOpen(false);
      void fetchAll();
    } catch (err) {
      toast({ title: editing ? "Update failed" : "Create failed", description: safeErrorMessage(err), variant: "destructive" });
    }
    setSubmitting(false);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const { error } = await supabase.from("meetings").delete().eq("id", deleteTarget.id);
    if (error) toast({ title: "Delete failed", description: safeErrorMessage(error), variant: "destructive" });
    else { toast({ title: "Meeting deleted" }); void fetchAll(); }
    setDeleteTarget(null);
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Meetings</h1>
            <p className="text-sm text-muted-foreground">
              Meeting history, agenda &amp; decisions, and attendance.
            </p>
          </div>
          {!isViewer && (
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" /> Add Meeting
            </Button>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Meeting list</CardTitle>
            <CardDescription>
              {loading
                ? "Loading…"
                : `${meetings.length} meetings${totalPages > 1 ? ` · page ${currentPage} of ${totalPages}` : ""}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {pageRows.length === 0 && !loading && (
              <p className="py-10 text-center text-muted-foreground">No meetings recorded yet.</p>
            )}

            <Accordion type="single" collapsible className="space-y-2">
              {pageRows.map((m) => {
                const detail = details.get(m.id);
                const present = (detail?.attendance ?? []).filter((a) => a.is_present);
                return (
                  <AccordionItem key={m.id} value={m.id} className="rounded-md border px-4">
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex flex-1 flex-wrap items-center justify-between gap-2 pr-2 text-left">
                        <div className="flex items-center gap-3">
                          <Badge variant="secondary" className="font-mono">#{m.meeting_no}</Badge>
                          <div>
                            <div className="font-medium">{formatDMY(m.meeting_date)}</div>
                            <div className="text-xs text-muted-foreground">{m.location ?? "—"}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Users className="h-3.5 w-3.5" />
                          {present.length} attended
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 pb-4">
                      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
                        {m.duration && <span>Duration: {m.duration}</span>}
                      </div>

                      <div>
                        <p className="mb-2 text-sm font-medium">Agenda &amp; Decisions</p>
                        {(detail?.agendaItems.length ?? 0) === 0 ? (
                          <p className="text-sm text-muted-foreground">No agenda items recorded.</p>
                        ) : (
                          <div className="space-y-2">
                            {detail!.agendaItems.map((a) => (
                              <div key={a.id} className="rounded-md border bg-muted/30 p-3">
                                {a.agenda && <p className="text-sm font-medium">{a.agenda}</p>}
                                {a.decision_summary && (
                                  <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{a.decision_summary}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {(detail?.nextAgendaItems.length ?? 0) > 0 && (
                        <div>
                          <p className="mb-2 text-sm font-medium">Planned for next meeting</p>
                          <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                            {detail!.nextAgendaItems.map((n) => <li key={n.id}>{n.item}</li>)}
                          </ul>
                        </div>
                      )}

                      {(m.next_meeting_date || m.next_meeting_location || m.next_meeting_duration) && (
                        <div className="flex items-center gap-2 rounded-md border bg-muted/30 p-3 text-sm">
                          <CalendarDays className="h-4 w-4 text-muted-foreground" />
                          <span>
                            Next meeting: {m.next_meeting_date ? formatDMY(m.next_meeting_date) : "—"}
                            {m.next_meeting_location ? ` · ${m.next_meeting_location}` : ""}
                            {m.next_meeting_duration ? ` · ${m.next_meeting_duration}` : ""}
                          </span>
                        </div>
                      )}

                      <div>
                        <p className="mb-2 text-sm font-medium">Attendance ({present.length})</p>
                        <div className="flex flex-wrap gap-1">
                          {present.length === 0 && <span className="text-sm text-muted-foreground">No attendees recorded.</span>}
                          {present.map((a) => (
                            <Badge key={a.member_id} variant="outline">
                              {memberMap.get(a.member_id)?.full_name ?? "—"}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      {!isViewer && (
                        <>
                          <Separator />
                          <div className="flex justify-end gap-1">
                            <Button variant="outline" size="sm" onClick={() => openEdit(m)}>
                              <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setDeleteTarget(m)}>
                              <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                            </Button>
                          </div>
                        </>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>

            {totalPages > 1 && (
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(e) => { e.preventDefault(); setPage((p) => Math.max(1, p - 1)); }}
                      className={currentPage === 1 ? "pointer-events-none opacity-50" : undefined}
                    />
                  </PaginationItem>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <PaginationItem key={p}>
                      <PaginationLink
                        href="#"
                        isActive={p === currentPage}
                        onClick={(e) => { e.preventDefault(); setPage(p); }}
                      >
                        {p}
                      </PaginationLink>
                    </PaginationItem>
                  ))}
                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      onClick={(e) => { e.preventDefault(); setPage((p) => Math.min(totalPages, p + 1)); }}
                      className={currentPage === totalPages ? "pointer-events-none opacity-50" : undefined}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit meeting" : "Add meeting"}</DialogTitle>
            <DialogDescription>
              {editing ? `Meeting #${editing.meeting_no}` : "Record a new meeting."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="meeting_no">Meeting No. *</Label>
                <Input id="meeting_no" inputMode="numeric" value={form.meeting_no}
                  onChange={(e) => setForm({ ...form, meeting_no: e.target.value.replace(/[^\d]/g, "") })} required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="meeting_date">Date *</Label>
                <Input id="meeting_date" type="date" value={form.meeting_date}
                  onChange={(e) => setForm({ ...form, meeting_date: e.target.value })} required />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="location">Location</Label>
                <Input id="location" value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="duration">Duration</Label>
                <Input id="duration" placeholder="e.g. 9 PM to 11 PM" value={form.duration}
                  onChange={(e) => setForm({ ...form, duration: e.target.value })} />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Attendance</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" className="justify-between font-normal">
                    <span className="truncate text-left">
                      {attendeeIds.size === 0 ? "Select attendees" : `${attendeeIds.size} member(s) selected`}
                    </span>
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-2" align="start">
                  <div className="max-h-64 overflow-auto space-y-1">
                    {members.map((m) => (
                      <label key={m.id} className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-accent cursor-pointer">
                        <Checkbox checked={attendeeIds.has(m.id)} onCheckedChange={() => toggleAttendee(m.id)} />
                        <span className="text-sm">#{m.member_no} · {m.full_name}</span>
                      </label>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
              {attendeeIds.size > 0 && (
                <div className="flex flex-wrap gap-1">
                  {[...attendeeIds].map((id) => (
                    <Badge key={id} variant="secondary">{memberMap.get(id)?.full_name ?? "?"}</Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Agenda &amp; Decision</Label>
                <Button type="button" variant="outline" size="sm" onClick={addAgendaRow}>
                  <Plus className="mr-1 h-3.5 w-3.5" /> Add item
                </Button>
              </div>
              <div className="space-y-3">
                {form.agenda_items.map((row, i) => (
                  <div key={i} className="space-y-2 rounded-md border p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">Item {i + 1}</span>
                      {form.agenda_items.length > 1 && (
                        <Button type="button" variant="ghost" size="icon" className="h-6 w-6"
                          onClick={() => removeAgendaRow(i)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                    <Input placeholder="Agenda" value={row.agenda}
                      onChange={(e) => updateAgendaRow(i, { agenda: e.target.value })} />
                    <Textarea placeholder="Decision / summary" rows={2} value={row.decision_summary}
                      onChange={(e) => updateAgendaRow(i, { decision_summary: e.target.value })} />
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Planned for next meeting</Label>
                <Button type="button" variant="outline" size="sm" onClick={addNextAgendaRow}>
                  <Plus className="mr-1 h-3.5 w-3.5" /> Add item
                </Button>
              </div>
              <div className="space-y-2">
                {form.next_agenda_items.map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input value={item} onChange={(e) => updateNextAgendaRow(i, e.target.value)} />
                    {form.next_agenda_items.length > 1 && (
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0"
                        onClick={() => removeNextAgendaRow(i)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Next meeting schedule</Label>
              <div className="grid grid-cols-2 gap-3">
                <Input type="date" value={form.next_meeting_date}
                  onChange={(e) => setForm({ ...form, next_meeting_date: e.target.value })} />
                <Input placeholder="Duration" value={form.next_meeting_duration}
                  onChange={(e) => setForm({ ...form, next_meeting_duration: e.target.value })} />
              </div>
              <Input placeholder="Location" value={form.next_meeting_location}
                onChange={(e) => setForm({ ...form, next_meeting_location: e.target.value })} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={submitting}>{submitting ? "Saving…" : editing ? "Save changes" : "Add meeting"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Delete meeting?"
        description={deleteTarget ? `Permanently delete meeting #${deleteTarget.meeting_no} and all its agenda/attendance records.` : ""}
        onConfirm={confirmDelete}
      />
    </AppLayout>
  );
}
