import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { Model } from "@earendil-works/pi-ai";
import { hasExplicitThinking } from "../src/argv.js";
import { OverrideStore } from "../src/overrides.js";
import {
  isClaudeModel,
  isThinkingLevel,
  modelKey,
  oneBelowMax,
  resolveTarget,
  type ModelLike,
  type ThinkingLevel,
} from "../src/policy.js";

interface EffortSettings {
  modelThinkingLevels?: Record<string, string>;
}

/**
 * Claude models default to one thinking level below their maximum. A level the
 * user picks by hand is remembered per model and wins from then on; a level
 * pinned in Pi settings wins over everything.
 */
export default function claudeEffort(pi: ExtensionAPI) {
  const store = new OverrideStore();
  // An explicit `--thinking` / `model:level` on the command line wins for the
  // whole process; the extension stands down instead of overwriting it.
  const standsDown = hasExplicitThinking(process.argv.slice(2));
  let applied: { key: string; level: ThinkingLevel } | undefined;
  let pending: { key: string; level: ThinkingLevel } | undefined;

  function pinnedLevel(model: ModelLike, ctx: ExtensionContext): ThinkingLevel | undefined {
    const settings = pi.getSettings() as EffortSettings;
    const key = modelKey(model);
    const fromSettings = key ? settings.modelThinkingLevels?.[key] : undefined;
    if (isThinkingLevel(fromSettings)) return fromSettings;

    const scoped = ctx.scopedModels?.find(
      (entry) => entry.model.provider === model.provider && entry.model.id === model.id,
    );
    if (isThinkingLevel(scoped?.thinkingLevel)) return scoped.thinkingLevel;
    return undefined;
  }

  /** Apply the policy to one model. Never touches non-Claude models. */
  function apply(model: ModelLike | undefined, ctx: ExtensionContext): void {
    if (standsDown) return;
    if (!model) return;
    const key = modelKey(model);
    if (!key) return;

    const target = resolveTarget({
      model,
      override: store.get(key),
      pinned: pinnedLevel(model, ctx),
    });

    if (target !== undefined && pi.getThinkingLevel() !== target) {
      pi.setThinkingLevel(target);
    }
    // Record the level Pi actually applied (it clamps to model capabilities),
    // so a later difference can only have come from the user.
    applied = { key, level: pi.getThinkingLevel() };
  }

  /**
   * Persist a thinking change as a user override.
   *
   * Pi applies its own level before `model_select` fires, so a change observed
   * without a model switch is a deliberate user action. Overrides are deferred
   * one tick and dropped when a switch was the cause.
   */
  function flushPending(currentModel?: ModelLike): void {
    const entry = pending;
    pending = undefined;
    if (standsDown) return;
    if (!entry) return;
    if (!currentModel || modelKey(currentModel) !== entry.key) return;
    if (pi.getThinkingLevel() !== entry.level) return;
    if (applied?.key === entry.key && applied.level === entry.level) return;
    if (!isClaudeModel(currentModel)) return;

    store.set(entry.key, entry.level);
    applied = { key: entry.key, level: entry.level };
  }

  pi.on("session_start", (_event, ctx) => {
    pending = undefined;
    apply(ctx.model as ModelLike | undefined, ctx);
  });

  pi.on("model_select", (event, ctx) => {
    pending = undefined;
    apply(event.model as ModelLike, ctx);
  });

  pi.on("before_agent_start", (_event, ctx) => {
    const model = ctx.model as ModelLike | undefined;
    const key = modelKey(model);
    // Safety net for sessions that start without a model selection event.
    if (key && applied?.key !== key) apply(model, ctx);
  });

  pi.on("thinking_level_select", (event, ctx) => {
    const model = ctx.model as ModelLike | undefined;
    const key = modelKey(model);
    if (!key) return;

    pending = { key, level: event.level as ThinkingLevel };
    const timer = setTimeout(() => flushPending(model), 0);
    timer.unref?.();
  });

  pi.on("session_shutdown", (_event, ctx) => {
    flushPending(ctx.model as ModelLike | undefined);
  });

  pi.registerCommand("claude-effort", {
    description: "Show, reset, or clear automatic Claude thinking levels",
    handler: async (args, ctx) => {
      const model = ctx.model as ModelLike | undefined;
      const key = modelKey(model);
      const action = args.trim().toLowerCase();

      if (action === "reset-all" || action === "clear") {
        store.clear();
        applied = undefined;
        apply(model, ctx);
        ctx.ui.notify("claude-effort: cleared every per-model override", "info");
        return;
      }

      if (action === "reset") {
        if (!key) {
          ctx.ui.notify("claude-effort: no model selected", "warning");
          return;
        }
        const existed = store.delete(key);
        applied = undefined;
        apply(model, ctx);
        ctx.ui.notify(
          existed
            ? `claude-effort: cleared override for ${key}`
            : `claude-effort: no override for ${key}`,
          "info",
        );
        return;
      }

      if (action !== "" && action !== "status") {
        ctx.ui.notify("usage: /claude-effort [status|reset|reset-all]", "warning");
        return;
      }

      if (!model || !key) {
        ctx.ui.notify("claude-effort: no model selected", "warning");
        return;
      }

      if (!isClaudeModel(model)) {
        ctx.ui.notify(
          `${key}: not a Claude model — left alone (level ${pi.getThinkingLevel()})`,
          "info",
        );
        return;
      }

      const pinned = pinnedLevel(model, ctx);
      const override = store.get(key);
      const mode = pinned
        ? `pinned to ${pinned} in Pi settings`
        : override
          ? `user override ${override}`
          : `automatic max-1 (${oneBelowMax(model)})`;
      ctx.ui.notify(
        `${key}: level ${pi.getThinkingLevel()} — ${mode}. /claude-effort reset clears the override.`,
        "info",
      );
    },
  });
}
