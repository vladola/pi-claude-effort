# pi-claude-effort

A [Pi](https://pi.dev) extension: **Claude models default to one thinking level below their maximum** — `xhigh` for current models — and a level you pick by hand is remembered per model.

No settings file to edit. No model list to maintain. New Claude models and new Claude providers get the default automatically.

## Why

Pi's `modelThinkingLevels` setting is keyed by exact `provider/modelId`, so a pin written today silently misses every Claude model released tomorrow, and every new provider that serves Claude. This extension derives the level from the model's own declared capabilities at runtime instead:

| The model exposes | Default level |
|---|---|
| `max` and `xhigh` (current Claude models) | `xhigh` |
| `max` but not `xhigh` (e.g. Opus/Sonnet 4.6) | `high` |
| top level `high` (legacy budget-thinking Claude) | `medium` |
| a single level | that level |

Levels follow Pi's own `thinkingLevelMap` rules, and Pi clamps whatever is requested to what the model supports, so the pin can never send an unsupported level.

Only Claude models are touched. Models are matched by name, not by a hard-coded list: `claude` in the model id (anthropic, claude-bridge, OpenRouter, Bedrock, Vertex, …) or `anthropic`/`claude` in the provider name.

## Overrides

A thinking level you set yourself — `/thinking`, `Shift+Tab`, or any other path that changes it on a Claude model — is stored per model and applied from then on. Switch away and back, restart, resume: your choice stays.

- `/claude-effort` — show the current model's level and where it came from
- `/claude-effort reset` — forget the override for the current model and return to automatic max-1
- `/claude-effort reset-all` — forget every override

Overrides live beside Pi's config, never in it:

```
<agent-dir>/claude-effort.json
```

```json
{
  "version": 1,
  "overrides": {
    "anthropic/claude-opus-5-5": "max"
  }
}
```

### Precedence

1. **Pi settings pin** — `modelThinkingLevels` in `settings.json`, or a `:level` suffix in `enabledModels`. The extension leaves Pi's choice alone.
2. **Explicit command line** — `pi --thinking <level>` or `--model provider/id:<level>`. The extension stands down for that process.
3. **Your override** — the level you last selected for that model.
4. **Automatic max-1** — the default this extension exists for.

## Install

```sh
pi install git:github.com/vladola/pi-claude-effort@main
```

Or load it for one run:

```sh
pi --extension ./extensions/index.ts
```

## Development

```sh
npm install
npm test
npm run typecheck
```

Unit tests cross-check `src/policy.ts` against Pi's `getSupportedThinkingLevels` for every shape of `thinkingLevelMap`, so the local rule cannot drift silently.

Isolated end-to-end check (no changes to your real Pi config):

```sh
export PI_CODING_AGENT_DIR=$(mktemp -d)
ln -s ~/.pi/agent/auth.json "$PI_CODING_AGENT_DIR/auth.json"   # credentials stay put
pi --mode rpc --no-session -ne -e ./extensions/index.ts --model anthropic/claude-haiku-5-5
# {"type":"get_state"} → thinkingLevel should be xhigh
```

## Requirements

- Pi with extension and thinking-level support (`@earendil-works/pi-coding-agent` and `@earendil-works/pi-ai` as peers)
- Node.js 20+

No runtime dependencies.

## License

MIT
