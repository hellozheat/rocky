import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { MCPServer } from "mcp-use/server";
import { text } from "mcp-use/server";
import { z } from "zod";

import { getDevkitProjectRoot } from "./devkit-project-root.js";
import { runPrePrQualityGate } from "./pre-pr-quality-gate.js";
import type { HandbookToolHandlers } from "./register-dev-handbook.js";
import {
  MAX_TIMEOUT_MS,
  runChangeScopeAnalyzer,
  runDependencyAdvisor,
  runProjectIntelligence,
  runSafeRun,
} from "./register-dev-tools.js";
import {
  repoDiffScopes,
  repoSearchModes,
  repoTestTargets,
  runRepoBlame,
  runRepoDiff,
  runRepoFindOwner,
  runRepoLint,
  runRepoOpenPr,
  runRepoSearch,
  runRepoStatus,
  runRepoTest,
} from "./register-repo-actions.js";
import {
  runTestGapFinder,
  runWebApiContractWatch,
  runWebIncidentDigest,
  runWebOwnerLookup,
  runWebPerfRegressionHint,
  runWebReleaseNotes,
  runWebRouteHealth,
} from "./register-web-hq-tools.js";

/** Markdown for resource `devkit://capabilities` (assistant-facing). */
export const DEVKIT_CAPABILITIES_MARKDOWN = readFileSync(
  join(getDevkitProjectRoot(), "src", "mcp", "docs", "devkit-capabilities.md"),
  "utf8",
);

const devkitActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("list_handbook") }),
  z.object({ action: z.literal("refresh_handbook") }),
  z.object({
    action: z.literal("project_intelligence"),
    projectRoot: z.string().optional().describe("Repo root (defaults to server cwd)"),
    structured: z
      .boolean()
      .optional()
      .describe("When true, return JSON object (same as project-intelligence tool)"),
  }),
  z.object({
    action: z.literal("safe_run"),
    command: z.string().min(1),
    args: z.array(z.string()).optional().default([]),
    cwd: z.string().optional(),
    timeoutMs: z.number().int().positive().max(MAX_TIMEOUT_MS).optional(),
  }),
  z.object({
    action: z.literal("dependency_advisor"),
    projectRoot: z.string().optional(),
    structured: z.boolean().optional(),
  }),
  z.object({
    action: z.literal("change_scope_analyzer"),
    projectRoot: z.string().optional(),
    targetPath: z.string().min(1),
    structured: z.boolean().optional(),
  }),
  z.object({
    action: z.literal("pre_pr_quality_gate"),
    repoPath: z.string(),
    baseRef: z.string().optional(),
    maxFiles: z.number().int().min(1).max(500).optional().default(40),
    force: z.boolean().optional().default(false),
    structured: z.boolean().optional(),
  }),
  z.object({
    action: z.literal("web_release_notes"),
    repoPath: z.string(),
    lookbackHours: z.number().int().min(1).max(24 * 30).optional().default(72),
    maxCommits: z.number().int().min(1).max(200).optional().default(40),
    detailLevel: z.enum(["brief", "full"]).optional().default("brief"),
  }),
  z.object({
    action: z.literal("web_incident_digest"),
    repoPath: z.string(),
    area: z.string().optional().default("web"),
    lookbackHours: z.number().int().min(1).max(24 * 14).optional().default(24),
    detailLevel: z.enum(["brief", "full"]).optional().default("brief"),
  }),
  z.object({
    action: z.literal("web_owner_lookup"),
    repoPath: z.string(),
    targetPath: z.string(),
    detailLevel: z.enum(["brief", "full"]).optional().default("brief"),
  }),
  z.object({
    action: z.literal("test_gap_finder"),
    repoPath: z.string(),
    baseRef: z.string().optional().default("origin/main"),
    maxFiles: z.number().int().min(1).max(200).optional().default(100),
    detailLevel: z.enum(["brief", "full"]).optional().default("brief"),
  }),
  z.object({
    action: z.literal("web_route_health"),
    repoPath: z.string(),
    routePattern: z.string().optional(),
    lookbackHours: z.number().int().min(1).max(24 * 30).optional().default(72),
    detailLevel: z.enum(["brief", "full"]).optional().default("brief"),
  }),
  z.object({
    action: z.literal("web_api_contract_watch"),
    repoPath: z.string(),
    baseRef: z.string().optional().default("origin/main"),
    maxFindings: z.number().int().min(1).max(100).optional().default(20),
    detailLevel: z.enum(["brief", "full"]).optional().default("brief"),
  }),
  z.object({
    action: z.literal("web_perf_regression_hint"),
    repoPath: z.string(),
    lookbackHours: z.number().int().min(1).max(24 * 30).optional().default(96),
    detailLevel: z.enum(["brief", "full"]).optional().default("brief"),
  }),
  z.object({
    action: z.literal("repo_status"),
    repoPath: z.string(),
    includeUntracked: z.boolean().optional().default(true),
    detailLevel: z.enum(["brief", "full"]).optional().default("brief"),
  }),
  z.object({
    action: z.literal("repo_diff"),
    repoPath: z.string(),
    scope: z.enum(repoDiffScopes).optional().default("all"),
    baseRef: z.string().optional(),
    filePaths: z.array(z.string()).optional(),
    contextLines: z.number().int().min(0).max(20).optional().default(3),
    maxBytes: z.number().int().min(1024).max(2_000_000).optional().default(60_000),
    detailLevel: z.enum(["brief", "full"]).optional().default("brief"),
  }),
  z.object({
    action: z.literal("repo_search"),
    repoPath: z.string(),
    query: z.string(),
    mode: z.enum(repoSearchModes).optional().default("text"),
    glob: z.string().optional(),
    maxResults: z.number().int().min(1).max(200).optional().default(20),
    detailLevel: z.enum(["brief", "full"]).optional().default("brief"),
  }),
  z.object({
    action: z.literal("repo_test"),
    repoPath: z.string(),
    target: z.enum(repoTestTargets).optional().default("changed"),
    value: z.string().optional(),
    timeoutSec: z.number().int().min(10).max(3600).optional().default(600),
    fix: z.boolean().optional().default(false),
    detailLevel: z.enum(["brief", "full"]).optional().default("brief"),
  }),
  z.object({
    action: z.literal("repo_lint"),
    repoPath: z.string(),
    paths: z.array(z.string()).optional(),
    fix: z.boolean().optional().default(true),
    timeoutSec: z.number().int().min(10).max(1800).optional().default(300),
    detailLevel: z.enum(["brief", "full"]).optional().default("brief"),
  }),
  z.object({
    action: z.literal("repo_blame"),
    repoPath: z.string(),
    filePath: z.string(),
    startLine: z.number().int().min(1),
    endLine: z.number().int().min(1).optional(),
    detailLevel: z.enum(["brief", "full"]).optional().default("brief"),
  }),
  z.object({
    action: z.literal("repo_find_owner"),
    repoPath: z.string(),
    filePath: z.string(),
    detailLevel: z.enum(["brief", "full"]).optional().default("brief"),
  }),
  z.object({
    action: z.literal("repo_open_pr"),
    repoPath: z.string(),
    base: z.string().optional().default("main"),
    title: z.string(),
    body: z.string().optional(),
    draft: z.boolean().optional().default(true),
    labels: z.array(z.string()).optional(),
    reviewers: z.array(z.string()).optional(),
    requireCleanStatus: z.boolean().optional().default(true),
    detailLevel: z.enum(["brief", "full"]).optional().default("brief"),
  }),
]);

// mcp-use currently requires tool schemas to be a top-level z.object(...).
// We keep strict per-action validation via `devkitActionSchema.parse()` in handler.
const devkitToolSchema = z.object({
  action: z.string().describe("Devkit operation key (see devkit://capabilities)"),
  projectRoot: z.string().optional(),
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  cwd: z.string().optional(),
  timeoutMs: z.number().optional(),
  targetPath: z.string().optional(),
  repoPath: z.string().optional(),
  lookbackHours: z.number().optional(),
  maxCommits: z.number().optional(),
  area: z.string().optional(),
  baseRef: z.string().optional(),
  maxFiles: z.number().optional(),
  routePattern: z.string().optional(),
  maxFindings: z.number().optional(),
  includeUntracked: z.boolean().optional(),
  scope: z.string().optional(),
  filePaths: z.array(z.string()).optional(),
  contextLines: z.number().optional(),
  maxBytes: z.number().optional(),
  query: z.string().optional(),
  mode: z.string().optional(),
  glob: z.string().optional(),
  maxResults: z.number().optional(),
  detailLevel: z.enum(["brief", "full"]).optional(),
  structured: z.boolean().optional(),
  target: z.string().optional(),
  value: z.string().optional(),
  timeoutSec: z.number().optional(),
  fix: z.boolean().optional(),
  paths: z.array(z.string()).optional(),
  filePath: z.string().optional(),
  startLine: z.number().optional(),
  endLine: z.number().optional(),
  base: z.string().optional(),
  title: z.string().optional(),
  body: z.string().optional(),
  draft: z.boolean().optional(),
  labels: z.array(z.string()).optional(),
  reviewers: z.array(z.string()).optional(),
  requireCleanStatus: z.boolean().optional(),
  force: z.boolean().optional(),
});

export function registerDevkitGateway(
  server: MCPServer,
  handbook: HandbookToolHandlers,
): void {
  server.resource(
    {
      name: "devkit-capabilities",
      uri: "devkit://capabilities",
      description:
        "Maps natural-language goals to `devkit` tool `action` values (users do not need to know individual names).",
    },
    async () => text(DEVKIT_CAPABILITIES_MARKDOWN),
  );

  server.tool(
    {
      name: "devkit",
      description:
        "MCP devkit: list_handbook and read agents first, then implement in the user repo; use actions for repo checks, tests, and pre_pr_quality_gate. Resources: devkit://how-it-works, devkit://capabilities.",
      schema: devkitToolSchema,
    },
    async (input) => {
      const parsed = devkitActionSchema.parse(input);
      switch (parsed.action) {
        case "list_handbook":
          return handbook.list();
        case "refresh_handbook":
          return handbook.refresh();
        case "project_intelligence":
          return runProjectIntelligence({
            projectRoot: parsed.projectRoot,
            structured: parsed.structured === true,
          });
        case "safe_run":
          return runSafeRun({
            command: parsed.command,
            args: parsed.args,
            cwd: parsed.cwd,
            timeoutMs: parsed.timeoutMs,
          });
        case "dependency_advisor":
          return runDependencyAdvisor({
            projectRoot: parsed.projectRoot,
            structured: parsed.structured === true,
          });
        case "change_scope_analyzer":
          return runChangeScopeAnalyzer({
            projectRoot: parsed.projectRoot,
            targetPath: parsed.targetPath,
            structured: parsed.structured === true,
          });
        case "pre_pr_quality_gate":
          return runPrePrQualityGate({
            repoPath: parsed.repoPath,
            baseRef: parsed.baseRef,
            maxFiles: parsed.maxFiles,
            force: parsed.force,
            structured: parsed.structured === true,
          });
        case "web_release_notes":
          return runWebReleaseNotes({
            repoPath: parsed.repoPath,
            lookbackHours: parsed.lookbackHours,
            maxCommits: parsed.maxCommits,
            detailLevel: parsed.detailLevel,
          });
        case "web_incident_digest":
          return runWebIncidentDigest({
            repoPath: parsed.repoPath,
            area: parsed.area,
            lookbackHours: parsed.lookbackHours,
            detailLevel: parsed.detailLevel,
          });
        case "web_owner_lookup":
          return runWebOwnerLookup({
            repoPath: parsed.repoPath,
            targetPath: parsed.targetPath,
            detailLevel: parsed.detailLevel,
          });
        case "test_gap_finder":
          return runTestGapFinder({
            repoPath: parsed.repoPath,
            baseRef: parsed.baseRef,
            maxFiles: parsed.maxFiles,
            detailLevel: parsed.detailLevel,
          });
        case "web_route_health":
          return runWebRouteHealth({
            repoPath: parsed.repoPath,
            routePattern: parsed.routePattern,
            lookbackHours: parsed.lookbackHours,
            detailLevel: parsed.detailLevel,
          });
        case "web_api_contract_watch":
          return runWebApiContractWatch({
            repoPath: parsed.repoPath,
            baseRef: parsed.baseRef,
            maxFindings: parsed.maxFindings,
            detailLevel: parsed.detailLevel,
          });
        case "web_perf_regression_hint":
          return runWebPerfRegressionHint({
            repoPath: parsed.repoPath,
            lookbackHours: parsed.lookbackHours,
            detailLevel: parsed.detailLevel,
          });
        case "repo_status":
          return runRepoStatus({
            repoPath: parsed.repoPath,
            includeUntracked: parsed.includeUntracked,
            detailLevel: parsed.detailLevel,
          });
        case "repo_diff":
          return runRepoDiff({
            repoPath: parsed.repoPath,
            scope: parsed.scope,
            baseRef: parsed.baseRef,
            filePaths: parsed.filePaths,
            contextLines: parsed.contextLines,
            maxBytes: parsed.maxBytes,
            detailLevel: parsed.detailLevel,
          });
        case "repo_search":
          return runRepoSearch({
            repoPath: parsed.repoPath,
            query: parsed.query,
            mode: parsed.mode,
            glob: parsed.glob,
            maxResults: parsed.maxResults,
            detailLevel: parsed.detailLevel,
          });
        case "repo_test":
          return runRepoTest({
            repoPath: parsed.repoPath,
            target: parsed.target,
            value: parsed.value,
            timeoutSec: parsed.timeoutSec,
            fix: parsed.fix,
            detailLevel: parsed.detailLevel,
          });
        case "repo_lint":
          return runRepoLint({
            repoPath: parsed.repoPath,
            paths: parsed.paths,
            fix: parsed.fix,
            timeoutSec: parsed.timeoutSec,
            detailLevel: parsed.detailLevel,
          });
        case "repo_blame":
          return runRepoBlame({
            repoPath: parsed.repoPath,
            filePath: parsed.filePath,
            startLine: parsed.startLine,
            endLine: parsed.endLine,
            detailLevel: parsed.detailLevel,
          });
        case "repo_find_owner":
          return runRepoFindOwner({
            repoPath: parsed.repoPath,
            filePath: parsed.filePath,
            detailLevel: parsed.detailLevel,
          });
        case "repo_open_pr":
          return runRepoOpenPr({
            repoPath: parsed.repoPath,
            base: parsed.base,
            title: parsed.title,
            body: parsed.body,
            draft: parsed.draft,
            labels: parsed.labels,
            reviewers: parsed.reviewers,
            requireCleanStatus: parsed.requireCleanStatus,
            detailLevel: parsed.detailLevel,
          });
        default: {
          throw new Error("devkit: unhandled action (server bug)");
        }
      }
    },
  );
}
