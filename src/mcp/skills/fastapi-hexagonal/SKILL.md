---
name: fastapi-hexagonal
description: Hexagonal FastAPI/Python backend — domain/application/infrastructure, Pydantic V2, async I/O, DI, and review checklists.
---

# FastAPI hexagonal architecture (reference)

Load this skill for layer rules, Pydantic/FastAPI patterns, and checklists. The **`fastapi-hexagonal`** agent is the short playbook.

## Project structure

```
├── .github/workflows/
├── src/
│   ├── main.py
│   ├── config.py               # Pydantic Settings
│   ├── dependencies.py         # DI factories
│   ├── domain/
│   │   ├── entities/           # Pydantic models (no FastAPI/SQLAlchemy)
│   │   ├── ports/              # ABC interfaces
│   │   └── services/           # Optional domain services
│   ├── application/
│   │   ├── requests/
│   │   ├── responses/          # Only when API shape differs from domain
│   │   ├── use_cases/
│   │   └── routes/
│   └── infrastructure/         # postgres/, mongodb/, email/ — adapter.py (+ models.py)
```

## Core principles

### Hexagonal

- **Domain**: Zero framework imports
- **Application**: Use cases orchestrate; routes stay thin
- **Infrastructure**: Adapters implement ports

### SOLID & KISS

- One use case = one action; heavy logic in domain **services** when needed
- Use cases depend on ports (ABC), not adapters
- `User(**model.model_dump())` or `model_validate(..., from_attributes=True)` — no `from_entity` / `to_entity`
- Return domain entities from routes when possible (FastAPI serializes)
- One entity per file; one file per concept

## Code rules

### Python

- Python 3.11+; type hints everywhere
- Async I/O for DB, HTTP, files
- ABC for ports (not `Protocol` per project standard)
- Domain exceptions hierarchy; Google-style docstrings on public APIs
- Dependency manager: **UV** (match repo if different)
- No mutable default args; prefer comprehensions when clear

### FastAPI

- `Depends()` / `Annotated[..., Depends(...)]` for use cases and ports
- Pydantic V2 `Field` validators; explicit `status.HTTP_*`
- `APIRouter` per resource; consistent error handlers
- Security: JWT/OAuth2, bcrypt, CORS, rate limits as required
- `lifespan` for DB pool startup/shutdown; middleware for request IDs/logging

### Transformations

```python
# Good
user_entity = User(**user_model.model_dump())
db_user = UserModel.model_validate(user_entity, from_attributes=True)

# Bad
user_entity = User.from_model(user_model)
```

### Testing

- Real internal wiring; mock **outbound** only
- See agent **`test-writer-python.md`**
- Skill **`async-python-patterns`** for async/concurrency patterns

## Checklist

- [ ] Three layers; domain has no FastAPI/SQLAlchemy imports
- [ ] Use cases depend on ABC ports
- [ ] Type hints + async I/O; Pydantic at boundaries
- [ ] CI, Docker, `.env.example` when applicable

## Avoid

- FastAPI/SQLAlchemy in `domain/`
- Extra response DTOs when domain models suffice
- `from_entity` / `to_entity` helpers; over-wide ports
- `__init__.py` re-export barrels (per project standard)
- `Protocol` instead of ABC for ports

## Related

- **`async-python-patterns`** — async tasks, concurrency
- **`test-writer-python`** agent — pytest patterns
- **`linter`** / **`sonarfix`** skills — quality gate in CI
