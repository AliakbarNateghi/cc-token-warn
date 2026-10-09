export type TokenWarnTally = {
  total: number
  // agentId -> what it counts toward: `agent:<id>` or `wf:<runId>`, with a label
  owner: Record<string, { key: string; label: string }>
  byKey: Record<string, number>
  flagged: string[]
}

declare module 'claude-code' {
  interface PluginState {
    'token-warn': { tally: TokenWarnTally }
  }
}
