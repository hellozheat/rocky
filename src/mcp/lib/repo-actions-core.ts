import { execFile } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import { isAbsolute, normalize, relative, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const MAX_EXCERPT_BYTES = 60_000;
const DEFAULT_TIMEOUT_MS = 60_000;
const SECRET_REDACTIONS: RegExp[] = [
  /ghp_[A-Za-z0-9]{20,}/g,
  /github_pat_[A-Za-z0-9_]{20,}/g,
  /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
];

const ALLOWED_COMMANDS = new Set(["git", "yarn"]);

export type RepoActionArtifacts = {
  branch?: string;
  files?: string[];
  prUrl?: string | null;
};

export type RepoActionEnvelope = {
  action: string;
  ok: boolean;
  summary: string;
  artifacts: RepoActionArtifacts;
  next_steps: string[];
  raw_excerpt: string;
};

export type DetailLevel = "brief" | "full";

export type ExecResult = {
  stdout: string;
  stderr: string;
  excerpt: string;
};

export function redactSecrets(input: string): string {
  let output = input;
  for (const pattern of SECRET_REDACTIONS) {
    output = output.replace(pattern, "[REDACTED]");
  }
  return output;
}

function clampExcerpt(input: string, maxBytes = MAX_EXCERPT_BYTES): string {
  if (Buffer.byteLength(input, "utf8") <= maxBytes) {
    return input;
  }
  let bytes = 0;
  let idx = 0;
  while (idx < input.length && bytes < maxBytes) {
    bytes += Buffer.byteLength(input[idx] ?? "", "utf8");
    idx += 1;
  }
  return `${input.slice(0, idx)}\n...[truncated]`;
}

function assertAllowedCommand(command: string): void {
  if (!ALLOWED_COMMANDS.has(command)) {
    throw new Error(`Command not allowed: ${command}`);
  }
}

export async function runAllowedCommand(params: {
  cwd: string;
  command: "git" | "yarn";
  args: string[];
  timeoutMs?: number;
  maxExcerptBytes?: number;
}): Promise<ExecResult> {
  assertAllowedCommand(params.command);
  const { cwd, command, args } = params;
  const timeoutMs = params.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxExcerptBytes = params.maxExcerptBytes ?? MAX_EXCERPT_BYTES;
  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      cwd,
      timeout: timeoutMs,
      maxBuffer: maxExcerptBytes * 2,
      windowsHide: true,
    });
    const excerpt = clampExcerpt(
      redactSecrets([stdout, stderr].filter(Boolean).join("\n")),
      maxExcerptBytes,
    );
    return { stdout, stderr, excerpt };
  } catch (error) {
    const e = error as {
      stdout?: string;
      stderr?: string;
      message?: string;
    };
    const raw = [e.stdout ?? "", e.stderr ?? "", e.message ?? ""]
      .filter(Boolean)
      .join("\n");
    const excerpt = clampExcerpt(redactSecrets(raw), maxExcerptBytes);
    throw new Error(excerpt || "Command execution failed");
  }
}

function isPathInside(base: string, target: string): boolean {
  const rel = relative(base, target);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

export async function resolveRepoPath(inputPath: string): Promise<string> {
  const trimmed = inputPath.trim();
  if (!trimmed) {
    throw new Error("repoPath is required");
  }
  // Accept absolute or relative repoPath; resolve relative paths from server cwd.
  const normalized = isAbsolute(trimmed)
    ? normalize(resolve(trimmed))
    : normalize(resolve(process.cwd(), trimmed));
  const rootsRaw = process.env.DEVKIT_ALLOWED_REPO_ROOTS?.trim();
  if (rootsRaw) {
    const roots = rootsRaw
      .split(",")
      .map((r) => normalize(resolve(r.trim())))
      .filter(Boolean);
    if (!roots.some((root) => isPathInside(root, normalized))) {
      throw new Error("repoPath is outside allowed repository roots");
    }
  }
  await access(normalized);
  const check = await runAllowedCommand({
    cwd: normalized,
    command: "git",
    args: ["rev-parse", "--is-inside-work-tree"],
    timeoutMs: 15_000,
  });
  if (!check.stdout.includes("true")) {
    throw new Error("repoPath is not a git repository");
  }
  return normalized;
}

export function validateRelativePaths(paths: string[] | undefined): string[] {
  if (!paths) {
    return [];
  }
  for (const path of paths) {
    if (isAbsolute(path)) {
      throw new Error("file paths must be relative to repoPath");
    }
    const clean = normalize(path);
    if (clean.startsWith("..")) {
      throw new Error("file paths cannot traverse outside repoPath");
    }
  }
  return paths;
}

export function makeEnvelope(
  input: RepoActionEnvelope,
  detailLevel: DetailLevel = "brief",
): RepoActionEnvelope {
  const redacted = redactSecrets(input.raw_excerpt);
  return {
    ...input,
    raw_excerpt: detailLevel === "full" ? redacted : "",
  };
}

export function parseGitRemoteUrl(url: string): {
  owner: string;
  repo: string;
} | null {
  const ssh = /git@github\.com:([^/]+)\/(.+?)(?:\.git)?$/i.exec(url.trim());
  if (ssh) {
    return { owner: ssh[1] ?? "", repo: ssh[2] ?? "" };
  }
  const https = /https?:\/\/github\.com\/([^/]+)\/(.+?)(?:\.git)?$/i.exec(
    url.trim(),
  );
  if (https) {
    return { owner: https[1] ?? "", repo: https[2] ?? "" };
  }
  return null;
}

type CodeownersRule = {
  pattern: string;
  owners: string[];
};

export function findOwnerByCodeowners(
  codeownersContent: string,
  filePath: string,
): string[] {
  const rules: CodeownersRule[] = codeownersContent
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const parts = line.split(/\s+/).filter(Boolean);
      return {
        pattern: parts[0] ?? "",
        owners: parts.slice(1),
      };
    })
    .filter((rule) => rule.pattern.length > 0 && rule.owners.length > 0);

  const target = filePath.replace(/\\/g, "/");
  let matched: string[] = [];
  for (const rule of rules) {
    const p = rule.pattern.replace(/\/$/, "");
    if (p === "*") {
      matched = rule.owners;
      continue;
    }
    if (p.startsWith("/") && (target === p.slice(1) || target.startsWith(`${p.slice(1)}/`))) {
      matched = rule.owners;
      continue;
    }
    const bare = p.startsWith("/") ? p.slice(1) : p;
    if (target === bare || target.startsWith(`${bare}/`)) {
      matched = rule.owners;
    }
  }
  return matched;
}

export async function readCodeowners(repoPath: string): Promise<string | null> {
  const candidates = [".github/CODEOWNERS", "CODEOWNERS", "docs/CODEOWNERS"];
  for (const relPath of candidates) {
    try {
      return await readFile(resolve(repoPath, relPath), "utf8");
    } catch {
      // Continue to next location.
    }
  }
  return null;
}
