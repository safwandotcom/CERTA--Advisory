import { redirect } from 'next/navigation'
import { requireEmployee } from '@/lib/auth'
import ResetPasswordForm from './ResetPasswordForm'

export default async function ResetPasswordPage() {
  try {
    await requireEmployee()
  } catch {
    redirect('/login')
  }

  return <ResetPasswordForm />
}
