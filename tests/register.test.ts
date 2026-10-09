import { describe, expect, test } from 'claude-code/testing'
import type { AgentSpawnInput, On, TurnCompleteInput } from 'claude-code'

import { fmt, parseTokens } from '../hooks/register'

const spawn = (over: Partial<AgentSpawnInput>): AgentSpawnInput => ({
  tool_use_id: 't1', prompt: 'task', description: 'worker', subagentType: 'general-purpose',
  provider: { plugin: 'engine', tier: 'core' }, parentModel: 'opus', background: false, fork: false, ...over,
})

const turn = (tokens: number, agentId?: string): TurnCompleteInput => ({
  answer: 'ok', durationMs: 1, isAborted: false, turnId: 'x', reason: 'answer', agentId,
  usage: { model: 'm', input_tokens: tokens, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
})

function stubs(on: On, toasts: string[], status: string[]) {
  on('ui.toast', ($, e) => { toasts.push(e.text); return { value: undefined } })
  on('ui.status', ($, e) => { status.push(e.text ?? ''); return { value: undefined } })
  on('turn.complete', ($, e) => ({ text: e.answer, usage: e.usage }))
  on('agent.spawn', ($, e) => ({ model: 'm', agentId: e.workflow ? 'wfa' : 'sub1' }))
}

describe('token-warn', () => {
  test('helpers', async () => {
    expect(parseTokens('10M, 1m,500k,junk')).toEqual([500000, 1000000, 10000000])
    expect([fmt(1234567), fmt(340000), fmt(12)]).toEqual(['1.2M', '340k', '12'])
  })

  test('session thresholds toast once each, status tracks total', async ($, on) => {
    const toasts: string[] = [], status: string[] = []
    stubs(on, toasts, status)
    await $.turn.complete(turn(600_000))
    await $.turn.complete(turn(600_000))
    await $.turn.complete(turn(100_000))
    await $.turn.complete(turn(4_000_000))
    expect(toasts).toEqual(['⚠ session passed 1M tokens', '⚠ session passed 5M tokens'])
    expect(status.at(-1)).toBe('tok 5.3M')
  })

  test('subagent and workflow runs over the limit toast once', { options: { agentLimit: 100 } }, async ($, on) => {
    const toasts: string[] = [], status: string[] = []
    stubs(on, toasts, status)
    await $.agent.spawn(spawn({ description: 'scout' }))
    await $.agent.spawn(spawn({ workflow: { runId: 'wf_1', agentIndex: 1 } }))
    await $.turn.complete(turn(60, 'sub1'))
    await $.turn.complete(turn(60, 'sub1'))
    await $.turn.complete(turn(60, 'sub1'))
    await $.turn.complete(turn(150, 'wfa'))
    await $.turn.complete(turn(999, 'unknown-fork'))
    expect(toasts).toEqual(['⚠ subagent "scout" used 120 tokens', '⚠ Workflow run wf_1 used 150 tokens'])
  })
})
