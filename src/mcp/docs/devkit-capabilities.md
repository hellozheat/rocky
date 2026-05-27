# MCP devkit — one tool

Use the **`devkit`** tool with a single `action` field. Users describe goals in chat; you choose `action` and parameters.

**Important:** Devkit does not replace coding. After `list_handbook`, read the relevant agent docs and **implement changes in the user’s workspace** (edit files, run tests). Use actions below for discovery, validation, and PR readiness. See `devkit://how-it-works`.


| action | When to use |
| ------ | ----------- |
| `list_handbook` | List team rules and agent docs (JSON with resource URIs) |
| `refresh_handbook` | Rescan rules/agents after files change |
| `project_intelligence` | Scripts, tsconfig, deps, git status for a repo |
| `safe_run` | Allowlisted shell command (git, node, yarn, graphify, …) |
| `dependency_advisor` | Flag risky dependency version specs |
| `change_scope_analyzer` | Suggest checks/tests for a changed file path |
| `pre_pr_quality_gate` | **Before PR:** lint, test, style heuristics → `ready` / `not_ready` |
| `web_release_notes` | Release-oriented commit summary |
| `web_incident_digest` | Incident signals from recent changes |
| `web_owner_lookup` | CODEOWNERS / git owners for a path |
| `test_gap_finder` | Changed sources missing nearby tests |
| `web_route_health` | Route-related change risk |
| `web_api_contract_watch` | API/schema drift signals |
| `web_perf_regression_hint` | Perf hotspot signals |
| `repo_status` | Branch + working tree summary |
| `repo_diff` | Git diff (staged/unstaged/range) |
| `repo_search` | Text search in repo |
| `repo_test` | Run yarn test with targeting |
| `repo_lint` | Run yarn lint |
| `repo_blame` | Git blame for line range |
| `repo_find_owner` | CODEOWNERS for a path |
| `repo_open_pr` | Open GitHub PR (needs `GITHUB_TOKEN`) |

Fetch resource `devkit://capabilities` for this map.
