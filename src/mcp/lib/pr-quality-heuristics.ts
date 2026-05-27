import { existsSync } from "node:fs";
import { join } from "node:path";

const SOURCE_EXT = /\.(tsx?|jsx?|vue|svelte)$/i;
const TEST_PATTERN = /\.(test|spec)\.(tsx?|jsx?)$/i;
const LOCK_OR_CONFIG =
  /^(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|\.github\/|.*\.md$|.*\.json$)/i;

export function filterReviewableChangedFiles(files: string[]): string[] {
  return files.filter((f) => {
    if (!f.trim() || LOCK_OR_CONFIG.test(f)) {
      return false;
    }
    return SOURCE_EXT.test(f);
  });
}

export function runStyleHeuristics(params: {
  repoRoot: string;
  changedFiles: string[];
  diffExcerpt: string;
  packageJson: Record<string, unknown> | null;
}): string[] {
  const warnings: string[] = [];
  const { repoRoot, changedFiles, diffExcerpt, packageJson } = params;
  const deps = {
    ...(packageJson?.dependencies as Record<string, string> | undefined),
    ...(packageJson?.devDependencies as Record<string, string> | undefined),
  };
  const hasLodash =
    Boolean(deps.lodash) || Boolean(deps["lodash-es"]) || Boolean(deps.lodash_es);
  const diffUsesLodash = /\blodash(-es)?\b|from ['"]lodash/.test(diffExcerpt);
  const sourceFiles = filterReviewableChangedFiles(changedFiles);

  if (hasLodash && sourceFiles.length > 0 && !diffUsesLodash) {
    warnings.push(
      "Repo depends on lodash but the diff does not import it — match collection/get patterns from neighbor files.",
    );
  }

  const utilsDir = join(repoRoot, "src", "utils");
  if (existsSync(utilsDir) && /^\+\s*export function/m.test(diffExcerpt)) {
    warnings.push(
      "Diff adds new exported helpers — check src/utils (or shared packages) before duplicating utilities.",
    );
  }

  const behaviorSources = sourceFiles.filter((f) => !TEST_PATTERN.test(f));
  const touchedTests = changedFiles.some((f) => TEST_PATTERN.test(f));
  if (behaviorSources.length > 0 && !touchedTests) {
    warnings.push(
      "Source files changed without test file updates — add or extend tests for behavior you changed.",
    );
  }

  const commentAdds = (diffExcerpt.match(/^\+\s*\/\//gm) ?? []).length;
  if (commentAdds > 12) {
    warnings.push(
      "Many new line comments in diff — remove noise comments reviewers flag as AI slop.",
    );
  }

  return warnings;
}
