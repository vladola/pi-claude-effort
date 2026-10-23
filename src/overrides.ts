import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { isThinkingLevel, type ThinkingLevel } from "./policy.js";

export const OVERRIDE_FILE_NAME = "claude-effort.json";
export const OVERRIDE_FILE_VERSION = 1;

export function expandTilde(input: string): string {
  if (input === "~") return os.homedir();
  if (input.startsWith("~/")) return path.join(os.homedir(), input.slice(2));
  return input;
}

/** Mirrors Pi's agent-directory resolution so tests can point at a sandbox. */
export function resolveAgentDir(env: NodeJS.ProcessEnv = process.env): string {
  const configured = env.PI_CODING_AGENT_DIR?.trim();
  if (configured) return path.resolve(expandTilde(configured));
  return path.join(os.homedir(), ".pi", "agent");
}

interface OverrideFile {
  version?: number;
  overrides?: unknown;
}

/**
 * Per-model user overrides, stored beside Pi's own config:
 *
 *   <agent-dir>/claude-effort.json
 *
 * Keyed by `provider/modelId`. Unknown levels and a corrupt file degrade to
 * "no overrides" rather than throwing during extension load.
 */
export class OverrideStore {
  readonly file: string;

  constructor(file: string = path.join(resolveAgentDir(), OVERRIDE_FILE_NAME)) {
    this.file = file;
  }

  read(): Record<string, ThinkingLevel> {
    let raw: string;
    try {
      raw = readFileSync(this.file, "utf8");
    } catch {
      return {};
    }

    let parsed: OverrideFile;
    try {
      parsed = JSON.parse(raw) as OverrideFile;
    } catch {
      return {};
    }

    const overrides = parsed?.overrides;
    if (!overrides || typeof overrides !== "object" || Array.isArray(overrides)) {
      return {};
    }

    const clean: Record<string, ThinkingLevel> = {};
    for (const [key, value] of Object.entries(overrides)) {
      if (isThinkingLevel(value)) clean[key] = value;
    }
    return clean;
  }

  get(key: string | undefined): ThinkingLevel | undefined {
    if (!key) return undefined;
    return this.read()[key];
  }

  /** Record a user choice. No-op when the stored value is already the same. */
  set(key: string, level: ThinkingLevel): void {
    const next = this.read();
    if (next[key] === level) return;
    next[key] = level;
    this.write(next);
  }

  /** Remove one override. Returns whether one existed. */
  delete(key: string | undefined): boolean {
    if (!key) return false;
    const next = this.read();
    if (!(key in next)) return false;
    delete next[key];
    if (Object.keys(next).length === 0) {
      this.clear();
    } else {
      this.write(next);
    }
    return true;
  }

  /** Remove every override. */
  clear(): void {
    if (!existsSync(this.file)) return;
    try {
      rmSync(this.file);
    } catch {
      /* a read-only home is not worth failing a session over */
    }
  }

  private write(overrides: Record<string, ThinkingLevel>): void {
    mkdirSync(path.dirname(this.file), { recursive: true });
    const body = `${JSON.stringify(
      { version: OVERRIDE_FILE_VERSION, overrides },
      null,
      2,
    )}\n`;
    const tmp = `${this.file}.tmp-${process.pid}`;
    writeFileSync(tmp, body, { mode: 0o600 });
    renameSync(tmp, this.file);
  }
}
