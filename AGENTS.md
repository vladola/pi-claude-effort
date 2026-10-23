# AGENTS.md — pi-claude-effort

Pi extension that makes Claude models default to one thinking level below their
maximum, while remembering a level the user selected by hand.

## File map

| Path | Purpose |
|---|---|
| `extensions/index.ts` | Pi entry point: event wiring, command, precedence |
| `.github/workflows/ci.yml` | Tests and typecheck on pull requests and `main` |
| `.github/workflows/release.yml` | `semantic-release` on every push to `main` |
| `.releaserc.json` | Release plugins: changelog, version commit, tag, GitHub release |
| `src/policy.ts` | Pure policy: Claude detection, supported levels, max-1, target resolution |
| `src/argv.ts` | Detects an explicit `--thinking` / `model:level` on the command line |
| `src/overrides.ts` | Per-model override store (`<agent-dir>/claude-effort.json`) |
| `test/policy.test.ts` | Policy tests, incl. parity with Pi's own level resolution |
| `test/argv.test.ts` | Explicit-level detection from CLI arguments |
| `test/overrides.test.ts` | Store round-trip, corruption, atomic write, agent-dir resolution |

## Invariants

- **No secrets and no personal data.** Never commit credentials, tokens, auth
  files, absolute home paths, names, or email addresses. Tests use `os.tmpdir()`.
- **Zero runtime dependencies.** Only `import type` from `@earendil-works/*` in
  shipped code. `src/policy.ts` mirrors Pi's `getSupportedThinkingLevels`
  locally; `test/policy.test.ts` enforces parity against the real package. Do not
  duplicate that rule anywhere else, and do not import Pi at runtime to compute
  levels.
- **Never write Pi settings.** This extension must not edit `settings.json`,
  `modelThinkingLevels`, or `enabledModels`. State belongs in
  `<agent-dir>/claude-effort.json` only. Settings pins are an input, not an
  output.
- **Never touch non-Claude models.** `resolveTarget()` returns `undefined` for
  them; keep it that way.
- **Preserve the deferred override capture.** Pi applies its own thinking level
  *before* `model_select` fires. The `pending` + one-tick timer in
  `extensions/index.ts` exists so model switches are not recorded as user
  overrides. Removing or "simplifying" it makes every switch persist a bogus
  override.
- **Precedence is a contract:** settings pin > user override > automatic max-1.
  `resolveTarget()` is the single place that encodes it. An explicit
  `--thinking` (or `model:level`) on the command line makes the extension stand
  down for the whole process (`src/argv.ts`) — never restore it silently.
- **Commits are Conventional Commits.** `semantic-release` derives the version
  from them: `fix` → patch, `feat` → minor, `feat!`/`BREAKING CHANGE` → major.
  `chore`, `ci`, `docs`, `test`, `build` do not cut a release. Never hand-edit
  `version` in `package.json` or the top of `CHANGELOG.md`; the release job owns
  both.

## Behavior notes

- Detection is by name: `claude` in the model id, or `anthropic`/`claude` in the
  provider. That is deliberate — new models and providers must work without a
  code change.
- `max-1` means the second-highest *supported* level, not a hard-coded name.
- Pi clamps `setThinkingLevel`; always read back `pi.getThinkingLevel()` and
  store the effective level.
- `/claude-effort`, `/claude-effort reset`, `/claude-effort reset-all` are the
  user-facing escape hatches.

## Test

```sh
npm install
npm test          # node:test + tsx
npm run typecheck
```

Isolated end-to-end run (does not touch the real agent directory):

```sh
export PI_CODING_AGENT_DIR=$(mktemp -d)
ln -s ~/.pi/agent/auth.json "$PI_CODING_AGENT_DIR/auth.json"
pi --mode rpc --no-session -ne -e ./extensions/index.ts --model anthropic/claude-haiku-5-5
```

Then write `{"type":"get_state"}` to stdin and expect `thinkingLevel: "xhigh"`.
Use a cheap Haiku model for any real prompt; RPC `get_state`/`set_thinking_level`
costs nothing.

Override checks in the same sandbox:

1. `set_thinking_level` to `medium`, then `get_state` → `medium`.
2. Switch to another Claude model and back → the override survives.
3. Switch to a non-Claude model → the extension must not change its level.
4. Pre-seed `claude-effort.json` with `{"version":1,"overrides":{"anthropic/claude-haiku-5-5":"medium"}}`
   and confirm a fresh session starts at `medium`, not `xhigh`.

## Release

Fully automated on `main` by `.github/workflows/release.yml`. Do not tag, bump
`package.json`, or edit `CHANGELOG.md` by hand.

1. Merge a change to `main` with a Conventional Commit subject.
2. CI runs the tests; `semantic-release` then computes the next semver from the
   commits since the last `vX.Y.Z` tag and, if the change is releasable:
   - writes the version to `package.json` + `package-lock.json`,
   - prepends the entry to `CHANGELOG.md`,
   - commits `chore(release): X.Y.Z [skip ci]`,
   - tags `vX.Y.Z`, pushes, and publishes a GitHub release.
3. Nothing is published to npm (`npmPublish: false`). The supported channel is
   `pi install git:github.com/vladola/pi-claude-effort@main`.

A commit that is not releasable (`chore`, `ci`, `docs`, `test`) leaves the
version alone; the job exits successfully.

Dry run locally (needs a token, creates nothing):

```sh
GITHUB_TOKEN=$(gh auth token) npm run release:dry
```
