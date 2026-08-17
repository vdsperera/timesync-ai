# Code Review Report — Final Project Review

## Code Review (Agent 6)

**ID:** CR-001
**Severity:** Blocker
**Category:** Error handling
**Location:** `server.js`, Lines 56, 113, 171
**Problem:** The API endpoints return the raw `error.message` from the Notion and Gemini SDKs directly to the client (e.g., `res.status(502).json({ error: '...', details: error.message })`).
**Risk:** External SDK error messages can sometimes leak internal paths, unmasked tokens, or sensitive context. The developer coding standards explicitly state: "Never expose internal error details to external callers".
**Fix:** Remove `details: error.message` from the `res.status().json()` responses. Log the raw error to the server console only.

**ID:** CR-002
**Severity:** Major
**Category:** Edge cases & boundary conditions
**Location:** `server.js`, `POST /api/parse` (Line 63) and `POST /api/sync` (Line 118)
**Problem:** There is no maximum limit enforced on the size of the `entries` array. 
**Risk:** Submitting thousands of lines will cause the Gemini API to hit token limits or timeout, and the Notion sync (which processes sequentially) will take an extremely long time and potentially block the thread or timeout the HTTP request.
**Fix:** Validate that `entries.length <= 100` (or a reasonable limit) and return a 400 Bad Request if the payload exceeds this bound.

**ID:** CR-003
**Severity:** Major
**Category:** Test quality
**Location:** Entire repository
**Problem:** No unit tests have been written for `server.js` or the client-side parsing logic.
**Risk:** Future refactoring of the parsing prompt or Notion sync logic could break functionality without automated detection.
**Fix:** Introduce a testing framework (e.g., Jest) and write tests for the API routes, mocking the Notion and Gemini SDKs.

**ID:** CR-004
**Severity:** Praise
**Category:** Security
**Location:** `public/app.js`, `escapeHtml()` function
**Problem:** The frontend explicitly sanitises AI-generated data before injecting it into the DOM via `.innerHTML`.
**Risk:** N/A (mitigates XSS).
**Fix:** Keep using this pattern for all dynamically rendered DOM elements.

---

## Security Review (Agent 7)

**ID:** SEC-001
**Severity:** Medium
**OWASP category:** A05:2021 — Security Misconfiguration
**CWE:** CWE-209 — Generation of Error Message Containing Sensitive Information
**Location:** `server.js`, Catch blocks
**Attack vector:** An attacker forces an API error (e.g., by sending malformed payloads) to read the stack trace or verbose error details returned in the HTTP response.
**Impact:** Information disclosure about the internal mechanics of the Notion or Gemini SDK integrations.
**Exploitability:** Trivial.
**Fix:** Mask error details in HTTP responses. (Overlaps with CR-001).
**Verification:** Force an error and verify the API returns a generic 502/500 message without SDK internals.

**ID:** SEC-002
**Severity:** Low
**OWASP category:** A05:2021 — Security Misconfiguration
**CWE:** CWE-942 — Permissive CORS Policy
**Location:** `server.js`, Line 14 (`app.use(cors());`)
**Attack vector:** A malicious website visited by the user could issue XHR requests to `http://localhost:3000/api/sync` to pollute their Notion database.
**Impact:** Unauthorized data injection into the user's personal Notion database if the local server is running.
**Exploitability:** Requires the user to have the server running while visiting a malicious site.
**Fix:** Restrict CORS to the frontend origin only, or restrict it to `localhost` explicitly.
**Verification:** Ensure cross-origin requests from `https://evil.com` are blocked by the browser.

---

## UX & Accessibility Review (Agent 13)

**ID:** UX-001
**Severity:** Blocker (WCAG AA)
**Category:** Accessibility
**Location:** `public/app.js`, `renderTable` function
**Problem:** The dynamically generated `<input>` and `<select>` elements inside the review table do not have associated `<label>` elements or `aria-label` attributes.
**Affected users:** Users relying on screen readers will not know what the input fields represent.
**Fix:** Add `aria-label="Edit duration"`, `aria-label="Edit main type"`, etc., to the input and select tags.
**WCAG criterion:** 4.1.2 Name, Role, Value

**ID:** UX-002
**Severity:** Minor
**Category:** User flow
**Location:** `public/app.js`, `POST /api/parse` error catch block
**Problem:** The "Processing with AI..." button state is reverted, but the input error message simply says "An error occurred". If the user submits a massive payload that times out, they aren't given actionable feedback.
**Affected users:** All users encountering errors.
**Fix:** Pass through user-friendly error messages (e.g., "Text too long, please split it up") if CR-002 is implemented.

---

## Final Verdict: Rework

The codebase has great momentum and a solid architectural foundation, but it cannot be approved for the final "deployment" phase yet due to **3 Blockers/Majors**.

Please instruct the Developer agent to address:
1. **CR-001 / SEC-001**: Remove `error.message` from the 500/502 JSON responses.
2. **CR-002**: Bound the input array size (e.g., max 50 entries) on the server.
3. **UX-001**: Add `aria-label`s to the table inputs.

*(Note: CR-003 regarding unit tests can be delegated to the Test Generator (`sdlc-test` skill) in a subsequent step).*
