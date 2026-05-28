# Rocky — Agentic-assisted engineering for teams and solo devs 

[![Rocky hero](public/rocky.png)](https://github.com/hellozheat/rocky)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)
[![MCP Endpoint](https://img.shields.io/badge/MCP-userocky.zheat.xyz%2Fmcp-1f6feb?style=for-the-badge)](https://userocky.zheat.xyz/mcp)
[![Inspector](https://img.shields.io/badge/Inspector-Live-0ea5e9?style=for-the-badge)](https://userocky.zheat.xyz/inspector)

[Rocky](https://github.com/hellozheat/rocky) is an MCP server for AI-assisted engineering workflows. It gives your assistant a shared handbook (agents + rules), one `devkit` gateway tool, and a pre-PR quality gate so outputs are reviewable before opening a pull request.

Rocky is **agentic-assisted**, not autonomous: your model still writes code in your repo, and Rocky provides the standards, routing, and checks.

## 🚀 Quick connect

**MCP endpoint:** `https://userocky.zheat.xyz/mcp`  
**Inspector:** [https://userocky.zheat.xyz/inspector](https://userocky.zheat.xyz/inspector)

### Claude Code

```bash
claude mcp add --transport http "rocky" https://userocky.zheat.xyz/mcp
```

### Cursor

Add to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "rocky": {
      "url": "https://userocky.zheat.xyz/mcp"
    }
  }
}
```

### VS Code / VS Code Insiders / ChatGPT

- Open [userocky.zheat.xyz/mcp](https://userocky.zheat.xyz/mcp) and use one-click client buttons, or
- Add `https://userocky.zheat.xyz/mcp` manually in your MCP connector settings.

## Why teams use Rocky

- **Pre-PR quality gate**: run lint, tests, and review heuristics before PR creation.
- **Token-efficient tooling**: one `devkit` gateway action contract instead of fragmented tools.
- **Codebase discovery first**: graphify-first flow, optional Understand Anything graph if present.
- **Consistent implementation style**: shared agents and rules exposed as MCP resources.
- **Safer repo operations**: path scoping via `DEVKIT_ALLOWED_REPO_ROOTS` and allowlisted command execution.

## Usage

Use natural language in your host app; the model calls `devkit` actions under the hood.

### Example prompt

```text
Use Rocky: read devkit://how-it-works, list_handbook, and the matching stack agent.
Implement changes directly in this repo, then run pre_pr_quality_gate before we finish.
Do not only call MCP tools without editing files.
```

### Typical flow

1. Discover conventions (`list_handbook`, stack-specific agent).
2. Implement in the repo (small, reviewable diffs).
3. Verify (`yarn lint:fix`, `yarn test`, `yarn build` in target project).
4. Gate (`pre_pr_quality_gate`) until verdict is `ready`.
5. Open PR (`repo_open_pr`) if needed.

## Integrations and clients

- **MCP hosts**: Cursor, Claude Code/Desktop, VS Code, VS Code Insiders, ChatGPT (Developer Mode).
- **Inspector**: built-in interactive MCP inspection at `/inspector`.
- **Team workflow**: works with existing repo conventions, CI, and review processes.

## Local development

```bash
git clone https://github.com/hellozheat/rocky.git
cd rocky
yarn install
yarn dev
```

Build and verify:

```bash
yarn lint:fix
yarn test
yarn build
```

## Deploy

```bash
yarn install
yarn build
yarn deploy
```

Set production env vars from [`config/env.example`](config/env.example):

- `MCP_URL`
- `PORT`
- `DEVKIT_ALLOWED_REPO_ROOTS`
- `GITHUB_TOKEN` (only if using `repo_open_pr`)

## Documentation

- [Install and security](docs/INSTALL.md)
- [Senior workflow](docs/senior-workflow.md)
- [Using Rocky: value report](docs/using-mcp-devkit-report.md)
- [Token and cost breakdown](docs/token-cost-breakdown.md)
- [Architecture profiles](docs/architecture-profiles.md)
- [Why agents and skills are split](docs/why-agents-and-skills-are-split.md)

## Core concepts (quick reference)

- **Gateway model**: call `devkit` with an `action` for handbook, analysis, quality gate, and repo operations.
- **Discovery policy**: prefer Understand Anything graph when present, otherwise graphify artifacts, otherwise folder walkthrough.
- **Prompt resources**: `devkit-start-task`, `devkit-review-code`, `devkit-before-pr`, `devkit-learn-the-stack`.

For full action-level references and MCP resource details, use:

- `devkit://capabilities`
- `devkit://tool-composability`
- `devkit://path-scope-policy`

## Contributing

Contributions are welcome. Please open an issue or PR with clear scope and reproducible steps.

If your change affects behavior, include:

- before/after behavior summary,
- tests or rationale for test coverage,
- any handbook/rule updates needed for agent consistency.

## License

MIT