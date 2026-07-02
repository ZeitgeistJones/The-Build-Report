'use client'

import { type ReactNode } from 'react'

export default function GateBlur({
  locked,
  children,
}: {
  locked: boolean
  children: ReactNode
}) {
  if (!locked) return <>{children}</>

  return (
    <div
      style={{
        filter: 'blur(6px)',
        opacity: 0.35,
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    >
      {children}
    </div>
  )
}
