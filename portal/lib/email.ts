import { Resend } from 'resend'

export async function sendRecoveryEmail(to: string, resetLink: string): Promise<{ error?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM

  if (!apiKey || !from) {
    return { error: 'Email is not configured (RESEND_API_KEY/EMAIL_FROM missing)' }
  }

  const resend = new Resend(apiKey)
  const { error } = await resend.emails.send({
    from,
    to,
    subject: 'Reset your CERTA& Portal password',
    html: `<p>A password reset was requested for your CERTA& Portal account.</p><p><a href="${resetLink}">Click here to set a new password</a>. This link expires soon and can only be used once.</p><p>If you didn't request this, you can safely ignore this email.</p>`,
  })

  if (error) return { error: error.message }
  return {}
}
