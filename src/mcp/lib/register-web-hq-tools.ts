import type { MCPServer } from "mcp-use/server";
import { object } from "mcp-use/server";
import { z } from "zod";

import {
  type DetailLevel,
  makeEnvelope,
  matchCodeowners,
  readCodeowners,
  requireRelativePath,
  resolveRepoPath,
  runGit,
} from "./web-hq-tools-core.js";

type ReleaseCommit = {
  sha: string;
  message: string;
  author: string;
  date: string;
};

type ApiContractSignal = {
  file: string;
  added: string[];
  removed: string[];
};

function summarizeCommits(commits: ReleaseCommit[]): string {
  const total = commits.length;
  const infra = commits.filter((c) =>
    /(infra|config|deploy|docker|ci|pipeline)/i.test(c.message),
  ).length;
  const ui = commits.filter((c) =>
    /(ui|frontend|page|component|css|style)/i.test(c.message),
  ).length;
  return `Found ${String(total)} commits (${String(ui)} UI-focused, ${String(infra)} infra/config).`;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

function scorePathRisk(path: string): number {
  let score = 0;
  if (/\.(tsx?|jsx?)$/i.test(path)) {
    score += 1;
  }
  if (/(auth|payment|checkout|middleware|api|route|config|schema|dto)/i.test(path)) {
    score += 3;
  }
  if (/test|spec/i.test(path)) {
    score -= 1;
  }
  return score;
}

function deriveTestCandidates(sourcePath: string): string[] {
  const withoutExt = sourcePath.replace(/\.[^/.]+$/, "");
  return [
    `${withoutExt}.test.ts`,
    `${withoutExt}.test.tsx`,
    `${withoutExt}.spec.ts`,
    `${withoutExt}.spec.tsx`,
    sourcePath
      .replace(/^src\//, "tests/")
      .replace(/\.(tsx?|jsx?)$/i, ".test.ts"),
    sourcePath
      .replace(/^src\//, "tests/")
      .replace(/\.(tsx?|jsx?)$/i, ".spec.ts"),
  ];
}

function parseApiPatch(diffText: string, file: string): ApiContractSignal | null {
  const added: string[] = [];
  const removed: string[] = [];
  const lines = diffText.split("\n");
  for (const line of lines) {
    if (line.startsWith("+++ ") || line.startsWith("--- ")) {
      continue;
    }
    if (
      line.startsWith("+") &&
      /(interface|type|z\.object|schema|response|payload|request|dto|contract)/i.test(line)
    ) {
      added.push(line.slice(1).trim());
    }
    if (
      line.startsWith("-") &&
      /(interface|type|z\.object|schema|response|payload|request|dto|contract)/i.test(line)
    ) {
      removed.push(line.slice(1).trim());
    }
  }
  if (added.length === 0 && removed.length === 0) {
    return null;
  }
  return {
    file,
    added: added.slice(0, 10),
    removed: removed.slice(0, 10),
  };
}

type WebHqObject = ReturnType<typeof object>;

export async function runWebReleaseNotes(input: {
  repoPath: string;
  lookbackHours: number;
  maxCommits: number;
  detailLevel?: DetailLevel;
}): Promise<WebHqObject> {
  const { repoPath, lookbackHours, maxCommits, detailLevel = "brief" } = input;
  const repo = await resolveRepoPath(repoPath);
  const sinceArg = `${lookbackHours} hours ago`;
  const log = await runGit(repo, [
    "log",
    "--since",
    sinceArg,
    "--max-count",
    String(maxCommits),
    "--pretty=format:%H%x09%an%x09%aI%x09%s",
  ]);
  const commits = log.stdout
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [sha = "", author = "", date = "", message = ""] = line.split("\t");
      return { sha: sha.slice(0, 7), author, date, message } satisfies ReleaseCommit;
    });
  const summary = summarizeCommits(commits);
  return object(
    makeEnvelope({
      action: "web_release_notes",
      ok: true,
      summary,
      artifacts: {
        lookbackHours,
        commits: commits.slice(0, 12),
        totalCommits: commits.length,
      },
      next_steps: [
        "Review high-risk infra commits first",
        "Use web_owner_lookup for affected files/routes",
      ],
      raw_excerpt: log.excerpt,
    }, detailLevel),
  );
}

export async function runWebIncidentDigest(input: {
  repoPath: string;
  area: string;
  lookbackHours: number;
  detailLevel?: DetailLevel;
}): Promise<WebHqObject> {
  const { repoPath, area, lookbackHours, detailLevel = "brief" } = input;
  const repo = await resolveRepoPath(repoPath);
  const sinceArg = `${lookbackHours} hours ago`;
  const log = await runGit(repo, [
    "log",
    "--since",
    sinceArg,
    "--name-only",
    "--pretty=format:%H%x09%an%x09%aI%x09%s",
  ]);
  const lines = log.stdout.split("\n");
  const suspiciousSignals = lines.filter((line) =>
    /(auth|payment|checkout|middleware|config|env|deploy|api)/i.test(line),
  );
  const uniqueFiles = new Set(
    lines.filter((line) => line.includes("/") || line.endsWith(".ts") || line.endsWith(".tsx")),
  );
  return object(
    makeEnvelope({
      action: "web_incident_digest",
      ok: true,
      summary: `Area ${area}: ${String(suspiciousSignals.length)} suspicious signal(s), ${String(uniqueFiles.size)} changed file(s) in ${String(lookbackHours)}h.`,
      artifacts: {
        area,
        lookbackHours,
        suspiciousSignals: suspiciousSignals.slice(0, 20),
        changedFiles: Array.from(uniqueFiles).slice(0, 40),
      },
      next_steps: [
        "Check latest suspicious commits first",
        "Use web_owner_lookup to page owners quickly",
      ],
      raw_excerpt: log.excerpt,
    }, detailLevel),
  );
}

export async function runWebOwnerLookup(input: {
  repoPath: string;
  targetPath: string;
  detailLevel?: DetailLevel;
}): Promise<WebHqObject> {
  const { repoPath, targetPath, detailLevel = "brief" } = input;
  const repo = await resolveRepoPath(repoPath);
  const rel = requireRelativePath(targetPath);
  const codeowners = await readCodeowners(repo);
  const owners = codeowners ? matchCodeowners(codeowners, rel) : [];
  if (owners.length > 0) {
    return object(
      makeEnvelope({
        action: "web_owner_lookup",
        ok: true,
        summary: `Found ${String(owners.length)} CODEOWNERS match(es).`,
        artifacts: {
          targetPath: rel,
          owners,
          source: "CODEOWNERS",
        },
        next_steps: ["Contact listed owners for review or incident response"],
        raw_excerpt: JSON.stringify({ targetPath: rel, owners }),
      }, detailLevel),
    );
  }

  const fallback = await runGit(repo, [
    "log",
    "--max-count",
    "8",
    "--pretty=format:%an <%ae>",
    "--",
    rel,
  ]);
  const contributors = [...new Set(fallback.stdout.split("\n").filter(Boolean))];
  return object(
    makeEnvelope({
      action: "web_owner_lookup",
      ok: true,
      summary: contributors.length
        ? `No CODEOWNERS match; found ${String(contributors.length)} recent contributor(s).`
        : "No CODEOWNERS match and no contributor history found.",
      artifacts: {
        targetPath: rel,
        owners: contributors,
        source: "git-log-fallback",
      },
      next_steps: ["Add CODEOWNERS mapping for this path to improve future lookups"],
      raw_excerpt: fallback.excerpt,
    }, detailLevel),
  );
}

export async function runTestGapFinder(input: {
  repoPath: string;
  baseRef: string;
  maxFiles: number;
  detailLevel?: DetailLevel;
}): Promise<WebHqObject> {
  const { repoPath, baseRef, maxFiles, detailLevel = "brief" } = input;
  const repo = await resolveRepoPath(repoPath);
  const changed = await runGit(repo, [
    "diff",
    "--name-only",
    `${baseRef}...HEAD`,
  ]);
  const sourceFiles = changed.stdout
    .split("\n")
    .filter(Boolean)
    .filter((path) => /\.(tsx?|jsx?)$/i.test(path))
    .filter((path) => !/(\.test\.|\.spec\.)/i.test(path))
    .slice(0, maxFiles);

  const gaps: Array<{ file: string; candidateTests: string[] }> = [];
  for (const sourceFile of sourceFiles) {
    const candidates = deriveTestCandidates(sourceFile);
    const ls = await runGit(repo, ["ls-files", "--", ...candidates]);
    if (ls.stdout.trim().length === 0) {
      gaps.push({ file: sourceFile, candidateTests: candidates.slice(0, 3) });
    }
  }

  return object(
    makeEnvelope({
      action: "test_gap_finder",
      ok: true,
      summary: `Scanned ${String(sourceFiles.length)} source files; found ${String(gaps.length)} likely test gap(s).`,
      artifacts: {
        baseRef,
        scannedFiles: sourceFiles.length,
        gaps: gaps.slice(0, 40),
      },
      next_steps: [
        "Prioritize gaps in auth/payment/checkout files first",
        "Add or update tests for high-risk changed files",
      ],
      raw_excerpt: changed.excerpt,
    }, detailLevel),
  );
}

export async function runWebRouteHealth(input: {
  repoPath: string;
  routePattern?: string;
  lookbackHours: number;
  detailLevel?: DetailLevel;
}): Promise<WebHqObject> {
  const { repoPath, routePattern, lookbackHours, detailLevel = "brief" } = input;
  const repo = await resolveRepoPath(repoPath);
  const log = await runGit(repo, [
    "log",
    "--since",
    `${lookbackHours} hours ago`,
    "--name-only",
    "--pretty=format:%s",
  ]);
  const rawLines = log.stdout.split("\n").filter(Boolean);
  const filtered = rawLines.filter(
    (line) =>
      /(route|routes|page|pages|api|middleware|controller|view)/i.test(line) ||
      (routePattern ? line.toLowerCase().includes(routePattern.toLowerCase()) : false),
  );
  const files = uniqueStrings(
    filtered.filter((line) => line.includes("/") || /\.(tsx?|jsx?)$/i.test(line)),
  );
  const highRisk = files
    .map((file) => ({ file, score: scorePathRisk(file) }))
    .filter((entry) => entry.score >= 3)
    .sort((a, b) => b.score - a.score);
  return object(
    makeEnvelope({
      action: "web_route_health",
      ok: true,
      summary: `Detected ${String(files.length)} route-related file change(s); ${String(highRisk.length)} high-risk candidate(s).`,
      artifacts: {
        routePattern: routePattern ?? null,
        lookbackHours,
        changedRouteFiles: files.slice(0, 60),
        highRiskCandidates: highRisk.slice(0, 20),
      },
      next_steps: [
        "Validate top high-risk routes in staging",
        "Use web_owner_lookup for top candidates",
      ],
      raw_excerpt: log.excerpt,
    }, detailLevel),
  );
}

export async function runWebApiContractWatch(input: {
  repoPath: string;
  baseRef: string;
  maxFindings: number;
  detailLevel?: DetailLevel;
}): Promise<WebHqObject> {
  const { repoPath, baseRef, maxFindings, detailLevel = "brief" } = input;
  const repo = await resolveRepoPath(repoPath);
  const changed = await runGit(repo, [
    "diff",
    "--name-only",
    `${baseRef}...HEAD`,
  ]);
  const apiFiles = changed.stdout
    .split("\n")
    .filter(Boolean)
    .filter((file) =>
      /(api|contract|dto|schema|types?|openapi|swagger|client|server)/i.test(file),
    )
    .slice(0, 80);
  const findings: ApiContractSignal[] = [];
  for (const file of apiFiles) {
    const patch = await runGit(repo, ["diff", `${baseRef}...HEAD`, "--", file]);
    const parsed = parseApiPatch(patch.stdout, file);
    if (parsed) {
      findings.push(parsed);
    }
    if (findings.length >= maxFindings) {
      break;
    }
  }
  return object(
    makeEnvelope({
      action: "web_api_contract_watch",
      ok: true,
      summary: `Scanned ${String(apiFiles.length)} API-related file(s); found ${String(findings.length)} potential contract drift signal(s).`,
      artifacts: {
        baseRef,
        scannedFiles: apiFiles.slice(0, 60),
        findings,
      },
      next_steps: [
        "Validate changed request/response fields end-to-end",
        "Update typed clients and tests where drift is intentional",
      ],
      raw_excerpt: changed.excerpt,
    }, detailLevel),
  );
}

export async function runWebPerfRegressionHint(input: {
  repoPath: string;
  lookbackHours: number;
  detailLevel?: DetailLevel;
}): Promise<WebHqObject> {
  const { repoPath, lookbackHours, detailLevel = "brief" } = input;
  const repo = await resolveRepoPath(repoPath);
  const log = await runGit(repo, [
    "log",
    "--since",
    `${lookbackHours} hours ago`,
    "--name-only",
    "--pretty=format:%s",
  ]);
  const lines = log.stdout.split("\n").filter(Boolean);
  const perfSignals = lines.filter((line) =>
    /(render|bundle|memo|effect|query|cache|image|video|list|table|virtual|perf|latency)/i.test(
      line,
    ),
  );
  const files = uniqueStrings(
    perfSignals.filter((line) => line.includes("/") || /\.(tsx?|jsx?)$/i.test(line)),
  );
  const scored = files
    .map((file) => ({
      file,
      score:
        scorePathRisk(file) +
        (/(page|layout|table|list|dashboard|chart|grid)/i.test(file) ? 2 : 0),
    }))
    .sort((a, b) => b.score - a.score);
  return object(
    makeEnvelope({
      action: "web_perf_regression_hint",
      ok: true,
      summary: `Found ${String(files.length)} perf-related change signal(s); ${String(scored.filter((entry) => entry.score >= 4).length)} strong hotspot(s).`,
      artifacts: {
        lookbackHours,
        hotspots: scored.slice(0, 25),
      },
      next_steps: [
        "Profile top hotspot routes in staging",
        "Check bundle size and expensive render paths for top files",
      ],
      raw_excerpt: log.excerpt,
    }, detailLevel),
  );
}

/** Standalone web-hq tools for direct Inspector testing. */
export function registerWebHqTools(server: MCPServer): void {
  server.tool(
    {
      name: "web_release_notes",
      description: "Summarize recent web-hq changes into concise release notes.",
      annotations: { readOnlyHint: true },
      schema: z.object({
        repoPath: z.string(),
        lookbackHours: z.number().int().min(1).max(24 * 30).optional().default(72),
        maxCommits: z.number().int().min(1).max(200).optional().default(40),
        detailLevel: z.enum(["brief", "full"]).optional().default("brief"),
      }),
    },
    async ({ repoPath, lookbackHours, maxCommits, detailLevel }) =>
      runWebReleaseNotes({ repoPath, lookbackHours, maxCommits, detailLevel }),
  );
  server.tool(
    {
      name: "web_incident_digest",
      description: "Build quick incident digest from recent git changes and risk signals.",
      annotations: { readOnlyHint: true },
      schema: z.object({
        repoPath: z.string(),
        area: z.string().optional().default("web"),
        lookbackHours: z.number().int().min(1).max(24 * 14).optional().default(24),
        detailLevel: z.enum(["brief", "full"]).optional().default("brief"),
      }),
    },
    async ({ repoPath, area, lookbackHours, detailLevel }) =>
      runWebIncidentDigest({ repoPath, area, lookbackHours, detailLevel }),
  );
  server.tool(
    {
      name: "web_owner_lookup",
      description: "Resolve owner for file/path using CODEOWNERS then git contributor fallback.",
      annotations: { readOnlyHint: true },
      schema: z.object({
        repoPath: z.string(),
        targetPath: z.string(),
        detailLevel: z.enum(["brief", "full"]).optional().default("brief"),
      }),
    },
    async ({ repoPath, targetPath, detailLevel }) =>
      runWebOwnerLookup({ repoPath, targetPath, detailLevel }),
  );
  server.tool(
    {
      name: "test_gap_finder",
      description: "Find changed source files that appear to lack nearby unit/spec test coverage.",
      annotations: { readOnlyHint: true },
      schema: z.object({
        repoPath: z.string(),
        baseRef: z.string().optional().default("origin/main"),
        maxFiles: z.number().int().min(1).max(200).optional().default(100),
        detailLevel: z.enum(["brief", "full"]).optional().default("brief"),
      }),
    },
    async ({ repoPath, baseRef, maxFiles, detailLevel }) =>
      runTestGapFinder({ repoPath, baseRef, maxFiles, detailLevel }),
  );
  server.tool(
    {
      name: "web_route_health",
      description: "Estimate route-level risk by scanning recent route/page/api related changes.",
      annotations: { readOnlyHint: true },
      schema: z.object({
        repoPath: z.string(),
        routePattern: z.string().optional(),
        lookbackHours: z.number().int().min(1).max(24 * 30).optional().default(72),
        detailLevel: z.enum(["brief", "full"]).optional().default("brief"),
      }),
    },
    async ({ repoPath, routePattern, lookbackHours, detailLevel }) =>
      runWebRouteHealth({ repoPath, routePattern, lookbackHours, detailLevel }),
  );
  server.tool(
    {
      name: "web_api_contract_watch",
      description:
        "Detect possible API contract drift from changed schema/DTO/request/response definitions.",
      annotations: { readOnlyHint: true },
      schema: z.object({
        repoPath: z.string(),
        baseRef: z.string().optional().default("origin/main"),
        maxFindings: z.number().int().min(1).max(100).optional().default(20),
        detailLevel: z.enum(["brief", "full"]).optional().default("brief"),
      }),
    },
    async ({ repoPath, baseRef, maxFindings, detailLevel }) =>
      runWebApiContractWatch({ repoPath, baseRef, maxFindings, detailLevel }),
  );
  server.tool(
    {
      name: "web_perf_regression_hint",
      description:
        "Estimate likely frontend performance regression hotspots from recent code changes.",
      annotations: { readOnlyHint: true },
      schema: z.object({
        repoPath: z.string(),
        lookbackHours: z.number().int().min(1).max(24 * 30).optional().default(96),
        detailLevel: z.enum(["brief", "full"]).optional().default("brief"),
      }),
    },
    async ({ repoPath, lookbackHours, detailLevel }) =>
      runWebPerfRegressionHint({ repoPath, lookbackHours, detailLevel }),
  );
}
