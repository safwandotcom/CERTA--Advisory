'use client'

import { useActionState } from 'react'
import { updateDepartmentNameAction, type DepartmentActionState } from './actions'
import { input, errorText } from '@/lib/ui'

const initialState: DepartmentActionState = {}

export function EditDepartmentForm({
  departmentId,
  currentName,
}: {
  departmentId: string
  currentName: string
}) {
  const [state, formAction] = useActionState(
    updateDepartmentNameAction.bind(null, departmentId),
    initialState
  )

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input
        name="name"
        defaultValue={currentName}
        required
        className={`${input} px-3 py-1.5 text-[0.875rem]`}
      />
      <button
        type="submit"
        className="shrink-0 text-[0.8125rem] font-semibold text-certa-green-deep hover:underline"
      >
        Save
      </button>
      {state.error && <span className={`${errorText} text-[0.75rem]`}>{state.error}</span>}
    </form>
  )
}
