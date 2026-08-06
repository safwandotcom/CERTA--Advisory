import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { createAdminClient } from '../lib/supabase/admin'
import { createEmployeeRecord } from '../lib/employees'
import { employeeIdToEmail } from '../lib/employeeAuth'

test('an employee cannot read or write another employee\'s onboarding row', async () => {
  const adminClient = createAdminClient()

  const ownerId = `ob-owner-${Date.now()}`
  const { employeeRowId: ownerRowId } = await createEmployeeRecord(adminClient, {
    employeeId: ownerId,
    password: 'password-owner-123',
    name: 'Onboarding Owner',
    role: 'employee',
  })

  const outsiderId = `ob-outsider-${Date.now()}`
  await createEmployeeRecord(adminClient, {
    employeeId: outsiderId,
    password: 'password-outsider-123',
    name: 'Onboarding Outsider',
    role: 'employee',
  })

  const outsiderClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  await outsiderClient.auth.signInWithPassword({ email: employeeIdToEmail(outsiderId), password: 'password-outsider-123' })

  const { data: visibleRows } = await outsiderClient
    .from('employee_onboarding')
    .select('*')
    .eq('employee_id', ownerRowId)
  expect(visibleRows).toHaveLength(0)

  const { error: writeError } = await outsiderClient
    .from('employee_onboarding')
    .update({ phone: 'should-fail' })
    .eq('employee_id', ownerRowId)
  // RLS silently filters rows the caller can't see rather than raising —
  // the correctness signal is that the row is unchanged, checked next.
  expect(writeError).toBeNull()

  const { data: unchanged } = await adminClient
    .from('employee_onboarding')
    .select('phone')
    .eq('employee_id', ownerRowId)
    .single()
  expect(unchanged?.phone).toBeNull()
})

test('an employee cannot self-complete onboarding or set review fields', async () => {
  const adminClient = createAdminClient()

  const selfId = `ob-self-${Date.now()}`
  const { employeeRowId: selfRowId } = await createEmployeeRecord(adminClient, {
    employeeId: selfId,
    password: 'password-self-123',
    name: 'Self Completer',
    role: 'employee',
  })

  const selfClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  await selfClient.auth.signInWithPassword({ email: employeeIdToEmail(selfId), password: 'password-self-123' })

  const { error: completeError } = await selfClient
    .from('employee_onboarding')
    .update({ status: 'complete' })
    .eq('employee_id', selfRowId)
  expect(completeError).not.toBeNull()

  const { error: reviewFieldError } = await selfClient
    .from('employee_onboarding')
    .update({ correction_notes: 'self-authored, should fail' })
    .eq('employee_id', selfRowId)
  expect(reviewFieldError).not.toBeNull()
})

// Final-review Finding 5, part 2: the "cannot self-complete" test above only
// exercises the trigger (enforce_onboarding_self_edit_columns), on a row
// still at not_started. This test targets a different boundary:
// employee_onboarding_update_self's status-gated USING clause, on a row
// that has moved past not_started/needs_correction — the case the trigger
// alone would NOT catch, since a plain field edit (not a status/review-field
// change) sails through the trigger untouched.
test('an employee whose onboarding is submitted cannot edit their own row', async () => {
  const adminClient = createAdminClient()

  const submittedId = `ob-submitted-${Date.now()}`
  const { employeeRowId: submittedRowId } = await createEmployeeRecord(adminClient, {
    employeeId: submittedId,
    password: 'password-submitted-123',
    name: 'Submitted Employee',
    role: 'employee',
  })

  const { error: setSubmittedError } = await adminClient
    .from('employee_onboarding')
    .update({ status: 'submitted', submitted_at: new Date().toISOString() })
    .eq('employee_id', submittedRowId)
  expect(setSubmittedError).toBeNull()

  const submittedClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  await submittedClient.auth.signInWithPassword({
    email: employeeIdToEmail(submittedId),
    password: 'password-submitted-123',
  })

  const { data: writeResult, error: writeError } = await submittedClient
    .from('employee_onboarding')
    .update({ phone: 'should-not-apply' })
    .eq('employee_id', submittedRowId)
    .select('id')

  // employee_onboarding_update_self's USING clause only matches status in
  // ('not_started', 'needs_correction') — a submitted row falls outside
  // that, so RLS filters the row out of the update entirely: no error,
  // zero rows returned/affected (same "silent no-op" shape Finding 4 fixed
  // the app layer to detect).
  expect(writeError).toBeNull()
  expect(writeResult).toHaveLength(0)

  const { data: unchanged } = await adminClient
    .from('employee_onboarding')
    .select('phone')
    .eq('employee_id', submittedRowId)
    .single()
  expect(unchanged?.phone).toBeNull()
})

test('a manager has no elevated access to another employee\'s onboarding row', async () => {
  const adminClient = createAdminClient()

  const managerId = `ob-mgr-${Date.now()}`
  const { employeeRowId: managerRowId } = await createEmployeeRecord(adminClient, {
    employeeId: managerId,
    password: 'password-mgr-123',
    name: 'Onboarding Manager',
    role: 'manager',
  })

  const staffId = `ob-staff-${Date.now()}`
  const { employeeRowId: staffRowId } = await createEmployeeRecord(adminClient, {
    employeeId: staffId,
    password: 'password-staff-123',
    name: 'Onboarding Staff',
    role: 'employee',
  })

  const managerClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  await managerClient.auth.signInWithPassword({ email: employeeIdToEmail(managerId), password: 'password-mgr-123' })

  const { data: visibleRows } = await managerClient
    .from('employee_onboarding')
    .select('*')
    .eq('employee_id', staffRowId)
  expect(visibleRows).toHaveLength(0)

  // Sanity check: the manager's OWN row is visible (own-row access still
  // works for a manager, only cross-employee access is denied).
  const { data: ownRow } = await managerClient
    .from('employee_onboarding')
    .select('status')
    .eq('employee_id', managerRowId)
    .single()
  expect(ownRow?.status).toBe('not_started')
})

test('an employee cannot read, mark-read, or create a notification belonging to another employee', async () => {
  const adminClient = createAdminClient()

  const senderId = `notif-sender-${Date.now()}`
  await createEmployeeRecord(adminClient, {
    employeeId: senderId,
    password: 'password-sender-123',
    name: 'Notification Sender',
    role: 'employee',
  })

  const targetId = `notif-target-${Date.now()}`
  const { employeeRowId: targetRowId } = await createEmployeeRecord(adminClient, {
    employeeId: targetId,
    password: 'password-target-123',
    name: 'Notification Target',
    role: 'employee',
  })

  const { data: targetNotification } = await adminClient
    .from('notifications')
    .insert({ recipient_id: targetRowId, title: 'For target only' })
    .select('id')
    .single()

  const senderClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  await senderClient.auth.signInWithPassword({ email: employeeIdToEmail(senderId), password: 'password-sender-123' })

  // Cannot read it.
  const { data: visibleToSender } = await senderClient
    .from('notifications')
    .select('id')
    .eq('id', targetNotification!.id)
  expect(visibleToSender).toHaveLength(0)

  // Cannot mark it read.
  await senderClient
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', targetNotification!.id)
  const { data: stillUnread } = await adminClient
    .from('notifications')
    .select('read_at')
    .eq('id', targetNotification!.id)
    .single()
  expect(stillUnread?.read_at).toBeNull()

  // Cannot create a new one for someone else.
  const { error: insertError } = await senderClient
    .from('notifications')
    .insert({ recipient_id: targetRowId, title: 'Should fail' })
  expect(insertError).not.toBeNull()
})

// Final-review Finding 5, part 1: no test previously covered the storage
// side of the onboarding-documents bucket, which migration 0012 re-keyed
// onto a bare auth.uid() folder check (see that migration's comment) after
// the original employees-table-joined policy was found to be unreliable
// under real Storage-API writes.
test('an employee cannot upload into or read from another employee\'s onboarding-documents folder', async () => {
  const adminClient = createAdminClient()

  const aId = `ob-storage-a-${Date.now()}`
  await createEmployeeRecord(adminClient, {
    employeeId: aId,
    password: 'password-storage-a-123',
    name: 'Storage Employee A',
    role: 'employee',
  })

  const bId = `ob-storage-b-${Date.now()}`
  const { employeeRowId: bRowId } = await createEmployeeRecord(adminClient, {
    employeeId: bId,
    password: 'password-storage-b-123',
    name: 'Storage Employee B',
    role: 'employee',
  })

  const { data: employeeB } = await adminClient
    .from('employees')
    .select('auth_user_id')
    .eq('id', bRowId)
    .single()
  const bAuthUserId = employeeB!.auth_user_id as string

  // Seed a file in B's folder via the service-role client (bypasses RLS) so
  // there is something for A to attempt to read.
  const seedPath = `${bAuthUserId}/national-id.pdf`
  const { error: seedError } = await adminClient.storage
    .from('onboarding-documents')
    .upload(seedPath, Buffer.from('seed onboarding document'), {
      contentType: 'application/pdf',
      upsert: true,
    })
  expect(seedError).toBeNull()

  const aClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  await aClient.auth.signInWithPassword({ email: employeeIdToEmail(aId), password: 'password-storage-a-123' })

  // Cannot upload into B's folder.
  const { error: uploadError } = await aClient.storage
    .from('onboarding-documents')
    .upload(`${bAuthUserId}/offer-letter.pdf`, Buffer.from('malicious upload'), {
      contentType: 'application/pdf',
    })
  expect(uploadError).not.toBeNull()

  // Cannot read/download an object from B's folder.
  const { data: downloadData, error: downloadError } = await aClient.storage
    .from('onboarding-documents')
    .download(seedPath)
  expect(downloadData).toBeNull()
  expect(downloadError).not.toBeNull()
})
