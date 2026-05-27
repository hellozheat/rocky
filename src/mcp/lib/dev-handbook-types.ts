/** One shared rule or agent file exposed as an MCP resource + listed via devkit (action list_handbook). */
export interface DevHandbookEntry {
  kind: "rule" | "agent";
  fileName: string;
  resourceUri: string;
  mcpResourceName: string;
  description: string;
}

export interface DevHandbookIndex {
  rules: DevHandbookEntry[];
  agents: DevHandbookEntry[];
  root: string;
}
