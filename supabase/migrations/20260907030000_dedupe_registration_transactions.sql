-- Remove duplicate REGISTRATION transactions.
--
-- Members 28, 29, 31, 32 and 34 ended up with two registration rows each:
-- one from the 2026-08-09 Bulk Import (older workbook, parsed with the
-- since-fixed date-column pairing) and one from the 2026-09-07 import. Both
-- rows carry the same amount and the same txn_date; only for_month differs,
-- so the (member_id, fund_id, for_month) dedupe key never matched.
--
-- Keeps the row filed under the month the fee was actually paid, per the
-- finalized workbook, and deletes any other registration row for that member.
-- Each deletion is written to transaction_audit_logs first, including the
-- original transaction id, so the removal is recoverable from the audit trail.
--
-- joining_date and member_fund_subscriptions.start_date are deliberately left
-- alone: these members have monthly dues recorded from the month BEFORE their
-- registration payment (e.g. member 28 pays for 2024-09 but registered
-- 2024-10-18). Moving the subscription start forward would drop a month from
-- the Dues "expected" calculation while the payment for it still exists.
--
-- Idempotent: once the extra rows are gone, re-running deletes nothing.

DO $dedupe$
DECLARE
  v_uid uuid;
  v_fund_reg uuid;
  v_member_id uuid;
  v_keep_month date;
  v_keep_count int;
  r record;
  t record;
  v_deleted int := 0;
BEGIN
  SELECT user_id INTO v_uid FROM public.user_roles
    WHERE role IN ('super_admin', 'admin')
    ORDER BY (role = 'super_admin') DESC
    LIMIT 1;

  SELECT id INTO v_fund_reg FROM public.funds WHERE code = 'REGISTRATION';
  IF v_fund_reg IS NULL THEN
    RAISE EXCEPTION 'REGISTRATION fund is missing';
  END IF;

  FOR r IN
    SELECT * FROM (VALUES
      (28, DATE '2024-10-18'),
      (29, DATE '2024-10-18'),
      (31, DATE '2024-11-29'),
      (32, DATE '2024-12-13'),
      (34, DATE '2025-01-17')
    ) AS v(member_no, reg_date)
  LOOP
    SELECT id INTO v_member_id FROM public.members WHERE member_no = r.member_no;
    IF v_member_id IS NULL THEN
      RAISE WARNING 'member_no % not found — skipped', r.member_no;
      CONTINUE;
    END IF;

    v_keep_month := date_trunc('month', r.reg_date)::date;

    -- Never delete unless the row we intend to keep is actually there.
    SELECT count(*) INTO v_keep_count
      FROM public.transactions
     WHERE member_id = v_member_id
       AND fund_id = v_fund_reg
       AND for_month = v_keep_month;

    IF v_keep_count = 0 THEN
      RAISE WARNING 'member_no %: no registration row for % — nothing deleted',
        r.member_no, v_keep_month;
      CONTINUE;
    END IF;

    FOR t IN
      SELECT * FROM public.transactions
       WHERE member_id = v_member_id
         AND fund_id = v_fund_reg
         AND for_month IS DISTINCT FROM v_keep_month
    LOOP
      INSERT INTO public.transaction_audit_logs (transaction_id, member_id, fund_id, fund_type,
        for_month, action, previous_amount, previous_data, updated_by_user_id, source_file)
      VALUES (t.id, v_member_id, v_fund_reg, 'registration', t.for_month, 'delete', t.amount,
              jsonb_build_object('deleted_transaction_id', t.id,
                                 'amount', t.amount,
                                 'txn_date', t.txn_date,
                                 'for_month', t.for_month,
                                 'payment_method', t.payment_method,
                                 'description', t.description),
              v_uid, 'duplicate registration cleanup');

      DELETE FROM public.transactions WHERE id = t.id;
      v_deleted := v_deleted + 1;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Duplicate registration cleanup: % transaction(s) deleted', v_deleted;
END;
$dedupe$;
