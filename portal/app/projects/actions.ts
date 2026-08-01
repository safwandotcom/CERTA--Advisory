'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireManagerOrAdmin, NOT_AUTHORIZED } from '@/lib/auth'
import { createProject, parseProjectMemberIds } from '@/lib/projects'

export type ActionState = { error?: string; success?: string }

export async function createProjectAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  let caller
  try {
    caller = await requireManagerOrAdmin()
  } catch {
    return { error: NOT_AUTHORIZED }
  }

  const name = String(formData.get('name') ?? '').trim()
  if (!name) return { error: 'Project name is required' }

  // The service-role client is required here, not the RLS-scoped one: a
  // brand-new project has zero project_members rows yet, so
  // project_members_write's is_project_member(project_id) check would
  // reject the creator's own membership insert (chicken-and-egg — you
  // can't be a member of a project before your own membership row
  // exists). Authorization is already enforced above by
  // requireManagerOrAdmin(); this mirrors the same admin-client-bypass
  // pattern used elsewhere in this app for the same chicken-and-egg reason
  // (e.g. assignTaskAction's auto-add-member insert in app/manager/actions.ts).
  const supabase = createAdminClient()
  const { projectId, error } = await createProject(supabase, {
    name,
    description: String(formData.get('description') ?? '').trim() || undefined,
    createdBy: caller.id,
    memberIds: parseProjectMemberIds(formData),
  })

  if (error || !projectId) return { error: error ?? 'Failed to create project' }

  revalidatePath('/projects')
  return { success: 'Project created' }
}
