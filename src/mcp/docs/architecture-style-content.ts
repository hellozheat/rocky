/**
 * Exposed as MCP resource `docs://architecture-style` and in prompts (see index.ts).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { getDevkitProjectRoot } from "../lib/devkit-project-root.js";

export const ARCHITECTURE_AND_CODE_STYLE = readFileSync(
  join(getDevkitProjectRoot(), "src", "mcp", "docs", "architecture-style.md"),
  "utf8",
);
