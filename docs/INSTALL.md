# Install & security (hosted)

Source: [hellozheat/mcp-devkit](https://github.com/hellozheat/mcp-devkit)

## Requirements

- Node.js **20+** on the deploy host
- Yarn
- Optional on **user machines**: [graphify](https://github.com) CLI; [Understand Anything](https://github.com/Lum1104/Understand-Anything) plugin (`devkit://understand-anything-workflow`)

## Deploy

```bash
yarn install
yarn build
yarn deploy
```

Set `MCP_URL` to the public HTTPS origin clients will use.

## Environment

| Variable | Purpose |
|----------|---------|
| `PORT` / `MCP_URL` | HTTP server |
| `DEVKIT_HANDBOOK_ROOT` | Override handbook root if needed |
| `DEVKIT_ALLOWED_REPO_ROOTS` | Comma-separated path allowlist for repo/dev tools on the server |
| `GITHUB_TOKEN` | Only if the server should run `repo_open_pr` |

## Security checklist (production)

- **No MCP login** — devkit does not gate `/mcp` with user authentication. Protect a public URL with your own reverse proxy or network controls if needed.
- **Never commit** `.env` or tokens.
- Prefer **handbook-only** public hosting: no `GITHUB_TOKEN`, no broad `DEVKIT_ALLOWED_REPO_ROOTS`, unless you add your own auth in front of the URL.
- If repo tools are enabled on the server, set **`DEVKIT_ALLOWED_REPO_ROOTS`** to the smallest set of git roots required.
- **`safe-run`**: allowlisted commands only (`git`, `yarn`, `eslint`, `graphify`, etc.) — not a general shell.

## Clients

Connect MCP hosts to your deployed URL (see [README](../README.md#use-the-hosted-server)). Use `yarn dev` or `yarn start` only when developing or running the server on your host.
