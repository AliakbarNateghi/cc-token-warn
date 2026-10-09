# token-warn

A Claude Code mod that keeps an eye on token use.

- Shows the session's running token total as a status entry under the prompt: `tok 1.2M`.
- Shows one toast each time the total passes a threshold (default 1M, 5M, 10M): `⚠ session passed 5M tokens`.
- Shows a toast when one subagent or one Workflow run uses more than a limit (default 500k).

Totals come from the usage the API reports at the end of each turn (main loop and subagents). They count all four token kinds: input, output, cache reads and cache writes.

## Install

```
/plugin install token-warn --marketplace AliakbarNateghi/cc-token-warn
```

Answer `y` to add the marketplace, then pick a scope.

## Options

- `thresholds`: comma list of session totals, `k` and `M` allowed. Default `1M,5M,10M`.
- `agentLimit`: tokens for one subagent or Workflow run. Default `500000`.
