import { parseGitRemoteUrl, redactSecrets, runAllowedCommand } from "./repo-actions-core.js";

const GH_API = "https://api.github.com";
const USER_AGENT = "mcp-devkit-server";

type OpenPrInput = {
  repoPath: string;
  base: string;
  title: string;
  body?: string;
  draft: boolean;
  labels?: string[];
  reviewers?: string[];
};

type OpenPrResult = {
  prUrl: string;
  number: number;
  head: string;
  base: string;
  owner: string;
  repo: string;
};

function githubHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": USER_AGENT,
    "Content-Type": "application/json",
  };
}

async function requireCurrentBranch(repoPath: string): Promise<string> {
  const res = await runAllowedCommand({
    cwd: repoPath,
    command: "git",
    args: ["rev-parse", "--abbrev-ref", "HEAD"],
    timeoutMs: 15_000,
  });
  const branch = res.stdout.trim();
  if (!branch || branch === "HEAD") {
    throw new Error("Cannot open PR from detached HEAD");
  }
  return branch;
}

export async function openPullRequestWithGithub(input: OpenPrInput): Promise<OpenPrResult> {
  const token = process.env.GITHUB_TOKEN?.trim();
  if (!token) {
    throw new Error("Missing GITHUB_TOKEN for repo_open_pr");
  }

  const remoteRes = await runAllowedCommand({
    cwd: input.repoPath,
    command: "git",
    args: ["remote", "get-url", "origin"],
    timeoutMs: 15_000,
  });
  const remote = remoteRes.stdout.trim();
  const parsed = parseGitRemoteUrl(remote);
  if (!parsed) {
    throw new Error("Unsupported origin remote; expected github.com owner/repo");
  }

  const head = await requireCurrentBranch(input.repoPath);
  const apiBase = process.env.GITHUB_API_URL?.trim() || GH_API;
  const prRes = await fetch(
    `${apiBase}/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}/pulls`,
    {
      method: "POST",
      headers: githubHeaders(token),
      body: JSON.stringify({
        title: input.title,
        head,
        base: input.base,
        body: input.body ?? "",
        draft: input.draft,
      }),
    },
  );
  const prData = (await prRes.json()) as {
    html_url?: string;
    number?: number;
    message?: string;
  };
  if (!prRes.ok || !prData.html_url || !prData.number) {
    const msg = redactSecrets(
      prData.message ?? `GitHub PR creation failed: ${prRes.status}`,
    );
    throw new Error(msg);
  }

  if (input.labels && input.labels.length > 0) {
    await fetch(
      `${apiBase}/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}/issues/${prData.number}/labels`,
      {
        method: "POST",
        headers: githubHeaders(token),
        body: JSON.stringify({ labels: input.labels }),
      },
    );
  }

  if (input.reviewers && input.reviewers.length > 0) {
    await fetch(
      `${apiBase}/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}/pulls/${prData.number}/requested_reviewers`,
      {
        method: "POST",
        headers: githubHeaders(token),
        body: JSON.stringify({ reviewers: input.reviewers }),
      },
    );
  }

  return {
    prUrl: prData.html_url,
    number: prData.number,
    head,
    base: input.base,
    owner: parsed.owner,
    repo: parsed.repo,
  };
}
