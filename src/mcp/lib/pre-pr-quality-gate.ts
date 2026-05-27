import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { object, text } from "mcp-use/server";

import {
  filterReviewableChangedFiles,
  runStyleHeuristics,
} from "./pr-quality-heuristics.js";
import {
  runChangeScopeAnalyzer,
  runProjectIntelligence,
} from "./register-dev-tools.js";
import { runRepoLint, runRepoTest } from "./register-repo-actions.js";
import { resolveRepoPath, runAllowedCommand } from "./repo-actions-core.js";

export type PrePrQualityVerdict = "ready" | "not_ready";

export type PrePrQualityResult = {
  verdict: PrePrQualityVerdict;
  blockers: string[];
  warnings: string[];
  suggested_pr_body: string;
  commands_run: string[];
  changed_files: string[];
};

async function listChangedFiles(
  repo: string,
  baseRef?: string,
): Promise<string[]> {
  const args = baseRef?.trim()
    ? ["diff", "--name-only", `${baseRef.trim()}...HEAD`]
    : ["diff", "--name-only", "HEAD"];
  const res = await runAllowedCommand({
    cwd: repo,
    command: "git",
    args,
    timeoutMs: 60_000,
  });
  return res.stdout
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

export async function runPrePrQualityGate(input: {
  repoPath: string;
  baseRef?: string;
  maxFiles?: number;
  force?: boolean;
  structured?: boolean;
}): Promise<ReturnType<typeof text> | ReturnType<typeof object>> {
  const maxFiles = input.maxFiles ?? 40;
  const blockers: string[] = [];
  const warnings: string[] = [];
  const commands_run: string[] = [];

  const repo = await resolveRepoPath(input.repoPath);
  commands_run.push(`git repo: ${repo}`);

  let changed_files: string[] = [];
  try {
    changed_files = await listChangedFiles(repo, input.baseRef);
    commands_run.push(
      input.baseRef
        ? `git diff --name-only ${input.baseRef}...HEAD`
        : "git diff --name-only HEAD",
    );
  } catch (e) {
    blockers.push(
      `Could not list changed files: ${e instanceof Error ? e.message : "unknown"}`,
    );
  }

  if (changed_files.length > maxFiles && !input.force) {
    blockers.push(
      `${changed_files.length} files changed (max ${maxFiles}). Split the PR or pass force: true.`,
    );
  }

  let packageJson: Record<string, unknown> | null = null;
  try {
    const raw = await readFile(join(repo, "package.json"), "utf8");
    packageJson = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    warnings.push("Could not read package.json for dependency heuristics.");
  }

  let diffExcerpt = "";
  try {
    const diff = await runAllowedCommand({
      cwd: repo,
      command: "git",
      args: input.baseRef?.trim()
        ? ["diff", `${input.baseRef.trim()}...HEAD`]
        : ["diff", "HEAD"],
      timeoutMs: 90_000,
      maxExcerptBytes: 80_000,
    });
    diffExcerpt = diff.stdout;
    commands_run.push("git diff (excerpt for heuristics)");
  } catch {
    warnings.push("Could not read full diff for style heuristics.");
  }

  warnings.push(
    ...runStyleHeuristics({
      repoRoot: repo,
      changedFiles: changed_files,
      diffExcerpt,
      packageJson,
    }),
  );

  const reviewable = filterReviewableChangedFiles(changed_files);
  for (const rel of reviewable.slice(0, 8)) {
    try {
      await runChangeScopeAnalyzer({
        projectRoot: repo,
        targetPath: rel,
        structured: true,
      });
      commands_run.push(`change_scope_analyzer: ${rel}`);
    } catch (e) {
      warnings.push(
        `change_scope_analyzer(${rel}): ${e instanceof Error ? e.message : "failed"}`,
      );
    }
  }

  try {
    await runRepoLint({
      repoPath: repo,
      fix: true,
      timeoutSec: 300,
      detailLevel: "brief",
    });
    commands_run.push("yarn lint:fix");
  } catch (e) {
    blockers.push(
      `Lint failed: ${e instanceof Error ? e.message : "unknown"}. Fix before PR.`,
    );
  }

  try {
    await runRepoTest({
      repoPath: repo,
      target: "changed",
      timeoutSec: 600,
      fix: false,
      detailLevel: "brief",
    });
    commands_run.push("yarn test (changed)");
  } catch (e) {
    blockers.push(
      `Tests failed: ${e instanceof Error ? e.message : "unknown"}. Fix before PR.`,
    );
  }

  try {
    await runProjectIntelligence({ projectRoot: repo, structured: true });
    commands_run.push("project_intelligence");
  } catch (e) {
    warnings.push(
      `project_intelligence: ${e instanceof Error ? e.message : "skipped"}`,
    );
  }

  const verdict: PrePrQualityVerdict =
    blockers.length === 0 ? "ready" : "not_ready";

  const suggested_pr_body = [
    "## What",
    "<1–2 sentences on the change>",
    "",
    "## Why",
    "<problem or ticket>",
    "",
    "## How tested",
    "- [ ] `yarn lint`",
    "- [ ] `yarn test` (or targeted tests from change_scope_analyzer)",
    "",
    "## Risks",
    "<rollout / edge cases>",
  ].join("\n");

  const result: PrePrQualityResult = {
    verdict,
    blockers,
    warnings,
    suggested_pr_body,
    commands_run,
    changed_files,
  };

  if (input.structured) {
    return object(result);
  }

  const md = [
    "# Pre-PR quality gate",
    "",
    `**Verdict:** \`${verdict}\``,
    "",
    blockers.length
      ? `## Blockers\n\n${blockers.map((b) => `- ${b}`).join("\n")}`
      : "## Blockers\n\n- none",
    "",
    warnings.length
      ? `## Warnings\n\n${warnings.map((w) => `- ${w}`).join("\n")}`
      : "## Warnings\n\n- none",
    "",
    `## Changed files (${changed_files.length})`,
    changed_files.length
      ? changed_files.map((f) => `- ${f}`).join("\n")
      : "- none detected",
    "",
    "## Suggested PR body",
    "",
    suggested_pr_body,
    "",
    "## Commands run",
    commands_run.map((c) => `- ${c}`).join("\n"),
    "",
    verdict === "ready"
      ? "You may open a PR. Prefer `repo_open_pr` only when verdict is ready."
      : "Do **not** open a PR until blockers are fixed. Re-run `pre_pr_quality_gate`.",
  ].join("\n");

  return text(md);
}
