import { describe, it, expect, vi, beforeEach } from 'vitest'

const { sendRecoveryEmailMock, createAdminClientMock } = vi.hoisted(() => ({
  sendRecoveryEmailMock: vi.fn(),
  createAdminClientMock: vi.fn(),
}))

vi.mock('@/lib/email', () => ({
  sendRecoveryEmail: sendRecoveryEmailMock,
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: createAdminClientMock,
}))

import { requestPasswordRecoveryAction } from './actions'

const GENERIC_MESSAGE = "If that Employee ID has a recovery email on file, we've sent a reset link."

type EmployeeRow = {
  id: string
  employee_id: string
  personal_email: string | null
  last_recovery_requested_at: string | null
}

// Builds a lightweight stand-in for the Supabase admin client covering only
// the chains requestPasswordRecoveryAction actually calls:
//   .from('employees').select().ilike().eq().maybeSingle()
//   .from('employee_onboarding').select().eq().maybeSingle()
//   .from('employees').update().eq()
//   .auth.admin.generateLink()
function makeAdmin(opts: {
  employee: { data: EmployeeRow | null; error: { message: string } | null }
  onboarding?: { data: { personal_email: string | null } | null; error: { message: string } | null }
  generateLink?: { data: { properties?: { hashed_token?: string } } | null; error: { message: string } | null }
  updateResult?: { error: { message: string } | null }
}) {
  const generateLinkMock = vi.fn().mockResolvedValue(
    opts.generateLink ?? { data: { properties: { hashed_token: 'test-token' } }, error: null }
  )

  const updateEq = vi.fn().mockResolvedValue(opts.updateResult ?? { error: null })
  const updateMock = vi.fn(() => ({ eq: updateEq }))

  const employeeMaybeSingle = vi.fn().mockResolvedValue(opts.employee)
  const employeeChain = {
    select: vi.fn(() => employeeChain),
    ilike: vi.fn(() => employeeChain),
    eq: vi.fn(() => employeeChain),
    maybeSingle: employeeMaybeSingle,
  }

  const onboardingMaybeSingle = vi.fn().mockResolvedValue(opts.onboarding ?? { data: null, error: null })
  const onboardingChain = {
    select: vi.fn(() => onboardingChain),
    eq: vi.fn(() => onboardingChain),
    maybeSingle: onboardingMaybeSingle,
  }

  const from = vi.fn((table: string) => {
    if (table === 'employees') {
      return { ...employeeChain, update: updateMock }
    }
    if (table === 'employee_onboarding') {
      return onboardingChain
    }
    throw new Error(`Unexpected table in test mock: ${table}`)
  })

  return {
    admin: {
      from,
      auth: { admin: { generateLink: generateLinkMock } },
    },
    generateLinkMock,
    updateMock,
    updateEq,
  }
}

function formDataFor(employeeId: string): FormData {
  const fd = new FormData()
  fd.set('employeeId', employeeId)
  return fd
}

describe('requestPasswordRecoveryAction', () => {
  beforeEach(() => {
    sendRecoveryEmailMock.mockReset()
    createAdminClientMock.mockReset()
  })

  it('returns the generic message and never emails when the Employee ID is not found', async () => {
    const { admin, generateLinkMock } = makeAdmin({ employee: { data: null, error: null } })
    createAdminClientMock.mockReturnValue(admin)

    const result = await requestPasswordRecoveryAction({}, formDataFor('NOPE001'))

    expect(result.success).toBe(GENERIC_MESSAGE)
    expect(sendRecoveryEmailMock).not.toHaveBeenCalled()
    expect(generateLinkMock).not.toHaveBeenCalled()
  })

  it('returns the generic message and never emails when no recovery email resolves', async () => {
    const { admin, generateLinkMock } = makeAdmin({
      employee: {
        data: {
          id: 'emp-1',
          employee_id: 'EMP001',
          personal_email: null,
          last_recovery_requested_at: null,
        },
        error: null,
      },
      onboarding: { data: { personal_email: null }, error: null },
    })
    createAdminClientMock.mockReturnValue(admin)

    const result = await requestPasswordRecoveryAction({}, formDataFor('EMP001'))

    expect(result.success).toBe(GENERIC_MESSAGE)
    expect(sendRecoveryEmailMock).not.toHaveBeenCalled()
    expect(generateLinkMock).not.toHaveBeenCalled()
  })

  it('returns the generic message and never calls generateLink when throttled', async () => {
    const { admin, generateLinkMock } = makeAdmin({
      employee: {
        data: {
          id: 'emp-1',
          employee_id: 'EMP001',
          personal_email: 'person@example.com',
          last_recovery_requested_at: new Date().toISOString(),
        },
        error: null,
      },
    })
    createAdminClientMock.mockReturnValue(admin)

    const result = await requestPasswordRecoveryAction({}, formDataFor('EMP001'))

    expect(result.success).toBe(GENERIC_MESSAGE)
    expect(sendRecoveryEmailMock).not.toHaveBeenCalled()
    expect(generateLinkMock).not.toHaveBeenCalled()
  })

  it('returns the generic message and never emails when generateLink fails', async () => {
    const { admin } = makeAdmin({
      employee: {
        data: {
          id: 'emp-1',
          employee_id: 'EMP001',
          personal_email: 'person@example.com',
          last_recovery_requested_at: null,
        },
        error: null,
      },
      generateLink: { data: null, error: { message: 'boom' } },
    })
    createAdminClientMock.mockReturnValue(admin)

    const result = await requestPasswordRecoveryAction({}, formDataFor('EMP001'))

    expect(result.success).toBe(GENERIC_MESSAGE)
    expect(sendRecoveryEmailMock).not.toHaveBeenCalled()
  })

  it('still calls generateLink and attempts the throttle stamp even when the email send fails', async () => {
    sendRecoveryEmailMock.mockResolvedValue({ error: 'send failed' })
    const { admin, generateLinkMock, updateMock } = makeAdmin({
      employee: {
        data: {
          id: 'emp-1',
          employee_id: 'EMP001',
          personal_email: 'person@example.com',
          last_recovery_requested_at: null,
        },
        error: null,
      },
    })
    createAdminClientMock.mockReturnValue(admin)

    const result = await requestPasswordRecoveryAction({}, formDataFor('EMP001'))

    expect(result.success).toBe(GENERIC_MESSAGE)
    expect(generateLinkMock).toHaveBeenCalled()
    expect(updateMock).toHaveBeenCalled()
  })

  it('sends the recovery email with the resolved address and reset link, and stamps the throttle, on full success', async () => {
    sendRecoveryEmailMock.mockResolvedValue({})
    const { admin, updateMock } = makeAdmin({
      employee: {
        data: {
          id: 'emp-1',
          employee_id: 'EMP001',
          personal_email: 'person@example.com',
          last_recovery_requested_at: null,
        },
        error: null,
      },
    })
    createAdminClientMock.mockReturnValue(admin)

    const result = await requestPasswordRecoveryAction({}, formDataFor('EMP001'))

    expect(result.success).toBe(GENERIC_MESSAGE)
    expect(sendRecoveryEmailMock).toHaveBeenCalledWith(
      'person@example.com',
      expect.stringContaining('test-token')
    )
    expect(updateMock).toHaveBeenCalled()
  })
})
