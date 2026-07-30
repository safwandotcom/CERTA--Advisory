'use client'

import { useActionState } from 'react'
import { useEffect, useState } from 'react'
import {
  updateEmployeeAction,
  uploadDocumentAction,
  resetPasswordAction,
  type ActionState,
} from './actions'

type Employee = {
  id: string
  auth_user_id: string
  employee_id: string
  name: string
  position: string | null
  department: string | null
  contact_info: string | null
  join_date: string | null
  status: 'active' | 'inactive'
}

type Document = { id: string; label: string; file_path: string }

const initialState: ActionState = {}

export default function EditEmployeeClient({ id }: { id: string }) {
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [documents, setDocuments] = useState<Document[]>([])

  useEffect(() => {
    fetch(`/api/employees/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setEmployee(data.employee)
        setDocuments(data.documents)
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

  if (!employee) return <main className="p-6">Loading…</main>

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-xl font-semibold">{employee.employee_id}</h1>

      <form action={updateAction} className="mt-4 flex flex-col gap-3">
        <label htmlFor="name">Name</label>
        <input id="name" name="name" defaultValue={employee.name} className="border p-2" />

        <label htmlFor="position">Position</label>
        <input id="position" name="position" defaultValue={employee.position ?? ''} className="border p-2" />

        <label htmlFor="department">Department</label>
        <input
          id="department"
          name="department"
          defaultValue={employee.department ?? ''}
          className="border p-2"
        />

        <label htmlFor="contactInfo">Contact info</label>
        <input
          id="contactInfo"
          name="contactInfo"
          defaultValue={employee.contact_info ?? ''}
          className="border p-2"
        />

        <label htmlFor="joinDate">Join date</label>
        <input
          id="joinDate"
          name="joinDate"
          type="date"
          defaultValue={employee.join_date ?? ''}
          className="border p-2"
        />

        <label htmlFor="status">Status</label>
        <select id="status" name="status" defaultValue={employee.status} className="border p-2">
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>

        {updateState.error && <p role="alert">{updateState.error}</p>}
        {updateState.success && <p>{updateState.success}</p>}
        <button type="submit" className="border p-2">
          Save
        </button>
      </form>

      <h2 className="mt-6 font-semibold">Documents</h2>
      <ul>
        {documents.map((doc) => (
          <li key={doc.id}>{doc.label}</li>
        ))}
      </ul>
      <form action={uploadAction} className="mt-2 flex flex-col gap-3">
        <label htmlFor="label">Label</label>
        <input id="label" name="label" required className="border p-2" />
        <label htmlFor="file">File</label>
        <input id="file" name="file" type="file" required className="border p-2" />
        {uploadState.error && <p role="alert">{uploadState.error}</p>}
        {uploadState.success && <p>{uploadState.success}</p>}
        <button type="submit" className="border p-2">
          Upload
        </button>
      </form>

      <h2 className="mt-6 font-semibold">Reset password</h2>
      <form action={resetAction} className="mt-2 flex flex-col gap-3">
        <label htmlFor="newPassword">New password</label>
        <input id="newPassword" name="newPassword" type="password" required className="border p-2" />
        {resetState.error && <p role="alert">{resetState.error}</p>}
        {resetState.success && <p>{resetState.success}</p>}
        <button type="submit" className="border p-2">
          Reset password
        </button>
      </form>
    </main>
  )
}
