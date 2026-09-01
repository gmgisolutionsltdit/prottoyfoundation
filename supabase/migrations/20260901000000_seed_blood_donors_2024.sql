-- Seed blood donor records from the "Blood group database (Prottoy foundation) 24102024" spreadsheet.
-- Idempotent: skips any SL already present so re-running this migration is safe.

INSERT INTO public.blood_donors
  (sl, name, blood_group, mobile, present_address, permanent_address, reference_person, reference_mobile, last_donation_date)
SELECT v.sl, v.name, v.blood_group, v.mobile, v.present_address, v.permanent_address, v.reference_person, v.reference_mobile, v.last_donation_date
FROM (VALUES
  (1, 'Md Nurullah',       'B-'::public.blood_group, '01710814092', 'Hazaribagh, Dhaka', 'Companiganj, Noakhali', 'Ahmed Rezwan Autul', NULL,           NULL::date),
  (2, 'Ahmed Rezwan Autul','O+'::public.blood_group, NULL,          'Hazaribagh, Dhaka', NULL,                    'Md Nurullah',         '01710814092', NULL::date),
  (3, 'Mahmudul Hasan',    'B+'::public.blood_group, NULL,          'Hazaribagh, Dhaka', NULL,                    'Ahmed Rezwan Autul',  NULL,          NULL::date),
  (4, 'Md Mamun Hossain',  'B+'::public.blood_group, NULL,          'Hazaribagh, Dhaka', NULL,                    'Ahmed Rezwan Autul',  NULL,          '2024-10-22'::date),
  (5, 'Md Rakib Raihan',   'A+'::public.blood_group, NULL,          NULL,                 NULL,                    NULL,                  NULL,          NULL::date),
  (6, 'Md Salam',          'A-'::public.blood_group, NULL,          NULL,                 NULL,                    NULL,                  NULL,          NULL::date),
  (7, 'Kazi Helal Uddin',  'B+'::public.blood_group, NULL,          NULL,                 NULL,                    NULL,                  NULL,          '2024-10-23'::date)
) AS v(sl, name, blood_group, mobile, present_address, permanent_address, reference_person, reference_mobile, last_donation_date)
WHERE NOT EXISTS (SELECT 1 FROM public.blood_donors b WHERE b.sl = v.sl);

-- Keep the auto-increment sequence ahead of the seeded SL values.
SELECT setval('public.blood_donors_sl_seq', GREATEST(7, (SELECT COALESCE(MAX(sl), 0) FROM public.blood_donors)));
