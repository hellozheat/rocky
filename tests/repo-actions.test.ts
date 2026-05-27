import { afterEach,beforeEach, describe, expect, it, vi } from "vitest";

import { findOwnerByCodeowners, validateRelativePaths } from "../src/mcp/lib/repo-actions-core.js";

vi.mock("../src/mcp/lib/repo-actions-core.js", async () => {
  const actual = await vi.importActual("../src/mcp/lib/repo-actions-core.js");
  return {
    ...actual,
    runAllowedCommand: vi.fn(),
  };
});

import { runAllowedCommand } from "../src/mcp/lib/repo-actions-core.js";
import { openPullRequestWithGithub } from "../src/mcp/lib/repo-open-pr-github.js";

describe("repo-actions-core", () => {
  it("rejects absolute and traversal paths", () => {
    expect(() => validateRelativePaths(["../secret.txt"])).toThrow(/cannot traverse/i);
    expect(() => validateRelativePaths(["/tmp/file"])).toThrow(/must be relative/i);
  });

  it("matches CODEOWNERS using last applicable rule", () => {
    const codeowners = `
* @org/all
/src/ @org/frontend
/src/mcp/ @org/mcp
`.trim();
    const owners = findOwnerByCodeowners(codeowners, "src/mcp/lib/register.ts");
    expect(owners).toEqual(["@org/mcp"]);
  });
});

describe("openPullRequestWithGithub", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    process.env.GITHUB_TOKEN = "test-token";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    delete process.env.GITHUB_TOKEN;
  });

  it("posts expected PR payload", async () => {
    vi.mocked(runAllowedCommand)
      .mockResolvedValueOnce({
        stdout: "git@github.com:acme/my-repo.git\n",
        stderr: "",
        excerpt: "",
      })
      .mockResolvedValueOnce({
        stdout: "feature/awesome\n",
        stderr: "",
        excerpt: "",
      });

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ html_url: "https://github.com/acme/my-repo/pull/1", number: 1 }),
    });

    const result = await openPullRequestWithGithub({
      repoPath: "/tmp/repo",
      base: "main",
      title: "Add feature",
      body: "body",
      draft: true,
      labels: undefined,
      reviewers: undefined,
    });

    expect(result.prUrl).toBe("https://github.com/acme/my-repo/pull/1");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/repos/acme/my-repo/pulls");
    expect(init.method).toBe("POST");
    expect(init.body).toContain('"head":"feature/awesome"');
    expect(init.body).toContain('"base":"main"');
    expect(init.body).toContain('"title":"Add feature"');
  });
});
