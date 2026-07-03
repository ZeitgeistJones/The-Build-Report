'use client'

import { useSyncExternalStore } from 'react'
import { MOBILE_MEDIA } from '@/lib/responsive'

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(MOBILE_MEDIA)
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}

function getSnapshot() {
  return window.matchMedia(MOBILE_MEDIA).matches
}

function getServerSnapshot() {
  return false
}

export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
