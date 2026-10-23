import { isThinkingLevel } from "./policy.js";

/**
 * Whether the command line already asked for a thinking level.
 *
 * `pi --thinking <level>` and the `:<level>` shorthand in `--model` /
 * `--models` are explicit user intent. The extension must not overwrite them,
 * so it stands down for that process.
 *
 * A `:` suffix is only treated as a level when it is one of Pi's levels, which
 * keeps model tags such as `ollama/qwen2.5-coder:7b` from matching.
 */
export function hasExplicitThinking(argv: readonly string[]): boolean {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--thinking" || arg.startsWith("--thinking=")) return true;
    if (
      arg !== "--model" &&
      arg !== "--models" &&
      !arg.startsWith("--model=") &&
      !arg.startsWith("--models=")
    ) {
      continue;
    }

    const value = arg.includes("=") ? arg.slice(arg.indexOf("=") + 1) : argv[index + 1];
    if (!value) continue;

    for (const pattern of value.split(",")) {
      const separator = pattern.lastIndexOf(":");
      if (separator > 0 && isThinkingLevel(pattern.slice(separator + 1))) return true;
    }
  }
  return false;
}
