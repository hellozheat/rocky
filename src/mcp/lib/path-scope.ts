import { isAbsolute, join, normalize, relative, resolve } from "node:path";

import { getDevkitProjectRoot } from "./devkit-project-root.js";

function dedupeSorted(paths: string[]): string[] {
  return [...new Set(paths)].sort();
}

function isInsideRoot(root: string, target: string): boolean {
  const rel = relative(root, target);
  return rel === "" || (!rel.startsWith("..") && !rel.startsWith("/"));
}

/**
 * Allowed filesystem roots for dev tools (`project-intelligence`, `safe-run`, etc.).
 * When `DEVKIT_ALLOWED_REPO_ROOTS` is set (comma-separated), paths must lie under one of those roots (same semantics as repo git tools).
 * When unset, defaults to the resolved devkit handbook project root and `process.cwd()` so arbitrary absolute paths are not accepted by default.
 */
export function getAllowedWorkspaceRoots(): { roots: string[]; source: "env" | "default" } {
  const rootsRaw = process.env.DEVKIT_ALLOWED_REPO_ROOTS?.trim();
  if (rootsRaw) {
    const roots = rootsRaw
      .split(",")
      .map((r) => normalize(resolve(r.trim())))
      .filter(Boolean);
    return { roots: dedupeSorted(roots), source: "env" };
  }
  const project = normalize(resolve(getDevkitProjectRoot()));
  const cwd = normalize(resolve(process.cwd()));
  return { roots: dedupeSorted([project, cwd]), source: "default" };
}

export function isPathUnderAllowedRoots(absoluteNormalized: string): boolean {
  const target = normalize(resolve(absoluteNormalized));
  const { roots } = getAllowedWorkspaceRoots();
  return roots.some((root) => isInsideRoot(root, target));
}

/**
 * Resolve a user-supplied path (absolute or relative to `process.cwd()`) and require it to fall under allowed roots.
 */
export function resolveAllowedWorkspacePath(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("path is required");
  }
  const absolute = normalize(
    isAbsolute(trimmed) ? resolve(trimmed) : resolve(process.cwd(), trimmed),
  );
  if (!isPathUnderAllowedRoots(absolute)) {
    const { roots, source } = getAllowedWorkspaceRoots();
    throw new Error(
      `Path is outside allowed workspace roots (${source}): ${roots.join(", ")}`,
    );
  }
  return absolute;
}

/**
 * Resolve `maybePath` against `projectRoot` (or as absolute) and ensure the result stays inside `projectRoot` (no `..` escape).
 */
export function resolvePathWithinProjectRoot(
  projectRoot: string,
  maybePath: string,
): string {
  const root = normalize(resolve(projectRoot));
  const abs = isAbsolute(maybePath)
    ? normalize(resolve(maybePath))
    : normalize(resolve(join(root, maybePath)));
  if (!isInsideRoot(root, abs)) {
    throw new Error("targetPath must stay inside projectRoot (no path traversal)");
  }
  return abs;
}
