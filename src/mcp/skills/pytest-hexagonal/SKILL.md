---
name: pytest-hexagonal
description: pytest + pytest-asyncio for FastAPI hexagonal apps — real repos/use cases, mock outbound adapters, async DB fixtures.
---

# pytest hexagonal (reference)

## Golden rule

- **Real**: repositories, use cases, domain entities (in-memory SQLite/Postgres test DB per repo)
- **Mock**: outbound adapters (`patch` / `AsyncMock` on email, Stripe, external HTTP)

## Layout

```
tests/unit/test_use_cases.py
tests/fixtures/external.py
tests/conftest.py              # db_session, app client
```

## conftest (async SQLite example)

```python
@pytest.fixture
async def db_session():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with AsyncSession(engine) as session:
        yield session
    # drop_all in teardown
```

## Use case test

```python
@patch("src.infrastructure.email.adapter.SendgridEmailAdapter.send", new_callable=AsyncMock)
async def test_creates_user(mock_send, db_session):
    repo = PostgresUserRepository(session=db_session)
    use_case = CreateUserUseCase(user_repository=repo)
    result = await use_case.execute(CreateUserRequest(...))
    assert result.email == "..."
    mock_send.assert_called_once()
```

## Never

- Fake repository that doesn’t match real SQLAlchemy behavior
- Import FastAPI/SQLAlchemy in domain tests

## Commands

```bash
uv run pytest tests/ -x -q
uv run pytest tests/unit/test_foo.py -v
uv run pytest --cov=src
```

## Related

- **`fastapi-hexagonal`** agent
- **`async-python-patterns`** skill
