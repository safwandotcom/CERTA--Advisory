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
