Date created: September 1, 2026
Date last modified: September 2, 2026 (implementation complete; production verified)

# MCQ Create, Read, Update, and Delete - Technical PRD

## Overview/Problem

Teachers using the Greenfield Quiz Maker can register, log in, and manage a shared multiple-choice question bank at `/mcq`. The MCQ CRUD feature is **implemented and deployed to production** — create, edit, preview (with attempt recording), and delete all work against remote D1.

This PRD records the phased delivery of that feature (Phases 1–5 complete).

---

## Hypothesis

We believe that providing full MCQ CRUD (create, read, update, delete) with a shadcn/ui table-based workspace, a dedicated create/edit form, preview with attempt recording, and a service-layer-backed API will let teachers populate the test bank and validate question quality before collaboration features arrive in a later sprint.

---

## Scope

### In Scope

- **Three D1 tables:** `mcqs`, `mcq_choices`, and `mcq_attempts` (see Database Schema)
- **D1 migrations** `0001`–`0003` applied locally and on remote `quizmaker-db`
- **MCQ service** (`src/lib/services/mcq-service.ts`) — CRUD for MCQs and choices; create attempts; backed by prepared D1 statements
- **Zod validators** (`src/lib/validators/mcq.ts`) for create, update, and attempt payloads
- **API route handlers:**
  - `GET /api/mcqs` — list all MCQs (summary fields for table)
  - `POST /api/mcqs` — create MCQ with choices
  - `GET /api/mcqs/[id]` — fetch one MCQ with choices
  - `PUT /api/mcqs/[id]` — update MCQ and replace choices
  - `DELETE /api/mcqs/[id]` — delete MCQ (cascade choices and attempts)
  - `POST /api/mcqs/[id]/attempts` — record a preview attempt
- **UI pages** built with **shadcn/ui** (`Table`, `Button`, `DropdownMenu`, `Field`, `Input`, `Textarea`, `RadioGroup`, `AlertDialog`, `Card`):
  - **`/mcq`** — MCQ list table, **Create MCQ** button, row actions menu (Edit, Preview, Delete), logout
  - **`/mcq/new`** — create form (shared with edit)
  - **`/mcq/[id]/edit`** — edit existing MCQ
  - **`/mcq/[id]/preview`** — read-only question with selectable choices; submit records attempt and shows result
- **Create/edit form behavior:**
  - Fields: name, question text
  - Choices: **2 shown by default**, user can add up to **6**, remove down to **2**
  - Exactly **one** choice marked as correct (radio selection)
  - **Save** and **Cancel** buttons (Cancel returns to `/mcq`)
- **List table columns:** name, question (truncated if long), actions (vertical ellipsis → dropdown)
- **Delete confirmation** via shadcn `AlertDialog` before calling DELETE API
- **Test-driven development with Vitest** — each phase begins with failing tests (red), then implements until green
- **Phase gates:** stop at the end of each phase for product-owner review before starting the next phase

### Out of Scope

- Route protection / auth middleware (anyone can hit MCQ routes, same as auth sprint)
- Validating that `createdByUserId` matches the logged-in user (no session yet)
- Filtering MCQs by owner, school, or tag
- Pagination, search, or sort on the list table (load all rows for now)
- Rich text or image choices
- Bulk import/export (CSV, QTI)
- Real-time collaboration or concurrent edit locking
- Attempt analytics dashboard
- Linking attempts to a user account (attempts table stores choice + correctness only for this sprint)
- End-to-end browser tests (Playwright/Cypress)
- Server Actions for MCQ mutations (this sprint uses HTTP API routes to mirror the auth sprint pattern)

### Cut

- **Optional `description` field** — removed after review; `name` is the short list title and `question` is the full prompt (truncated in the list table). Migration `0003_drop_mcq_description.sql` drops the column from D1.
- **Soft delete** — hard delete with `ON DELETE CASCADE` is simpler for a teaching sprint; archived questions can be added later.
- **Choice shuffle on preview** — choices display in `display_order` for now.
- **Server-side session for `created_by_user_id`** — deferred until a session sprint; create payload includes `createdByUserId` until then.

---

## Technical Requirements

### Database Schema

Database: `quizmaker-db` (existing)  
Binding: `DB` (existing in `wrangler.jsonc`)

```sql
CREATE TABLE mcqs (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL,
  question TEXT NOT NULL,
  created_by_user_id TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id)
);

CREATE TABLE mcq_choices (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  mcq_id TEXT NOT NULL,
  choice_text TEXT NOT NULL,
  is_correct INTEGER NOT NULL DEFAULT 0 CHECK (is_correct IN (0, 1)),
  display_order INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (mcq_id) REFERENCES mcqs(id) ON DELETE CASCADE
);

CREATE TABLE mcq_attempts (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  mcq_id TEXT NOT NULL,
  choice_id TEXT NOT NULL,
  is_correct INTEGER NOT NULL CHECK (is_correct IN (0, 1)),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (mcq_id) REFERENCES mcqs(id) ON DELETE CASCADE,
  FOREIGN KEY (choice_id) REFERENCES mcq_choices(id) ON DELETE CASCADE
);

CREATE INDEX idx_mcqs_created_by ON mcqs (created_by_user_id);
CREATE INDEX idx_mcq_choices_mcq_id ON mcq_choices (mcq_id);
CREATE INDEX idx_mcq_attempts_mcq_id ON mcq_attempts (mcq_id);
```

**Column notes:**

| Table | Column | Type | Notes |
|-------|--------|------|-------|
| `mcqs` | `id` | TEXT PK | Random 16-byte hex string |
| `mcqs` | `name` | TEXT NOT NULL | Short title for list table |
| `mcqs` | `question` | TEXT NOT NULL | Full question prompt (truncated in list; full text on edit/preview) |
| `mcqs` | `created_by_user_id` | TEXT NOT NULL FK | References `users.id` |
| `mcqs` | `created_at` / `updated_at` | DATETIME | Audit timestamps |
| `mcq_choices` | `mcq_id` | TEXT NOT NULL FK | Parent MCQ; cascade delete |
| `mcq_choices` | `choice_text` | TEXT NOT NULL | Answer option label |
| `mcq_choices` | `is_correct` | INTEGER 0/1 | Exactly one per MCQ enforced in service/validator |
| `mcq_choices` | `display_order` | INTEGER NOT NULL | 0-based order in UI |
| `mcq_attempts` | `mcq_id` | TEXT NOT NULL FK | Which question was attempted |
| `mcq_attempts` | `choice_id` | TEXT NOT NULL FK | Selected choice |
| `mcq_attempts` | `is_correct` | INTEGER 0/1 | Denormalized at insert time from choice |

**Migration workflow:**

1. `npx wrangler d1 migrations create quizmaker-db create_mcq_tables`
2. SQL in `migrations/0002_create_mcq_tables.sql`
3. Apply locally: `npx wrangler d1 migrations apply quizmaker-db --local`
4. Run `npm run cf-typegen` (no new binding, but keep types current)
5. **Do not** apply `--remote` unless the user explicitly requests it
6. After removing the unused `description` column: add `migrations/0003_drop_mcq_description.sql` (`ALTER TABLE mcqs DROP COLUMN description;`) and apply locally
7. For production: `npx wrangler d1 migrations apply quizmaker-db --remote` (applied September 2, 2026 — all migrations current)

---

### MCQ Service

Location: `src/lib/services/mcq-service.ts`

Server-only module. Factory: `createMcqService(db: D1Database)`.

**Methods:**

| Method | Purpose |
|--------|---------|
| `listMcqs()` | All MCQs with summary fields (no choices) for table |
| `getMcqById(id)` | MCQ with ordered choices, or `null` |
| `createMcq(input)` | Insert MCQ + choices in a batch; return full MCQ |
| `updateMcq(id, input)` | Update MCQ fields; delete and re-insert choices |
| `deleteMcq(id)` | Delete MCQ row (cascade removes choices and attempts) |
| `createAttempt(mcqId, choiceId)` | Validate choice belongs to MCQ; insert attempt; return `{ isCorrect }` |

**Query conventions** (same as user service):

- Prepared statements with numbered placeholders (`?1`, `?2`)
- Never concatenate user input into SQL
- Use `all()` and read `results[0]` rather than `first()`
- Map snake_case rows to camelCase domain types

**Choice rules enforced in service + Zod:**

- Minimum 2 choices, maximum 6
- Each `choiceText` non-empty after trim
- Exactly one choice with `isCorrect: true`

---

### API Endpoints

All MCQ endpoints accept and return JSON unless noted.

#### GET /api/mcqs

List all MCQs for the workspace table.

**Response:**

| Status | Body | Condition |
|--------|------|-----------|
| 200 | `{ "mcqs": [ { "id", "name", "question", "createdByUserId", "createdAt", "updatedAt" } ] }` | Success |
| 500 | `{ "error": "Internal server error" }` | Unexpected failure |

---

#### POST /api/mcqs

Create a new MCQ with choices.

**Request Body:**

```json
{
  "name": "Photosynthesis basics",
  "question": "Which organelle performs photosynthesis?",
  "createdByUserId": "abc123",
  "choices": [
    { "choiceText": "Mitochondria", "isCorrect": false },
    { "choiceText": "Chloroplast", "isCorrect": true }
  ]
}
```

**Responses:**

| Status | Body | Condition |
|--------|------|-----------|
| 201 | `{ "mcq": { "id", "name", "question", "createdByUserId", "createdAt", "updatedAt", "choices": [...] } }` | Created |
| 400 | `{ "error": "Validation failed", "details": [...] }` | Invalid payload |
| 404 | `{ "error": "User not found" }` | `createdByUserId` does not exist (optional check) |
| 500 | `{ "error": "Internal server error" }` | Unexpected failure |

---

#### GET /api/mcqs/[id]

Fetch one MCQ with choices (correct flags included for edit/preview).

**Responses:**

| Status | Body | Condition |
|--------|------|-----------|
| 200 | `{ "mcq": { ...full mcq with choices } }` | Found |
| 404 | `{ "error": "MCQ not found" }` | Unknown id |
| 500 | `{ "error": "Internal server error" }` | Unexpected failure |

---

#### PUT /api/mcqs/[id]

Update MCQ metadata and replace all choices.

**Request Body:** same shape as POST minus `createdByUserId` (immutable after create).

**Responses:**

| Status | Body | Condition |
|--------|------|-----------|
| 200 | `{ "mcq": { ...updated mcq with choices } }` | Updated |
| 400 | `{ "error": "Validation failed", "details": [...] }` | Invalid payload |
| 404 | `{ "error": "MCQ not found" }` | Unknown id |
| 500 | `{ "error": "Internal server error" }` | Unexpected failure |

---

#### DELETE /api/mcqs/[id]

Delete an MCQ and cascade related choices and attempts.

**Responses:**

| Status | Body | Condition |
|--------|------|-----------|
| 200 | `{ "success": true }` | Deleted |
| 404 | `{ "error": "MCQ not found" }` | Unknown id |
| 500 | `{ "error": "Internal server error" }` | Unexpected failure |

---

#### POST /api/mcqs/[id]/attempts

Record a preview attempt for an MCQ.

**Request Body:**

```json
{
  "choiceId": "choice-uuid-here"
}
```

**Responses:**

| Status | Body | Condition |
|--------|------|-----------|
| 201 | `{ "attempt": { "id", "mcqId", "choiceId", "isCorrect", "createdAt" } }` | Recorded |
| 400 | `{ "error": "Validation failed", "details": [...] }` | Missing choiceId |
| 404 | `{ "error": "MCQ not found" }` or `{ "error": "Choice not found" }` | Invalid ids |
| 500 | `{ "error": "Internal server error" }` | Unexpected failure |

**Server behavior:** look up choice; verify `choice.mcq_id === mcqId`; set `is_correct` from `choice.is_correct`; insert attempt row.

---

### User Interface Requirements

All UI uses **shadcn/ui** on **Base UI** (`base-nova` style), **Tailwind CSS v4** tokens, and **Lucide** icons. Interactive pieces are **client components** under `src/components/`; App Router pages under `src/app/mcq/` are thin wrappers.

#### shadcn components

| Component | Status | Used for |
|-----------|--------|----------|
| `Table` | Installed | MCQ list |
| `Button` | Installed | Create, Save, Cancel, actions |
| `Card`, `Field`, `Input` | Installed | Form layout |
| `DropdownMenu` | **Add in Phase 4** | Row actions (⋮ menu) |
| `AlertDialog` | **Add in Phase 4** | Delete confirmation |
| `Textarea` | **Add in Phase 4** | Question prompt |
| `RadioGroup` | **Add in Phase 4** | Mark correct choice; preview selection |

Install before Phase 4 UI work:

```bash
npx shadcn@latest add @shadcn/dropdown-menu @shadcn/alert-dialog @shadcn/textarea @shadcn/radio-group
```

#### Component architecture

| Component | Path | Type | Role |
|-----------|------|------|------|
| `McqList` | `src/components/mcq-list.tsx` | Client | Fetch list, render table, actions menu, delete dialog |
| `McqForm` | `src/components/mcq-form.tsx` | Client | Shared create/edit form |
| `McqPreview` | `src/components/mcq-preview.tsx` | Client | Preview question, submit attempt, show result |
| `LogoutButton` | `src/components/logout-button.tsx` | Client | Existing — keep on list page |

#### MCQ List Page (`/mcq`)

Implemented as:

- Page heading: **MCQ Test Bank**
- Primary **Create MCQ** button → `/mcq/new`
- shadcn `Table` with columns: **Name**, **Question**, **Actions**
- Actions column: `DropdownMenu` trigger with `MoreVertical` icon (vertical ellipsis)
  - **Edit** → `/mcq/[id]/edit`
  - **Preview** → `/mcq/[id]/preview`
  - **Delete** → opens `AlertDialog`; confirm calls `DELETE /api/mcqs/[id]` then refreshes list
- Empty state when no MCQs: message + Create button
- **`LogoutButton`** retained
- Loading and error states for fetch failures

#### Create Page (`/mcq/new`)

- Renders **`McqForm`** in create mode
- **Save:** POST `/api/mcqs` with form data + `createdByUserId` (interim: prop or constant until session exists)
- **Cancel:** navigate to `/mcq` without saving
- Success: redirect to `/mcq`

#### Edit Page (`/mcq/[id]/edit`)

- Load MCQ via GET `/api/mcqs/[id]` on mount
- Renders **`McqForm`** pre-filled
- **Save:** PUT `/api/mcqs/[id]`
- **Cancel:** navigate to `/mcq`
- 404: show not-found message with link back to list

#### Preview Page (`/mcq/[id]/preview`)

- Load MCQ via GET `/api/mcqs/[id]`
- Display name, question, choices as `RadioGroup` (no correct answer revealed before submit)
- **Submit answer:** POST `/api/mcqs/[id]/attempts` with selected `choiceId`
- After response: show whether attempt was **Correct** or **Incorrect** (do not reveal which choice was correct unless product owner prefers — default: show result only)
- Link back to list and to edit

#### Create/Edit Form (`McqForm`)

**Fields:**

| Field | Validation |
|-------|------------|
| Name | Required, max 200 chars |
| Question | Required, max 5000 chars |
| Choices (2–6) | Each text required; exactly one `isCorrect` |

**Choice UX:**

- Start with 2 empty choice rows
- **Add choice** button (disabled at 6)
- **Remove** per row (disabled at 2)
- Radio button per row to mark the single correct answer

---

## Test-Driven Development Approach

Same rhythm as the auth sprint:

1. **Red** — Write tests describing expected behavior; `npm run test` fails.
2. **Green** — Implement minimum code until phase tests pass.
3. **Review gate** — Stop; product owner reviews phase deliverables before the next phase starts.

**Phase completion signal:** phase Vitest files pass **and** phase acceptance criteria met.

### Testing conventions

Reuse existing project conventions (see auth PRD):

| Convention | Rule |
|------------|------|
| Colocation | `foo.ts` → `foo.test.ts` |
| Mock boundaries | Mock D1, `getCloudflareContext()`, `fetch` |
| Server-only | `vi.mock("server-only", () => ({}))` |
| React | Testing Library + `userEvent`; query by role/name |
| Router | Mock `next/navigation` `useRouter` and `useParams` |

### Test file map (by phase)

| Phase | Test files |
|-------|------------|
| 1 | `src/lib/db/mcq-schema.test.ts` |
| 2 | `src/lib/validators/mcq.test.ts`, `src/lib/services/mcq-service.test.ts` |
| 3 | `src/app/api/mcqs/route.test.ts`, `src/app/api/mcqs/[id]/route.test.ts`, `src/app/api/mcqs/[id]/attempts/route.test.ts` |
| 4 | `src/components/mcq-list.test.tsx`, `src/components/mcq-form.test.tsx`, `src/components/mcq-preview.test.tsx` |
| 5 | Full suite + lint + build + manual preview smoke |

---

## Implementation Phases

> **Review gate:** After completing each phase, stop and wait for product-owner approval before starting the next phase.

### Phase 1: Database Foundation - COMPLETED

**Objective:** D1 has `mcqs`, `mcq_choices`, and `mcq_attempts` tables applied locally; schema contract locked by tests.

**TDD workflow:**

| Step | Action | Expected test state |
|------|--------|---------------------|
| 1 | Write `src/lib/db/mcq-schema.test.ts` | **RED** — migration missing or incomplete |
| 2 | Create migration `0002_create_mcq_tables.sql` | Still **RED** until SQL matches contract |
| 3 | Apply migration locally | **GREEN** — schema tests pass |

**Tests to write first (`src/lib/db/mcq-schema.test.ts`):**

- Migration file exists and contains `CREATE TABLE mcqs`, `mcq_choices`, `mcq_attempts`
- `mcqs` has columns: `id`, `name`, `question`, `created_by_user_id`, `created_at`, `updated_at`
- `0003_drop_mcq_description.sql` drops the `description` column from `mcqs`
- `mcq_choices` has FK to `mcqs` with `ON DELETE CASCADE`
- `mcq_attempts` has FKs to `mcqs` and `mcq_choices`
- Indexes exist on foreign-key columns

**Implementation tasks:**

1. Write schema contract tests (red)
2. Create migration via Wrangler
3. Add SQL per schema above
4. Apply locally: `npx wrangler d1 migrations apply quizmaker-db --local`
5. Re-run `npm run test` until green

**Phase acceptance criteria:**

- [x] `npm run test` passes for `mcq-schema.test.ts`
- [x] Local D1 has all three MCQ tables

**Deliverables:**

- `migrations/0002_create_mcq_tables.sql`
- `migrations/0003_drop_mcq_description.sql`
- `src/lib/db/mcq-schema.test.ts`

**Phase 1 verification (September 1, 2026; updated September 2, 2026):**

```
npm run test -- src/lib/db/mcq-schema.test.ts  → 9 passed
npm run test                                    → 102 passed (21 files)
npx wrangler d1 migrations apply quizmaker-db --local → 0001 + 0002 + 0003 applied
```

Local `mcqs` columns confirmed: `id`, `name`, `question`, `created_by_user_id`, `created_at`, `updated_at`.

**Schema note:** `0002` originally created `mcqs.description`; product review removed it as redundant with `question`. `0003` drops the column; service, validators, API, and UI no longer reference `description`.

**⏸ Stop for review before Phase 2.**

---

### Phase 2: MCQ Service and Validators - COMPLETED

**Objective:** Server-side MCQ data access and Zod validation implemented; covered by unit tests.

**TDD workflow:**

| Step | Action | Expected test state |
|------|--------|---------------------|
| 1 | Write validator and service tests | **RED** |
| 2 | Implement `validators/mcq.ts` and `services/mcq-service.ts` | **GREEN** |

**Tests to write first:**

**`src/lib/validators/mcq.test.ts`**

- Create schema accepts valid payload with 2–6 choices
- Rejects empty name/question, wrong choice count, zero or multiple `isCorrect`
- Update schema same as create minus `createdByUserId`
- Attempt schema requires `choiceId`

**`src/lib/services/mcq-service.test.ts`** (mock D1)

- `listMcqs` returns summary rows
- `createMcq` inserts MCQ + choices; returns full object
- `getMcqById` returns MCQ with ordered choices or null
- `updateMcq` updates fields and replaces choices
- `deleteMcq` removes row
- `createAttempt` sets `isCorrect` from choice; rejects foreign choice

**Implementation tasks:**

1. Write Phase 2 test files (red)
2. Implement `src/lib/validators/mcq.ts`
3. Implement `src/lib/services/mcq-service.ts`
4. Run `npm run test` until green

**Phase acceptance criteria:**

- [x] All Phase 2 test files pass
- [x] Service enforces 2–6 choices and exactly one correct answer

**Deliverables:**

- `src/lib/validators/mcq.ts` + test
- `src/lib/services/mcq-service.ts` + test

**Phase 2 verification (September 1, 2026):**

```
npm run test -- src/lib/validators/mcq.test.ts src/lib/services/mcq-service.test.ts  → 20 passed
npm run test                                                                          → 77 passed (15 files)
npm run lint                                                                          → clean (no errors in src)
```

**⏸ Stop for review before Phase 3.**

---

### Phase 3: API Route Handlers - COMPLETED

**Objective:** MCQ CRUD and attempt HTTP endpoints wired to the service; behavior locked by route tests.

**TDD workflow:**

| Step | Action | Expected test state |
|------|--------|---------------------|
| 1 | Write route tests with mocked context + service | **RED** |
| 2 | Implement route handlers | **GREEN** |

**Tests to write first:**

Mock pattern (same as auth routes):

```typescript
vi.mock("server-only", () => ({}));
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: vi.fn(async () => ({ env: { DB: {} as D1Database } })),
}));
vi.mock("@/lib/services/mcq-service", () => ({
  createMcqService: vi.fn(() => mockMcqService),
}));
```

**`src/app/api/mcqs/route.test.ts`**

- GET → 200 with mcqs array
- POST valid body → 201 with mcq
- POST invalid body → 400

**`src/app/api/mcqs/[id]/route.test.ts`**

- GET found → 200; not found → 404
- PUT valid → 200; not found → 404; invalid → 400
- DELETE found → 200; not found → 404

**`src/app/api/mcqs/[id]/attempts/route.test.ts`**

- POST valid choiceId → 201 with attempt
- POST invalid → 400/404

**Implementation tasks:**

1. Write three route test files (red)
2. Create `src/app/api/mcqs/route.ts` (GET, POST)
3. Create `src/app/api/mcqs/[id]/route.ts` (GET, PUT, DELETE)
4. Create `src/app/api/mcqs/[id]/attempts/route.ts` (POST)
5. Reuse `validationErrorResponse` / `internalErrorResponse` from `src/lib/api/responses.ts`
6. Run `npm run test` until green

**Phase acceptance criteria:**

- [x] All Phase 3 route tests pass
- [x] Status codes and JSON shapes match this PRD

**Deliverables:**

- Three route modules + three test files

**Phase 3 verification (September 1, 2026):**

```
npm run test -- src/app/api/mcqs  → 13 passed
npm run test                      → 90 passed (18 files)
npm run lint                      → clean (no errors in src)
```

**⏸ Stop for review before Phase 4.**

---

### Phase 4: UI Pages and Components - COMPLETED

**Objective:** Teachers can list, create, edit, preview, and delete MCQs via the browser; components covered by Testing Library tests.

**TDD workflow:**

| Step | Action | Expected test state |
|------|--------|---------------------|
| 1 | Add shadcn components (dropdown-menu, alert-dialog, textarea, radio-group) | — |
| 2 | Write component tests with mocked `fetch` | **RED** |
| 3 | Build components and pages | **GREEN** |

**Tests to write first:**

**`src/components/mcq-list.test.tsx`**

- Renders table rows from mocked GET `/api/mcqs`
- Create button links to `/mcq/new`
- Actions menu exposes Edit, Preview, Delete
- Delete confirm calls DELETE and refreshes list

**`src/components/mcq-form.test.tsx`**

- Renders name, question, 2 default choices
- Can add/remove choices within 2–6 bounds
- Submit POST (create) or PUT (edit) with correct payload
- Cancel navigates to `/mcq`

**`src/components/mcq-preview.test.tsx`**

- Renders question and choices
- Submit POST attempt with selected choiceId
- Shows correct/incorrect feedback

**Implementation tasks:**

1. Install additional shadcn components
2. Write component tests (red)
3. Implement `McqList`, `McqForm`, `McqPreview`
4. Update `src/app/mcq/page.tsx` (replace stub)
5. Create `src/app/mcq/new/page.tsx`, `[id]/edit/page.tsx`, `[id]/preview/page.tsx`
6. Run `npm run test` until green

**Phase acceptance criteria:**

- [x] All Phase 4 component tests pass
- [x] `/mcq` shows table instead of stub
- [x] Create → save → list shows new row (manual preview smoke in Phase 5)
- [x] Edit, preview, and delete flows work in `npm run preview` (Phase 5)

**Deliverables:**

- Three client components + tests
- Four page routes under `src/app/mcq/`
- shadcn components: `dropdown-menu`, `alert-dialog`, `textarea`, `radio-group`
- `src/lib/auth-session.ts` (stores user id after login/register for MCQ create)

**Phase 4 verification (September 1, 2026; updated September 2, 2026):**

```
npm run test -- src/components/mcq-list.test.tsx src/components/mcq-form.test.tsx src/components/mcq-preview.test.tsx  → 11 passed
npm run test                                                                                                          → 102 passed (21 files)
npm run lint                                                                                                          → clean (McqList effect refactored in Phase 5)
npm run build                                                                                                         → passed
```

**Post–Phase 4 change:** Removed `description` from MCQ model (migration `0003`, service, validators, API payloads, `McqForm`, and list table column replaced with truncated `question`).

**⏸ Stop for review before Phase 5.**

---

### Phase 5: Verification - COMPLETED

**Objective:** Full test suite green; MCQ feature meets acceptance criteria; builds cleanly.

**Tasks:**

1. `npm run test` — all tests pass (auth + MCQ)
2. `npm run lint` — no errors
3. `npm run build` — production build passes
4. `npm run preview` — manual smoke: create MCQ, edit, preview attempt, delete
5. Mark acceptance criteria in this PRD
6. Extend `scripts/preview-smoke-test.mjs` with MCQ API steps (optional)

**Phase acceptance criteria:**

- [x] Full Vitest suite passes
- [x] `npm run lint` and `npm run build` pass
- [x] Manual preview smoke documented
- [x] Production deploy live and remote D1 migrations applied
- [x] Manual production verification: create, update, delete, and preview MCQs

**Deliverables:**

- Green test suite
- Updated smoke script (`scripts/preview-smoke-test.mjs` — auth + MCQ CRUD + attempt + page checks)
- PRD acceptance criteria marked complete
- Production deployment to Cloudflare Workers

**Phase 5 verification (September 2, 2026):**

**Local / CI:**

```
npm run test                    → 102 passed (21 files)
npm run lint                    → clean
npm run build                   → passed
npx wrangler d1 migrations apply quizmaker-db --local  → 0001 + 0002 + 0003 applied
npm run preview                 → Ready on http://127.0.0.1:8787
npm run smoke:preview           → all steps passed (register, auth, mcq-create/list/get/update/attempt/delete, pages)
```

**Production (September 2, 2026):**

```
npm run deploy                                          → deployed to https://ai-spints-quizmaker.aishwarya-ai.workers.dev
npx wrangler d1 migrations apply quizmaker-db --remote  → No migrations to apply (0001–0003 already applied)
```

Remote `mcqs` schema confirmed: `id`, `name`, `question`, `created_by_user_id`, `created_at`, `updated_at` (no `description`). Tables: `users`, `mcqs`, `mcq_choices`, `mcq_attempts`.

**Product-owner manual smoke (production):** create MCQ → appears in list → edit → preview with attempt → delete — all verified working.

**Smoke script MCQ flow:** register user → POST `/api/mcqs` → GET list/get → PUT update → POST attempt (uses choice id from update response, since update replaces choices) → DELETE → verify `/mcq` and `/mcq/new` pages return 200.

**Lint fix:** refactored `McqList` initial fetch to avoid synchronous `setState` in `useEffect`.

**Git (branch `feature/mcq-crud`):** `7853a5c` (auth + stub) → Phase 1–3 → `3fe0da5` (Phase 4 UI) → `20985cf` (Phase 5 verification).

**✅ Implementation complete — all phases delivered and signed off.**

---

## Technical Implementation Details

### Key Files (implemented)

| File | Purpose |
|------|---------|
| `migrations/0002_create_mcq_tables.sql` | MCQ schema migration |
| `migrations/0003_drop_mcq_description.sql` | Drops unused `description` column from `mcqs` |
| `src/lib/db/mcq-schema.test.ts` | Phase 1 schema contract tests |
| `src/lib/validators/mcq.ts` | Zod schemas for MCQ payloads |
| `src/lib/services/mcq-service.ts` | D1 access for MCQs, choices, attempts |
| `src/app/api/mcqs/route.ts` | List + create |
| `src/app/api/mcqs/[id]/route.ts` | Get + update + delete |
| `src/app/api/mcqs/[id]/attempts/route.ts` | Record attempt |
| `src/components/mcq-list.tsx` | Table + actions |
| `src/components/mcq-form.tsx` | Create/edit form |
| `src/components/mcq-preview.tsx` | Preview + attempt |

### Implementation Patterns

**MCQ service factory (mirror user service):**

```typescript
export function createMcqService(db: D1Database) {
  return {
    async listMcqs() { /* ... */ },
    async getMcqById(id: string) { /* ... */ },
    async createMcq(input: CreateMcqInput) { /* ... */ },
    async updateMcq(id: string, input: UpdateMcqInput) { /* ... */ },
    async deleteMcq(id: string) { /* ... */ },
    async createAttempt(mcqId: string, choiceId: string) { /* ... */ },
  };
}
```

**Accessing D1 in a route handler:**

```typescript
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createMcqService } from "@/lib/services/mcq-service";

export async function GET() {
  const { env } = await getCloudflareContext();
  const mcqService = createMcqService(env.DB);
  const mcqs = await mcqService.listMcqs();
  return Response.json({ mcqs });
}
```

### Important Notes

- **No session auth:** `createdByUserId` is supplied in the create payload until a future session sprint; the API does not verify ownership.
- **Cascade deletes:** Deleting an MCQ removes its choices and attempts automatically.
- **Correct answer in GET:** Edit and preview pages receive `isCorrect` on choices; preview UI must not highlight the correct choice before the user submits.
- **Local vs preview:** D1 requires Workers runtime — use `npm run preview` for end-to-end MCQ API tests; `npm run dev` serves UI without `env.DB`.
- **Preview smoke:** Run `npm run preview` in one terminal, then `npm run smoke:preview` in another (targets `http://127.0.0.1:8787` by default).
- **Production URL:** https://ai-spints-quizmaker.aishwarya-ai.workers.dev
- **Deploy on Windows:** Stop `npm run preview` before `npm run deploy`; if build fails with `EPERM` on `.open-next`, delete that folder and retry.

---

## Acceptance Criteria

- [x] Migration `0002_create_mcq_tables.sql` and `0003_drop_mcq_description.sql` applied locally and on remote with all three MCQ tables
- [x] Phase 1 schema contract tests pass
- [x] MCQ service supports list, get, create, update, delete, and createAttempt
- [x] Phase 2 unit tests pass (validators + service)
- [x] Creating an MCQ with 2–6 choices persists MCQ and choice rows
- [x] Exactly one correct choice enforced on create and update
- [x] Phase 3 route handler tests pass
- [x] List, create, get, update, delete, and attempt endpoints return documented status codes
- [x] Phase 4 component tests pass
- [x] `/mcq` displays shadcn table with name, question, and actions dropdown
- [x] Create and edit forms support 2–6 choices with save/cancel
- [x] Preview records attempt with correct/incorrect result
- [x] Delete shows confirmation dialog before removal
- [x] `npm run test` passes (full suite)
- [x] `npm run lint` and `npm run build` pass
- [x] Manual preview smoke test documented
- [x] Production deployed to Cloudflare Workers (`npm run deploy`)
- [x] Remote D1 migrations current (`0001`–`0003`)
- [x] Production manual smoke: create, update, delete, and preview MCQs verified by product owner

---

## Success Metrics

| Metric | Target | How Measured | Status |
|--------|--------|--------------|--------|
| Unit test suite | 100% pass | `npm run test` | ✅ 102 passed |
| MCQ CRUD API | All operations succeed | Route tests + preview smoke | ✅ |
| Create-to-list flow | < 30 seconds manual | Time create → save → visible in table | ✅ (local + production) |
| Choice validation | 100% invalid payloads rejected | Validator + route tests | ✅ |
| Build health | lint + build + test | CI commands | ✅ |
| Production deploy | Live on Workers + remote D1 | Manual smoke on production URL | ✅ |

---

## Dependencies

### External Dependencies

| Dependency | Purpose | Status |
|------------|---------|--------|
| Cloudflare D1 | SQLite for MCQs, choices, attempts | Configured — `quizmaker-db`, binding `DB` |
| Vitest + Testing Library | TDD | Installed (auth sprint) |
| shadcn/ui | UI components | Installed — Table, Button, Card, Field, Input, DropdownMenu, AlertDialog, Textarea, RadioGroup |

### Internal Dependencies

| Module | Purpose | Status |
|--------|---------|--------|
| `users` table + user service | FK `created_by_user_id` | Exists |
| `src/lib/api/responses.ts` | Shared API error helpers | Exists |
| Auth pages + `/mcq` workspace | Post-login landing and MCQ test bank | Live in production |
| `LogoutButton` | Sign out from workspace | Exists |

---

## Risks and Mitigation

### Technical Risks

- **Risk:** Replacing all choices on update could lose stable choice IDs referenced by attempts.
- **Mitigation:** Acceptable for this sprint; attempts store `choice_id` at time of attempt. Document that editing choices after attempts exist may orphan historical choice references if IDs change — future sprint can diff/update choices in place.

- **Risk:** No auth means any client can pass arbitrary `createdByUserId`.
- **Mitigation:** Document as interim; session sprint will fix. Optional service check that user id exists.

### User Experience Risks

- **Risk:** Long questions break table layout.
- **Mitigation:** Question column truncated with `truncate` / max-width; full question on edit/preview pages.

- **Risk:** Users forget to mark a correct choice.
- **Mitigation:** Client + server validation requiring exactly one `isCorrect`.

---

## Troubleshooting Guide

### MCQ API returns 500 on preview
**Problem:** Create/list MCQ fails with internal server error.  
**Cause:** D1 not available — running `npm run dev` instead of `npm run preview`.  
**Solution:** Use `npm run preview` for Workers + D1 runtime; apply migrations locally first.

### Preview smoke `mcq-attempt` returns 404
**Problem:** Attempt fails with "Choice not found" after a successful update.  
**Cause:** `updateMcq` replaces all choices with new IDs.  
**Solution:** Use a `choiceId` from the update response, not the create response.

### Deploy fails with EPERM on `.open-next` (Windows)
**Problem:** `npm run deploy` fails with `Permission denied` deleting `.open-next`.  
**Cause:** `npm run preview` (or `workerd`) still running and locking build output.  
**Solution:** Stop preview (Ctrl+C), then `Remove-Item -Recurse -Force .open-next` and retry deploy.

---

## Notes for AI Agents

When working with this PRD:

1. Read Overview and Hypothesis first to understand intent.
2. Use Scope (In/Out/Cut) — do not build out-of-scope items.
3. **Stop at the end of each phase** and wait for product-owner review before continuing.
4. Follow TDD: red → green for each phase.
5. Update phase status markers (`PLANNED` → `IN PROGRESS` → `COMPLETED`) as work progresses.
6. Add implementation details and code references under Technical Implementation Details as code is written.
7. Mark acceptance criteria when features work.
8. Never apply D1 migrations with `--remote` unless the user explicitly asks.
9. Never run `npm run deploy` unless explicitly asked.

---

## Current Status

**Last Updated:** September 2, 2026  
**Implementation:** **COMPLETE** — all five phases delivered  
**Production URL:** https://ai-spints-quizmaker.aishwarya-ai.workers.dev  
**Branch:** `feature/mcq-crud` (commits through `20985cf`)

### Summary

| Phase | Status | Deliverable |
|-------|--------|-------------|
| 1 — Database | ✅ COMPLETED | Migrations `0002`, `0003`; schema tests |
| 2 — Service & validators | ✅ COMPLETED | `mcq-service.ts`, `validators/mcq.ts` |
| 3 — API routes | ✅ COMPLETED | `/api/mcqs` CRUD + attempts |
| 4 — UI | ✅ COMPLETED | List, create/edit form, preview pages |
| 5 — Verification | ✅ COMPLETED | Tests, lint, build, smoke script, production deploy |

### Production verification (product owner, September 2, 2026)

- Remote D1: migrations `0001`–`0003` applied; `mcqs` table without `description` column
- Deploy: Worker live at production URL above
- Manual flows confirmed: **create**, **update**, **delete**, and **preview** MCQs

### Codebase reference

- MCQ workspace at `/mcq` — list table (name + truncated question), create/edit/preview pages
- API routes under `src/app/api/mcqs/`
- 102 Vitest tests; `npm run smoke:preview` for local end-to-end API checks
- `createdByUserId` from `sessionStorage` after login/register (interim until session sprint)

**Next sprint (out of scope here):** route protection, server-side session, MCQ ownership validation, pagination/search.
