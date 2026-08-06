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
  markOnboardingCompleteAction,
  requestOnboardingCorrectionAction,
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

type Onboarding = {
  status: 'not_started' | 'submitted' | 'needs_correction' | 'complete'
  date_of_birth: string | null
  fathers_name: string | null
  mothers_name: string | null
  blood_group: string | null
  phone: string | null
  personal_email: string | null
  present_address: string | null
  permanent_address: string | null
  emergency_contact_name: string | null
  emergency_contact_relationship: string | null
  emergency_contact_phone: string | null
  bank_name: string | null
  account_holder_name: string | null
  account_number: string | null
  branch_code: string | null
  correction_notes: string | null
}

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
  const [loaded, setLoaded] = useState(false)
  const [onboarding, setOnboarding] = useState<Onboarding | null>(null)
  const [onboardingDocumentUrls, setOnboardingDocumentUrls] = useState<{
    nationalId: string | null
    offerLetter: string | null
    photo: string | null
  }>({ nationalId: null, offerLetter: null, photo: null })

  useEffect(() => {
    fetch(`/api/employees/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setEmployee(data.employee)
        setDocuments(data.documents)
        setDepartments(data.departments)
        setOnboarding(data.onboarding)
        setOnboardingDocumentUrls(data.onboardingDocumentUrls)
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
  const [completeState, completeAction] = useActionState(
    markOnboardingCompleteAction.bind(null, id),
    initialState
  )
  const [correctionState, correctionAction] = useActionState(
    requestOnboardingCorrectionAction.bind(null, id),
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
          <h2 className="font-display text-base font-semibold text-ink">Onboarding</h2>

          {!onboarding || onboarding.status === 'not_started' ? (
            <p className="mt-4 text-[0.9375rem] text-ink-muted">Not yet submitted.</p>
          ) : (
            <>
              <p className="mt-1 text-[0.8125rem] font-semibold uppercase tracking-[0.04em] text-ink-muted">
                Status: {onboarding.status.replace('_', ' ')}
              </p>

              {onboarding.status === 'needs_correction' && onboarding.correction_notes && (
                <p className="mt-2 rounded-[8px] border border-signal-coral bg-signal-coral/5 px-3 py-2 text-[0.8125rem] text-ink">
                  <span className="font-semibold text-signal-coral-deep">Correction requested: </span>
                  {onboarding.correction_notes}
                </p>
              )}

              <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
                {[
                  { label: 'Date of birth', value: onboarding.date_of_birth },
                  { label: "Father's name", value: onboarding.fathers_name },
                  { label: "Mother's name", value: onboarding.mothers_name },
                  { label: 'Blood group', value: onboarding.blood_group },
                  { label: 'Phone', value: onboarding.phone },
                  { label: 'Personal email', value: onboarding.personal_email },
                  { label: 'Present address', value: onboarding.present_address },
                  { label: 'Permanent address', value: onboarding.permanent_address },
                  { label: 'Emergency contact', value: onboarding.emergency_contact_name },
                  { label: 'Relationship', value: onboarding.emergency_contact_relationship },
                  { label: 'Emergency phone', value: onboarding.emergency_contact_phone },
                  { label: 'Bank name', value: onboarding.bank_name },
                  { label: 'Account holder', value: onboarding.account_holder_name },
                  { label: 'Account number', value: onboarding.account_number },
                  { label: 'Branch / routing code', value: onboarding.branch_code },
                ].map((field) => (
                  <div key={field.label}>
                    <dt className="text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">
                      {field.label}
                    </dt>
                    <dd className="mt-1 text-[0.9375rem] text-ink">{field.value ?? '—'}</dd>
                  </div>
                ))}
              </dl>

              <div className="mt-4 flex flex-wrap gap-4">
                {onboardingDocumentUrls.nationalId && (
                  <a href={onboardingDocumentUrls.nationalId} target="_blank" rel="noreferrer" className="text-[0.8125rem] font-semibold text-certa-green-deep hover:underline">
                    National ID copy
                  </a>
                )}
                {onboardingDocumentUrls.offerLetter && (
                  <a href={onboardingDocumentUrls.offerLetter} target="_blank" rel="noreferrer" className="text-[0.8125rem] font-semibold text-certa-green-deep hover:underline">
                    Signed offer letter
                  </a>
                )}
                {onboardingDocumentUrls.photo && (
                  <a href={onboardingDocumentUrls.photo} target="_blank" rel="noreferrer" className="text-[0.8125rem] font-semibold text-certa-green-deep hover:underline">
                    Photo
                  </a>
                )}
              </div>

              {onboarding.status === 'submitted' && (
                <div className="mt-6 flex flex-col gap-4 border-t border-border pt-5 sm:max-w-sm">
                  <form action={completeAction}>
                    <FormMessage state={completeState} />
                    <button type="submit" className={`${buttonPrimary} mt-2`}>
                      Mark complete
                    </button>
                  </form>

                  <form action={correctionAction} className="flex flex-col gap-3">
                    <label htmlFor="correctionNote" className={labelClass}>
                      Request a correction
                    </label>
                    <textarea id="correctionNote" name="correctionNote" required rows={2} className={input} />
                    <FormMessage state={correctionState} />
                    <button type="submit" className={`${buttonCoral} w-fit`}>
                      Send back for correction
                    </button>
                  </form>
                </div>
              )}

              {onboarding.status === 'complete' && (
                <p className="mt-4 text-[0.8125rem] font-medium text-certa-green-deep">
                  Reviewed and marked complete.
                </p>
              )}
            </>
          )}
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
