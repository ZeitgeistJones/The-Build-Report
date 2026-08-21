import assert from 'node:assert/strict'
import { splitStandardPlainLabeled } from '../lib/labeledLlmPair'

const sameLine = splitStandardPlainLabeled(
  'STANDARD: The engine room was running at full tilt today with clawd-research and eth-eval for holders. PLAIN: It was a busy day behind the scenes with clawd-research and eth-eval.',
)
assert.ok(sameLine)
assert.match(sameLine.standard, /engine room/)
assert.doesNotMatch(sameLine.standard, /PLAIN/i)
assert.ok(sameLine.plain)
assert.match(sameLine.plain, /busy day/)
assert.doesNotMatch(sameLine.plain, /STANDARD/i)

const newline = splitStandardPlainLabeled('STANDARD:\nHello world engine room stuff here.\n\nPLAIN:\nBusy day behind the scenes.')
assert.ok(newline?.plain)
assert.match(newline!.standard, /Hello world/)

console.log('ok: labeled STANDARD/PLAIN split')
