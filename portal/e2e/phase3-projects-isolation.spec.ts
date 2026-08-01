import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { createAdminClient } from '../lib/supabase/admin'
import { createEmployeeRecord } from '../lib/employees'
import { employeeIdToEmail } from '../lib/employeeAuth'
import { createProject, addProjectMember } from '../lib/projects'

test('a non-member cannot see or comment on a project they were never added to', async () => {
  const adminClient = createAdminClient()

  const memberId = `pm-member-${Date.now()}`
  const { employeeRowId: memberRowId } = await createEmployeeRecord(adminClient, {
    employeeId: memberId,
    password: 'password-member-123',
    name: 'Project Member',
    role: 'employee',
  })

  const outsiderId = `pm-outsider-${Date.now()}`
  const { employeeRowId: outsiderRowId } = await createEmployeeRecord(adminClient, {
    employeeId: outsiderId,
    password: 'password-outsider-123',
    name: 'Project Outsider',
    role: 'employee',
  })

  const { projectId } = await createProject(adminClient, {
    name: `Isolation-Test-${Date.now()}`,
    createdBy: memberRowId,
    memberIds: [memberRowId],
  })
  expect(projectId).toBeTruthy()

  const anonClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  await anonClient.auth.signInWithPassword({ email: employeeIdToEmail(outsiderId), password: 'password-outsider-123' })

  const { data: visibleProjects } = await anonClient.from('projects').select('*').eq('id', projectId)
  expect(visibleProjects).toHaveLength(0)

  const { error: commentError } = await anonClient
    .from('task_comments')
    .insert({ task_id: '00000000-0000-0000-0000-000000000000', author_id: outsiderRowId, body: 'should fail' })
  expect(commentError).not.toBeNull()
})

test('any manager can assign a task to any employee regardless of department', async () => {
  const adminClient = createAdminClient()

  const deptA = await adminClient.from('departments').insert({ name: `Dept-A3-${Date.now()}` }).select('id').single()
  const deptB = await adminClient.from('departments').insert({ name: `Dept-B3-${Date.now()}` }).select('id').single()

  const managerId = `pm-mgr-${Date.now()}`
  const { employeeRowId: managerRowId } = await createEmployeeRecord(adminClient, {
    employeeId: managerId,
    password: 'password-mgr3-123',
    name: 'Cross-Dept Manager',
    role: 'manager',
    departmentId: deptA.data!.id,
  })

  const employeeInB = `pm-emp-b-${Date.now()}`
  const { employeeRowId: employeeInBRowId } = await createEmployeeRecord(adminClient, {
    employeeId: employeeInB,
    password: 'password-empb3-123',
    name: 'Employee In Other Dept',
    role: 'employee',
    departmentId: deptB.data!.id,
  })

  const { projectId } = await createProject(adminClient, {
    name: `CrossDept-Project-${Date.now()}`,
    createdBy: managerRowId,
    memberIds: [managerRowId],
  })

  const anonClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  await anonClient.auth.signInWithPassword({ email: employeeIdToEmail(managerId), password: 'password-mgr3-123' })

  const { error } = await anonClient.from('tasks').insert({
    project_id: projectId,
    assigned_to: employeeInBRowId,
    assigned_by: managerRowId,
    title: 'Cross-department assignment should succeed',
  })

  expect(error).toBeNull()
})
