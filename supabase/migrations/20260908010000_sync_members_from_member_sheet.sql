-- Sync members.mobile / members.email and member type badges from the
-- "Member" sheet of the finalized account summary
-- (Prottoy_Foundation_Account_Summary_Up_To_7_Sep_2026.xlsx).
--
-- mobile/email were never populated by the Reg and Monthly import (that
-- sheet doesn't have those columns), so this is new data for all 51
-- members. Idempotent: only updates rows that actually differ.
--
-- Member type badges: the Members tab reads public.member_member_types
-- (a member <-> type many-to-many), not the legacy members.member_type_id
-- column the earlier import set. member_types has since been split into
-- three rows (Founding, General, Executive) instead of one combined
-- "Founding & Executive" row. Per user direction, a sheet value of
-- "Founding & Executive" links the member to BOTH Founding and Executive;
-- "General" links to General. ON CONFLICT DO NOTHING makes this safe to
-- re-run and leaves the 3 members who already had links untouched.
--
-- Scope: members.mobile, members.email, member_member_types only. Nothing
-- else (joining_date, subscriptions, transactions) is touched.

UPDATE public.members m
SET mobile = v.mobile,
    email = v.email,
    updated_at = now()
FROM (VALUES
  (1, '+880 1710-814092', 'opunurullah@gmail.com'),
  (2, '+880 1310-752386', NULL),
  (3, '+880 1684-019248', NULL),
  (4, '+880 1516-161226', NULL),
  (5, '+880 1727-017816', NULL),
  (6, '+880 1630-236572', NULL),
  (7, '+880 1516 161227', NULL),
  (8, '+880 1515-293438', NULL),
  (9, '+880 1515-215230', NULL),
  (10, '+880 1680-766456', NULL),
  (11, '+880 1701-005139', NULL),
  (12, '+880 1515-276479', NULL),
  (13, '+880 1735-154961', NULL),
  (14, '+880 1735-852691', NULL),
  (15, '+880 1515-276479', NULL),
  (16, '+880 1710-814092', NULL),
  (17, '+880 1710-814092', NULL),
  (18, '+880 1310-752386', NULL),
  (19, '+880 1644-918582', NULL),
  (20, '+880 1515-293438', NULL),
  (21, '+880 1710-814092', NULL),
  (22, '+880 1710-814092', NULL),
  (23, '+880 1710-814092', NULL),
  (24, '+880 1735-852691', NULL),
  (25, '+880 1735-852691', NULL),
  (26, '+880 1727-017816', NULL),
  (27, '+880 1727-017816', NULL),
  (28, '+880 1684-019248', NULL),
  (29, '+880 1684-019248', NULL),
  (30, '+880 1310-752386', NULL),
  (31, '+880 1684-019248', NULL),
  (32, '+880 1684-019248', NULL),
  (33, '+880 1534-609614', NULL),
  (34, '+880 1310-752386', NULL),
  (35, NULL, NULL),
  (36, NULL, NULL),
  (37, NULL, NULL),
  (38, NULL, NULL),
  (39, '+880 1580-556616', NULL),
  (40, NULL, NULL),
  (41, NULL, NULL),
  (42, NULL, NULL),
  (43, NULL, NULL),
  (44, NULL, NULL),
  (45, NULL, NULL),
  (46, NULL, NULL),
  (47, NULL, NULL),
  (48, NULL, NULL),
  (49, NULL, NULL),
  (50, NULL, NULL),
  (51, '+880 1727-017816', NULL)
) AS v(member_no, mobile, email)
WHERE m.member_no = v.member_no
  AND (m.mobile IS DISTINCT FROM v.mobile OR m.email IS DISTINCT FROM v.email);

INSERT INTO public.member_member_types (member_id, member_type_id)
SELECT m.id, mt.id
FROM (VALUES
  (1, 'Founding & Executive'),
  (2, 'Founding & Executive'),
  (3, 'Founding & Executive'),
  (4, 'Founding & Executive'),
  (5, 'Founding & Executive'),
  (6, 'Founding & Executive'),
  (7, 'Founding & Executive'),
  (8, 'Founding & Executive'),
  (9, 'Founding & Executive'),
  (10, 'Founding & Executive'),
  (11, 'Founding & Executive'),
  (12, 'Founding & Executive'),
  (13, 'Founding & Executive'),
  (14, 'General'),
  (15, 'General'),
  (16, 'General'),
  (17, 'General'),
  (18, 'General'),
  (19, 'General'),
  (20, 'General'),
  (21, 'General'),
  (22, 'General'),
  (23, 'General'),
  (24, 'General'),
  (25, 'General'),
  (26, 'General'),
  (27, 'General'),
  (28, 'General'),
  (29, 'General'),
  (30, 'General'),
  (31, 'General'),
  (32, 'General'),
  (33, 'General'),
  (34, 'General'),
  (35, 'General'),
  (36, 'General'),
  (37, 'General'),
  (38, 'General'),
  (39, 'General'),
  (40, 'General'),
  (41, 'General'),
  (42, 'General'),
  (43, 'General'),
  (44, 'General'),
  (45, 'General'),
  (46, 'General'),
  (47, 'General'),
  (48, 'General'),
  (49, 'General'),
  (50, 'General'),
  (51, 'General')
) AS v(member_no, sheet_type)
JOIN public.members m ON m.member_no = v.member_no
JOIN public.member_types mt
  ON (v.sheet_type = 'Founding & Executive' AND mt.name IN ('Founding', 'Executive'))
  OR (v.sheet_type = 'General' AND mt.name = 'General')
ON CONFLICT (member_id, member_type_id) DO NOTHING;
