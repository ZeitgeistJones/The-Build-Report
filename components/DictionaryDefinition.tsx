'use client'

import DictionaryTermRef from '@/components/DictionaryTermRef'
import { parseDictionaryDefinition } from '@/lib/dictionary'

/** Renders a dictionary definition with [[term-id]] → tooltip + See here. */
export default function DictionaryDefinition({
  definition,
  inPage = true,
}: {
  definition: string
  inPage?: boolean
}) {
  const parts = parseDictionaryDefinition(definition)
  return (
    <span>
      {parts.map((part, i) =>
        part.type === 'text' ? (
          <span key={i}>{part.value}</span>
        ) : (
          <DictionaryTermRef key={`${part.id}-${i}`} id={part.id} inPage={inPage} />
        ),
      )}
    </span>
  )
}
