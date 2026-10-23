# Changelog

## 0.1.0

- Claude models default to one thinking level below their maximum (`xhigh` on
  current models), derived from the model's declared capabilities at runtime.
- Provider- and model-agnostic Claude detection, so new models and new providers
  inherit the default without configuration.
- Per-model user overrides: a level selected by hand is remembered and wins
  until `/claude-effort reset`.
- Settings pins (`modelThinkingLevels`, `enabledModels` `:level`) take
  precedence and are left untouched.
- `/claude-effort` status, `reset`, and `reset-all` commands.
