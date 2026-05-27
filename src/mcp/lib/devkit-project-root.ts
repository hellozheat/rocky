import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const EXT = new Set([".md", ".mdc"]);

export function filterHandbookFileNames(names: string[]): string[] {
  return names
    .filter((n) => !n.startsWith(".") && EXT.has(extname(n).toLowerCase()))
    .sort();
}

function listHandbookFileNamesSync(dirPath: string): string[] {
  if (!existsSync(dirPath)) {
    return [];
  }
  try {
    return filterHandbookFileNames(readdirSync(dirPath));
  } catch {
    return [];
  }
}

function* walkAncestorDirs(start: string): Generator<string, void, undefined> {
  let dir = start;
  for (;;) {
    yield dir;
    const parent = dirname(dir);
    if (parent === dir) {
      return;
    }
    dir = parent;
  }
}

function everyAgentDocReadable(agentsDir: string): boolean {
  const names = listHandbookFileNamesSync(agentsDir);
  for (const fileName of names) {
    try {
      readFileSync(join(agentsDir, fileName), "utf8");
    } catch {
      return false;
    }
  }
  return true;
}

function projectRootFromThisModule(): string {
  const start = dirname(fileURLToPath(import.meta.url));
  for (const dir of walkAncestorDirs(start)) {
    const pkg = join(dir, "package.json");
    const agentsDir = join(dir, "src", "mcp", "agents");
    if (!existsSync(pkg) || !existsSync(agentsDir)) {
      continue;
    }
    if (!everyAgentDocReadable(agentsDir)) {
      continue;
    }
    return dir;
  }
  return process.cwd();
}

/** MCP server / handbook root. Honors `DEVKIT_HANDBOOK_ROOT`. */
export function getDevkitProjectRoot(): string {
  const env = process.env.DEVKIT_HANDBOOK_ROOT?.trim();
  if (env) {
    return resolve(env);
  }
  return projectRootFromThisModule();
}
