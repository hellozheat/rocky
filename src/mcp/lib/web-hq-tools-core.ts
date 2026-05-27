import { execFile } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import { isAbsolute, normalize, relative, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_BYTES = 60_000;
const ALLOWED_COMMANDS = new Set(["git"]);
const REDACTIONS = [
  /ghp_[A-Za-z0-9]{20,}/g,
  /github_pat_[A-Za-z0-9_]{20,}/g,
  /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
];

export type WebHqEnvelope = {
  action: string;
  ok: boolean;
  summary: string;
  artifacts: Record<string, unknown>;
  next_steps: string[];
  raw_excerpt: string;
};

export type DetailLevel = "brief" | "full";

export type CommandResult = {
  stdout: string;
  stderr: string;
  excerpt: string;
};

function redact(input: string): string {
  let out = input;
  for (const p of REDACTIONS) {
    out = out.replace(p, "[REDACTED]");
  }
  return out;
}

function cap(input: string, maxBytes: number): string {
  if (Buffer.byteLength(input, "utf8") <= maxBytes) {
    return input;
  }
  let bytes = 0;
  let i = 0;
  while (i < input.length && bytes < maxBytes) {
    bytes += Buffer.byteLength(input[i] ?? "", "utf8");
    i += 1;
  }
  return `${input.slice(0, i)}\n...[truncated]`;
}

function isPathInside(base: string, target: string): boolean {
  const rel = relative(base, target);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

export async function resolveRepoPath(repoPath: string): Promise<string> {
  const trimmed = repoPath.trim();
  if (!trimmed) {
    throw new Error("repoPath is required");
  }
  const normalized = isAbsolute(trimmed)
    ? normalize(resolve(trimmed))
    : normalize(resolve(process.cwd(), trimmed));

  const allowedRootsRaw = process.env.DEVKIT_ALLOWED_REPO_ROOTS?.trim();
  if (allowedRootsRaw) {
    const allowedRoots = allowedRootsRaw
      .split(",")
      .map((v) => normalize(resolve(v.trim())))
      .filter(Boolean);
    if (!allowedRoots.some((root) => isPathInside(root, normalized))) {
      throw new Error("repoPath is outside allowed repository roots");
    }
  }

  await access(normalized);
  const check = await runGit(normalized, ["rev-parse", "--is-inside-work-tree"], 10_000);
  if (!check.stdout.includes("true")) {
    throw new Error("repoPath is not a git repository");
  }
  return normalized;
}

export async function runGit(
  cwd: string,
  args: string[],
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxBytes = DEFAULT_MAX_BYTES,
): Promise<CommandResult> {
  if (!ALLOWED_COMMANDS.has("git")) {
    throw new Error("git command not allowed");
  }
  try {
    const { stdout, stderr } = await execFileAsync("git", args, {
      cwd,
      timeout: timeoutMs,
      maxBuffer: maxBytes * 2,
      windowsHide: true,
    });
    const excerpt = cap(redact([stdout, stderr].filter(Boolean).join("\n")), maxBytes);
    return { stdout, stderr, excerpt };
  } catch (error) {
    const e = error as { stdout?: string; stderr?: string; message?: string };
    const raw = [e.stdout ?? "", e.stderr ?? "", e.message ?? ""].filter(Boolean).join("\n");
    throw new Error(cap(redact(raw), maxBytes) || "git command failed");
  }
}

export function makeEnvelope(
  input: WebHqEnvelope,
  detailLevel: DetailLevel = "brief",
): WebHqEnvelope {
  const redacted = redact(input.raw_excerpt);
  return {
    ...input,
    raw_excerpt: detailLevel === "full" ? redacted : "",
  };
}

export function requireRelativePath(inputPath: string): string {
  if (isAbsolute(inputPath)) {
    throw new Error("path must be relative to repoPath");
  }
  const clean = normalize(inputPath);
  if (clean.startsWith("..")) {
    throw new Error("path cannot traverse outside repoPath");
  }
  return clean;
}

export async function readCodeowners(repoPath: string): Promise<string | null> {
  const candidates = [".github/CODEOWNERS", "CODEOWNERS", "docs/CODEOWNERS"];
  for (const relPath of candidates) {
    try {
      return await readFile(resolve(repoPath, relPath), "utf8");
    } catch {
      // Try next.
    }
  }
  return null;
}

export function matchCodeowners(content: string, filePath: string): string[] {
  const lines = content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
  let owners: string[] = [];
  const target = filePath.replace(/\\/g, "/");
  for (const line of lines) {
    const parts = line.split(/\s+/).filter(Boolean);
    const pattern = (parts[0] ?? "").replace(/\/$/, "");
    const currentOwners = parts.slice(1);
    if (!pattern || currentOwners.length === 0) {
      continue;
    }
    if (pattern === "*") {
      owners = currentOwners;
      continue;
    }
    const bare = pattern.startsWith("/") ? pattern.slice(1) : pattern;
    if (target === bare || target.startsWith(`${bare}/`)) {
      owners = currentOwners;
    }
  }
  return owners;
}
