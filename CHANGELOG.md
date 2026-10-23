# [0.2.0](https://github.com/vladola/pi-claude-effort/compare/v0.1.0...v0.2.0) (2026-10-23)


### Features

* automate semantic versioning releases ([0d0b1fe](https://github.com/vladola/pi-claude-effort/commit/0d0b1fe977eaadb84b4344b4a049d86323f05fdc))

# 0.1.0 (2026-10-23)


### Features

* Claude models default to one thinking level below their maximum (`xhigh` on
  current models), derived from the model's declared capabilities at runtime
* provider- and model-agnostic Claude detection, so new models and new providers
  inherit the default without configuration
* per-model user overrides: a level selected by hand is remembered and wins
  until `/claude-effort reset`
* settings pins (`modelThinkingLevels`, `enabledModels` `:level`) take
  precedence and are left untouched
* `/claude-effort` status, `reset`, and `reset-all` commands
