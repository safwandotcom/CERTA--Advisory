import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: employee } = await supabase
    .from('employees')
    .select('*')
    .eq('auth_user_id', user!.id)
    .single()

  const { data: documents } = await supabase
    .from('employee_documents')
    .select('*')
    .eq('employee_id', employee!.id)

  const { data: signedUrls } = documents?.length
    ? await supabase.storage
        .from('employee-documents')
        .createSignedUrls(documents.map((d) => d.file_path), 60 * 10)
    : { data: [] as { path: string; signedUrl: string }[] }

  const signedUrlMap = signedUrls || []

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-xl font-semibold">{employee?.name}</h1>
      <dl className="mt-4 grid grid-cols-2 gap-2">
        <dt>Employee ID</dt>
        <dd>{employee?.employee_id}</dd>
        <dt>Position</dt>
        <dd>{employee?.position ?? '—'}</dd>
        <dt>Department</dt>
        <dd>{employee?.department ?? '—'}</dd>
        <dt>Status</dt>
        <dd>{employee?.status}</dd>
      </dl>

      <h2 className="mt-6 font-semibold">Your documents</h2>
      <ul className="mt-2">
        {documents?.map((doc, i) => (
          <li key={doc.id}>
            <a href={signedUrlMap?.[i]?.signedUrl || '#'} target="_blank" rel="noreferrer">
              {doc.label}
            </a>
          </li>
        ))}
        {documents?.length === 0 && <li>No documents yet.</li>}
      </ul>
    </main>
  )
}
