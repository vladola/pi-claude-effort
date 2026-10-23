/**
 * Pure thinking-level policy. No Pi runtime imports, so the rules can be
 * unit-tested and cross-checked against Pi's own semantics.
 */

export const THINKING_LEVELS = [
  "off",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
] as const;

export type ThinkingLevel = (typeof THINKING_LEVELS)[number];

export interface ModelLike {
  id: string;
  provider: string;
  reasoning?: boolean;
  thinkingLevelMap?: Partial<Record<ThinkingLevel, string | null>> | null;
}

export function isThinkingLevel(value: unknown): value is ThinkingLevel {
  return typeof value === "string" && (THINKING_LEVELS as readonly string[]).includes(value);
}

/**
 * Claude models are identified by model id or provider:
 *
 * - ids carry `claude` across every provider (anthropic, claude-bridge,
 *   openrouter, bedrock, vertex, ...);
 * - provider aliases carry it for `anthropic` / `claude-*` providers.
 *
 * Matching on the name, not on a hard-coded model list, is what lets new
 * Claude models and new Claude providers pick up the default automatically.
 */
export function isClaudeModel(model: ModelLike | null | undefined): boolean {
  if (!model) return false;
  const id = String(model.id ?? "").toLowerCase();
  const provider = String(model.provider ?? "").toLowerCase();
  return id.includes("claude") || provider.includes("anthropic") || provider.includes("claude");
}

/**
 * Levels the model exposes, mirroring Pi's `getSupportedThinkingLevels`:
 *
 * - a `null` map value marks the level unsupported;
 * - an absent `xhigh` / `max` key is unsupported (opt-in tiers);
 * - an absent key for every other level is identity-mapped and supported;
 * - a non-reasoning model supports `off` only.
 */
export function supportedThinkingLevels(model: ModelLike): ThinkingLevel[] {
  if (!model.reasoning) return ["off"];
  const map = model.thinkingLevelMap ?? {};
  return THINKING_LEVELS.filter((level) => {
    const mapped = map[level];
    if (mapped === null) return false;
    if (level === "xhigh" || level === "max") return mapped !== undefined;
    return true;
  });
}

/**
 * The highest level below the model's maximum.
 *
 * Current Claude models expose `xhigh` below `max`, so that is the usual
 * answer. Legacy models whose top level is `high` get `medium`, and models
 * that expose a single level keep it.
 */
export function oneBelowMax(model: ModelLike): ThinkingLevel {
  const levels = supportedThinkingLevels(model);
  if (levels.length <= 1) return levels[0] ?? "off";
  return levels[levels.length - 2];
}

export function modelKey(
  model: { provider: string; id: string } | null | undefined,
): string | undefined {
  if (!model?.provider || !model?.id) return undefined;
  return `${model.provider}/${model.id}`;
}

export interface TargetInput {
  model: ModelLike | null | undefined;
  /** A level the user picked earlier for this model. */
  override?: ThinkingLevel;
  /** A level pinned in Pi settings (`modelThinkingLevels` or a scoped `:level`). */
  pinned?: ThinkingLevel;
}

/**
 * Precedence: settings pin (Pi's choice is left alone) > user override >
 * automatic one-below-max.
 *
 * Returns `undefined` when the extension must not touch the level.
 */
export function resolveTarget({ model, override, pinned }: TargetInput): ThinkingLevel | undefined {
  if (!model) return undefined;
  if (!isClaudeModel(model)) return undefined;
  if (isThinkingLevel(pinned)) return undefined;
  if (isThinkingLevel(override)) return override;
  return oneBelowMax(model);
}
