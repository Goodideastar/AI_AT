# AGENTS.md

Workspace instructions for ZCode agents working in `G:\AI_AT`.

## Project overview

**AI_AT** is a user-authentication backend for the "AT" project, built with FastAPI.
It currently exposes registration, login, logout, and account-deletion endpoints, with
email verification codes, JWT session tokens, bcrypt password hashing, Redis-backed rate
limiting, and MySQL storage. A LangChain/LangGraph agent layer is scaffolded but commented
out in `backend/main.py` (not yet active).

- `backend/` — Python FastAPI service (the active part of the repo).
- `frontend/` — empty placeholder; no UI has been written yet.
- `backend/api/` — FastAPI routers, all mounted under the `/api` prefix.
- `backend/config/` — SQLAlchemy engine/session factory and Redis client.
- `backend/models/` — SQLAlchemy ORM models.
- `backend/security/` — JWT issuance and the `JWTBearer` auth dependency.
- `backend/service/` — business logic (currently email verify-code generation/sending).
- `backend/database/` — raw SQL schema (`schema.sql`); the app uses the ORM, not this file, at runtime.
- `backend/utils/` — empty; reserved.

## Stack

- Python 3.13 (interpreter on this machine).
- FastAPI 0.115, Pydantic 2.9, SQLAlchemy 2.0, PyMySQL 1.2, redis 5.2, PyJWT 2.13, bcrypt 5.0, python-dotenv.
- MySQL 8 (`ATDB` database) and Redis are reached over the network at the IPs in `backend/.env`.
- LangChain/LangGraph + `langchain_openai.ChatOpenAI` are intended for the future agent layer (currently commented out).

## Running

Run from the `backend/` directory (modules import each other as top-level packages, e.g. `from config.redis import redis_client`, so the working directory must be `backend/`):

```bash
cd backend
python main.py            # uvicorn on 0.0.0.0:8000, reload=True
```

`main.py` calls `load_dotenv()` first, then reads config from `backend/.env`.

## Dependencies / environment

- There is **no** `requirements.txt`, `pyproject.toml`, or lockfile yet — dependencies are only the packages installed in the global interpreter. If you add a dependency, also add it to a manifest (do not assume a future agent will know to install it).
- `backend/.env` holds live secrets (DB password, Redis password, `SECRET_KEY`, SMTP authorization code). It is **gitignored** (`.gitignore` contains `backend/.env`) — never commit it, and never paste its values into commits/PRs/logs.
- Required env vars (all read via `os.getenv`): `DB_URL`, `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `SECRET_KEY`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`. Optional: `ACCESS_TOKEN_EXPIRE_MINUTES` (default `30`).
- Several modules raise at import time if a required env var is missing (e.g. `config/sqlalchemy.py`, `security/jwt.py`), so `main.py` will not start without a populated `.env`.

## Architecture & layer rules

- **Layering:** `api/` (HTTP routers) → `service/` (logic) → `models/` + `config/` (data) → `security/` (auth). Routers should stay thin; push logic into `service/`.
- **All routers are mounted under `/api`** in `main.py` via `app.include_router(..., prefix="/api")`. Endpoints resolve to `/api/login`, `/api/register`, `/api/send_verify_code`, `/api/logout`, `/api/destroy`.
- **Auth:** `app = FastAPI(authentication_scheme=JWTBearer())`. Protected endpoints take `credentials: HTTPAuthorizationCredentials = Depends(JWTBearer())`.
- **Session/token model (important):** A token is valid only if it is *both* a well-formed JWT and present in Redis. `JWTBearer.__call__` checks Redis first, then decodes the JWT. Login/register store the issued token in Redis with `ex=ACCESS_TOKEN_EXPIRE_MINUTES * 60`. Logout/destroy delete the token from Redis. To revoke a session, delete its token from Redis — do not rely on JWT expiry alone.
- **DB sessions:** Open a `SessionLocal()` inside the handler, use a `try/finally` that calls `session.close()`. There is no shared dependency for the DB session yet.
- **Rate limiting** is implemented manually with Redis `INCR`/`EXPIRE` keys (login attempts, register, send-code). Keep this pattern when adding throttled endpoints; keys are namespaced like `login_attempts:<user>`, `rate_limit:register:<user>`, `rate_limit:send_code:<email>`.

## Conventions

- Language: code comments, log messages, and HTTP `detail` strings are in **Chinese**. Match this when editing existing code.
- Logging: Python `logging` with `logging.basicConfig` set in `main.py`; modules use `logger = logging.getLogger(__name__)`. Prefer `logger.info/warning/error` over `print`.
- Imports are absolute top-level (e.g. `from config.redis import redis_client`), which is why the app must be run from `backend/`.
- Passwords: always `bcrypt.hashpw(..., gensalt(rounds=12))` before storing, `bcrypt.checkpw` to verify. Never store or log plaintext passwords.
- Validation order in `register.py` is deliberate: rate-limit → verify code → format checks → DB uniqueness → insert. Preserve this order to avoid leaking which accounts exist.

## Gotchas

- `service/verify_code.py::verify_verify_code_expire` calls `stored_verify_code.decode("utf-8")` on the Redis value, but the Redis client is created with `decode_responses=True`, so values are already `str`. This function will raise `AttributeError` if ever called — it is currently unused. Be aware before wiring it up.
- `frontend/` is empty — there is no frontend build, lint, or test command yet.
- The repo currently has **no tests** and no lint/type-check configuration.
- Git is on `master` with no commits yet; only `.gitignore` and `backend/` are tracked-eligible (`.env` excluded).
