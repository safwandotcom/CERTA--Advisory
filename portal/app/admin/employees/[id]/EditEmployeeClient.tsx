'use client'

import { useActionState } from 'react'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, AlertCircle, CheckCircle2, FileText, Upload, KeyRound } from 'lucide-react'
import {
  updateEmployeeAction,
  uploadDocumentAction,
  resetPasswordAction,
  archiveEmployeeAction,
  type ActionState,
} from './actions'
import { PageHeader } from '@/components/PageHeader'
import type { Department } from '@/lib/departments'
import {
  card,
  input,
  label as labelClass,
  buttonPrimary,
  buttonCoral,
  errorText,
  successText,
} from '@/lib/ui'

type Employee = {
  id: string
  auth_user_id: string
  employee_id: string
  name: string
  position: string | null
  department_id: string | null
  contact_info: string | null
  join_date: string | null
  status: 'active' | 'inactive'
  role: 'superadmin' | 'admin' | 'manager' | 'employee'
}

type Document = { id: string; label: string; file_path: string }

const initialState: ActionState = {}

function FormMessage({ state }: { state: ActionState }) {
  if (state.error) {
    return (
      <p role="alert" className={`${errorText} mt-4`}>
        <AlertCircle size={16} strokeWidth={2} className="shrink-0" />
        {state.error}
      </p>
    )
  }
  if (state.success) {
    return (
      <p className={`${successText} mt-4`}>
        <CheckCircle2 size={16} strokeWidth={2} className="shrink-0" />
        {state.success}
      </p>
    )
  }
  return null
}

function SkeletonCard() {
  return (
    <div className={`${card} animate-pulse`}>
      <div className="h-4 w-32 rounded bg-border" />
      <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className="h-10 rounded-[10px] bg-border" />
        <div className="h-10 rounded-[10px] bg-border" />
        <div className="h-10 rounded-[10px] bg-border" />
        <div className="h-10 rounded-[10px] bg-border" />
      </div>
    </div>
  )
}

export default function EditEmployeeClient({ id }: { id: string }) {
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [documents, setDocuments] = useState<Document[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [managedDepartmentIds, setManagedDepartmentIds] = useState<string[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch(`/api/employees/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setEmployee(data.employee)
        setDocuments(data.documents)
        setDepartments(data.departments)
        setManagedDepartmentIds(data.managedDepartmentIds)
        setLoaded(true)
      })
  }, [id])

  const [updateState, updateAction] = useActionState(
    updateEmployeeAction.bind(null, id),
    initialState
  )
  const [uploadState, uploadAction] = useActionState(
    uploadDocumentAction.bind(null, id),
    initialState
  )
  const [resetState, resetAction] = useActionState(
    resetPasswordAction.bind(null, employee?.auth_user_id ?? ''),
    initialState
  )
  const [archiveState, archiveAction] = useActionState(
    archiveEmployeeAction.bind(
      null,
      employee?.auth_user_id ?? '',
      employee?.employee_id ?? '',
      employee?.role ?? ''
    ),
    initialState
  )

  if (!loaded || !employee) {
    return (
      <>
        <div className="mb-4 h-4 w-40 animate-pulse rounded bg-border" />
        <div className="mb-8 h-8 w-56 animate-pulse rounded bg-border" />
        <div className="flex flex-col gap-6">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </>
    )
  }

  return (
    <>
      <Link
        href="/admin"
        className="mb-4 inline-flex items-center gap-1.5 text-[0.8125rem] font-semibold text-ink-muted hover:text-ink"
      >
        <ArrowLeft size={15} strokeWidth={2} />
        Back to employees
      </Link>

      <PageHeader title={employee.name} subtitle={`Employee ID ${employee.employee_id}`} />

      <div className="flex flex-col gap-6">
        <form action={updateAction} className={`${card} max-w-2xl`}>
          <h2 className="font-display text-base font-semibold text-ink">Profile</h2>
          <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="name" className={labelClass}>
                Name
              </label>
              <input id="name" name="name" defaultValue={employee.name} className={input} />
            </div>

            <div>
              <label htmlFor="position" className={labelClass}>
                Position
              </label>
              <input
                id="position"
                name="position"
                defaultValue={employee.position ?? ''}
                className={input}
              />
            </div>

            <div>
              <label htmlFor="departmentId" className={labelClass}>
                Department
              </label>
              <select
                id="departmentId"
                name="departmentId"
                required
                defaultValue={employee.department_id ?? ''}
                className={input}
              >
                <option value="">Select a department</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="status" className={labelClass}>
                Status
              </label>
              <select id="status" name="status" defaultValue={employee.status} className={input}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            <div>
              <label htmlFor="contactInfo" className={labelClass}>
                Contact info
              </label>
              <input
                id="contactInfo"
                name="contactInfo"
                defaultValue={employee.contact_info ?? ''}
                className={input}
              />
            </div>

            <div>
              <label htmlFor="joinDate" className={labelClass}>
                Join date
              </label>
              <input
                id="joinDate"
                name="joinDate"
                type="date"
                defaultValue={employee.join_date ?? ''}
                className={input}
              />
            </div>
          </div>

          {employee.role === 'manager' && (
            <div className="mt-5 border-t border-border pt-5 sm:col-span-2">
              <p className={labelClass}>Departments managed</p>
              <div className="flex flex-col gap-2">
                {departments.map((dept) => (
                  <label key={dept.id} className="flex items-center gap-2 text-[0.9375rem] text-ink">
                    <input
                      type="checkbox"
                      name="managedDepartmentIds"
                      value={dept.id}
                      defaultChecked={managedDepartmentIds.includes(dept.id)}
                    />
                    {dept.name}
                  </label>
                ))}
              </div>
            </div>
          )}

          <FormMessage state={updateState} />

          <button type="submit" className={`${buttonPrimary} mt-6`}>
            Save changes
          </button>
        </form>

        <div className={`${card} max-w-2xl`}>
          <h2 className="font-display text-base font-semibold text-ink">Documents</h2>

          {documents.length > 0 ? (
            <ul className="mt-4 divide-y divide-border">
              {documents.map((doc) => (
                <li key={doc.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <FileText size={18} strokeWidth={2} className="shrink-0 text-ink-muted" />
                  <span className="text-[0.9375rem] text-ink">{doc.label}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-[0.9375rem] text-ink-muted">No documents uploaded yet.</p>
          )}

          <form action={uploadAction} className="mt-5 flex flex-col gap-4 border-t border-border pt-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="label" className={labelClass}>
                  Label
                </label>
                <input id="label" name="label" required placeholder="e.g. Signed contract" className={input} />
              </div>
              <div>
                <label htmlFor="file" className={labelClass}>
                  File
                </label>
                <input
                  id="file"
                  name="file"
                  type="file"
                  required
                  className={`${input} file:mr-3 file:rounded-[6px] file:border-0 file:bg-white file:px-3 file:py-1.5 file:text-[0.8125rem] file:font-semibold file:text-ink`}
                />
              </div>
            </div>

            <FormMessage state={uploadState} />

            <button type="submit" className={`${buttonPrimary} w-fit`}>
              <Upload size={16} strokeWidth={2} />
              Upload
            </button>
          </form>
        </div>

        <div className={`${card} max-w-2xl`}>
          <h2 className="font-display text-base font-semibold text-ink">Reset password</h2>
          <p className="mt-1 text-[0.8125rem] text-ink-muted">
            This is the only way to reset a password — there is no self-service recovery.
          </p>

          <form action={resetAction} className="mt-4 flex flex-col gap-4 sm:max-w-xs">
            <div>
              <label htmlFor="newPassword" className={labelClass}>
                New password
              </label>
              <input id="newPassword" name="newPassword" type="password" required className={input} />
            </div>

            <FormMessage state={resetState} />

            <button type="submit" className={`${buttonCoral} w-fit`}>
              <KeyRound size={16} strokeWidth={2} />
              Reset password
            </button>
          </form>
        </div>

        {employee.role !== 'superadmin' && (
          <div className={`${card} max-w-2xl border border-border`}>
            <h2 className="font-display text-base font-semibold text-ink">Archive employee</h2>
            <p className="mt-1 text-[0.8125rem] text-ink-muted">
              Revokes login and hides this employee from the active list. Their task
              history, documents, and past reports are kept, and this can be
              reversed by an engineer directly in the database if needed.
            </p>

            <form action={archiveAction} className="mt-4 flex flex-col gap-4 sm:max-w-xs">
              <div>
                <label htmlFor="confirmPassword" className={labelClass}>
                  Your password
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  required
                  className={input}
                />
              </div>

              <FormMessage state={archiveState} />

              <button type="submit" className={`${buttonCoral} w-fit`}>
                Archive employee
              </button>
            </form>
          </div>
        )}
      </div>
    </>
  )
}
