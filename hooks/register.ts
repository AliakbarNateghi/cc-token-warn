import { atom, update } from 'claude-code'
import type { Register, TurnUsage } from 'claude-code'

import type { TokenWarnTally } from '../types'

const empty: TokenWarnTally = { total: 0, owner: {}, byKey: {}, flagged: [] }
const tally = atom({ plugin: 'token-warn', key: 'tally' } as const, empty)

export const parseTokens = (s: string): number[] =>
  s.split(',').map(p => p.trim().toLowerCase()).filter(Boolean).map(p => {
    const mult = p.endsWith('m') ? 1e6 : p.endsWith('k') ? 1e3 : 1
    return Number(mult === 1 ? p : p.slice(0, -1)) * mult
  }).filter(n => Number.isFinite(n) && n > 0).sort((a, b) => a - b)

export const fmt = (n: number): string =>
  n >= 1e6 ? `${+(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : String(n)

// Every token the API counted: input, output, cache reads and cache writes.
const sum = (u: TurnUsage) =>
  u.input_tokens + u.output_tokens + u.cache_read_input_tokens + u.cache_creation_input_tokens

export const register: Register = (on, options) => {
  const thresholds = parseTokens(String(options.thresholds ?? '1M,5M,10M'))
  const limit = Number(options.agentLimit ?? 500000)

  // Remember which spawned agent counts toward which subagent or Workflow run.
  on('agent.spawn', async ($, e, next) => {
    const r = await next(e)
    const id = 'agentId' in r ? r.agentId : undefined
    if (id) {
      const own = e.workflow
        ? { key: `wf:${e.workflow.runId}`, label: `Workflow run ${e.workflow.runId}` }
        : { key: `agent:${id}`, label: `subagent "${e.description ?? id}"` }
      await update($, tally, t => ({ ...t, owner: { ...t.owner, [id]: own } }))
    }
    return r
  }).catch(($, e, next) => next(e)) // never block a spawn over bookkeeping

  on('turn.complete', async ($, e, next) => {
    const r = await next(e)
    const usage = r.usage ?? e.usage
    if (!usage) return r
    const n = sum(usage)
    const toasts: string[] = []

    const after = await update($, tally, t => {
      toasts.length = 0 // update() retries on a version miss; keep the last attempt's toasts
      const total = t.total + n
      const flagged = [...t.flagged]
      const byKey = { ...t.byKey }
      for (const th of thresholds) {
        const id = `session:${th}`
        if (total >= th && !flagged.includes(id)) {
          flagged.push(id)
          toasts.push(`⚠ session passed ${fmt(th)} tokens`)
        }
      }
      const own = e.agentId ? t.owner[e.agentId] : undefined
      if (own) {
        byKey[own.key] = (byKey[own.key] ?? 0) + n
        if (byKey[own.key]! > limit && !flagged.includes(own.key)) {
          flagged.push(own.key)
          toasts.push(`⚠ ${own.label} used ${fmt(byKey[own.key]!)} tokens`)
        }
      }
      return { ...t, total, byKey, flagged }
    })

    $.ui.status(`tok ${fmt(after.total)}`)
    for (const text of toasts) $.ui.toast(text, { timeoutMs: 8000 })
    return r
  })
}
