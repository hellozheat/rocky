import type { MCPServer, ToolContext } from "mcp-use/server";
import { object, text } from "mcp-use/server";
import { z } from "zod";

import {
  getAllowedWorkspaceRoots,
  resolveAllowedWorkspacePath,
} from "./path-scope.js";

const PATH_SCOPE_POLICY = `## Devkit path scope (dev tools)

Tools such as **project-intelligence**, **dependency-advisor**, **change-scope-analyzer**, and **safe-run** resolve filesystem paths against **allowed workspace roots**:

1. If **DEVKIT_ALLOWED_REPO_ROOTS** is set (comma-separated absolute or resolvable paths), every path must lie under one of those directories (same idea as git repo tools).
2. If unset, defaults to **the devkit project root** (package.json + handbook discovery) and **process.cwd()**.

**change-scope-analyzer** additionally requires \`targetPath\` to resolve **inside** the chosen \`projectRoot\` (blocks \`..\` escape).

For a machine-readable list of roots, call tool **workspace-roots-status** or **normalize-workspace-path**.
`;

const TOOL_COMPOSABILITY = `## Composable dev tools (devkit)

Prefer **small, single-purpose tools** composed in sequence:

1. **workspace-roots-status** — allowed roots + whether they came from env.
2. **normalize-workspace-path** — validate a path before passing it to other tools.
3. **project-intelligence** / **dependency-advisor** / **change-scope-analyzer** — use \`structured: true\` when the client should consume JSON instead of markdown.
4. **user-confirm-step** — optional MCP elicitation when the client supports it; otherwise returns guidance without blocking.

Gateway: the same options are available on \`devkit\` actions **project_intelligence**, **dependency_advisor**, and **change_scope_analyzer** via \`structured: true\`.
`;

export function registerMcpDeveloperExperience(server: MCPServer): void {
  server.resource(
    {
      name: "devkit-path-scope-policy",
      uri: "devkit://path-scope-policy",
      description:
        "How allowed workspace roots work for dev tools (DEVKIT_ALLOWED_REPO_ROOTS vs defaults).",
    },
    async () => text(PATH_SCOPE_POLICY),
  );

  server.resource(
    {
      name: "devkit-tool-composability",
      uri: "devkit://tool-composability",
      description:
        "Guidance for composing narrow tools (roots → normalize → intelligence / structured output / elicitation).",
    },
    async () => text(TOOL_COMPOSABILITY),
  );

  server.tool(
    {
      name: "workspace-roots-status",
      description:
        "Return allowed workspace roots for path-scoped dev tools (JSON). Composes with normalize-workspace-path.",
      schema: z.object({}),
    },
    async () => {
      const { roots, source } = getAllowedWorkspaceRoots();
      return object({
        ok: true,
        source,
        roots,
        envVar: "DEVKIT_ALLOWED_REPO_ROOTS",
      });
    },
  );

  server.tool(
    {
      name: "normalize-workspace-path",
      description:
        "Resolve a path and report whether it is inside allowed workspace roots (structured; does not throw on denial).",
      schema: z.object({
        path: z
          .string()
          .min(1)
          .describe("Absolute path, or relative to server cwd"),
      }),
    },
    async ({ path: rawPath }) => {
      try {
        const absolutePath = resolveAllowedWorkspacePath(rawPath);
        const { roots, source } = getAllowedWorkspaceRoots();
        return object({
          ok: true,
          absolutePath,
          allowed: true,
          roots,
          source,
        });
      } catch (err) {
        const { roots, source } = getAllowedWorkspaceRoots();
        return object({
          ok: true,
          allowed: false,
          error: err instanceof Error ? err.message : String(err),
          roots,
          source,
        });
      }
    },
  );

  server.tool(
    {
      name: "user-confirm-step",
      description:
        "Ask the user to confirm a sensitive step via MCP elicitation when the client supports it; otherwise returns a JSON fallback (never hard-fails the server).",
      schema: z.object({
        message: z
          .string()
          .min(1)
          .describe("What you want the user to confirm (shown in the elicitation form)"),
      }),
    },
    async ({ message }, ctx: ToolContext) => {
      if (!ctx.client.can("elicitation")) {
        return object({
          ok: true,
          elicitationAvailable: false,
          proceed: null,
          hint:
            "Client did not advertise elicitation. Confirm in natural language in chat before running destructive tools.",
        });
      }
      try {
        const result = await ctx.elicit(
          message,
          z.object({
            proceed: z
              .boolean()
              .describe("Set true only if the user explicitly approves this step"),
          }),
          { timeout: 180_000 },
        );
        const accepted = result.action === "accept";
        const proceed =
          accepted && "data" in result && result.data !== undefined
            ? Boolean((result as { data: { proceed: boolean } }).data.proceed)
            : false;
        return object({
          ok: true,
          elicitationAvailable: true,
          elicitationAction: result.action,
          proceed,
        });
      } catch (err) {
        return object({
          ok: false,
          elicitationAvailable: true,
          error: err instanceof Error ? err.message : String(err),
          hint: "Elicitation failed; obtain explicit user confirmation in chat instead.",
        });
      }
    },
  );

  server.prompt(
    {
      name: "devkit-path-scope-and-elicitation",
      description:
        "Primes agents to validate paths (workspace-roots-status, normalize-workspace-path) and to use user-confirm-step before destructive repo or shell operations.",
      schema: z.object({
        taskSummary: z.string().describe("One-line description of what will touch the filesystem or git"),
      }),
    },
    async ({ taskSummary }) => {
      return text(
        `## Task\n\n${taskSummary}\n\n` +
          `### Path safety\n\n` +
          `1. Read resource \`devkit://path-scope-policy\` if roots are unclear.\n` +
          `2. Call tool **workspace-roots-status**, then **normalize-workspace-path** for any non-trivial path before **safe-run** or repo tools.\n\n` +
          `### Elicitation\n\n` +
          `If the client supports MCP elicitation, call **user-confirm-step** with a clear message before irreversible actions (force push, destructive migrations, PR merge). ` +
          `If elicitation is unavailable, stop and ask the user explicitly in chat.\n`,
      );
    },
  );

  server.prompt(
    {
      name: "devkit-structured-and-narrow-tools",
      description:
        "Primes agents to prefer structured tool outputs and small composed tools per devkit://tool-composability.",
      schema: z.object({
        goal: z.string().describe("What the agent is trying to learn from the repo"),
      }),
    },
    async ({ goal }) => {
      return text(
        `## Goal\n\n${goal}\n\n` +
          `Read resource \`devkit://tool-composability\`.\n\n` +
          `**Narrow tools:** use **workspace-roots-status** → **normalize-workspace-path** → domain tools.\n\n` +
          `**Structured results:** pass \`structured: true\` to **project-intelligence**, **dependency-advisor**, and **change-scope-analyzer** (or the same flag on \`devkit\` gateway actions) when JSON is easier to parse than markdown.\n`,
      );
    },
  );
}
