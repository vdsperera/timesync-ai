# Task List — TimeSync

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

```
ID: TASK-010
Title: Implement Daily Overwrite Sync Strategy
Layer: 4
Linked stories: US-005
Linked component: Local Backend API
Depends on: TASK-005
Input: Issue with duplicate entries on re-sync.
Output: Modify `POST /api/sync` to identify unique dates in the payload, query Notion for existing entries on those dates using native fetch, and archive them before appending the new entries.
Acceptance condition: Syncing the same day twice does not result in duplicates; old entries are archived in Notion.
Estimated size: M
Risk / notes: Destructive operation; depends on accurate date matching.
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

```
ID: TASK-009
Title: Implement interactive Draft Library with LocalStorage
Layer: 5
Linked stories: US-004
Linked component: Web UI
Depends on: TASK-008
Input: User feedback on drafting multiple days.
Output: Implement draft management grouped by date in `localStorage`, adding a "Save to Library" button, an "Auto-cleanup on sync" toggle, and a "Saved Drafts" panel to the home screen. Also add a "Delete" button to individual rows.
Acceptance condition: User can save multiple drafts, load them, delete individual rows, and auto-cleanup removes them upon successful sync.
Estimated size: M
Risk / notes: UI state management complexity.
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

## Future Backlog

```
ID: TASK-011
Title: Bulk edit and delete operations in review table
Layer: 5
Linked component: Web UI
Input: User feedback regarding tedious manual entry when multiple rows lack dates.
Output: Implement checkbox selection for rows in the review table. Provide a bulk action menu to apply a single Date, Main Type, Sub Type, or to Delete all selected rows simultaneously.
Estimated size: M
```

```
ID: TASK-012
Title: Local file system log extraction workflow
Layer: 4, 5
Linked component: Web UI, Local Backend API
Input: User desire to automatically pull entries from daily files in a specific local directory instead of copy-pasting.
Output: 
1. A backend endpoint to scan a local directory for files (named by date) and intelligently extract only the time-tracking lines using a "Delimiter Strategy" (e.g., ignoring everything above a specific marker like `---LOGS---` to separate actual logs from schedules or templates).
2. A frontend UI to trigger the scan, view the extracted raw text grouped by date, and allow human review/editing of the raw text *before* sending it to the AI for processing.
3. Ability to process the extracted dates one by one or in bulk.
Estimated size: L
```

```
ID: TASK-013
Title: Configurable database schema & generalized AI parsing
Layer: 3, 4, 5
Linked component: Local Backend API, Web UI
Input: User feedback to make the app useful for a wider audience with varying Notion setups.
Output: 
1. Move the hardcoded dependency on "Main Type" and "Sub Type" to an environment or UI-based configuration.
2. Dynamically fetch the configured properties from Notion and dynamically generate the AI prompt to extract those specific fields.
3. Dynamically render the review table columns based on the configured properties.
Acceptance condition: A user can configure the app to sync to a database that has entirely different categorical properties (e.g., "Client" and "Project") without changing the source code.
Estimated size: L


## Architectural Suggestions (Under Review)

The following items are architectural suggestions pending review and decision.

```text
ID: ARCH-001
Title: Data Integrity during Notion Sync (Soft Deletes / Upserts)
Layer: 4
Linked component: Local Backend API
Input: Notion sync currently deletes existing pages for a given date before creating new ones.
Output: Implement soft deletes or upserts based on a deterministic hash of the entry to prevent data loss during partial sync failures.
Estimated size: M
```

```text
ID: ARCH-002
Title: UI State Persistence (LocalStorage)
Layer: 5
Linked component: Web UI
Input: UI state (review queue) is currently in-memory and lost on page refresh.
Output: Implement `localStorage` or `sessionStorage` in the Vanilla JS frontend to persist the review queue state, hydrating the UI on page load.
Estimated size: S
```

```text
ID: ARCH-003
Title: Rate Limiting & Circuit Breaking Implementation
Layer: 4
Linked component: Local Backend API
Input: Notion API rate limiting (`429 Too Many Requests`).
Output: Implement a queuing mechanism (e.g., `bottleneck` or `p-retry`) on the backend to throttle requests and automatically retry based on the `Retry-After` header.
Estimated size: M
```

```text
ID: ARCH-004
Title: Pluggable AI / Strategy Pattern for Parsers
Layer: 4
Linked component: Local Backend API
Input: Backend is tightly coupled to the Gemini API.
Output: Implement a Strategy Pattern for the AI parser to easily swap between different AI providers (e.g., OpenAI, Anthropic, or local Ollama) using an environment variable.
Estimated size: M
```

```text
ID: ARCH-005
Title: Strict Input/Output Validation Boundary (Zod)
Layer: 3, 4
Linked component: Local Backend API
Input: Implicit trust between frontend payloads and Gemini responses.
Output: Introduce a validation library like `Zod` to strictly validate incoming `/api/sync` payloads and Gemini JSON responses before processing.
Estimated size: S
```
