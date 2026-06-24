import AdvanceClient from "./AdvanceClient"

// Public, unauthenticated. Lives outside /dashboard so the auth proxy never runs.
// All data access happens through the token-validated /api/advance/* routes.
export default async function AdvancePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return <AdvanceClient token={token} />
}
