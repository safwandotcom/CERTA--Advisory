export function employeeIdToEmail(employeeId: string): string {
  const sanitized = employeeId.trim().toLowerCase().replace(/[^a-z0-9]/g, '')

  if (!sanitized) {
    throw new Error('Employee ID must contain at least one letter or digit')
  }

  return `emp-${sanitized}@internal.certaadvisory.com`
}
