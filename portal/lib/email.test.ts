import { describe, it, expect, vi, beforeEach } from 'vitest'

const sendMock = vi.fn()

vi.mock('resend', () => {
  return {
    Resend: vi.fn(function() {
      return {
        emails: { send: sendMock },
      }
    }),
  }
})

import { sendRecoveryEmail } from './email'

describe('sendRecoveryEmail', () => {
  beforeEach(() => {
    sendMock.mockReset()
    process.env.RESEND_API_KEY = 'test-key'
    process.env.EMAIL_FROM = 'CERTA& Portal <no-reply@certaadvisory.com>'
  })

  it('sends via Resend with the reset link in the body', async () => {
    sendMock.mockResolvedValue({ data: { id: 'abc' }, error: null })

    const result = await sendRecoveryEmail(
      'person@example.com',
      'https://portal.certaadvisory.com/auth/confirm?token_hash=xyz&type=recovery'
    )

    expect(result.error).toBeUndefined()
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'person@example.com',
        from: 'CERTA& Portal <no-reply@certaadvisory.com>',
        html: expect.stringContaining(
          'https://portal.certaadvisory.com/auth/confirm?token_hash=xyz&type=recovery'
        ),
      })
    )
  })

  it('returns an error when RESEND_API_KEY is missing, without calling Resend', async () => {
    delete process.env.RESEND_API_KEY

    const result = await sendRecoveryEmail('person@example.com', 'https://example.com/link')

    expect(result.error).toMatch(/not configured/i)
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('surfaces a Resend API error', async () => {
    sendMock.mockResolvedValue({ data: null, error: { message: 'invalid domain' } })

    const result = await sendRecoveryEmail('person@example.com', 'https://example.com/link')

    expect(result.error).toBe('invalid domain')
  })
})
