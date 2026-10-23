import assert from "node:assert/strict";
import test from "node:test";
import { hasExplicitThinking } from "../src/argv.js";

test("detects --thinking in both forms", () => {
  assert.equal(hasExplicitThinking(["--thinking", "high"]), true);
  assert.equal(hasExplicitThinking(["--thinking=max"]), true);
  assert.equal(hasExplicitThinking(["-p", "--thinking", "off", "hello"]), true);
});

test("detects the :level shorthand in --model and --models", () => {
  assert.equal(hasExplicitThinking(["--model", "anthropic/claude-opus-5-5:max"]), true);
  assert.equal(hasExplicitThinking(["--model=anthropic/claude-opus-5-5:xhigh"]), true);
  assert.equal(hasExplicitThinking(["--models", "a/one:high,b/two"]), true);
  assert.equal(hasExplicitThinking(["--models=a/one,b/two:medium"]), true);
});

test("ignores models without an explicit level", () => {
  assert.equal(hasExplicitThinking([]), false);
  assert.equal(hasExplicitThinking(["--model", "anthropic/claude-opus-5-5"]), false);
  assert.equal(hasExplicitThinking(["--models", "a/one,b/two"]), false);
  // A model tag that merely contains a colon is not a thinking level.
  assert.equal(hasExplicitThinking(["--model", "ollama/qwen2.5-coder:7b"]), false);
  assert.equal(hasExplicitThinking(["--thinking"]), true);
});
