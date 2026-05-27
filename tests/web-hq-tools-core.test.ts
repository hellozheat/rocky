import { describe, expect, it } from "vitest";

import { matchCodeowners, requireRelativePath } from "../src/mcp/lib/web-hq-tools-core.js";

describe("web-hq-tools-core", () => {
  it("rejects absolute and traversal target paths", () => {
    expect(() => requireRelativePath("/tmp/file.ts")).toThrow(/relative/);
    expect(() => requireRelativePath("../escape.ts")).toThrow(/outside/);
  });

  it("matches deepest CODEOWNERS rule", () => {
    const content = `
* @org/all
/apps/ @org/web
/apps/web-hq/ @org/web-hq
    `.trim();
    const owners = matchCodeowners(content, "apps/web-hq/src/page.tsx");
    expect(owners).toEqual(["@org/web-hq"]);
  });
});
