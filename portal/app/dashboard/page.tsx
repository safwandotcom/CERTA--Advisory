import { FileText, Download, Inbox } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/PageHeader'
import { card, statusPillClass } from '@/lib/ui'

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

  const fields: { label: string; value: React.ReactNode }[] = [
    { label: 'Employee ID', value: employee?.employee_id },
    { label: 'Position', value: employee?.position ?? '—' },
    { label: 'Contact info', value: employee?.contact_info ?? '—' },
    { label: 'Join date', value: employee?.join_date ?? '—' },
    {
      label: 'Status',
      value: (
        <span className={statusPillClass(employee?.status === 'active' ? 'active' : 'inactive')}>
          {employee?.status}
        </span>
      ),
    },
  ]

  return (
    <>
      <PageHeader title={`Welcome, ${employee?.name?.split(' ')[0] ?? ''}`} subtitle="Your profile and documents" />

      <section className={card}>
        <h2 className="font-display text-base font-semibold text-ink">{employee?.name}</h2>
        <dl className="mt-5 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
          {fields.map((field) => (
            <div key={field.label}>
              <dt className="text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">
                {field.label}
              </dt>
              <dd className="mt-1 text-[0.9375rem] text-ink">{field.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className={`${card} mt-6`}>
        <h2 className="font-display text-base font-semibold text-ink">Your documents</h2>

        {documents && documents.length > 0 ? (
          <ul className="mt-4 divide-y divide-border">
            {documents.map((doc, i) => (
              <li key={doc.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                <div className="flex min-w-0 items-center gap-3">
                  <FileText size={18} strokeWidth={2} className="shrink-0 text-ink-muted" />
                  <span className="truncate text-[0.9375rem] text-ink">{doc.label}</span>
                </div>
                <a
                  href={signedUrlMap?.[i]?.signedUrl || '#'}
                  target="_blank"
                  rel="noreferrer"
                  className="flex shrink-0 items-center gap-1.5 text-[0.8125rem] font-semibold text-certa-green-deep hover:underline"
                >
                  <Download size={15} strokeWidth={2} />
                  Download
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-4 flex flex-col items-center gap-2 py-10 text-center">
            <Inbox size={28} strokeWidth={1.5} className="text-ink-muted" />
            <p className="text-[0.9375rem] text-ink-muted">
              No documents yet. Your administrator will upload documents here as they become available.
            </p>
          </div>
        )}
      </section>
    </>
  )
}
