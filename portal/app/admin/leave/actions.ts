'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin, NOT_AUTHORIZED } from '@/lib/auth'
import { reviewLeaveRequest } from '@/lib/leaveRequests'
import { notifyEmployees } from '@/lib/notifications'

export type LeaveReviewActionState = { error?: string; success?: string }

export async function reviewLeaveRequestAction(
  _prevState: LeaveReviewActionState,
  formData: FormData
): Promise<LeaveReviewActionState> {
  let reviewer
  try {
    reviewer = await requireAdmin()
  } catch {
    return { error: NOT_AUTHORIZED }
  }

  const requestId = String(formData.get('requestId') ?? '')
  const decision = String(formData.get('decision') ?? '') as 'approved' | 'rejected'
  const reviewNote = String(formData.get('reviewNote') ?? '')

  if (decision !== 'approved' && decision !== 'rejected') {
    return { error: 'Invalid decision' }
  }

  const adminClient = createAdminClient()
  const { error, employeeId } = await reviewLeaveRequest(adminClient, requestId, reviewer.id, decision, reviewNote)
  if (error) return { error }

  if (employeeId) {
    await notifyEmployees(adminClient, [employeeId], {
      title: decision === 'approved' ? 'Your leave request was approved' : 'Your leave request was rejected',
      body: reviewNote || undefined,
      link: '/dashboard/leave',
    })
  }

  revalidatePath('/admin/leave')
  return { success: `Request ${decision}` }
}
