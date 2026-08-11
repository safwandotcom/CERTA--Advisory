import { createClient } from '@/lib/supabase/server'
import { getCompanySetting, listCompanyHolidays } from '@/lib/companySettings'
import { PageHeader } from '@/components/PageHeader'
import { card } from '@/lib/ui'
import { WeeklyOffDaysForm } from './WeeklyOffDaysForm'
import { AddHolidayForm } from './AddHolidayForm'
import { DeleteHolidayButton } from './DeleteHolidayButton'

export default async function AdminSettingsPage() {
  const supabase = await createClient()

  const [weeklyOffDays, holidays] = await Promise.all([
    getCompanySetting(supabase, 'weekly_off_days'),
    listCompanyHolidays(supabase),
  ])

  return (
    <>
      <PageHeader
        title="Company settings"
        subtitle="Configure weekly off-days and the company holiday calendar used across attendance, leave, and salary calculations."
      />

      <WeeklyOffDaysForm currentValue={weeklyOffDays ?? ''} />

      <div className={`${card} mt-6`}>
        <h2 className="font-display text-base font-semibold text-ink">Holiday calendar</h2>
        <div className="mt-4">
          <AddHolidayForm />
        </div>

        <div className="mt-6 overflow-hidden rounded-[10px] border border-border">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">
                  Date
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">
                  Name
                </th>
                <th className="w-32 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {holidays.map((holiday) => (
                <tr key={holiday.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3.5 text-[0.9375rem] text-ink">{holiday.date}</td>
                  <td className="px-4 py-3.5 text-[0.9375rem] text-ink">{holiday.name}</td>
                  <td className="px-4 py-3.5 text-right">
                    <DeleteHolidayButton holidayId={holiday.id} holidayName={holiday.name} />
                  </td>
                </tr>
              ))}
              {holidays.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-[0.9375rem] text-ink-muted">
                    No holidays added yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
