-- Self-service password reset (docs/superpowers/specs/2026-09-12-portal-forgot-password-design.md).
-- personal_email: admin-set recovery address, primarily for admin/superadmin
-- accounts (they never have an employee_onboarding row to fall back on).
-- last_recovery_requested_at: throttle marker, see lib/passwordRecovery.ts.
alter table employees add column personal_email text;
alter table employees add column last_recovery_requested_at timestamptz;
