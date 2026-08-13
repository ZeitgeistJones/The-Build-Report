import { redirect } from 'next/navigation'

export const metadata = {
  title: 'Utility — The Build Report',
  description: 'CLAWD / CV utility ledger moved to Admin.',
}

/** Public Utility tab retired — ledger lives behind Admin login. */
export default function UtilityPage() {
  redirect('/admin#utility')
}
