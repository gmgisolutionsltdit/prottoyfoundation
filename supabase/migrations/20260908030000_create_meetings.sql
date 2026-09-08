-- Meetings tab: schema for meeting records, per-meeting agenda/decision
-- pairs, planned next-meeting agenda items, and per-member attendance.
--
-- meeting_agenda_items keeps agenda and decision_summary on the SAME row
-- (not two separate lists) because that pairing is the whole point per the
-- source data: each agenda item discussed in a meeting has its own specific
-- decision/summary next to it. sort_order preserves the order they were
-- discussed in.
--
-- meeting_next_agenda_items is a separate, unordered-relative-to-agenda
-- list because in the source spreadsheet the "planned for next meeting"
-- column is NOT row-paired to a specific current-meeting agenda item — it's
-- just a flat list of what's planned next, spread arbitrarily across rows.
--
-- meeting_attendance is one row per (meeting, member) pair, storing an
-- explicit is_present boolean for members in the tracked roster — absence
-- is meaningful information, not just an omitted row.

CREATE TABLE public.meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_no integer NOT NULL UNIQUE,
  meeting_date date NOT NULL,
  location text,
  duration text,
  next_meeting_date date,
  next_meeting_location text,
  next_meeting_duration text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.meeting_agenda_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  agenda text,
  decision_summary text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_meeting_agenda_items_meeting ON public.meeting_agenda_items(meeting_id);

CREATE TABLE public.meeting_next_agenda_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  item text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_meeting_next_agenda_items_meeting ON public.meeting_next_agenda_items(meeting_id);

CREATE TABLE public.meeting_attendance (
  meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  is_present boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (meeting_id, member_id)
);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.meetings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.meetings                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_agenda_items         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_next_agenda_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_attendance           ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage meetings"                  ON public.meetings                  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins manage meeting_agenda_items"      ON public.meeting_agenda_items      FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins manage meeting_next_agenda_items" ON public.meeting_next_agenda_items FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins manage meeting_attendance"        ON public.meeting_attendance        FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
