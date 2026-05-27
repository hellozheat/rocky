import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadDotenv } from "dotenv";
import { completable, MCPServer, object, text } from "mcp-use/server";
import { z } from "zod";

import { ARCHITECTURE_AND_CODE_STYLE } from "./src/mcp/docs/architecture-style-content.js";
import { getDevkitProjectRoot } from "./src/mcp/lib/devkit-project-root.js";
import {
  createHandbookToolHandlers,
  registerDevHandbook,
  registerHandbookTools,
} from "./src/mcp/lib/register-dev-handbook.js";
import { registerDevTools } from "./src/mcp/lib/register-dev-tools.js";
import { registerDevkitGateway } from "./src/mcp/lib/register-devkit-gateway.js";
import { registerMcpDeveloperExperience } from "./src/mcp/lib/register-mcp-dx.js";
import { registerPrePrQualityTools } from "./src/mcp/lib/register-pre-pr-quality.js";
import { registerRepoActions } from "./src/mcp/lib/register-repo-actions.js";
import { registerWebHqTools } from "./src/mcp/lib/register-web-hq-tools.js";

const projectRoot = dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: join(projectRoot, ".env"), quiet: true });

const SENIOR_WORKFLOW_MD = readFileSync(
  join(getDevkitProjectRoot(), "src", "mcp", "docs", "senior-workflow.md"),
  "utf8",
);
const PR_QUALITY_RUBRIC_MD = readFileSync(
  join(getDevkitProjectRoot(), "src", "mcp", "docs", "pr-quality-rubric.md"),
  "utf8",
);
const GRAPHIFY_WORKFLOW_MD = readFileSync(
  join(getDevkitProjectRoot(), "src", "mcp", "docs", "graphify-workflow.md"),
  "utf8",
);
const UNDERSTAND_ANYTHING_WORKFLOW_MD = readFileSync(
  join(
    getDevkitProjectRoot(),
    "src",
    "mcp",
    "docs",
    "understand-anything-workflow.md",
  ),
  "utf8",
);
const TOKEN_COST_MD = readFileSync(
  join(getDevkitProjectRoot(), "docs", "token-cost-breakdown.md"),
  "utf8",
);
const HOW_IT_WORKS_MD = readFileSync(
  join(getDevkitProjectRoot(), "src", "mcp", "docs", "how-devkit-works-with-llms.md"),
  "utf8",
);

function hostnameOfMcpUrl(): string {
  try {
    return new URL(process.env.MCP_URL || "http://localhost:3000").hostname;
  } catch {
    return "localhost";
  }
}

/** e.g. devkit.zheat.xyz → zheat.xyz, mcp.soludev.tech → soludev.tech */
function apexHost(hostname: string): string {
  const parts = hostname.toLowerCase().split(".");
  if (parts.length <= 2) {
    return hostname.toLowerCase();
  }
  return parts.slice(-2).join(".");
}

/** Brand logo at https://{apex}/logo.jpg (devkit.zheat.xyz → https://zheat.xyz/logo.jpg). */
function logoUrlForHostname(hostname: string): string {
  const host = hostname.toLowerCase();
  const fallbackApex = process.env.DEVKIT_LOGO_APEX?.trim() || "zheat.xyz";

  if (host === "localhost" || host === "127.0.0.1") {
    return `https://${fallbackApex}/logo.jpg`;
  }
  if (host.endsWith(".mcp-use.com") || host === "mcp-use.com") {
    return `https://${fallbackApex}/logo.jpg`;
  }
  return `https://${apexHost(host)}/logo.jpg`;
}

const mcpUrlHost = hostnameOfMcpUrl();
/** Must be absolute — relative paths become baseUrl + /mcp-use/public/… */
const DEVKIT_LOGO_URL =
  process.env.DEVKIT_LOGO_URL?.trim() || logoUrlForHostname(mcpUrlHost);

const server = new MCPServer({
  name: "devkit",
  title: "MCP devkit",
  version: "1.0.0",
  description:
    "Senior-dev handbook + pre-PR quality gate (mcp-use). For code that looks good in review—layered React SPA playbooks, one devkit gateway, graphify-first discovery, and pre_pr_quality_gate. Gives the host LLM agents and rules to implement in the user's repo; devkit actions support discovery and validation. Read devkit://how-it-works.",
  baseUrl: process.env.MCP_URL || "http://localhost:3000",
  ...(mcpUrlHost === "localhost" || mcpUrlHost === "127.0.0.1"
    ? { host: mcpUrlHost }
    : {}),
  favicon: DEVKIT_LOGO_URL,
  websiteUrl: "https://mcp-use.com",
  icons: [
    {
      src: DEVKIT_LOGO_URL,
      mimeType: "image/jpeg",
      sizes: ["512x512"],
    },
  ],
});

/** Optional redirect when something requests /logo.jpg on the MCP host */
server.get("/logo.jpg", (c) => {
  const host = c.req.header("host")?.split(":")[0] ?? hostnameOfMcpUrl();
  const target = process.env.DEVKIT_LOGO_URL?.trim() || logoUrlForHostname(host);
  return c.redirect(target, 302);
});

server.resource(
  {
    name: "config",
    uri: "config://settings",
    description: "Server configuration",
  },
  async () =>
    object({
      theme: "dark",
      language: "en",
    }),
);

server.resource(
  {
    name: "architecture-style",
    uri: "docs://architecture-style",
    description: "Layering and code style (Router → Use case → Repository)",
  },
  async () => text(ARCHITECTURE_AND_CODE_STYLE),
);

server.resource(
  {
    name: "how-it-works",
    uri: "devkit://how-it-works",
    description:
      "What devkit does and does not do with the host LLM (handbook guides implementation; tools validate)",
  },
  async () => text(HOW_IT_WORKS_MD),
);

server.resource(
  {
    name: "senior-workflow",
    uri: "devkit://senior-workflow",
    description: "Graphify → handbook → implement → pre_pr_quality_gate → PR",
  },
  async () => text(SENIOR_WORKFLOW_MD),
);

server.resource(
  {
    name: "graphify-workflow",
    uri: "devkit://graphify-workflow",
    description: "How to understand a codebase with graphify before editing",
  },
  async () => text(GRAPHIFY_WORKFLOW_MD),
);

server.resource(
  {
    name: "understand-anything-workflow",
    uri: "devkit://understand-anything-workflow",
    description:
      "Optional semantic codebase graph (Understand Anything); complements graphify",
  },
  async () => text(UNDERSTAND_ANYTHING_WORKFLOW_MD),
);

server.resource(
  {
    name: "pr-quality-rubric",
    uri: "devkit://pr-quality-rubric",
    description: "Why reviewers reject AI PRs and how the gate helps",
  },
  async () => text(PR_QUALITY_RUBRIC_MD),
);

server.resource(
  {
    name: "token-cost-breakdown",
    uri: "devkit://token-cost-breakdown",
    description: "Token and cost tradeoffs: gateway, graphify, quality gate",
  },
  async () => text(TOKEN_COST_MD),
);

const HANDBOOK_RULE_FILES = [
  "codebase-conventions.mdc",
  "codebase-discovery.mdc",
  "e2e.mdc",
  "engineering-workflow.mdc",
  "graphify-and-discovery.mdc",
  "human-readable-code.mdc",
  "pr-quality-gate.mdc",
  "react-components.mdc",
  "safety.mdc",
  "state-and-data.mdc",
  "storybook.mdc",
  "styling.mdc",
  "tests.mdc",
] as const;

const HANDBOOK_AGENT_FILES = [
  "code-reviewer.md",
  "codebase-discovery.md",
  "coverage-and-review-workflow.md",
  "graphify-codebase-understanding.md",
  "graphify-local-project.md",
  "nextjs-developer.md",
  "node-api-developer.md",
  "playwright-writer.md",
  "pr-quality-gate.md",
  "react-developer.md",
  "storybook-writer.md",
  "tailwind-ui-developer.md",
  "typescript-library-developer.md",
  "understand-anything-onboarding.md",
  "vitest-writer.md",
] as const;

const HANDBOOK_RULES_BLOCK = HANDBOOK_RULE_FILES.map(
  (f) => `- \`devkit://handbook/rules/${f}\``,
).join("\n");

const HANDBOOK_AGENTS_BLOCK = HANDBOOK_AGENT_FILES.map(
  (f) => `- \`devkit://handbook/agents/${f}\``,
).join("\n");

const LANGUAGE_OPTIONS = [
  "python",
  "javascript",
  "typescript",
  "java",
  "cpp",
  "go",
  "rust",
] as const;

server.prompt(
  {
    name: "devkit-review-code",
    description:
      "Code review using devkit handbook. Use list_handbook; read code-reviewer, human-readable-code, tests.",
    schema: z.object({
      language: completable(z.string(), [...LANGUAGE_OPTIONS]).describe(
        "Language of the snippet",
      ),
      code: z.string().describe("Full code to review"),
      focus: z.string().optional().describe("Optional focus area"),
    }),
  },
  async ({ language, code, focus }) => {
    const focusBlock =
      focus !== undefined && focus.length > 0
        ? `## Review focus\n\n${focus}\n\n---\n\n`
        : "";
    return text(
      `Code review using **MCP devkit** handbook. Call **list_handbook** and read relevant resources.\n\n` +
        `Start: \`devkit://handbook/agents/code-reviewer.md\`, \`human-readable-code.mdc\`, \`tests.mdc\`.\n\n` +
        `## Handbook — rules\n\n${HANDBOOK_RULES_BLOCK}\n\n` +
        `## Handbook — agents\n\n${HANDBOOK_AGENTS_BLOCK}\n\n` +
        `---\n\n${focusBlock}## Code (${language})\n\n${code}`,
    );
  },
);

server.prompt(
  {
    name: "devkit-start-task",
    description:
      "Prime a task: list_handbook, read agents, implement in the user repo, use devkit tools for gate/tests. See devkit://how-it-works.",
    schema: z.object({
      taskDescription: z.string().describe("What you are doing"),
    }),
  },
  async ({ taskDescription }) => {
    return text(
      `## Task\n\n${taskDescription}\n\n` +
        `Read \`devkit://how-it-works\` first. Devkit is a **handbook**—you must **edit the user's codebase** (components, tests, refactors) using editor tools, not only call MCP actions.\n\n` +
        `**Discovery:** list_handbook → \`codebase-discovery.md\` / graphify (see \`devkit://graphify-workflow\`) → read matching agents.\n\n` +
        `| Goal | You should |\n` +
        `|------|------------|\n` +
        `| Better code / split components / architecture | Read agents below, then implement in files |\n` +
        `| Tests | \`vitest-writer\` / \`playwright-writer\`; \`test_gap_finder\`; run tests in repo |\n` +
        `| Before PR | \`pre_pr_quality_gate\` when repoPath is available |\n\n` +
        `| Area | Agents | Rules |\n` +
        `|------|--------|-------|\n` +
        `| React UI | react-developer, tailwind-ui-developer | react-components, styling |\n` +
        `| Next.js | nextjs-developer | engineering-workflow |\n` +
        `| API | node-api-developer | safety, tests |\n` +
        `| Repo / architecture / graph | codebase-discovery, graphify-local-project, understand-anything-onboarding | codebase-discovery |\n` +
        `| Before PR | pr-quality-gate | pr-quality-gate, human-readable-code |\n\n` +
        `## Rules\n\n${HANDBOOK_RULES_BLOCK}\n\n` +
        `## Agents\n\n${HANDBOOK_AGENTS_BLOCK}\n\n` +
        `**Before PR:** \`devkit\` action \`pre_pr_quality_gate\` — only \`repo_open_pr\` when verdict is \`ready\`.`,
    );
  },
);

server.prompt(
  {
    name: "devkit-before-pr",
    description: "Run pre_pr_quality_gate and fix blockers before opening a PR.",
    schema: z.object({
      repoPath: z.string().describe("Git repository root"),
    }),
  },
  async ({ repoPath }) => {
    return text(
      `Before opening a PR on \`${repoPath}\`:\n\n` +
        `1. Run \`devkit\` with action \`pre_pr_quality_gate\` (same repoPath).\n` +
        `2. Fix all **blockers**; address **warnings**.\n` +
        `3. Re-run until \`verdict: ready\`.\n` +
        `4. Then \`repo_open_pr\` (needs GITHUB_TOKEN).\n\n` +
        `Read \`devkit://pr-quality-rubric\` and agent \`pr-quality-gate.md\`.`,
    );
  },
);

server.prompt(
  {
    name: "devkit-learn-the-stack",
    description: "Onboard to the layered React SPA conventions in this handbook.",
    schema: z.object({}),
  },
  async () =>
    text(
      `Learn the **layered React SPA** stack:\n\n` +
        `1. \`devkit://handbook/rules/codebase-conventions.mdc\`\n` +
        `2. \`devkit://handbook/agents/react-developer.md\`\n` +
        `3. \`devkit://handbook/rules/human-readable-code.mdc\`\n` +
        `4. \`devkit://graphify-workflow\` — explore one feature folder in the user's repo\n` +
        `5. Deep onboarding (if \`.understand-anything/knowledge-graph.json\` exists): \`understand-anything-onboarding.md\`, \`devkit://understand-anything-workflow\`\n` +
        `6. \`devkit://senior-workflow\` for the full pipeline`,
    ),
);

const PORT = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 3000;

function isExecutedDirectly(): boolean {
  const entry = process.argv[1];
  if (!entry) {
    return false;
  }
  return entry === fileURLToPath(import.meta.url);
}

async function start(): Promise<void> {
  await registerDevHandbook(server);
  registerHandbookTools(server);
  registerMcpDeveloperExperience(server);
  await registerDevTools(server);
  registerPrePrQualityTools(server);
  registerWebHqTools(server);
  registerRepoActions(server);
  const handbookHandlers = createHandbookToolHandlers(server);
  registerDevkitGateway(server, handbookHandlers);
  if (process.env.MCP_USE_CLI_DEV === "1" || !isExecutedDirectly()) {
    return;
  }
  console.log(`[devkit] Server running on port ${PORT}`);
  server.listen(PORT);
}

void start();
