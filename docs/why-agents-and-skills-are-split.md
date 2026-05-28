# Why agents and skills are split

This doc explains **how the devkit handbook is built** — not whether MCP saves tokens on your app repo. For that, see [Using Rocky — value report](./using-mcp-devkit-report.md).

## The idea in one sentence

**Agents are the short front door; skills are the deep reference you load only when the task needs templates or long checklists.**

## How agents are built

Handbook agents under `src/mcp/agents/` come from two sources:

1. **Devkit-native playbooks** — discovery (`codebase-discovery`), quality gate (`pr-quality-gate`), graphify onboarding, stack-specific implementers (`nextjs-developer`, `node-api-developer`, …).
2. **ai-driven playbooks** — hexagonal implementers and test writers (`react-hexagonal`, `nestjs-hexagonal`, `fastapi-hexagonal`, `vitest-writer`, …), aligned with the [ai-driven](https://github.com/hellozheat/ai-driven) agent set.

Every agent shares the same skeleton:

| Section | Purpose |
|---------|---------|
| Frontmatter | `name`, `description`, optional `skills: …` |
| Local project graph | graphify + optional Understand Anything — same policy everywhere |
| Do / Don’t | What to enforce on this task |
| Deep reference | Pointer to skill(s) or sibling agents |
| When invoked | Short checklist |

Agents are registered as MCP resources (`devkit://handbook/agents/…`) and listed via `devkit` → `list_handbook`.

## Why we split agents and skills

| If everything lived in the agent file | What happens |
|---------------------------------------|--------------|
| Long templates (Vitest, Jest, Playwright, hexagonal checklists) | Every invoke loads **thousands of tokens** before the model reads **your** code |
| Duplicate agents (`vitest-writer` + `test-writer-react`) | Two front doors, drift, wasted context |
| Prompt dumps all handbook URIs | Model treats the index as a reading list |

| With agent + skill split | What happens |
|--------------------------|--------------|
| Agent ~40–60 lines | Role, discovery, routing — fits in one glance |
| Skill `src/mcp/skills/*/SKILL.md` | Examples and checklists load **only when needed** |
| One React test agent (`vitest-writer`) + `vitest-react` skill | Single entry point for Vitest/RTL |

**Rule of thumb:** ~**1,244 lines** across **24 agents** on disk; a disciplined session reads **~4k–6k tokens** of handbook, not the whole corpus.

## Skill layer (depth)

Skills hold implementation depth that does not belong in every turn:

| Skill | Used by |
|-------|---------|
| `react-hexagonal` | `react-hexagonal` agent |
| `vitest-react` | `vitest-writer` |
| `jest-nestjs` | `test-writer-nestjs` |
| `pytest-hexagonal` | `test-writer-python` |
| `playwright-e2e` | `playwright-writer` |
| `nextjs-app-router` | `nextjs-developer` |
| `node-api-layered` | `node-api-developer` |
| … | See `src/mcp/skills/` |

Frontmatter `skills: foo` tells the host the skill exists; it is **not** automatically pasted into context unless the workflow attaches it.

## Prompts and routing

`devkit-start-task` uses a **router table** (task area → agent + rules) and a cap: **read at most 2–3 handbook resources**. It does **not** embed all 37 rule/agent URIs — that duplicated `list_handbook` and encouraged over-reading.

`devkit-review-code` points to exactly three resources: `code-reviewer`, `human-readable-code`, `tests`.

## Where things live

| Path | Role |
|------|------|
| `src/mcp/agents/` | Short MCP handbook agents |
| `src/mcp/skills/` | Deep skills (Cursor + devkit) |
| `src/mcp/rules/` | Team rules (`.mdc`) |
| `index.ts` | `HANDBOOK_ROUTER_BLOCK`, prompts |

## References

- [Using Rocky — value report](./using-mcp-devkit-report.md)
- [Token & cost breakdown](./token-cost-breakdown.md)
- `devkit://how-it-works`
