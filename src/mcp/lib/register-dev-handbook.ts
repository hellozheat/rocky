import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";

import type { MCPServer } from "mcp-use/server";
import { text } from "mcp-use/server";
import { z } from "zod";

import type { DevHandbookEntry, DevHandbookIndex } from "./dev-handbook-types.js";
import {
  filterHandbookFileNames,
  getDevkitProjectRoot,
} from "./devkit-project-root.js";

function toMcpName(prefix: "rule" | "agent", fileName: string): string {
  const base = fileName.replace(/\.(md|mdc)$/i, "");
  const safe = base.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `dev-handbook-${prefix}-${safe}`.toLowerCase();
}

function toUri(kind: "rule" | "agent", fileName: string): string {
  const seg = kind === "rule" ? "rules" : "agents";
  return `devkit://handbook/${seg}/${fileName}`;
}

function describeHandbook(
  kind: "rule" | "agent",
  fileName: string,
): string {
  const label = kind === "rule" ? "Shared team rule" : "Shared team agent / prompt spec";
  return `${label} (${fileName}) — for all developers; read via MCP resources.`;
}

async function safeReadDir(
  dir: string,
): Promise<string[]> {
  try {
    const s = await stat(dir);
    if (!s.isDirectory()) {
      return [];
    }
  } catch {
    return [];
  }
  const names = await readdir(dir);
  return filterHandbookFileNames(names);
}

let cachedIndex: DevHandbookIndex | null = null;
let handbookRoot = "";
const registeredUris = new Set<string>();

function sortEntries(entries: DevHandbookEntry[]): DevHandbookEntry[] {
  return [...entries].sort((a, b) => a.fileName.localeCompare(b.fileName));
}

async function scanDevHandbook(root: string): Promise<DevHandbookIndex> {
  const rulesDir = join(root, "src", "mcp", "rules");
  const agentsDir = join(root, "src", "mcp", "agents");
  const [ruleNames, agentNames] = await Promise.all([
    safeReadDir(rulesDir),
    safeReadDir(agentsDir),
  ]);

  const rules: DevHandbookEntry[] = ruleNames.map((fileName) => {
    const mcpResourceName = toMcpName("rule", fileName);
    return {
      kind: "rule",
      fileName,
      resourceUri: toUri("rule", fileName),
      mcpResourceName,
      description: describeHandbook("rule", fileName),
    } satisfies DevHandbookEntry;
  });

  const agents: DevHandbookEntry[] = agentNames.map((fileName) => {
    const mcpResourceName = toMcpName("agent", fileName);
    return {
      kind: "agent",
      fileName,
      resourceUri: toUri("agent", fileName),
      mcpResourceName,
      description: describeHandbook("agent", fileName),
    } satisfies DevHandbookEntry;
  });

  return {
    rules: sortEntries(rules),
    agents: sortEntries(agents),
    root,
  };
}

function registerEntryResource(
  server: MCPServer,
  root: string,
  entry: DevHandbookEntry,
): void {
  if (registeredUris.has(entry.resourceUri)) {
    return;
  }
  const path = join(
    root,
    "src",
    "mcp",
    entry.kind === "rule" ? "rules" : "agents",
    entry.fileName,
  );
  server.resource(
    {
      name: entry.mcpResourceName,
      uri: entry.resourceUri,
      description: entry.description,
    },
    async () => {
      const body = await readFile(path, "utf8");
      return text(body);
    },
  );
  registeredUris.add(entry.resourceUri);
}

async function refreshDevHandbook(server: MCPServer): Promise<{
  addedRules: number;
  addedAgents: number;
  totalRules: number;
  totalAgents: number;
}> {
  const root = handbookRoot || getDevkitProjectRoot();
  const nextIndex = await scanDevHandbook(root);

  const prevRuleUris = new Set(cachedIndex?.rules.map((e) => e.resourceUri) ?? []);
  const prevAgentUris = new Set(cachedIndex?.agents.map((e) => e.resourceUri) ?? []);

  for (const entry of nextIndex.rules) {
    registerEntryResource(server, root, entry);
  }
  for (const entry of nextIndex.agents) {
    registerEntryResource(server, root, entry);
  }

  cachedIndex = nextIndex;
  handbookRoot = root;

  const addedRules = nextIndex.rules.filter((e) => !prevRuleUris.has(e.resourceUri)).length;
  const addedAgents = nextIndex.agents.filter((e) => !prevAgentUris.has(e.resourceUri)).length;

  return {
    addedRules,
    addedAgents,
    totalRules: nextIndex.rules.length,
    totalAgents: nextIndex.agents.length,
  };
}

/**
 * Scans `src/mcp/rules` and `src/mcp/agents` and registers one MCP resource per file.
 * List/refresh is exposed only via the unified `devkit` tool (actions list_handbook / refresh_handbook).
 * Resource URIs: `devkit://handbook/rules/...` and `devkit://handbook/agents/...`.
 */
export async function registerDevHandbook(server: MCPServer): Promise<void> {
  const first = await refreshDevHandbook(server);
  console.log(`[devkit] Dev handbook root: ${handbookRoot}`);
  if (first.totalRules === 0 && first.totalAgents === 0) {
    console.warn(
      `[devkit] Dev handbook: no .md/.mdc files under src/mcp/rules or src/mcp/agents (expected under root above). Set DEVKIT_HANDBOOK_ROOT if files live elsewhere.`,
    );
  } else {
    console.log(
      `[devkit] Dev handbook: ${first.totalRules} rules, ${first.totalAgents} agent docs registered as resources`,
    );
  }
}

/** Handlers for list/refresh handbook — use via the `devkit` MCP tool. */
export function createHandbookToolHandlers(server: MCPServer): {
  list: () => ReturnType<typeof text>;
  refresh: () => Promise<ReturnType<typeof text>>;
} {
  return {
    list: () => text(formatDevHandbookListJson()),
    refresh: async () => {
      const result = await refreshDevHandbook(server);
      return text(
        JSON.stringify(
          {
            ok: true,
            summary: `Added ${result.addedRules} rule(s), ${result.addedAgents} agent doc(s).`,
            totals: {
              rules: result.totalRules,
              agents: result.totalAgents,
            },
          },
          null,
          2,
        ),
      );
    },
  };
}

/** Backward-compatible standalone tools for direct Inspector testing. */
export function registerHandbookTools(server: MCPServer): void {
  const handlers = createHandbookToolHandlers(server);
  server.tool(
    {
      name: "list-dev-handbook",
      description:
        "List all shared team rules and agent/prompt docs with MCP resource URIs (source: src/mcp/rules and src/mcp/agents).",
      schema: z.object({}),
    },
    async () => handlers.list(),
  );
  server.tool(
    {
      name: "refresh-dev-handbook",
      description:
        "Rescan src/mcp/rules and src/mcp/agents and register newly added docs as MCP resources without restart.",
      schema: z.object({}),
    },
    async () => handlers.refresh(),
  );
}

/** Shape of `createHandbookToolHandlers` — use for typing (e.g. `registerDevkitGateway`). */
export type HandbookToolHandlers = ReturnType<typeof createHandbookToolHandlers>;

/**
 * Synchronous read of last computed index (after `registerDevHandbook`). Empty if not registered.
 */
export function getDevHandbookIndex(): DevHandbookIndex | null {
  return cachedIndex;
}

/**
 * Exposed as MCP tool; uses cached index from registration.
 */
export function formatDevHandbookListJson(): string {
  if (!cachedIndex) {
    return JSON.stringify(
      { error: "Handbook not loaded yet" },
      null,
      2,
    );
  }
  return JSON.stringify(cachedIndex, null, 2);
}
