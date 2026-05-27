import type { MCPServer } from "mcp-use/server";
import { z } from "zod";

import { runPrePrQualityGate } from "./pre-pr-quality-gate.js";

export function registerPrePrQualityTools(server: MCPServer): void {
  server.tool(
    {
      name: "pre-pr-quality-gate",
      description:
        "Run lint, tests, and review heuristics before opening a PR. Returns verdict ready | not_ready. Prefer devkit action pre_pr_quality_gate in chat.",
      schema: z.object({
        repoPath: z.string().describe("Git repository root"),
        baseRef: z.string().optional().describe("Compare against base ref (e.g. main)"),
        maxFiles: z.number().int().min(1).max(500).optional().default(40),
        force: z
          .boolean()
          .optional()
          .default(false)
          .describe("Allow large diffs above maxFiles"),
        structured: z.boolean().optional().describe("Return JSON object"),
      }),
    },
    async (input) => runPrePrQualityGate(input),
  );
}
