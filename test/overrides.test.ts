import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { OverrideStore, OVERRIDE_FILE_NAME, resolveAgentDir } from "../src/overrides.js";

function sandbox() {
  const dir = mkdtempSync(path.join(os.tmpdir(), "pi-claude-effort-"));
  return { dir, file: path.join(dir, OVERRIDE_FILE_NAME), cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

test("stores, reads, and removes overrides", () => {
  const box = sandbox();
  try {
    const store = new OverrideStore(box.file);
    assert.equal(store.get("anthropic/claude-opus-5-5"), undefined);

    store.set("anthropic/claude-opus-5-5", "max");
    assert.equal(store.get("anthropic/claude-opus-5-5"), "max");

    const onDisk = JSON.parse(readFileSync(box.file, "utf8"));
    assert.equal(onDisk.version, 1);
    assert.deepEqual(onDisk.overrides, { "anthropic/claude-opus-5-5": "max" });

    assert.equal(store.delete("anthropic/claude-opus-5-5"), true);
    assert.equal(store.delete("anthropic/claude-opus-5-5"), false);
    assert.equal(store.get("anthropic/claude-opus-5-5"), undefined);
    // The last override removes the file instead of leaving an empty shell.
    assert.equal(existsSync(box.file), false);
  } finally {
    box.cleanup();
  }
});

test("writes atomically and leaves no temp files behind", () => {
  const box = sandbox();
  try {
    const store = new OverrideStore(box.file);
    store.set("claude-bridge/claude-sonnet-5-5", "high");
    store.set("anthropic/claude-opus-5-5", "medium");

    const leftovers = readdirSync(box.dir).filter((name) => name.includes(".tmp-"));
    assert.deepEqual(leftovers, []);
    assert.deepEqual(store.read(), {
      "claude-bridge/claude-sonnet-5-5": "high",
      "anthropic/claude-opus-5-5": "medium",
    });
  } finally {
    box.cleanup();
  }
});

test("corrupt or unexpected files degrade to no overrides", () => {
  const box = sandbox();
  try {
    const store = new OverrideStore(box.file);

    writeFileSync(box.file, "{not json");
    assert.deepEqual(store.read(), {});

    writeFileSync(box.file, JSON.stringify({ version: 1, overrides: ["max"] }));
    assert.deepEqual(store.read(), {});

    writeFileSync(
      box.file,
      JSON.stringify({ version: 1, overrides: { "anthropic/x": "turbo", "anthropic/y": "high" } }),
    );
    assert.deepEqual(store.read(), { "anthropic/y": "high" });
  } finally {
    box.cleanup();
  }
});

test("clear removes every override", () => {
  const box = sandbox();
  try {
    const store = new OverrideStore(box.file);
    store.set("anthropic/claude-opus-5-5", "max");
    store.clear();
    assert.deepEqual(store.read(), {});
    assert.equal(existsSync(box.file), false);
  } finally {
    box.cleanup();
  }
});

test("agent directory follows PI_CODING_AGENT_DIR", () => {
  const box = sandbox();
  try {
    assert.equal(resolveAgentDir({ PI_CODING_AGENT_DIR: box.dir }), box.dir);
    assert.equal(resolveAgentDir({ PI_CODING_AGENT_DIR: "~/sandbox" }), path.join(os.homedir(), "sandbox"));
    assert.equal(resolveAgentDir({}), path.join(os.homedir(), ".pi", "agent"));
  } finally {
    box.cleanup();
  }
});
