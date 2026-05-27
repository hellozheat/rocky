import type { MCPServer } from "mcp-use/server";
import { object } from "mcp-use/server";
import { z } from "zod";

import {
  type DetailLevel,
  findOwnerByCodeowners,
  makeEnvelope,
  readCodeowners,
  resolveRepoPath,
  runAllowedCommand,
  validateRelativePaths,
} from "./repo-actions-core.js";
import { openPullRequestWithGithub } from "./repo-open-pr-github.js";

export const repoDiffScopes = ["unstaged", "staged", "all", "range"] as const;
export const repoTestTargets = ["all", "changed", "path", "pattern"] as const;
export const repoSearchModes = ["text", "semantic"] as const;

type RepoObject = ReturnType<typeof object>;

export async function runRepoStatus(input: {
  repoPath: string;
  includeUntracked: boolean;
  detailLevel?: DetailLevel;
}): Promise<RepoObject> {
  const { repoPath, includeUntracked, detailLevel = "brief" } = input;
  const repo = await resolveRepoPath(repoPath);
  const branchRes = await runAllowedCommand({
    cwd: repo,
    command: "git",
    args: ["rev-parse", "--abbrev-ref", "HEAD"],
  });
  const statusRes = await runAllowedCommand({
    cwd: repo,
    command: "git",
    args: ["status", "--porcelain", "--branch"],
  });
  const files = statusRes.stdout
    .split("\n")
    .slice(1)
    .filter(Boolean)
    .map((line) => line.slice(3));
  const untracked = includeUntracked
    ? files.filter((f) => statusRes.stdout.includes(`?? ${f}`)).length
    : 0;
  return object(
    makeEnvelope({
      action: "repo_status",
      ok: true,
      summary: `Branch ${branchRes.stdout.trim()} with ${files.length} changed files`,
      artifacts: { branch: branchRes.stdout.trim(), files },
      next_steps: ["Run repo_diff for patch details"],
      raw_excerpt: statusRes.excerpt + (includeUntracked ? `\nuntracked=${untracked}` : ""),
    }, detailLevel),
  );
}

export async function runRepoDiff(input: {
  repoPath: string;
  scope: (typeof repoDiffScopes)[number];
  baseRef?: string;
  filePaths?: string[];
  contextLines: number;
  maxBytes: number;
  detailLevel?: DetailLevel;
}): Promise<RepoObject> {
  const { repoPath, scope, baseRef, filePaths, contextLines, maxBytes, detailLevel = "brief" } =
    input;
  const repo = await resolveRepoPath(repoPath);
  const safePaths = validateRelativePaths(filePaths);
  const contextArg = `-U${String(contextLines)}`;

  let args: string[];
  if (scope === "unstaged") {
    args = ["diff", contextArg];
  } else if (scope === "staged") {
    args = ["diff", "--staged", contextArg];
  } else if (scope === "range") {
    if (!baseRef) {
      throw new Error("baseRef is required when scope=range");
    }
    args = ["diff", contextArg, `${baseRef}...HEAD`];
  } else {
    args = ["diff", contextArg, "HEAD"];
  }
  if (safePaths.length > 0) {
    args.push("--", ...safePaths);
  }

  const diff = await runAllowedCommand({
    cwd: repo,
    command: "git",
    args,
    maxExcerptBytes: maxBytes,
  });
  return object(
    makeEnvelope({
      action: "repo_diff",
      ok: true,
      summary: "Computed repository diff",
      artifacts: { files: safePaths.length > 0 ? safePaths : undefined },
      next_steps: ["Inspect changed files and run repo_test if needed"],
      raw_excerpt: diff.excerpt,
    }, detailLevel),
  );
}

export async function runRepoSearch(input: {
  repoPath: string;
  query: string;
  mode: (typeof repoSearchModes)[number];
  glob?: string;
  maxResults: number;
  detailLevel?: DetailLevel;
}): Promise<RepoObject> {
  const { repoPath, query, mode, glob, maxResults, detailLevel = "brief" } = input;
  const repo = await resolveRepoPath(repoPath);
  if (mode === "semantic") {
    return object(
      makeEnvelope({
        action: "repo_search",
        ok: false,
        summary: "Semantic mode is not configured in this server yet",
        artifacts: {},
        next_steps: ["Use mode=text for now"],
        raw_excerpt: "",
      }, detailLevel),
    );
  }
  const args = ["grep", "-n", "-I", "-m", String(maxResults), query];
  if (glob) {
    args.push("--", glob);
  }
  const result = await runAllowedCommand({
    cwd: repo,
    command: "git",
    args,
  });
  return object(
    makeEnvelope({
      action: "repo_search",
      ok: true,
      summary: "Search completed",
      artifacts: {},
      next_steps: ["Open matching files and inspect context"],
      raw_excerpt: result.excerpt,
    }, detailLevel),
  );
}

export async function runRepoTest(input: {
  repoPath: string;
  target: (typeof repoTestTargets)[number];
  value?: string;
  timeoutSec: number;
  fix: boolean;
  detailLevel?: DetailLevel;
}): Promise<RepoObject> {
  const { repoPath, target, value, timeoutSec, fix, detailLevel = "brief" } = input;
  const repo = await resolveRepoPath(repoPath);
  if ((target === "path" || target === "pattern") && !value) {
    throw new Error("value is required for target=path|pattern");
  }
  if (fix) {
    await runAllowedCommand({
      cwd: repo,
      command: "yarn",
      args: ["lint:fix"],
      timeoutMs: timeoutSec * 1_000,
    });
  }
  const args = ["test"];
  if (target === "changed") {
    args.push("--changed");
  } else if (target === "path" && value) {
    args.push(value);
  } else if (target === "pattern" && value) {
    args.push("-t", value);
  }
  const res = await runAllowedCommand({
    cwd: repo,
    command: "yarn",
    args,
    timeoutMs: timeoutSec * 1_000,
  });
  return object(
    makeEnvelope({
      action: "repo_test",
      ok: true,
      summary: "Test command completed",
      artifacts: {},
      next_steps: ["Review failures and run repo_search for symbols"],
      raw_excerpt: res.excerpt,
    }, detailLevel),
  );
}

export async function runRepoLint(input: {
  repoPath: string;
  paths?: string[];
  fix: boolean;
  timeoutSec: number;
  detailLevel?: DetailLevel;
}): Promise<RepoObject> {
  const { repoPath, paths, fix, timeoutSec, detailLevel = "brief" } = input;
  const repo = await resolveRepoPath(repoPath);
  const safePaths = validateRelativePaths(paths);
  const args = [fix ? "lint:fix" : "lint"];
  if (safePaths.length > 0) {
    args.push(...safePaths);
  }
  const res = await runAllowedCommand({
    cwd: repo,
    command: "yarn",
    args,
    timeoutMs: timeoutSec * 1_000,
  });
  return object(
    makeEnvelope({
      action: "repo_lint",
      ok: true,
      summary: "Lint command completed",
      artifacts: { files: safePaths },
      next_steps: ["Run repo_test to verify behavior after lint fixes"],
      raw_excerpt: res.excerpt,
    }, detailLevel),
  );
}

export async function runRepoBlame(input: {
  repoPath: string;
  filePath: string;
  startLine: number;
  endLine?: number;
  detailLevel?: DetailLevel;
}): Promise<RepoObject> {
  const { repoPath, filePath, startLine, endLine, detailLevel = "brief" } = input;
  const repo = await resolveRepoPath(repoPath);
  validateRelativePaths([filePath]);
  const end = endLine ?? startLine;
  const res = await runAllowedCommand({
    cwd: repo,
    command: "git",
    args: ["blame", "-L", `${String(startLine)},${String(end)}`, "--", filePath],
  });
  return object(
    makeEnvelope({
      action: "repo_blame",
      ok: true,
      summary: `Blame computed for ${filePath}`,
      artifacts: { files: [filePath] },
      next_steps: ["Inspect commit details with git show <sha> if needed"],
      raw_excerpt: res.excerpt,
    }, detailLevel),
  );
}

export async function runRepoFindOwner(input: {
  repoPath: string;
  filePath: string;
  detailLevel?: DetailLevel;
}): Promise<RepoObject> {
  const { repoPath, filePath, detailLevel = "brief" } = input;
  const repo = await resolveRepoPath(repoPath);
  validateRelativePaths([filePath]);
  const content = await readCodeowners(repo);
  const owners = content ? findOwnerByCodeowners(content, filePath) : [];
  const fallback = owners.length === 0 ? ["@unknown-owner"] : [];
  return object(
    makeEnvelope({
      action: "repo_find_owner",
      ok: true,
      summary:
        owners.length > 0
          ? `Resolved ${owners.length} owner(s)`
          : "No CODEOWNERS match; returning fallback",
      artifacts: { files: [filePath] },
      next_steps: ["Use repo_blame to identify active maintainers for unmatched files"],
      raw_excerpt: JSON.stringify({ owners: owners.length > 0 ? owners : fallback }),
    }, detailLevel),
  );
}

export async function runRepoOpenPr(input: {
  repoPath: string;
  base: string;
  title: string;
  body?: string;
  draft: boolean;
  labels?: string[];
  reviewers?: string[];
  requireCleanStatus: boolean;
  detailLevel?: DetailLevel;
}): Promise<RepoObject> {
  const {
    repoPath,
    base,
    title,
    body,
    draft,
    labels,
    reviewers,
    requireCleanStatus,
    detailLevel = "brief",
  } = input;
  const repo = await resolveRepoPath(repoPath);
  if (requireCleanStatus) {
    const s = await runAllowedCommand({
      cwd: repo,
      command: "git",
      args: ["status", "--porcelain"],
    });
    if (s.stdout.trim().length > 0) {
      throw new Error("Working tree is not clean; commit or stash before opening PR");
    }
  }
  const pr = await openPullRequestWithGithub({
    repoPath: repo,
    base,
    title,
    body,
    draft,
    labels,
    reviewers,
  });
  return object(
    makeEnvelope({
      action: "repo_open_pr",
      ok: true,
      summary: `Created PR #${String(pr.number)}`,
      artifacts: {
        branch: pr.head,
        prUrl: pr.prUrl,
      },
      next_steps: ["Share PR URL and request team review"],
      raw_excerpt: JSON.stringify({ url: pr.prUrl, number: pr.number }),
    }, detailLevel),
  );
}

/** Standalone repo tools for direct Inspector testing. */
export function registerRepoActions(server: MCPServer): void {
  server.tool(
    {
      name: "repo_status",
      description: "Get branch and workspace change summary for a repository.",
      annotations: { readOnlyHint: true },
      schema: z.object({
        repoPath: z.string(),
        includeUntracked: z.boolean().optional().default(true),
        detailLevel: z.enum(["brief", "full"]).optional().default("brief"),
      }),
    },
    async ({ repoPath, includeUntracked, detailLevel }) =>
      runRepoStatus({ repoPath, includeUntracked, detailLevel }),
  );
  server.tool(
    {
      name: "repo_diff",
      description: "Get repository diffs (staged, unstaged, all, or against base ref).",
      annotations: { readOnlyHint: true },
      schema: z.object({
        repoPath: z.string(),
        scope: z.enum(repoDiffScopes).optional().default("all"),
        baseRef: z.string().optional(),
        filePaths: z.array(z.string()).optional(),
        contextLines: z.number().int().min(0).max(20).optional().default(3),
        maxBytes: z.number().int().min(1024).max(2_000_000).optional().default(60_000),
        detailLevel: z.enum(["brief", "full"]).optional().default("brief"),
      }),
    },
    async ({ repoPath, scope, baseRef, filePaths, contextLines, maxBytes, detailLevel }) =>
      runRepoDiff({ repoPath, scope, baseRef, filePaths, contextLines, maxBytes, detailLevel }),
  );
  server.tool(
    {
      name: "repo_search",
      description: "Search repository by text (or semantic when configured).",
      annotations: { readOnlyHint: true },
      schema: z.object({
        repoPath: z.string(),
        query: z.string(),
        mode: z.enum(repoSearchModes).optional().default("text"),
        glob: z.string().optional(),
        maxResults: z.number().int().min(1).max(200).optional().default(20),
        detailLevel: z.enum(["brief", "full"]).optional().default("brief"),
      }),
    },
    async ({ repoPath, query, mode, glob, maxResults, detailLevel }) =>
      runRepoSearch({ repoPath, query, mode, glob, maxResults, detailLevel }),
  );
  server.tool(
    {
      name: "repo_test",
      description: "Run repository tests with optional targeting.",
      schema: z.object({
        repoPath: z.string(),
        target: z.enum(repoTestTargets).optional().default("changed"),
        value: z.string().optional(),
        timeoutSec: z.number().int().min(10).max(3600).optional().default(600),
        fix: z.boolean().optional().default(false),
        detailLevel: z.enum(["brief", "full"]).optional().default("brief"),
      }),
    },
    async ({ repoPath, target, value, timeoutSec, fix, detailLevel }) =>
      runRepoTest({ repoPath, target, value, timeoutSec, fix, detailLevel }),
  );
  server.tool(
    {
      name: "repo_lint",
      description: "Run linter on repository or specified paths.",
      annotations: { destructiveHint: true },
      schema: z.object({
        repoPath: z.string(),
        paths: z.array(z.string()).optional(),
        fix: z.boolean().optional().default(true),
        timeoutSec: z.number().int().min(10).max(1800).optional().default(300),
        detailLevel: z.enum(["brief", "full"]).optional().default("brief"),
      }),
    },
    async ({ repoPath, paths, fix, timeoutSec, detailLevel }) =>
      runRepoLint({ repoPath, paths, fix, timeoutSec, detailLevel }),
  );
  server.tool(
    {
      name: "repo_blame",
      description: "Get blame details for a file line or range.",
      annotations: { readOnlyHint: true },
      schema: z.object({
        repoPath: z.string(),
        filePath: z.string(),
        startLine: z.number().int().min(1),
        endLine: z.number().int().min(1).optional(),
        detailLevel: z.enum(["brief", "full"]).optional().default("brief"),
      }),
    },
    async ({ repoPath, filePath, startLine, endLine, detailLevel }) =>
      runRepoBlame({ repoPath, filePath, startLine, endLine, detailLevel }),
  );
  server.tool(
    {
      name: "repo_find_owner",
      description: "Resolve owner(s) for a path via CODEOWNERS with fallback heuristics.",
      annotations: { readOnlyHint: true },
      schema: z.object({
        repoPath: z.string(),
        filePath: z.string(),
        detailLevel: z.enum(["brief", "full"]).optional().default("brief"),
      }),
    },
    async ({ repoPath, filePath, detailLevel }) =>
      runRepoFindOwner({ repoPath, filePath, detailLevel }),
  );
  server.tool(
    {
      name: "repo_open_pr",
      description: "Create a pull request from current branch using GitHub API.",
      annotations: { destructiveHint: true },
      schema: z.object({
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
    },
    async ({
      repoPath,
      base,
      title,
      body,
      draft,
      labels,
      reviewers,
      requireCleanStatus,
      detailLevel,
    }) =>
      runRepoOpenPr({
        repoPath,
        base,
        title,
        body,
        draft,
        labels,
        reviewers,
        requireCleanStatus,
        detailLevel,
      }),
  );
}
