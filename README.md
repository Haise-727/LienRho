# LienRho

An agentic capital marketplace for supply-chain working capital — CSI ORIGIN
2026, Problem Statement 5.

**Start here:** [`docs/README.md`](docs/README.md) indexes the planning docs
in reading order. [`docs/06-implementation-plan.md`](docs/06-implementation-plan.md)
is the concrete one — what's already transferred and working, and what each
of the four of us can pick up right now.

## Status

`backend/` and `frontend/` are a verified-working transfer from an earlier
build (receivables decisioning) — infrastructure, auth, the risk model, the
agent scaffolding, and the deterministic-tool-boundary pattern carry over
directly. The actual marketplace — providers, offers, scoring, matching,
settlement — doesn't exist yet. See
[`docs/02-carryover-audit.md`](docs/02-carryover-audit.md) for the line-by-line
and [`docs/06-implementation-plan.md`](docs/06-implementation-plan.md) for
what's next.

## Quickstart

```bash
# Backend
cd backend
docker compose up -d
uv sync
uv run alembic upgrade head
uv run python -m app.ml_core.train    # trains the risk model; gitignored, run once
uv run uvicorn app.main:app --reload  # :8000

# Frontend
cd frontend
npm install
npm run dev                            # :3000
```

```bash
cd backend && uv run pytest -q   # expect 348 passed with Postgres up
```
