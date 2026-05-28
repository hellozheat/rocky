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

const mcpUrlHost = hostnameOfMcpUrl();

/** Bundled logo in public/ — served at {origin}/mcp-use/public/logo.png on any host. */
const DEVKIT_LOGO = "logo.png";

const server = new MCPServer({
  name: "Rocky",
  title: "Rocky",
  version: "2.0.0",
  description:
    "AI-assisted engineering workflow for teams and solo devs. Hexagonal React/NestJS/FastAPI playbooks, ai-driven skills, one devkit gateway, graphify-first discovery, and pre_pr_quality_gate. Gives the host LLM agents and rules to implement in the user's repo; devkit actions support discovery and validation. Read devkit://how-it-works.",
  baseUrl: process.env.MCP_URL || "http://localhost:3000",
  ...(mcpUrlHost === "localhost" || mcpUrlHost === "127.0.0.1"
    ? { host: mcpUrlHost }
    : {}),
  favicon: DEVKIT_LOGO,
  websiteUrl: "https://mcp-use.com",
  icons: [
    {
      src: DEVKIT_LOGO,
      mimeType: "image/png",
      sizes: ["512x512"],
    },
  ],
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

/** Compact routing for prompts — full index via `devkit` → `list_handbook` (~1.6k tokens). */
const HANDBOOK_READ_CAP =
  "Read **at most 2–3** handbook resources for this task. Use `devkit` → `list_handbook` only to resolve URIs — **do not** fetch every entry in the index.";

const HANDBOOK_ROUTER_BLOCK = [
  "| If the task involves… | Agent | Rules |",
  "|----------------------|-------|-------|",
  "| React UI | `react-hexagonal` | `react-components`, `styling` |",
  "| Next.js `app/` | `nextjs-developer` | `engineering-workflow` |",
  "| Nest API | `nestjs-hexagonal` | `safety`, `tests` |",
  "| FastAPI | `fastapi-hexagonal` | `safety`, `tests` |",
  "| Layered Node API | `node-api-developer` | `safety`, `tests` |",
  "| TS library / SDK | `typescript-library-developer` | `codebase-conventions` |",
  "| Unit tests (React) | `vitest-writer` | `tests` |",
  "| Unit tests (Nest) | `test-writer-nestjs` | `tests` |",
  "| Unit tests (Python) | `test-writer-python` | `tests` |",
  "| E2E | `playwright-writer` | `e2e` |",
  "| Storybook | `storybook-writer` | `storybook` |",
  "| Requirements / scope | `product-owner` | — |",
  "| Code review | `code-reviewer` | `human-readable-code`, `tests` |",
  "| Repo / graph discovery | `codebase-discovery` | `codebase-discovery` |",
  "| Before PR | `pr-quality-gate` | `pr-quality-gate`, `human-readable-code` |",
].join("\n");

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
      `Code review using **MCP devkit** handbook.\n\n` +
        `Read only:\n` +
        `- \`devkit://handbook/agents/code-reviewer.md\`\n` +
        `- \`devkit://handbook/rules/human-readable-code.mdc\`\n` +
        `- \`devkit://handbook/rules/tests.mdc\`\n\n` +
        `${HANDBOOK_READ_CAP}\n\n` +
        `---\n\n${focusBlock}## Code (${language})\n\n${code}`,
    );
  },
);

server.prompt(
  {
    name: "devkit-start-task",
    description:
      "Prime a task: read how-it-works, codebase-discovery, 1–2 matching agents (router), implement in repo. See devkit://how-it-works.",
    schema: z.object({
      taskDescription: z.string().describe("What you are doing"),
    }),
  },
  async ({ taskDescription }) => {
    return text(
      `## Task\n\n${taskDescription}\n\n` +
        `Read \`devkit://how-it-works\` (short). Devkit is a **handbook** — **edit the user's codebase** with editor tools, not only MCP actions.\n\n` +
        `### Discovery\n` +
        `1. Read \`devkit://handbook/agents/codebase-discovery.md\` and follow graphify / Understand Anything policy (\`devkit://graphify-workflow\`).\n` +
        `2. ${HANDBOOK_READ_CAP}\n` +
        `3. Pick **one row** from the router (plus \`codebase-discovery\` when needed) — do not read agents outside that row.\n\n` +
        `### Router\n\n${HANDBOOK_ROUTER_BLOCK}\n\n` +
        `### Before PR\n` +
        `\`devkit\` → \`pre_pr_quality_gate\`; \`repo_open_pr\` only when verdict is \`ready\`.`,
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
    description: "Onboard to hexagonal React and handbook conventions.",
    schema: z.object({}),
  },
  async () =>
    text(
      `Learn the **hexagonal React** stack:\n\n` +
        `1. \`devkit://handbook/rules/codebase-conventions.mdc\`\n` +
        `2. \`devkit://handbook/agents/react-hexagonal.md\`\n` +
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
