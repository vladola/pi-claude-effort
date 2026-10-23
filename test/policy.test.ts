import assert from "node:assert/strict";
import test from "node:test";
import { getSupportedThinkingLevels } from "@earendil-works/pi-ai";
import {
  THINKING_LEVELS,
  isClaudeModel,
  isThinkingLevel,
  modelKey,
  oneBelowMax,
  resolveTarget,
  supportedThinkingLevels,
  type ModelLike,
  type ThinkingLevel,
} from "../src/policy.js";

const model = (
  id: string,
  provider: string,
  thinkingLevelMap?: Partial<Record<ThinkingLevel, string | null>>,
  reasoning = true,
): ModelLike => ({ id, provider, reasoning, thinkingLevelMap });

test("identifies Claude models across providers without a model list", () => {
  assert.equal(isClaudeModel(model("claude-opus-5-5", "anthropic")), true);
  assert.equal(isClaudeModel(model("claude-sonnet-5-5", "claude-bridge")), true);
  assert.equal(isClaudeModel(model("anthropic/claude-opus-5.5", "openrouter")), true);
  assert.equal(isClaudeModel(model("claude-haiku-5-5", "opencode-go")), true);
  assert.equal(isClaudeModel(model("anthropic.claude-3-5-sonnet", "bedrock")), true);

  assert.equal(isClaudeModel(model("deepseek-v4.1-flash", "opencode-go")), false);
  assert.equal(isClaudeModel(model("gpt-6.1-sol", "openai-codex")), false);
  assert.equal(isClaudeModel(undefined), false);
  assert.equal(isClaudeModel(null), false);
});

test("oneBelowMax follows the model's declared maximum", () => {
  // Current Claude models: max plus xhigh.
  assert.equal(
    oneBelowMax(model("claude-opus-5-5", "anthropic", { xhigh: "xhigh", max: "max" })),
    "xhigh",
  );

  // Adaptive models that expose max but not xhigh.
  assert.equal(oneBelowMax(model("claude-opus-4-6", "anthropic", { max: "max" })), "high");

  // Legacy budget-thinking models: top level is high.
  assert.equal(oneBelowMax(model("claude-sonnet-4-5", "anthropic")), "medium");

  // Explicit full maps with hidden lower tiers.
  assert.equal(
    oneBelowMax(
      model("claude-opus-5-5", "claude-bridge", {
        off: null,
        minimal: null,
        low: "low",
        medium: "medium",
        high: "high",
        xhigh: "xhigh",
        max: "max",
      }),
    ),
    "xhigh",
  );

  // Only max is exposed: keep it rather than inventing a lower level.
  assert.equal(
    oneBelowMax(
      model("claude-max-only", "acme", {
        off: null,
        minimal: null,
        low: null,
        medium: null,
        high: null,
        xhigh: null,
        max: "max",
      }),
    ),
    "max",
  );

  // Non-reasoning models support off only.
  assert.equal(oneBelowMax(model("claude-lite", "acme", undefined, false)), "off");
});

test("supportedThinkingLevels matches Pi's own resolution", () => {
  const maps: Array<Partial<Record<ThinkingLevel, string | null>> | undefined> = [
    undefined,
    {},
    { max: "max" },
    { xhigh: "xhigh", max: "max" },
    { off: null, minimal: null, low: "low", medium: "medium", high: "high", xhigh: "xhigh", max: "max" },
    { off: null, minimal: null },
    { high: null },
  ];

  for (const thinkingLevelMap of maps) {
    for (const reasoning of [true, false]) {
      const candidate = model("claude-parity", "anthropic", thinkingLevelMap, reasoning);
      assert.deepEqual(
        supportedThinkingLevels(candidate),
        getSupportedThinkingLevels(candidate as never),
        `parity failed for reasoning=${reasoning} map=${JSON.stringify(thinkingLevelMap)}`,
      );
    }
  }
});

test("resolveTarget precedence: pin > user override > automatic max-1", () => {
  const claude = model("claude-opus-5-5", "anthropic", { xhigh: "xhigh", max: "max" });
  const other = model("gpt-6.1-sol", "openai-codex", { xhigh: "xhigh", max: "max" });

  assert.equal(resolveTarget({ model: claude }), "xhigh");
  assert.equal(resolveTarget({ model: claude, override: "medium" }), "medium");
  assert.equal(resolveTarget({ model: claude, override: "medium", pinned: "max" }), undefined);
  assert.equal(resolveTarget({ model: claude, pinned: "high" }), undefined);
  assert.equal(resolveTarget({ model: other, override: "low" }), undefined);
  assert.equal(resolveTarget({ model: undefined }), undefined);

  // Invalid stored values are ignored instead of applied.
  assert.equal(resolveTarget({ model: claude, override: "turbo" as ThinkingLevel }), "xhigh");
});

test("level helpers accept only known levels", () => {
  for (const level of THINKING_LEVELS) assert.equal(isThinkingLevel(level), true);
  assert.equal(isThinkingLevel("max-1"), false);
  assert.equal(isThinkingLevel(undefined), false);
  assert.equal(isThinkingLevel(3), false);
});

test("model keys are provider/model", () => {
  assert.equal(modelKey({ provider: "anthropic", id: "claude-opus-5-5" }), "anthropic/claude-opus-5-5");
  assert.equal(modelKey(undefined), undefined);
  assert.equal(modelKey({ provider: "", id: "x" }), undefined);
});
