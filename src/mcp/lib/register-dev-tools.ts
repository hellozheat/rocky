import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { dirname, extname, join } from "node:path";
import { promisify } from "node:util";

import type { MCPServer } from "mcp-use/server";
import { object, text } from "mcp-use/server";
import { z } from "zod";

import {
  resolveAllowedWorkspacePath,
  resolvePathWithinProjectRoot,
} from "./path-scope.js";

const execFileAsync = promisify(execFile);
const MAX_OUTPUT_LENGTH = 6000;
const DEFAULT_TIMEOUT_MS = 30000;
const MAX_TIMEOUT_MS = 120000;

function truncateOutput(input: string): string {
  if (input.length <= MAX_OUTPUT_LENGTH) {
    return input;
  }
  return `${input.slice(0, MAX_OUTPUT_LENGTH)}\n... [truncated]`;
}

function redactSecrets(input: string): string {
  return input
    .replace(
      /(token|secret|password|apikey|api_key)\s*[:=]\s*([^\s]+)/gi,
      "$1=[REDACTED]",
    )
    .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/g, "Bearer [REDACTED]");
}

function detectPackageManager(projectRoot: string): "yarn" | "pnpm" | "npm" | "unknown" {
  if (existsSync(join(projectRoot, "yarn.lock"))) {
    return "yarn";
  }
  if (existsSync(join(projectRoot, "pnpm-lock.yaml"))) {
    return "pnpm";
  }
  if (existsSync(join(projectRoot, "package-lock.json"))) {
    return "npm";
  }
  return "unknown";
}

async function readJsonFile(path: string): Promise<Record<string, unknown> | null> {
  try {
    const content = await readFile(path, "utf8");
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function maybeGit(command: string[], cwd: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("git", command, { cwd, timeout: 8000 });
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

function toMarkdownBulletList(items: string[]): string {
  if (items.length === 0) {
    return "- none";
  }
  return items.map((item) => `- ${item}`).join("\n");
}

const projectRootDefault = process.cwd();

function resolveDevToolProjectRoot(projectRoot?: string): string {
  if (projectRoot !== undefined && projectRoot.trim() !== "") {
    return resolveAllowedWorkspacePath(projectRoot);
  }
  return resolveAllowedWorkspacePath(projectRootDefault);
}

export async function runProjectIntelligence(input: {
  projectRoot?: string;
  structured?: boolean;
}): Promise<ReturnType<typeof text> | ReturnType<typeof object>> {
  const root = resolveDevToolProjectRoot(input.projectRoot);
  const packageJson = await readJsonFile(join(root, "package.json"));
  const tsconfig = await readJsonFile(join(root, "tsconfig.json"));
  const scripts = (packageJson?.scripts as Record<string, string> | undefined) ?? {};
  const dependencyCount = Object.keys(
    (packageJson?.dependencies as Record<string, string> | undefined) ?? {},
  ).length;
  const devDependencyCount = Object.keys(
    (packageJson?.devDependencies as Record<string, string> | undefined) ?? {},
  ).length;
  const branch = await maybeGit(["rev-parse", "--abbrev-ref", "HEAD"], root);
  const gitStatus = await maybeGit(["status", "--short"], root);
  const compilerOptions =
    (tsconfig?.compilerOptions as Record<string, unknown> | undefined) ?? {};

  const scriptEntries = Object.entries(scripts);
  const structuredPayload = {
    projectRoot: root,
    packageManager: detectPackageManager(root),
    currentBranch: branch ?? "unknown",
    gitDirty: Boolean(gitStatus),
    scripts: Object.fromEntries(scriptEntries),
    typescript: {
      strict: Boolean(compilerOptions.strict),
      target: String(compilerOptions.target ?? "unknown"),
      module: String(compilerOptions.module ?? "unknown"),
    },
    dependencyCounts: {
      dependencies: dependencyCount,
      devDependencies: devDependencyCount,
    },
    workingTreeExcerpt: gitStatus ? truncateOutput(gitStatus) : null,
  };

  if (input.structured) {
    return object(structuredPayload);
  }

  const output = [
    "# Project Intelligence",
    `- projectRoot: ${root}`,
    `- packageManager: ${structuredPayload.packageManager}`,
    `- currentBranch: ${structuredPayload.currentBranch}`,
    `- gitDirty: ${structuredPayload.gitDirty ? "yes" : "no"}`,
    "",
    "## Scripts",
    scriptEntries.length === 0
      ? "- none"
      : scriptEntries.map(([name, command]) => `- ${name}: ${command}`).join("\n"),
    "",
    "## TypeScript",
    `- strict: ${String(structuredPayload.typescript.strict)}`,
    `- target: ${structuredPayload.typescript.target}`,
    `- module: ${structuredPayload.typescript.module}`,
    "",
    "## Dependencies",
    `- dependencies: ${dependencyCount}`,
    `- devDependencies: ${devDependencyCount}`,
  ];

  if (gitStatus) {
    output.push("", "## Working Tree", "```", truncateOutput(gitStatus), "```");
  }

  return text(output.join("\n"));
}

export async function runSafeRun(input: {
  command: string;
  args?: string[];
  cwd?: string;
  timeoutMs?: number;
}): Promise<ReturnType<typeof text>> {
  const { command, args = [], cwd, timeoutMs } = input;
  const allowlist = new Set(["git", "node", "yarn", "pnpm", "tsc", "eslint", "graphify"]);
  if (!allowlist.has(command)) {
    return text(`Error: command "${command}" is not allowlisted.`);
  }

  const resolvedCwd =
    cwd !== undefined && cwd.trim() !== ""
      ? resolveAllowedWorkspacePath(cwd)
      : resolveAllowedWorkspacePath(projectRootDefault);
  const resolvedTimeout = timeoutMs ?? DEFAULT_TIMEOUT_MS;
  try {
    const result = await execFileAsync(command, args, {
      cwd: resolvedCwd,
      timeout: resolvedTimeout,
      env: process.env,
      maxBuffer: 10 * 1024 * 1024,
    });

    return text(
      [
        "# Safe Run",
        `- command: ${command} ${args.join(" ")}`.trim(),
        `- cwd: ${resolvedCwd}`,
        `- timeoutMs: ${resolvedTimeout}`,
        `- exitCode: 0`,
        "",
        "## stdout",
        "```",
        truncateOutput(redactSecrets(result.stdout || "")),
        "```",
        "",
        "## stderr",
        "```",
        truncateOutput(redactSecrets(result.stderr || "")),
        "```",
      ].join("\n"),
    );
  } catch (error) {
    const err = error as Error & {
      code?: string | number;
      stdout?: string;
      stderr?: string;
    };
    return text(
      [
        "# Safe Run",
        `- command: ${command} ${args.join(" ")}`.trim(),
        `- cwd: ${resolvedCwd}`,
        `- timeoutMs: ${resolvedTimeout}`,
        `- exitCode: ${String(err.code ?? "unknown")}`,
        "",
        "## stdout",
        "```",
        truncateOutput(redactSecrets(err.stdout || "")),
        "```",
        "",
        "## stderr",
        "```",
        truncateOutput(redactSecrets(err.stderr || err.message)),
        "```",
      ].join("\n"),
    );
  }
}

export async function runDependencyAdvisor(input: {
  projectRoot?: string;
  structured?: boolean;
}): Promise<ReturnType<typeof text> | ReturnType<typeof object>> {
  const root = resolveDevToolProjectRoot(input.projectRoot);
  const packageJson = await readJsonFile(join(root, "package.json"));
  if (!packageJson) {
    return text(`Error: package.json not found in ${root}`);
  }

  const dependencies =
    (packageJson.dependencies as Record<string, string> | undefined) ?? {};
  const devDependencies =
    (packageJson.devDependencies as Record<string, string> | undefined) ?? {};

  const allEntries = [...Object.entries(dependencies), ...Object.entries(devDependencies)];
  const wildcardOrLatest = allEntries
    .filter(([, version]) => version === "*" || version.toLowerCase() === "latest")
    .map(([name, version]) => `${name}: ${version}`);
  const exactPins = allEntries
    .filter(([, version]) => /^\d+\.\d+\.\d+$/.test(version))
    .map(([name, version]) => `${name}: ${version}`);

  if (input.structured) {
    return object({
      projectRoot: root,
      dependencyCounts: {
        dependencies: Object.keys(dependencies).length,
        devDependencies: Object.keys(devDependencies).length,
      },
      riskyVersionSpecs: wildcardOrLatest,
      exactPins,
      recommendations: [
        "Keep ranges consistent (typically caret ranges).",
        "Avoid `latest` and `*` for production deps.",
        "Run regular update checks and CI validation.",
      ],
    });
  }

  return text(
    [
      "# Dependency Advisor",
      `- projectRoot: ${root}`,
      `- dependencies: ${Object.keys(dependencies).length}`,
      `- devDependencies: ${Object.keys(devDependencies).length}`,
      "",
      "## Risky Version Specs",
      toMarkdownBulletList(wildcardOrLatest),
      "",
      "## Exact Pins (review freshness)",
      toMarkdownBulletList(exactPins),
      "",
      "## Recommendations",
      "- Keep ranges consistent (typically caret ranges).",
      "- Avoid `latest` and `*` for production deps.",
      "- Run regular update checks and CI validation.",
    ].join("\n"),
  );
}

export async function runChangeScopeAnalyzer(input: {
  projectRoot?: string;
  targetPath: string;
  structured?: boolean;
}): Promise<ReturnType<typeof text> | ReturnType<typeof object>> {
  const root = resolveDevToolProjectRoot(input.projectRoot);
  const absoluteTargetPath = resolvePathWithinProjectRoot(root, input.targetPath);
  const fileType = extname(absoluteTargetPath);
  const parent = dirname(absoluteTargetPath);

  const checks: string[] = [];
  if (fileType === ".ts" || fileType === ".tsx") {
    checks.push("Run TypeScript compile checks (`yarn build`).");
    checks.push("Run lint on changed code (`yarn lint:fix`).");
    checks.push("Run targeted and related tests (`yarn test`).");
  } else if (fileType === ".json") {
    checks.push("Validate config/schema consumers.");
    checks.push("Run build and startup smoke tests.");
  } else if (fileType === ".md" || fileType === ".mdc") {
    checks.push("Validate docs links and referenced commands.");
  } else {
    checks.push("Run relevant build/test checks for this module.");
  }

  let nearbyTests: string[] = [];
  try {
    const siblings = await readdir(parent);
    nearbyTests = siblings.filter((entry) => /\.test\.|\.spec\./.test(entry));
  } catch {
    nearbyTests = [];
  }

  const relativeTarget =
    absoluteTargetPath === root
      ? "."
      : absoluteTargetPath.replace(`${root}/`, "").replace(/\\/g, "/");

  if (input.structured) {
    return object({
      projectRoot: root,
      targetPath: relativeTarget,
      absoluteTargetPath,
      fileType: fileType || null,
      suggestedChecks: checks,
      nearbyTests,
      defaultVerificationCommands: ["yarn lint:fix", "yarn build", "yarn test"],
    });
  }

  return text(
    [
      "# Change Scope Analyzer",
      `- projectRoot: ${root}`,
      `- targetPath: ${relativeTarget}`,
      `- fileType: ${fileType || "(none)"}`,
      "",
      "## Suggested Checks",
      toMarkdownBulletList(checks),
      "",
      "## Nearby Tests",
      toMarkdownBulletList(nearbyTests),
      "",
      "## Default Verification Commands",
      "- `yarn lint:fix`",
      "- `yarn build`",
      "- `yarn test`",
    ].join("\n"),
  );
}

export { MAX_TIMEOUT_MS };

export async function registerDevTools(server: MCPServer): Promise<void> {
  server.tool(
    {
      name: "project-intelligence",
      description:
        "Summarize project scripts, tsconfig, dependency counts, package manager, and git working tree status. Paths are restricted to allowed workspace roots (see resource devkit://path-scope-policy).",
      schema: z.object({
        projectRoot: z
          .string()
          .optional()
          .describe("Repository root; must fall under allowed roots (defaults to server cwd)"),
        structured: z
          .boolean()
          .optional()
          .describe("When true, return a JSON object payload instead of markdown"),
      }),
    },
    async ({ projectRoot, structured }) =>
      runProjectIntelligence({ projectRoot, structured: structured === true }),
  );

  server.tool(
    {
      name: "safe-run",
      description:
        "Run allowlisted local commands with timeout and output redaction. `cwd` must fall under allowed workspace roots.",
      schema: z.object({
        command: z
          .string()
          .min(1)
          .describe("Allowlisted: git, node, yarn, pnpm, tsc, eslint, graphify"),
        args: z.array(z.string()).optional().default([]).describe("Arguments passed to command"),
        cwd: z
          .string()
          .optional()
          .describe("Working directory (absolute or relative to server cwd); scoped to allowed roots"),
        timeoutMs: z
          .number()
          .int()
          .positive()
          .max(MAX_TIMEOUT_MS)
          .optional()
          .describe("Max runtime in ms"),
      }),
    },
    async ({ command, args, cwd, timeoutMs }) =>
      runSafeRun({ command, args, cwd, timeoutMs }),
  );

  server.tool(
    {
      name: "dependency-advisor",
      description:
        "Review dependency versions and highlight risky version specifications. `projectRoot` must fall under allowed workspace roots.",
      schema: z.object({
        projectRoot: z.string().optional().describe("Repo root containing package.json"),
        structured: z
          .boolean()
          .optional()
          .describe("When true, return JSON object instead of markdown"),
      }),
    },
    async ({ projectRoot, structured }) =>
      runDependencyAdvisor({ projectRoot, structured: structured === true }),
  );

  server.tool(
    {
      name: "change-scope-analyzer",
      description:
        "Suggest validation checks and nearby tests for a changed file path. `targetPath` is resolved inside `projectRoot` (no traversal).",
      schema: z.object({
        projectRoot: z.string().optional().describe("Repo root; scoped to allowed workspace roots"),
        targetPath: z
          .string()
          .min(1)
          .describe("Path relative to projectRoot, or absolute if still under projectRoot"),
        structured: z
          .boolean()
          .optional()
          .describe("When true, return JSON object instead of markdown"),
      }),
    },
    async ({ projectRoot, targetPath, structured }) =>
      runChangeScopeAnalyzer({
        projectRoot,
        targetPath,
        structured: structured === true,
      }),
  );
}
