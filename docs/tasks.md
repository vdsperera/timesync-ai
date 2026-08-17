# Task List — TimeSync AI

## Layer 1: Infrastructure

```
ID: TASK-001
Title: Initialize project structure and environment config
Layer: 1
Linked stories: All
Linked component: Local Backend API, Web UI
Depends on: None
Input: Architecture document ADR-001
Output: A Git repository with `package.json`, an Express server skeleton in `server.js`, a `public/index.html` file, and a `.env.example` file.
Acceptance condition: Running `npm start` serves the `index.html` file successfully on `localhost:3000`.
Estimated size: S
Risk / notes: None.
```

## Layer 3: API contracts & interfaces (Skipping Layer 2 as there is no local DB)

```
ID: TASK-002
Title: Define and stub Backend REST endpoints
Layer: 3
Linked stories: US-002, US-003, US-005
Linked component: Local Backend API
Depends on: TASK-001
Input: API Contracts section of the Architecture document.
Output: Express routes for `GET /api/categories`, `POST /api/parse`, and `POST /api/sync` returning mocked JSON responses.
Acceptance condition: `curl` requests to the three endpoints return valid JSON matching the architectural contracts.
Estimated size: S
Risk / notes: Unblocks frontend UI development (TASK-007, TASK-008).
```

## Layer 4: Business logic & services

```
ID: TASK-003 [Parallelisable with TASK-006]
Title: Implement Notion API category fetch
Layer: 4
Linked stories: US-002
Linked component: Local Backend API
Depends on: TASK-002
Input: Notion SDK documentation, Notion API Key, and Database ID in `.env`.
Output: Implementation of `GET /api/categories` using the official `@notionhq/client`.
Acceptance condition: Endpoint returns actual categories extracted from the specified Notion database schema.
Estimated size: M
Risk / notes: Notion API schema structure can be deeply nested; requires careful parsing of select/multi-select properties.
```

```
ID: TASK-004
Title: Implement Gemini API parsing logic
Layer: 4
Linked stories: US-003
Linked component: Local Backend API
Depends on: TASK-003 (Needs categories for prompt)
Input: Google Generative AI SDK, Gemini API Key.
Output: Implementation of `POST /api/parse` that uses a structured prompt instructing Gemini to map text to the provided Notion categories.
Acceptance condition: Endpoint accurately parses a provided text string, returning a JSON object with duration, mainType, subType, and `isAiFailure: false`.
Estimated size: M
Risk / notes: Core risk of AI hallucination. The prompt must strongly enforce strict JSON output.
```

```
ID: TASK-005
Title: Implement Notion API sync logic
Layer: 4
Linked stories: US-005
Linked component: Local Backend API
Depends on: TASK-002
Input: Notion SDK documentation.
Output: Implementation of `POST /api/sync` that accepts an array of entries and appends them as pages to the Notion database.
Acceptance condition: Successfully appends rows to Notion and returns the exact count of successes and a list of failed items if rate-limited.
Estimated size: M
Risk / notes: Must handle Notion rate limits and return partial successes accurately to mitigate data loss.
```

## Layer 5: UI & integration

```
ID: TASK-006 [Parallelisable with TASK-003]
Title: Build UI layout and text input
Layer: 5
Linked stories: US-001
Linked component: Web UI
Depends on: TASK-001
Input: Basic wireframe concept (text area, button).
Output: HTML/CSS implementation of the main input interface.
Acceptance condition: User can paste text and click the process button, and empty state validation works.
Estimated size: S
Risk / notes: None.
```

```
ID: TASK-007
Title: Implement frontend AI processing flow and review table
Layer: 5
Linked stories: US-002, US-003, US-004
Linked component: Web UI
Depends on: TASK-006, TASK-002 (stub is sufficient)
Input: Fetch API logic.
Output: UI automatically fetches categories on load. Submitting text calls `/api/parse` and renders the response in a tabular format.
Acceptance condition: The review table displays the original text, extracted time, and suggested categories. Items with `isAiFailure: true` are highlighted in red.
Estimated size: M
Risk / notes: Manages complex DOM state (pending vs approved items).
```

```
ID: TASK-008
Title: Implement manual review editing and Notion sync flow
Layer: 5
Linked stories: US-004, US-005
Linked component: Web UI
Depends on: TASK-007
Input: Sync logic.
Output: Dropdowns in the review table populate with valid Notion categories. Modifying them updates the row state. Clicking "Sync" calls `/api/sync`.
Acceptance condition: Successful rows are removed from the UI. Failed rows remain with an error message and a "Retry Sync" option.
Estimated size: M
Risk / notes: Critical path for user trust. Unsynced data must not disappear on error.
```

## Coverage Matrix

### Stories × Tasks
- US-001: TASK-001, TASK-006
- US-002: TASK-002, TASK-003, TASK-007
- US-003: TASK-002, TASK-004, TASK-007
- US-004: TASK-007, TASK-008
- US-005: TASK-002, TASK-005, TASK-008

### Components × Tasks
- Web UI: TASK-001, TASK-006, TASK-007, TASK-008
- Local Backend API: TASK-001, TASK-002, TASK-003, TASK-004, TASK-005

### Critical Path
TASK-001 -> TASK-002 -> TASK-003 -> TASK-004 -> TASK-007 -> TASK-008

*(Note: Layer 6 Hardening is implicit in the acceptance conditions for the backend tasks, as error handling is explicitly tested there).*
