-- Set members.joining_date to the exact registration date recorded in
-- column F of the "Reg and Monthly" sheet, for every member currently
-- in the workbook (Prottoy_Foundation_Account_Summary_Up_To_7_Sep_2026.xlsx).
--
-- Several members were imported with joining_date truncated to the 1st of
-- their joining month; this replaces that with the exact day. Column F's
-- date always equals the earliest dated activity for every member in this
-- workbook (verified), so there is no ambiguity in which date to use.
--
-- Scope: ONLY public.members.joining_date. Nothing else (transactions,
-- subscriptions, fees) is touched.
--
-- Idempotent: the WHERE clause only updates rows that actually differ, so
-- re-running this after it has already applied is a no-op.

UPDATE public.members m
SET joining_date = v.reg_date,
    updated_at = now()
FROM (VALUES
  (1, DATE '2024-08-22'),
  (2, DATE '2024-08-22'),
  (3, DATE '2024-08-22'),
  (4, DATE '2024-08-22'),
  (5, DATE '2024-08-22'),
  (6, DATE '2024-08-22'),
  (7, DATE '2024-08-22'),
  (8, DATE '2024-09-17'),
  (9, DATE '2024-08-22'),
  (10, DATE '2024-08-22'),
  (11, DATE '2024-08-29'),
  (12, DATE '2024-08-22'),
  (13, DATE '2024-09-13'),
  (14, DATE '2024-08-22'),
  (15, DATE '2024-09-09'),
  (16, DATE '2024-09-12'),
  (17, DATE '2024-09-12'),
  (18, DATE '2024-09-12'),
  (19, DATE '2024-09-13'),
  (20, DATE '2024-09-17'),
  (21, DATE '2024-09-19'),
  (22, DATE '2024-09-19'),
  (23, DATE '2024-09-19'),
  (24, DATE '2024-09-19'),
  (25, DATE '2024-09-19'),
  (26, DATE '2024-09-19'),
  (27, DATE '2024-09-19'),
  (28, DATE '2024-10-18'),
  (29, DATE '2024-10-18'),
  (30, DATE '2024-11-22'),
  (31, DATE '2024-11-29'),
  (32, DATE '2024-12-13'),
  (33, DATE '2025-01-13'),
  (34, DATE '2025-01-17'),
  (35, DATE '2025-03-14'),
  (36, DATE '2025-03-14'),
  (37, DATE '2025-03-14'),
  (38, DATE '2025-03-14'),
  (39, DATE '2025-03-14'),
  (40, DATE '2025-03-18'),
  (41, DATE '2025-03-18'),
  (42, DATE '2025-03-20'),
  (43, DATE '2025-03-20'),
  (44, DATE '2025-03-20'),
  (45, DATE '2025-03-20'),
  (46, DATE '2025-03-20'),
  (47, DATE '2025-03-20'),
  (48, DATE '2025-03-20'),
  (49, DATE '2025-03-20'),
  (50, DATE '2025-03-20'),
  (51, DATE '2025-03-20')
) AS v(member_no, reg_date)
WHERE m.member_no = v.member_no
  AND m.joining_date IS DISTINCT FROM v.reg_date;
