Date created: August 26, 2026
Date last modified: August 26, 2026 (implementation complete — deployed and verified)

# Register, Login, and Logout - Technical PRD

## Overview/Problem

The Greenfield Quiz Maker application will allow multiple teachers to collaborate on building a shared test bank of multiple-choice questions. Before any quiz content can be created, teachers need individual accounts so the system can distinguish one user from another.

**This sprint delivered** the foundational identity layer: a D1 `users` table, user service, register/login/logout HTTP endpoints, shadcn/ui auth pages, and an MCQ workspace stub. The feature was built test-first (Vitest, 49 tests), verified locally and on Workers preview, deployed to Cloudflare, and manually confirmed by the product owner (register, login, logout flows).

---

## Hypothesis

We believe that providing basic username-and-password registration and login will let multiple teachers create accounts and reach a shared workspace stub, establishing the identity foundation required for collaborative MCQ authoring in a later sprint.

**Outcome:** Hypothesis validated — teachers can register, log in, reach `/mcq`, and log out via the deployed application.

---

## Implementation Record

Complete summary of what was built, where it lives, and how it was verified.

### Architecture (request flow)

```
Browser (SignupForm / LoginForm)
  → hashPasswordClient()          [src/lib/password-client.ts]
  → POST /api/auth/register|login [src/app/api/auth/*/route.ts]
  → registerSchema | loginSchema  [src/lib/validators/auth.ts]
  → createUserService(env.DB)     [src/lib/services/user-service.ts]
  → D1 users table                [migrations/0001_create_users_table.sql]
  → JSON response (no password fields)
  → router.push("/mcq")           [src/components/signup-form.tsx, login-form.tsx]

LogoutButton
  → POST /api/auth/logout         [src/app/api/auth/logout/route.ts]
  → router.push("/login")         [src/components/logout-button.tsx]
```

### Environments

| Environment | URL / command | D1 | Notes |
|-------------|---------------|-----|-------|
| Local dev (UI only) | `npm run dev` → `http://localhost:3000` | Not bound on Node | Pages render; API calls need preview for full auth |
| Workers preview | `npm run preview` → `http://127.0.0.1:8787` | Local D1 (`--local`) | Full auth stack on Workers runtime |
| **Production** | **https://ai-spints-quizmaker.aishwarya-ai.workers.dev** | Remote D1 `quizmaker-db` | Deployed via `npm run deploy` |

### Cloudflare resources

| Resource | Value |
|----------|-------|
| Worker name | `ai-spints-quizmaker` |
| D1 database | `quizmaker-db` |
| D1 database ID | `3e553b1b-917c-400f-be7e-9d8075d94976` |
| D1 binding | `DB` in `wrangler.jsonc:21-27` |
| Production URL | https://ai-spints-quizmaker.aishwarya-ai.workers.dev |

### npm scripts added or used

| Script | Command | Purpose |
|--------|---------|---------|
| `test` | `vitest run` | 49 unit/component tests |
| `test:watch` | `vitest` | TDD watch mode |
| `smoke:preview` | `node scripts/preview-smoke-test.mjs` | API smoke test (set `PREVIEW_URL` for production) |
| `deploy` | `opennextjs-cloudflare build && deploy` | Production deploy |
| `preview` | OpenNext + wrangler dev | Local Workers runtime |
| `cf-typegen` | Regenerates `cloudflare-env.d.ts` with `env.DB` |

### Manual verification (product owner — August 26, 2026)

Confirmed on **local** environment:

- [x] Navigate to home, register, and login pages
- [x] Register a new user → redirected to `/mcq` stub
- [x] Log in with registered credentials → redirected to `/mcq`
- [x] Log out from MCQ stub → returned to login flow

Automated verification additionally confirmed on **preview** and **production** (see Phase 5).

### Test suite summary

| Metric | Value |
|--------|-------|
| Test files | 12 |
| Tests | 49 (all passing) |
| Framework | Vitest + Testing Library + jest-dom |

---

## Scope

### In Scope

- **Cloudflare D1 database** with a `users` table (id, first name, last name, username, email, password hash, timestamps)
- **D1 migration** to create the `users` table and uniqueness constraints on username and email
- **User service** (`src/lib/services/user-service.ts`) with methods to create, read, update, and delete users, backed by prepared D1 statements
- **Password security**: client-side SHA-256 hash of the plaintext password before HTTP POST; server-side bcrypt hash of that value before storage; bcrypt comparison on login
- **API route handlers** (HTTP POST):
  - `POST /api/auth/register` — create a new user via the user service
  - `POST /api/auth/login` — validate credentials via the user service
  - `POST /api/auth/logout` — acknowledge logout (no server-side session to destroy)
- **UI pages** built with **shadcn/ui** (`Card`, `Field`, `Input`, `Button`) and client-side `fetch` to API routes:
  - `SignupForm` / `LoginForm` / `LogoutButton` in `src/components/` (adapted from shadcn signup/login blocks)
  - Thin App Router pages at `/`, `/register`, `/login`, `/mcq`
  - Registration and login form validation; MCQ stub with logout
- **Post-auth redirect**: successful register or login navigates the user to `/mcq`
- **Input validation** with Zod on all API route handler bodies
- **Wrangler D1 binding** (`DB`) added to `wrangler.jsonc` and typed via `npm run cf-typegen`
- **Test-driven development with Vitest** — each implementation phase begins by writing failing tests (red), then implements until those tests pass (green), alongside the acceptance criteria for that phase

### Out of Scope

- Social login (Google, GitHub, etc.)
- JWT, API tokens, or any token-based auth
- Session management: cookies, server-side sessions, or "remember me"
- Route protection / auth middleware (any user can visit `/mcq` directly for now)
- Password reset or email verification
- User profile editing UI (update/delete exist on the service only)
- MCQ creation, editing, listing, or collaboration features
- Role-based access control (admin vs teacher)
- Rate limiting or CAPTCHA
- End-to-end browser tests (Playwright/Cypress) — manual smoke test in Phase 5 only
- `@cloudflare/vitest-pool-workers` real Workers runtime tests — unit tests mock D1 instead

### Cut

- **Server Actions instead of API routes** — project conventions prefer Server Actions for forms, but this sprint explicitly calls for HTTP POST endpoints to establish a REST-style auth API pattern for later phases.
- **Plaintext password over HTTPS only (no client hash)** — client-side pre-hashing was requested to avoid sending raw passwords in request bodies; HTTPS remains assumed for transport security regardless.
- **OAuth / magic-link email login** — unnecessary complexity for a teaching sprint focused on fundamentals.
- **Persistent login state** — deferred until a session or token strategy is chosen in a future sprint; logout is therefore a client-side navigation with no server state to clear.

---

## Technical Requirements

### Database Schema

Database name (suggested): `quizmaker-db`  
Binding name: `DB` (per project D1 conventions)

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_username ON users (username);
CREATE INDEX idx_users_email ON users (email);
```

**Column notes:**

| Column | Type | Notes |
|--------|------|-------|
| `id` | TEXT PK | Random 16-byte hex string |
| `first_name` | TEXT NOT NULL | Display name component |
| `last_name` | TEXT NOT NULL | Display name component |
| `username` | TEXT NOT NULL UNIQUE | Login identifier; may equal email |
| `email` | TEXT NOT NULL UNIQUE | Contact / alternate login identifier |
| `password_hash` | TEXT NOT NULL | bcrypt hash of the client SHA-256 digest |
| `created_at` | DATETIME | Set on insert |
| `updated_at` | DATETIME | Set on insert and update |

**Migration workflow:**

1. `npx wrangler d1 create quizmaker-db` — **done** (APAC region)
2. Add `d1_databases` block to `wrangler.jsonc` with binding `DB` — **done** (`wrangler.jsonc:21-27`)
3. `npx wrangler d1 migrations create quizmaker-db create_users_table` — **done**
4. SQL in `migrations/0001_create_users_table.sql` — **done**
5. Apply locally: `npx wrangler d1 migrations apply quizmaker-db --local` — **done**
6. Apply remote (production deploy): `npx wrangler d1 migrations apply quizmaker-db --remote` — **done** (August 26, 2026)
7. Run `npm run cf-typegen` — **done** (`env.DB: D1Database` in `cloudflare-env.d.ts`)

---

### API Endpoints

All auth endpoints accept and return JSON. Password fields in request bodies carry the **client SHA-256 hex digest**, never the plaintext password.

#### POST /api/auth/register

Creates a new user through the user service.

**Request Body:**

```json
{
  "firstName": "Jane",
  "lastName": "Smith",
  "username": "jsmith",
  "email": "jsmith@school.edu",
  "passwordHash": "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3"
}
```

**Responses:**

| Status | Body | Condition |
|--------|------|-----------|
| 201 | `{ "success": true, "user": { "id", "firstName", "lastName", "username", "email" } }` | User created |
| 400 | `{ "error": "Validation failed", "details": [...] }` | Invalid or missing fields |
| 409 | `{ "error": "Username or email already exists" }` | Duplicate username/email |
| 500 | `{ "error": "Internal server error" }` | Unexpected failure |

**Server behavior:**

1. Validate body with Zod (`registerSchema` — `src/lib/validators/auth.ts:8-14`)
2. Call `userService.createUser(...)` with the client `passwordHash`
3. User service bcrypt-hashes the digest before INSERT (`user-service.ts:84-99`)
4. Return user object **without** `password_hash` (`user-service.ts:71-74`)

**Implementation:** `src/app/api/auth/register/route.ts:6-29`

---

#### POST /api/auth/login

Validates credentials through the user service.

**Request Body:**

```json
{
  "usernameOrEmail": "jsmith",
  "passwordHash": "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3"
}
```

`usernameOrEmail` accepts either the user's username or email address.

**Responses:**

| Status | Body | Condition |
|--------|------|-----------|
| 200 | `{ "success": true, "user": { "id", "firstName", "lastName", "username", "email" } }` | Credentials valid |
| 400 | `{ "error": "Validation failed", "details": [...] }` | Invalid or missing fields |
| 401 | `{ "error": "Invalid username or password" }` | No match or wrong password |
| 500 | `{ "error": "Internal server error" }` | Unexpected failure |

**Server behavior:**

1. Validate body with Zod (`loginSchema` — `src/lib/validators/auth.ts:16-19`)
2. Call `userService.findByUsernameOrEmail(usernameOrEmail)` (`user-service.ts:146-153`)
3. Call `userService.verifyPassword(storedHash, passwordHash)` (`user-service.ts:222-224`)
4. Return user object without password on success (`login/route.ts` strips `passwordHash`)

**Implementation:** `src/app/api/auth/login/route.ts:8-41`

---

#### POST /api/auth/logout

Acknowledges a logout request. Because there is no session or token state, this endpoint performs no server-side cleanup.

**Request Body:** none (or empty JSON `{}`)

**Responses:**

| Status | Body | Condition |
|--------|------|-----------|
| 200 | `{ "success": true }` | Always (no session to invalidate) |

**Client behavior:** on 200, navigate to `/login`. No cookies to clear.

**Implementation:** `src/app/api/auth/logout/route.ts:1-3`

---

### User Service

Location: `src/lib/services/user-service.ts`

Server-only module. Receives D1 binding from callers (route handlers obtain `env.DB` via `getCloudflareContext()`).

**Methods:**

| Method | Purpose |
|--------|---------|
| `createUser(input)` | Insert user; bcrypt-hash `passwordHash` before storage |
| `findById(id)` | Fetch user by primary key |
| `findByUsername(username)` | Fetch user by username |
| `findByEmail(email)` | Fetch user by email |
| `findByUsernameOrEmail(value)` | Lookup for login (try username, then email) |
| `updateUser(id, input)` | Update allowed fields; re-hash password if provided |
| `deleteUser(id)` | Remove user row |
| `verifyPassword(storedHash, clientPasswordHash)` | bcrypt compare |

**Query conventions** (per project D1 rules):

- Prepared statements with numbered placeholders (`?1`, `?2`)
- Never concatenate user input into SQL
- Use `all()` and read `results[0]` rather than `first()`

---

### Password Handling

Two-layer hashing keeps plaintext passwords out of request bodies and uses slow hashing at rest.

```
Registration / Login (client):
  plaintext password → SHA-256 → hex string → sent in JSON body as passwordHash

Registration (server):
  client passwordHash → bcrypt (cost factor 10–12) → stored in password_hash column

Login (server):
  client passwordHash → bcrypt.compare(clientHash, storedHash) → boolean
```

**Client utility:** `src/lib/password-client.ts` (`'use client'` safe — uses Web Crypto API)

```typescript
export async function hashPasswordClient(plaintext: string): Promise<string> {
  const encoded = new TextEncoder().encode(plaintext);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
```

**Server utility:** `src/lib/password-server.ts` (server-only)

Uses `bcryptjs` (pure JS, Workers-compatible with `nodejs_compat`) or an equivalent approved dependency.

---

### User Interface Requirements

All UI is built with **shadcn/ui** components on **Base UI** (`base-nova` style) and **Tailwind CSS v4** theme tokens. Interactive forms are **client components** (`'use client'`) colocated under `src/components/`; App Router pages under `src/app/` are thin server-component wrappers that provide layout only.

#### shadcn components used

| Component | Path | Used for |
|-----------|------|----------|
| `Button` | `@/components/ui/button` | Submit actions, home navigation, logout |
| `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent` | `@/components/ui/card` | Form shells, home hero, MCQ stub |
| `Field`, `FieldGroup`, `FieldLabel`, `FieldDescription`, `FieldError` | `@/components/ui/field` | Form layout and inline validation errors |
| `Input` | `@/components/ui/input` | Text, email, and password fields |

#### Component architecture

| Component | Path | Type | Role |
|-----------|------|------|------|
| `SignupForm` | `src/components/signup-form.tsx` | Client | Registration form + API wiring |
| `LoginForm` | `src/components/login-form.tsx` | Client | Login form + API wiring |
| `LogoutButton` | `src/components/logout-button.tsx` | Client | Logout POST + redirect |

Pages import these components:

```tsx
// src/app/register/page.tsx
import { SignupForm } from "@/components/signup-form";

export default function RegisterPage() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <SignupForm />
      </div>
    </div>
  );
}
```

Login page follows the same centered layout pattern with `<LoginForm />`.

#### Design source: shadcn blocks (adapted)

Phase 4 started from shadcn **signup** and **login** block templates. The following adaptations were made to align with PRD scope and data model:

| Block element | Adaptation |
|---------------|------------|
| Single "Full Name" field | Replaced with **First Name**, **Last Name**, and **Username** (PRD user model) |
| Login "Email" field only | Replaced with **Username or Email** (`usernameOrEmail`) |
| "Sign up with Google" / "Login with Google" buttons | **Removed** — social login out of scope |
| "Forgot your password?" link | **Removed** — password reset out of scope |
| `<a href="#">` navigation | Replaced with Next.js **`Link`** to `/login` and `/register` |
| Static `<form>` | Wired to **`onSubmit`** handlers: validate → `hashPasswordClient` → `fetch` → redirect |

#### Landing / Home (`/`)

- shadcn `Card` with app title and description
- **Register** and **Login** actions via `Button` + Next.js `Link` (`render` prop pattern from Base UI)
- Routes: `/register`, `/login`

#### Register Page (`/register`)

- **`SignupForm`** in centered `min-h-svh` layout (`max-w-sm`)
- **Fields:** First Name, Last Name, Username, Email, Password, Confirm Password
- **Client validation:**
  - All fields required (HTML + form read)
  - Password minimum length 8 characters checked **before** hashing
  - Confirm password must match password
- **Submit:** `hashPasswordClient(password)` → POST `/api/auth/register` with `{ firstName, lastName, username, email, passwordHash }`
- **Success:** `router.push("/mcq")`
- **Errors:** surfaced via shadcn `FieldError` (`role="alert"`)
- **Link:** "Already have an account? Sign in" → `/login`

#### Login Page (`/login`)

- **`LoginForm`** in centered layout (wraps inner `Card` with `cn()` flex column)
- **Fields:** Username or Email, Password
- **Client validation:** both fields required
- **Submit:** `hashPasswordClient(password)` → POST `/api/auth/login` with `{ usernameOrEmail, passwordHash }`
- **Success:** `router.push("/mcq")`
- **Errors:** generic "Invalid username or password" on 401 via `FieldError`
- **Link:** "Don't have an account? Sign up" → `/register`

#### MCQ Stub Page (`/mcq`)

- shadcn `Card` with heading **"MCQ Test Bank — Coming Soon"**
- Description: question authoring built in next sprint
- **`LogoutButton`**: POST `/api/auth/logout` → `router.push("/login")`
- No auth gate on this route in this sprint (direct navigation allowed)

#### Client auth flow (forms)

```
User submits form
  → client validation (length, password match)
  → passwordHash = await hashPasswordClient(plaintext)   // never sent over wire
  → fetch("/api/auth/register" | "/api/auth/login", { JSON body })
  → on success: router.push("/mcq")
  → on error: setError(message) → FieldError displays
```

---

## Test-Driven Development Approach

This feature is implemented **test-first** using **Vitest** (project preferred testing framework). Each phase follows the same rhythm:

1. **Red** — Write tests that describe the phase's expected behavior. Run `npm run test`; new tests fail because implementation does not exist yet.
2. **Green** — Implement the minimum code to make those tests pass. Re-run `npm run test` until the phase's test files are green.
3. **Verify** — Confirm phase acceptance criteria and run `npm run lint` where applicable.

**Phase completion signal:** the phase's Vitest files pass **and** the phase acceptance criteria are met. Do not advance to the next phase with failing tests.

### Vitest setup (once, start of Phase 1)

Vitest is not installed in the starter. Bootstrap before writing feature tests:

```bash
npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/user-event @testing-library/dom @testing-library/jest-dom jsdom vite-tsconfig-paths
```

Add `vitest.config.ts` at the repo root (see `.cursor/skills/testing/SKILL.md` for the canonical config). Add `vitest.setup.ts` to register jest-dom matchers:

```typescript
// vitest.setup.ts
import "@testing-library/jest-dom/vitest";
```

```typescript
// vitest.config.ts (excerpt)
test: {
  environment: "jsdom",
  globals: true,
  setupFiles: ["./vitest.setup.ts"],
},
```

Add scripts to `package.json`:

```json
"test": "vitest run",
"test:watch": "vitest",
"smoke:preview": "node scripts/preview-smoke-test.mjs"
```

**Initial red state:** `npm run test` fails with "no tests" or missing config until setup is complete.

### Testing conventions

| Convention | Rule |
|------------|------|
| Colocation | `src/lib/foo.ts` → `src/lib/foo.test.ts` |
| Mock boundaries | Mock D1, `getCloudflareContext()`, and `fetch` — never hit real network or database in unit tests |
| Server-only | `vi.mock("server-only", () => ({}))` before importing server modules |
| Assertions | Test observable behavior; no hollow tests (`expect(true).toBe(true)`) |
| Isolation | Each test passes alone; use `beforeEach(() => vi.clearAllMocks())` |
| React | Testing Library + `userEvent`; query by role/accessible name; client components only |
| jest-dom | `@testing-library/jest-dom/vitest` via `vitest.setup.ts` for `toBeInTheDocument`, `toHaveTextContent`, etc. |
| Router | Mock `next/navigation` `useRouter().push` for redirect assertions |

### Test file map (by phase)

| Phase | Test files |
|-------|------------|
| 1 | `vitest.config.ts`, `src/lib/db/users-schema.test.ts` |
| 2 | `src/lib/password-client.test.ts`, `src/lib/password-server.test.ts`, `src/lib/validators/auth.test.ts`, `src/lib/services/user-service.test.ts` |
| 3 | `src/app/api/auth/register/route.test.ts`, `src/app/api/auth/login/route.test.ts`, `src/app/api/auth/logout/route.test.ts` |
| 4 | `src/components/signup-form.test.tsx`, `src/components/login-form.test.tsx`, `src/components/logout-button.test.tsx`, `src/app/page.test.tsx` |
| 5 | Full suite + lint + build + manual preview smoke |

---

## Implementation Phases

### Phase 1: Database Foundation - COMPLETED

**Objective:** D1 database exists locally with the `users` table applied; schema contract is locked by tests.

**TDD workflow:**

| Step | Action | Expected test state |
|------|--------|---------------------|
| 1 | Install Vitest and add `vitest.config.ts` + npm scripts | `npm run test` runs (may report no tests) |
| 2 | Write `src/lib/db/users-schema.test.ts` | **RED** — tests fail (no migration file / wrong binding) |
| 3 | Create D1 database, migration, wrangler binding, apply locally | Tests still **RED** until migration SQL matches contract |
| 4 | Run `npm run cf-typegen` | **GREEN** — schema contract tests pass |

**Tests to write first (`src/lib/db/users-schema.test.ts`):**

- Migration file exists under `migrations/` and contains `CREATE TABLE users`
- Migration defines required columns: `id`, `first_name`, `last_name`, `username`, `email`, `password_hash`, `created_at`, `updated_at`
- Migration enforces `UNIQUE` on `username` and `email`
- `wrangler.jsonc` includes a `d1_databases` entry with binding name `DB`

These are contract tests (read filesystem / parse config) — no live D1 connection required in Vitest.

**Implementation tasks:**

1. Bootstrap Vitest (dependencies, config, scripts)
2. Write schema contract tests (red)
3. Create D1 database with Wrangler
4. Add `d1_databases` binding to `wrangler.jsonc`
5. Create and apply local migration for `users` table
6. Run `npm run cf-typegen` and verify `env.DB` is typed
7. Re-run `npm run test` until green

**Phase acceptance criteria:**

- [x] `npm run test` passes for `users-schema.test.ts`
- [x] Local D1 has `users` table applied via migration

**Deliverables:**

- `vitest.config.ts`, `package.json` test scripts
- `src/lib/db/users-schema.test.ts`
- `wrangler.jsonc` updated with D1 binding
- Migration SQL file under `migrations/`
- Local D1 database with `users` schema

---

### Phase 2: User Service and Password Utilities - COMPLETED

**Objective:** Server-side data access, password hashing, and validation schemas are implemented; fully covered by unit tests.

**TDD workflow:**

| Step | Action | Expected test state |
|------|--------|---------------------|
| 1 | Add `bcryptjs`, `zod`, and types | Dependencies available |
| 2 | Write password, validator, and user-service tests | **RED** — imports fail or assertions fail |
| 3 | Implement `password-client.ts`, `password-server.ts`, `validators/auth.ts`, `user-service.ts` | Tests turn **GREEN** one file at a time |

**Tests to write first:**

**`src/lib/password-client.test.ts`**

- `hashPasswordClient("hello")` returns a 64-char lowercase hex string
- Same input produces the same digest (deterministic)
- Different inputs produce different digests

**`src/lib/password-server.test.ts`**

- `hashPasswordServer(clientDigest)` returns a bcrypt string (starts with `$2`)
- `verifyPasswordServer(stored, clientDigest)` returns `true` for matching digest, `false` for mismatch
- Stored hash is not equal to the raw client digest

**`src/lib/validators/auth.test.ts`**

- Register schema accepts valid payload; rejects missing fields, invalid email, empty strings
- Login schema accepts valid payload; rejects missing `usernameOrEmail` or `passwordHash`

**`src/lib/services/user-service.test.ts`** (mock `D1Database` prepared statements)

- `createUser` inserts row and returns user without `password_hash`
- `createUser` bcrypt-hashes password before insert (assert bound parameter is not raw client digest)
- `findByUsername`, `findByEmail`, `findByUsernameOrEmail` return correct row or null
- `findByUsernameOrEmail` tries username first, then email
- `updateUser` updates allowed fields; re-hashes when password provided
- `deleteUser` removes row
- `verifyPassword` delegates to password-server compare
- Duplicate username/email surfaces error (mock constraint failure)

**Implementation tasks:**

1. Write all Phase 2 test files (red)
2. Implement `src/lib/password-client.ts`
3. Implement `src/lib/password-server.ts`
4. Add Zod schemas in `src/lib/validators/auth.ts`
5. Implement `src/lib/services/user-service.ts` with all CRUD methods
6. Run `npm run test` until all Phase 2 tests are green

**Phase acceptance criteria:**

- [x] All Phase 2 test files pass
- [x] User service CRUD and password verification work against mock D1

**Deliverables:**

- Four test files + four implementation modules
- User service module with typed inputs/outputs
- Password hash/compare utilities
- Validation schemas

---

### Phase 3: API Route Handlers - COMPLETED

**Objective:** Register, login, and logout HTTP endpoints are wired to the user service; route behavior locked by tests.

**TDD workflow:**

| Step | Action | Expected test state |
|------|--------|---------------------|
| 1 | Write route handler tests with mocked `getCloudflareContext` and user service | **RED** — routes do not exist |
| 2 | Implement `register`, `login`, `logout` route handlers | Tests turn **GREEN** |
| 3 | Optional manual `curl` smoke against `npm run preview` | Confirms Workers runtime (not a substitute for Vitest) |

**Tests to write first:**

Mock pattern for all route tests:

```typescript
vi.mock("server-only", () => ({}));
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: vi.fn(async () => ({ env: { DB: {} as D1Database } })),
}));
vi.mock("@/lib/services/user-service", () => ({
  createUserService: vi.fn(() => mockUserService),
}));
```

**`src/app/api/auth/register/route.test.ts`**

- Valid body → 201, `{ success: true, user }` without password fields
- Invalid body → 400 with validation details
- Duplicate user → 409
- User service throws → 500

**`src/app/api/auth/login/route.test.ts`**

- Valid credentials → 200, `{ success: true, user }`
- Invalid body → 400
- Unknown user or wrong password → 401 (same error message for both)
- User object never includes `password_hash`

**`src/app/api/auth/logout/route.test.ts`**

- POST → 200, `{ success: true }`
- No request body required

**Implementation tasks:**

1. Write three route test files (red)
2. Create `src/app/api/auth/register/route.ts`
3. Create `src/app/api/auth/login/route.ts`
4. Create `src/app/api/auth/logout/route.ts`
5. Wire handlers to `getCloudflareContext()` → `env.DB` → user service
6. Run `npm run test` until Phase 3 tests are green

**Phase acceptance criteria:**

- [x] All Phase 3 route tests pass
- [x] Happy-path and error responses match PRD status codes and body shapes

**Deliverables:**

- Three route test files + three route handlers
- Consistent JSON error responses

---

### Phase 4: UI Pages - COMPLETED

**Objective:** Teachers can register, log in, log out, and land on the MCQ stub; client components tested with Testing Library.

**TDD workflow:**

| Step | Action | Expected test state |
|------|--------|---------------------|
| 1 | Extract interactive logic into client components where needed for testability | — |
| 2 | Write component tests with mocked `fetch` and `hashPasswordClient` | **RED** — components missing |
| 3 | Build pages and wire fetch + redirect | Tests turn **GREEN** |

**Tests to write first:**

Use `vi.mock` for `@/lib/password-client`, `next/navigation`, and global `fetch`. Use `@testing-library/user-event` for form interaction. Tests are **colocated with components** under `src/components/`.

**`src/components/signup-form.test.tsx`**

- Renders all required fields (first name, last name, username, email, password, confirm password)
- Submit with mismatched passwords shows client validation error (no fetch call)
- Submit with valid data calls `hashPasswordClient`, POSTs to `/api/auth/register` with `passwordHash` (not plaintext)
- Successful response redirects to `/mcq` (mock `useRouter().push`)
- API error surfaces message in UI via `FieldError`

**`src/components/login-form.test.tsx`**

- Renders username/email and password fields
- Submit hashes password and POSTs to `/api/auth/login`
- Success redirects to `/mcq`
- 401 shows generic invalid-credentials message

**`src/components/logout-button.test.tsx`**

- Logout button POSTs to `/api/auth/logout`
- Success navigates to `/login`

**`src/app/page.test.tsx`**

- Home page renders Register and Login navigation (Base UI `Button` + `Link` renders as `role="button"`)

**Implementation tasks:**

1. Write component test files (red)
2. Create `src/components/signup-form.tsx` from shadcn signup block (adapted)
3. Create `src/components/login-form.tsx` from shadcn login block (adapted)
4. Create `src/components/logout-button.tsx`
5. Create thin pages: `src/app/register/page.tsx`, `src/app/login/page.tsx`, `src/app/mcq/page.tsx`
6. Update `src/app/page.tsx` home with shadcn Card + auth navigation
7. Add `vitest.setup.ts` + `@testing-library/jest-dom` if not already present
8. Run `npm run test` until Phase 4 tests are green

**Phase 4 verification (completed):**

```
npm run test  → 49 passed (12 files)
npm run lint  → clean
npm run build → passed; routes: /, /register, /login, /mcq, /api/auth/*
```

**Phase acceptance criteria:**

- [x] All Phase 4 component tests pass
- [x] No test sends plaintext password in mocked fetch body

**Deliverables:**

- `src/components/signup-form.tsx`, `login-form.tsx`, `logout-button.tsx`
- `src/components/*.test.tsx` (3 files) + `src/app/page.test.tsx`
- Pages: `/`, `/register`, `/login`, `/mcq`
- `vitest.setup.ts` with jest-dom matchers
- End-to-end register → MCQ and login → MCQ flows working locally (`npm run dev` or `npm run preview`)

---

### Phase 5: Verification - COMPLETED

**Objective:** Full test suite green; feature meets all acceptance criteria; builds cleanly on Workers runtime.

**TDD workflow:**

| Step | Action | Expected test state |
|------|--------|---------------------|
| 1 | Run full Vitest suite | **GREEN** — all phases' tests pass |
| 2 | Run lint and build | No errors |
| 3 | Manual preview smoke test | Auth flows work on Workers runtime |
| 4 | Mark PRD acceptance criteria complete | — |

**Tasks:**

1. `npm run test` — entire suite must pass (zero failures)
2. `npm run lint` — fix any issues
3. `npm run build` — confirm production build passes
4. `npm run preview` — smoke-test register, login, logout flows manually
5. Mark acceptance criteria checkboxes complete in this PRD

**Phase acceptance criteria:**

- [x] `npm run test` passes (all test files from Phases 1–4) — 49 tests
- [x] `npm run lint` and `npm run build` pass
- [x] Manual preview smoke test documented (see below)

**Preview smoke test (August 26, 2026)**

Environment: `npm run preview` on Workers runtime (`http://127.0.0.1:8787`), local D1 binding `env.DB`.

Automated script: `npm run smoke:preview` or `node scripts/preview-smoke-test.mjs` (requires preview server running).

| Step | Expected | Actual |
|------|----------|--------|
| POST `/api/auth/register` | 201, user without password fields | Pass |
| POST `/api/auth/login` | 200, matching user | Pass |
| POST `/api/auth/logout` | 200 `{ success: true }` | Pass |
| Duplicate POST `/api/auth/register` | 409 | Pass |
| GET `/`, `/register`, `/login`, `/mcq` | 200 | Pass |
| D1 `password_hash` column | bcrypt string (`$2b$10$...`), not plaintext or raw SHA-256 | Pass |

Request bodies in smoke test send **`passwordHash`** (SHA-256 hex), never plaintext `password`.

**Phase 5 verification (completed):**

```
npm run test   → 49 passed (12 files)
npm run lint   → clean
npm run build  → passed
npm run preview → Ready on http://127.0.0.1:8787 (local D1 bound)
node scripts/preview-smoke-test.mjs → all steps pass
# or: npm run smoke:preview
```

**Deliverables:**

- Full green test suite
- Lint and build passing
- Preview smoke test script + results documented above

**Production deployment (August 26, 2026)**

| Step | Result |
|------|--------|
| `npx wrangler d1 migrations apply quizmaker-db --remote` | `0001_create_users_table.sql` applied |
| `npm run deploy` | Worker deployed to Cloudflare |
| Production URL | https://ai-spints-quizmaker.aishwarya-ai.workers.dev |
| Production smoke test (`PREVIEW_URL=... node scripts/preview-smoke-test.mjs`) | All steps pass (register 201, login 200, logout 200, duplicate 409, pages 200) |

**Deploy note (Windows):** Stop `npm run dev` and `npm run preview` before deploy — they lock `.open-next` and cause `EPERM` on build.

---

## Technical Implementation Details

### Key Files

| File | Purpose |
|------|---------|
| `vitest.config.ts` | Vitest configuration (`jsdom`, `@/` path alias, setupFiles) |
| `vitest.setup.ts` | Registers `@testing-library/jest-dom/vitest` matchers |
| `src/lib/api/responses.ts` | Shared JSON error helpers for API routes (Phase 3) |
| `src/components/signup-form.tsx` | shadcn-based registration form (client) |
| `src/components/signup-form.test.tsx` | Phase 4 signup form tests |
| `src/components/login-form.tsx` | shadcn-based login form (client) |
| `src/components/login-form.test.tsx` | Phase 4 login form tests |
| `src/components/logout-button.tsx` | Logout control (client) |
| `src/components/logout-button.test.tsx` | Phase 4 logout tests |
| `src/app/page.tsx` | Home — shadcn Card + Register/Login navigation |
| `src/app/page.test.tsx` | Phase 4 home navigation tests |
| `src/app/register/page.tsx` | Register page layout wrapping `SignupForm` |
| `src/app/login/page.tsx` | Login page layout wrapping `LoginForm` |
| `src/app/mcq/page.tsx` | MCQ stub Card + `LogoutButton` |
| `scripts/preview-smoke-test.mjs` | Phase 5 preview smoke test against running `npm run preview` |
| `wrangler.jsonc` | D1 database binding configuration |
| `migrations/0001_create_users_table.sql` | Schema migration (exact filename from Wrangler) |
| `src/lib/db/users-schema.test.ts` | Phase 1 schema contract tests |
| `src/lib/password-client.ts` | Client-side SHA-256 hashing |
| `src/lib/password-client.test.ts` | Phase 2 client hash tests |
| `src/lib/password-server.ts` | Server-side bcrypt hash and compare |
| `src/lib/password-server.test.ts` | Phase 2 server hash tests |
| `src/lib/validators/auth.ts` | Zod schemas for auth payloads |
| `src/lib/validators/auth.test.ts` | Phase 2 validation tests |
| `src/lib/services/user-service.ts` | D1 queries and user CRUD |
| `src/lib/services/user-service.test.ts` | Phase 2 user service tests (mock D1) |
| `src/app/api/auth/register/route.ts` | Registration endpoint |
| `src/app/api/auth/register/route.test.ts` | Phase 3 register route tests |
| `src/app/api/auth/login/route.ts` | Login endpoint |
| `src/app/api/auth/login/route.test.ts` | Phase 3 login route tests |
| `src/app/api/auth/logout/route.ts` | Logout endpoint |
| `src/app/api/auth/logout/route.test.ts` | Phase 3 logout route tests |

### Code reference index

Primary implementation entry points (for navigation and future sprints):

| Concern | File | Key lines |
|---------|------|-----------|
| D1 binding | `wrangler.jsonc` | 21–27 |
| Migration SQL | `migrations/0001_create_users_table.sql` | 1–13 |
| Schema contract tests | `src/lib/db/users-schema.test.ts` | full file |
| Client SHA-256 hash | `src/lib/password-client.ts` | 1–7 |
| Server bcrypt hash/compare | `src/lib/password-server.ts` | 1–14 |
| Zod register/login schemas | `src/lib/validators/auth.ts` | 3–19 |
| User CRUD + `DuplicateUserError` | `src/lib/services/user-service.ts` | 3–8, 81–225 |
| JSON error helpers | `src/lib/api/responses.ts` | 3–18 |
| Register API | `src/app/api/auth/register/route.ts` | 6–29 |
| Login API | `src/app/api/auth/login/route.ts` | 8–41 |
| Logout API | `src/app/api/auth/logout/route.ts` | 1–3 |
| Signup UI (shadcn) | `src/components/signup-form.tsx` | 24–155 |
| Login UI (shadcn) | `src/components/login-form.tsx` | 25–108 |
| Logout control | `src/components/logout-button.tsx` | 7–27 |
| Home page | `src/app/page.tsx` | 11–38 |
| Register page shell | `src/app/register/page.tsx` | full file |
| Login page shell | `src/app/login/page.tsx` | full file |
| MCQ stub | `src/app/mcq/page.tsx` | full file |
| Preview/production smoke script | `scripts/preview-smoke-test.mjs` | full file |
| Vitest config | `vitest.config.ts` | full file |
| jest-dom setup | `vitest.setup.ts` | full file |

**Register route handler (representative):**

```6:29:src/app/api/auth/register/route.ts
export async function POST(request: Request) {
	try {
		const json: unknown = await request.json();
		const parsed = registerSchema.safeParse(json);

		if (!parsed.success) {
			return validationErrorResponse(parsed.error);
		}

		const { env } = await getCloudflareContext();
		const userService = createUserService(env.DB);
		const user = await userService.createUser(parsed.data);

		return Response.json({ success: true, user }, { status: 201 });
	} catch (error) {
		if (error instanceof DuplicateUserError) {
			return Response.json(
				{ error: "Username or email already exists" },
				{ status: 409 },
			);
		}

		return internalErrorResponse();
	}
}
```

**User creation with bcrypt before D1 insert:**

```83:107:src/lib/services/user-service.ts
		async createUser(input: CreateUserInput): Promise<User> {
			const passwordHash = await hashPasswordServer(input.passwordHash);

			try {
				const result = await db
					.prepare(
						`INSERT INTO users (first_name, last_name, username, email, password_hash)
             VALUES (?1, ?2, ?3, ?4, ?5)
             RETURNING id, first_name, last_name, username, email, password_hash, created_at, updated_at`,
					)
					.bind(
						input.firstName,
						input.lastName,
						input.username,
						input.email,
						passwordHash,
					)
					.all<UserRow>();

				const row = getFirstRow(result.results);
				if (!row) {
					throw new Error("Failed to create user");
				}

				return toUser(row);
```

**Client password hashing (never sends plaintext):**

```1:7:src/lib/password-client.ts
export async function hashPasswordClient(plaintext: string): Promise<string> {
	const encoded = new TextEncoder().encode(plaintext);
	const digest = await crypto.subtle.digest("SHA-256", encoded);
	return Array.from(new Uint8Array(digest))
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
}
```

### Implementation Patterns

**Client form submit (SignupForm / LoginForm):**

```typescript
"use client";

import { useRouter } from "next/navigation";
import { hashPasswordClient } from "@/lib/password-client";

async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const passwordHash = await hashPasswordClient(String(formData.get("password")));
  const response = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ /* fields */, passwordHash }),
  });
  if (response.ok) router.push("/mcq");
}
```

**Component test mocks (Phase 4):**

```typescript
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));
vi.mock("@/lib/password-client", () => ({
  hashPasswordClient: vi.fn(async () => "a665a459..."),
}));
```

**Accessing D1 in a route handler:**

```typescript
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createUserService } from "@/lib/services/user-service";

export async function POST(request: Request) {
  const { env } = await getCloudflareContext();
  const userService = createUserService(env.DB);
  // ...
}
```

**User service factory pattern:**

```typescript
export function createUserService(db: D1Database) {
  return {
    async createUser(input: CreateUserInput) { /* ... */ },
    async findByUsernameOrEmail(value: string) { /* ... */ },
    // ...
  };
}
```

### Important Notes

- **No persistent auth state:** after redirect to `/mcq`, refreshing the page does not "log the user out," but neither does it prove who they are — there is no session. This is intentional for this sprint.
- **Duplicate detection:** UNIQUE constraints on `username` and `email`; `DuplicateUserError` thrown on constraint failure (`user-service.ts:109-111`).
- **Never return `password_hash`** in API responses or UI props.
- **Local vs preview vs dev:** D1 auth requires Workers runtime — use `npm run preview` or production for end-to-end API tests; `npm run dev` serves UI on Node without `env.DB`.
- **Remote D1:** Migration applied to production D1 on deploy date; new environments must run `migrations apply --remote` before auth works in production.
- **`npm run test`** — 49 tests must pass; **`npm run deploy`** for production releases.

---

## Acceptance Criteria

- [x] Vitest is configured (`vitest.config.ts`, `npm run test` script) per `.cursor/skills/testing/SKILL.md`
- [x] D1 `users` table exists locally with correct columns and unique constraints on username and email
- [x] Phase 1 schema contract tests pass
- [x] User service supports create, read (by id/username/email), update, delete, and password verification
- [x] Phase 2 unit tests pass (password, validators, user service)
- [x] Registering with valid data creates a user row with a bcrypt-hashed password (not plaintext, not raw client digest)
- [x] Registering with a duplicate username or email returns 409
- [x] Logging in with valid username/email and correct password returns 200 with user profile (no password fields)
- [x] Logging in with wrong password or unknown user returns 401
- [x] Phase 3 route handler tests pass (register, login, logout)
- [x] Client never sends plaintext password in HTTP request bodies
- [x] Successful register redirects the browser to `/mcq`
- [x] Successful login redirects the browser to `/mcq`
- [x] Logout POST returns 200 and the UI navigates away from `/mcq`
- [x] Phase 4 component tests pass (forms, logout, home links)
- [x] `/mcq` displays stub content indicating MCQ features are coming in a future sprint
- [x] `npm run test` passes (49 tests, 12 files)
- [x] `npm run lint` passes
- [x] `npm run build` passes
- [x] Deployed to Cloudflare Workers (production URL live)
- [x] Manual browser verification: register, login, logout (product owner)
- [x] Production API smoke test passes

---

## Success Metrics

| Metric | Target | How Measured | Result |
|--------|--------|--------------|--------|
| Unit test suite | 100% pass | `npm run test` | 49/49 pass |
| Registration end-to-end | 100% | Manual browser + smoke script | Pass |
| Login end-to-end | 100% | Manual browser + smoke script | Pass |
| Logout end-to-end | 100% | Manual browser + smoke script | Pass |
| Duplicate registration blocked | 100% | Route test + smoke script | 409 |
| Password stored hashed | 100% | D1 inspect (`$2b$10$...`) | Pass |
| Build health | lint + build + test | CI commands | Pass |
| Production deploy | Live on Workers | `npm run deploy` | Pass |

---

## Dependencies

### External Dependencies

| Dependency | Purpose | Status |
|------------|---------|--------|
| Cloudflare D1 | SQLite database for users | Configured — `quizmaker-db`, binding `DB` |
| `vitest` | Unit test runner | Installed |
| `@vitejs/plugin-react` | Vitest React/TSX support | Installed |
| `@testing-library/react` | Component rendering in tests | Installed |
| `@testing-library/user-event` | Realistic user interaction in tests | Installed |
| `@testing-library/dom` | DOM utilities for Testing Library | Installed |
| `@testing-library/jest-dom` | DOM matchers (`toBeInTheDocument`, etc.) | Installed |
| `jsdom` | DOM environment for Vitest | Installed |
| `vite-tsconfig-paths` | Resolve `@/` alias in tests | Installed |
| `bcryptjs` | Server-side password hashing | Installed |
| `zod` | Request validation | Installed |

### Internal Dependencies

| Module | Purpose |
|--------|---------|
| `@opennextjs/cloudflare` | `getCloudflareContext()` for D1 binding access |
| `src/lib/utils.ts` | `cn()` for Tailwind class merging in UI |
| shadcn/ui (`field`, `input`, `button`, `card`) | Form and layout components — signup/login blocks |
| `.cursor/skills/testing/SKILL.md` | Vitest setup, mocking, and quality bar |

### Environment Variables

None required for this sprint. No API keys or secrets.

---

## Risks and Mitigation

### Technical Risks

- **Risk:** Client-side SHA-256 alone does not protect against replay if HTTPS is compromised; the digest becomes the effective password.
  - **Mitigation:** Always deploy over HTTPS; bcrypt at rest still protects stored credentials; full session/token auth comes in a later sprint.

- **Risk:** `bcryptjs` performance on Workers cold starts.
  - **Mitigation:** Use a moderate cost factor (10); acceptable for low-traffic teaching use.

- **Risk:** D1 binding unavailable during `npm run dev` (Node) vs `npm run preview` (Workers).
  - **Mitigation:** Document that auth integration testing requires `npm run preview`; local D1 uses `--local` SQLite.

- **Risk:** No route protection means `/mcq` is not truly "authenticated."
  - **Mitigation:** Explicitly out of scope; acceptance criteria and UI copy set expectations for this sprint.

### User Experience Risks

- **Risk:** Users expect to "stay logged in" after closing the browser.
  - **Mitigation:** Stub MCQ page and future sprint will add real session management; no false promise of persistence in UI copy.

- **Risk:** Username and email uniqueness errors are confusing.
  - **Mitigation:** Return clear 409 message; show which field conflicted when D1/SQLite error detail allows.

---

## Troubleshooting Guide

### Deploy fails with EPERM on `.open-next`

**Problem:** `npm run deploy` fails deleting `.open-next`.  
**Cause:** `npm run dev` or `npm run preview` still running and locking assets.  
**Solution:** Stop all node/workerd processes for this project; delete or rename `.open-next`; retry deploy.

### D1 binding not found at runtime

**Problem:** `env.DB` is undefined in route handlers.  
**Cause:** Binding not added to `wrangler.jsonc` or `cf-typegen` not run.  
**Solution:** Add `d1_databases` block, run `npm run cf-typegen`, restart preview.

### Migration apply fails locally

**Problem:** `wrangler d1 migrations apply` errors.  
**Cause:** Wrong database name or migration SQL syntax error.  
**Solution:** Run `npx wrangler d1 migrations list quizmaker-db`; fix SQL; re-apply with `--local` only.

### bcrypt compare always fails

**Problem:** Valid password rejected on login.  
**Cause:** Client hash algorithm mismatch or double-hashing inconsistency between register and login.  
**Solution:** Verify the same `hashPasswordClient()` runs on both forms; confirm server stores bcrypt of client digest, not bcrypt of plaintext.

### Vitest cannot resolve `@/` imports

**Problem:** Tests fail with module-not-found for `@/lib/...`.  
**Cause:** `vite-tsconfig-paths` missing from Vitest config.  
**Solution:** Add plugin per `.cursor/skills/testing/SKILL.md`; confirm `vitest.config.ts` includes `tsconfigPaths()`.

### Component tests fail with "Invalid Chai property: toBeInTheDocument"

**Problem:** Testing Library assertions like `toBeInTheDocument` fail in Vitest.  
**Cause:** `@testing-library/jest-dom` not registered.  
**Solution:** Add `vitest.setup.ts` with `import "@testing-library/jest-dom/vitest"` and reference it in `vitest.config.ts` `setupFiles`.

### Home page test cannot find role="link"

**Problem:** `getByRole("link", { name: /register/i })` fails on home page.  
**Cause:** Base UI `Button` with `render={<Link />}` exposes `role="button"`, not `role="link"`.  
**Solution:** Query `getByRole("button", { name: /register/i })` and assert `href` attribute.

### Route tests fail importing server-only modules

**Problem:** `server-only` package throws in test environment.  
**Cause:** Server modules imported without mock.  
**Solution:** Add `vi.mock("server-only", () => ({}))` at top of test file before imports.

---

## Notes for AI Agents

When working with this PRD:

1. Read **Overview** and **Hypothesis** first to understand this is identity-only groundwork for a collaborative quiz app.
2. Respect **Scope** — do not build MCQ features, sessions, tokens, or social login.
3. Follow **Test-Driven Development Approach** — write failing tests at the start of each phase (red), implement until green, then verify phase acceptance criteria before advancing.
4. Load `.cursor/skills/testing/SKILL.md` when writing or running Vitest tests.
5. Use **HTTP POST route handlers** under `src/app/api/auth/` as specified, even though project rules otherwise prefer Server Actions.
6. Centralize D1 access in `src/lib/services/user-service.ts`; never query D1 from client components; mock D1 in unit tests.
7. Remote D1 migration was applied for production deploy; for new environments run `migrations apply --remote` explicitly.
8. Update phase status markers and **Current Status** when scope changes.
9. Mark acceptance criteria when verified with `npm run test`, `npm run lint`, `npm run build`, and `npm run preview` or production smoke test.
10. Phase 4 UI lives in `src/components/signup-form.tsx`, `login-form.tsx`, `logout-button.tsx` — adapt shadcn blocks but do not add social login or password-reset UI.
11. Add troubleshooting entries when bugs are found and fixed.

---

## Current Status

**Last Updated:** August 26, 2026  
**Feature status:** **SHIPPED** — all 5 phases complete  
**Production URL:** https://ai-spints-quizmaker.aishwarya-ai.workers.dev  
**Verification:** 49/49 tests pass; lint and build pass; preview + production smoke tests pass; product owner confirmed register/login/logout in browser locally  
**Next sprint:** MCQ test bank authoring; session/token auth (out of scope for this PRD)
