-- Task 8's manual verification found that migration 0011's self-insert/
-- self-update storage policies reject every legitimate employee upload
-- with a generic "new row violates row-level security policy" error, even
-- though the policy's own boolean condition evaluates true when tested
-- directly in SQL. Root-caused via live isolation testing (see the SDD
-- ledger for this plan): cross-table subqueries embedded in a
-- storage.objects policy do not reliably evaluate during an actual
-- Storage-API-driven write in this project, even when wrapped in a
-- SECURITY DEFINER helper function (which was tried and also failed).
-- A bare `auth.uid()` comparison — no subquery, no other table referenced
-- at all — works correctly and was independently verified live: an
-- authenticated employee can upload into a folder matching their own
-- auth.uid(), and is correctly rejected (RLS violation) when attempting to
-- upload into any other folder.
--
-- Fix: re-key the onboarding-documents folder-ownership check on
-- auth.uid() directly instead of employees.id, for both the insert and
-- update self-service policies and the select policy's own-document half.
-- This changes the folder-naming convention documents are uploaded under
-- from `{employees.id}/...` to `{auth.uid()}/...` — the application code
-- in app/onboarding/actions.ts must construct upload paths accordingly
-- (a follow-up task; this migration only fixes the schema side).
--
-- The status-gate condition (`eo.status in ('not_started',
-- 'needs_correction')`) that the original self-insert/self-update policies
-- also tried to enforce is deliberately NOT reproduced here, for the same
-- reason: it required the same unreliable cross-table subquery pattern.
-- That protection still exists at the layer that actually matters — an
-- employee cannot get `employee_onboarding.national_id_path` (etc.) written
-- once their row's status is `submitted`/`complete`, because
-- `employee_onboarding_update_self`'s RLS (0011, unaffected by this
-- migration) already blocks that regardless of what's sitting in storage.
-- A determined actor bypassing the UI could at most deposit an orphaned
-- file in their own private folder after submitting — never linked to
-- anything, never visible to another employee — which is an accepted,
-- low-severity gap rather than a cross-employee security boundary issue.
--
-- The select policy's admin branch (`or public.is_admin()`) is likely
-- subject to the same cross-table-subquery unreliability when evaluated
-- for a real (non-service-role) admin session — untested, since every
-- admin storage operation elsewhere in this codebase already goes through
-- the service-role client (createAdminClient()), which bypasses RLS
-- entirely and never exercises this branch. Left in place for
-- documentation/defense-in-depth; Task 9 (admin review UI) uses the
-- service-role client for its own document reads rather than relying on
-- this branch, for the same reason.
drop policy "onboarding_documents_storage_self_insert" on storage.objects;
create policy "onboarding_documents_storage_self_insert" on storage.objects
  for insert with check (
    bucket_id = 'onboarding-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy "onboarding_documents_storage_self_update" on storage.objects;
create policy "onboarding_documents_storage_self_update" on storage.objects
  for update using (
    bucket_id = 'onboarding-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  ) with check (
    bucket_id = 'onboarding-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy "onboarding_documents_storage_select" on storage.objects;
create policy "onboarding_documents_storage_select" on storage.objects
  for select using (
    bucket_id = 'onboarding-documents'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
    )
  );

-- Drop the SECURITY DEFINER helper tried during diagnosis — it did not fix
-- the issue (same cross-table-subquery limitation applies inside a
-- SECURITY DEFINER function body too) and is not referenced by any policy
-- above.
drop function if exists public.owns_onboarding_document(text);
