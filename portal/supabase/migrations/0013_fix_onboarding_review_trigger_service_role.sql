-- Task 9 (admin review UI) live-testing found: enforce_onboarding_self_edit_columns()
-- (migration 0011)'s own public.is_admin() check never accounts for a service-role
-- session. public.is_admin() (0001/0002) resolves via `e.auth_user_id = auth.uid()`,
-- and auth.uid() is null for a service-role call (no JWT) — so is_admin() always
-- returns false there. Every other admin write in this codebase relies on Postgres
-- RLS bypass for the service role, but *triggers* are not part of RLS and always
-- fire regardless of role. The result: markOnboardingComplete() and
-- requestOnboardingCorrection() (lib/onboarding.ts, both called with
-- createAdminClient() per this plan's established convention for cross-employee
-- admin writes) were unconditionally rejected by this trigger with "Only an admin
-- can set onboarding review fields" / "Only an admin can mark onboarding complete"
-- — reproduced live, repeatedly, via a throwaway employee and the actual
-- markOnboardingCompleteAction/requestOnboardingCorrectionAction code path.
--
-- Fix: treat a null auth.uid() (i.e. a service-role session) the same as
-- public.is_admin(). This is safe because no authenticated employee session ever
-- has a null auth.uid() — a real employee JWT always carries one — so this only
-- widens the trusted branch to cover the service-role case, without weakening the
-- self-edit protection for actual employee sessions.
create or replace function public.enforce_onboarding_self_edit_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() or auth.uid() is null then
    new.updated_at = now();
    return new;
  end if;

  if new.status = 'complete' then
    raise exception 'Only an admin can mark onboarding complete';
  end if;

  if new.reviewed_by is distinct from old.reviewed_by
    or new.reviewed_at is distinct from old.reviewed_at
    or new.correction_notes is distinct from old.correction_notes then
    raise exception 'Only an admin can set onboarding review fields';
  end if;

  new.updated_at = now();
  return new;
end;
$$;
