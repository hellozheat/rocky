import { afterEach, describe, expect, it } from "vitest";

import {
  getAllowedWorkspaceRoots,
  resolveAllowedWorkspacePath,
  resolvePathWithinProjectRoot,
} from "../src/mcp/lib/path-scope.js";

describe("path-scope", () => {
  const prev = process.env.DEVKIT_ALLOWED_REPO_ROOTS;

  afterEach(() => {
    if (prev === undefined) {
      delete process.env.DEVKIT_ALLOWED_REPO_ROOTS;
    } else {
      process.env.DEVKIT_ALLOWED_REPO_ROOTS = prev;
    }
  });

  it("default policy rejects arbitrary absolute paths outside roots", () => {
    delete process.env.DEVKIT_ALLOWED_REPO_ROOTS;
    expect(() =>
      resolveAllowedWorkspacePath("/tmp/mcp-devkit-path-scope-nonexistent-999"),
    ).toThrow(/outside allowed workspace roots/i);
  });

  it("default policy allows process.cwd()", () => {
    delete process.env.DEVKIT_ALLOWED_REPO_ROOTS;
    expect(() => resolveAllowedWorkspacePath(process.cwd())).not.toThrow();
    const { roots, source } = getAllowedWorkspaceRoots();
    expect(source).toBe("default");
    expect(roots.length).toBeGreaterThan(0);
  });

  it("resolvePathWithinProjectRoot blocks directory traversal", () => {
    const root = process.cwd();
    expect(() => resolvePathWithinProjectRoot(root, "../../../etc/passwd")).toThrow(
      /traversal/i,
    );
  });
});
