import { getPromoStatusForDisplay } from '@/lib/rescorePromo'
import RescorePromoBanner from '@/components/RescorePromoBanner'

export default function RescorePromoBannerShell() {
  const status = getPromoStatusForDisplay()
  if (!status.active) return null

  return <RescorePromoBanner endsAt={status.endsAt} pennyEth={status.pennyEth} />
}
