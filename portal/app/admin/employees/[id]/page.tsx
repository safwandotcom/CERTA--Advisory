import EditEmployeeClient from './EditEmployeeClient'

export default async function EditEmployeePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return <EditEmployeeClient id={id} />
}
