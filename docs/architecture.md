# System Architecture — TimeSync AI

## 1. Component Map

### 1.1 Web UI (Frontend)
- **Responsibility**: Present the user interface for inputting text logs, reviewing AI suggestions, and triggering sync.
- **Exposes**: Interactive user interface in the browser.
- **Depends on**: Local Backend API.
- **Data owned**: Transient state of the review queue (unapproved, approved, failed entries).
- **Technology**: Vanilla HTML, CSS, and JavaScript. *(Rationale: Keeps the app incredibly lightweight, fast, and easy to maintain without complex build steps, fitting the "simple personal tool" ethos).*
- **Scaling strategy**: N/A (Single user local tool).
- **Failure mode**: If the backend is unreachable, the UI displays a "Connection Error" overlay and disables input.

### 1.2 Local Backend API (Server)
- **Responsibility**: Securely hold API keys, serve the frontend assets, and proxy requests to external APIs (Gemini, Notion).
- **Exposes**: REST endpoints (`/api/categories`, `/api/parse`, `/api/sync`).
- **Depends on**: Gemini API, Notion API.
- **Data owned**: Configuration state (API keys from `.env`).
- **Technology**: Node.js with Express. *(Rationale: Best ecosystem for rapid API proxying, excellent Notion SDK available, easy local `.env` management).*
- **Scaling strategy**: N/A (Single user local tool).
- **Failure mode**: If external APIs fail, returns standard HTTP error codes (e.g., 502 Bad Gateway or 429 Too Many Requests) with descriptive JSON error messages to the frontend.

## 2. API Contracts (Internal REST API)

### 2.1 `GET /api/categories`
- **Method/Endpoint**: `GET /api/categories`
- **Request shape**: Empty body.
- **Response shape**:
  ```json
  {
    "mainTypes": ["ATGO", "FINGO", "FAMGO", "PHYGO", "EDGO", "PLEAGO", "CARGO"],
    "subTypes": ["English", "general coding", "team lead"]
  }
  ```
- **Error codes**: `502 Bad Gateway` (Notion API unreachable), `401 Unauthorized` (Invalid Notion Key).
- **Auth requirement**: None (Localhost only).
- **Idempotency**: Idempotent.

### 2.2 `POST /api/parse`
- **Method/Endpoint**: `POST /api/parse`
- **Request shape**:
  ```json
  {
    "entries": ["08.00 - 08.10 - 0.2H - quick wash", "..."]
  }
  ```
- **Response shape**:
  ```json
  {
    "results": [
      {
        "originalText": "08.00 - 08.10 - 0.2H - quick wash",
        "duration": "0.2H",
        "mainType": "famgo",
        "subType": "hygiene",
        "isAiFailure": false
      }
    ]
  }
  ```
- **Error codes**: `400 Bad Request` (Empty input), `502 Bad Gateway` (Gemini API failed).
- **Auth requirement**: None (Localhost only).
- **Idempotency**: Idempotent.

### 2.3 `POST /api/sync`
- **Method/Endpoint**: `POST /api/sync`
- **Request shape**:
  ```json
  {
    "entries": [
      {
        "originalText": "08.00 - 08.10 - 0.2H - quick wash",
        "duration": "0.2H",
        "mainType": "famgo",
        "subType": "hygiene",
        "date": "2026-08-17"
      }
    ]
  }
  ```
- **Response shape**:
  ```json
  {
    "successCount": 1,
    "failedEntries": []
  }
  ```
- **Error codes**: `429 Too Many Requests` (Notion rate limit), `502 Bad Gateway` (Notion network error).
- **Auth requirement**: None (Localhost only).
- **Idempotency**: Not strictly idempotent (appends rows to Notion), but the UI clears synced rows to prevent duplicate submissions.

## 3. Data Models

### 3.1 Review Entry (Transient UI State)
- **Entities**: `id`, `originalText`, `duration`, `mainType`, `subType`, `status` (pending, approved, synced, error).
- **Storage technology**: In-memory (JavaScript Array / DOM State).
- **Data ownership**: Web UI.

### 3.2 Notion Row (External State)
- **Entities**: Properties matching the user's Notion table (Entry/Text, Date/Date, Regular Hours/Number, Main Type/Select, Sub Type/Select).
- **Storage technology**: Notion Database.
- **Data ownership**: Notion (Source of truth).

## 4. NFR Mapping

| NFR from Stories | Architectural Decision |
|------------------|------------------------|
| **Prevent AI Hallucination** | The Backend fetches valid categories dynamically via `GET /api/categories` and injects them strictly into the Gemini prompt. |
| **Secure API Key Management** | Use a Node.js Backend to hold `.env` variables so keys are never exposed in the browser. |
| **Offline-first speed preservation** | The web UI is served locally and instantly. The user only waits during the batch parse and batch sync steps. |
| **Error Resilience** | The UI maintains state for failed sync entries, allowing the user to click "Retry Sync" without losing their manual corrections. |

## 5. Risk Flags

- **Third-party API with no circuit breaker**:
  - **Risk**: The app depends heavily on Gemini and Notion APIs. If Notion rate-limits the sync, the app could fail.
  - **Consequence**: Partial sync failures where some rows are added and others aren't.
  - **Mitigation**: The `POST /api/sync` endpoint must return the exact items that failed, and the UI must keep them in the queue.
- **Single point of failure**:
  - **Risk**: The Gemini API structure might change or hallucinate despite instructions.
  - **Consequence**: The app fails to parse the text, breaking the pipeline.
  - **Mitigation**: The UI handles `isAiFailure = true` by falling back to manual entry mode.

## 6. Architecture Decision Records (ADRs)

### ADR-001
**Title:** Two-Tier Architecture (Node.js + Vanilla JS) vs Single Page App
**Status:** Accepted
**Context:** We need a way to build the web UI and communicate with external APIs (Gemini, Notion). We could build a purely client-side SPA (React/Vite) that calls external APIs directly, or a local server + client model.
**Options considered:**
1. Pure Client-Side SPA: Easy to distribute as a static HTML file, but requires the user to input API keys into the browser (security risk, annoying UX on reload).
2. Node.js Backend + Vanilla JS Frontend: Requires running a local server process, but securely manages API keys via `.env` and avoids CORS issues with external APIs.
**Decision:** Option 2 (Node.js Backend + Vanilla JS Frontend). It is safer, avoids CORS, and running a local `npm start` is acceptable for a developer/power-user tracking time in local `.txt` files.
**Consequences:** Easier API key management, safer execution, but requires Node.js installed on the host machine.

### ADR-002
**Title:** Dynamic vs Hardcoded Notion Categories
**Status:** Accepted (Amended)
**Context:** US-002 flagged the need to clarify if Notion categories should be hardcoded in the app or fetched dynamically. A later requirement mandated that `Main Type` must strictly adhere to a specific list regardless of Notion schema, while `Sub Type` can remain dynamic.
**Options considered:**
1. Hardcode all categories in a `config.json` file. (Requires manual update every time a category is added in Notion).
2. Fetch dynamically from Notion Database Schema on load. (Always up to date, but adds a network request on startup).
3. Hybrid approach: Hardcode `Main Type` to strictly enforce business rules, but fetch `Sub Type` dynamically.
**Decision:** Option 3. The `Main Type` is hardcoded to enforce strict usage of tags like `ATGO`, `FINGO`, etc., preventing AI hallucination outside these bounds. `Sub Type` remains dynamically fetched so the user can freely add new activities in Notion without touching the codebase.
**Consequences:** Partial maintenance burden if the strict `Main Type` list changes, but optimal balance of strictness and flexibility.
