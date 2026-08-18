# Refined Requirements Document — TimeSync

## 1. Issues List

```
ID: REQ-001
Type: Gap
Location: "suggest the best Main Type and Sub Type from a predefined list."
Problem: It is unclear how the web app knows the predefined Notion categories. Hardcoding them means the app breaks if Notion categories change.
Question: Should the predefined Notion categories be hardcoded in the app, or fetched dynamically from the Notion Database API on load?
Suggested fix: "The app will fetch the valid Main Type and Sub Type options dynamically from the Notion Database schema on application load."
```

```
ID: REQ-002
Type: Missing constraint
Location: "Integration with Notion API... Integration with Gemini (or similar AI)"
Problem: The app needs API keys to communicate with Gemini and Notion, but there's no requirement on how the user provides them for this local tool.
Question: Should the user provide API keys via environment variables (since it's a local tool) or input them into the web UI (stored in local storage)?
Suggested fix: "API keys for Gemini and Notion, as well as the Notion Database ID, will be provided via environment variables (e.g., a `.env` file)."
```

```
ID: REQ-003
Type: Gap
Location: "A UI to display each parsed entry alongside the AI's suggested categories..."
Problem: There is no defined failure state if Gemini cannot parse a line (e.g., malformed text, missing time).
Question: What should the UI display if the AI fails to parse a specific line or extract a duration?
Suggested fix: "If the AI fails to parse a line, the UI will display the raw text with blank category/time fields, flag it for review, and require manual data entry."
```

```
ID: REQ-004
Type: Gap
Location: "Notion Sync: Integration with Notion API to append approved entries..."
Problem: There is no defined failure state or retry mechanism if the Notion sync fails (e.g., rate limit, network error).
Question: What happens to approved entries if the Notion sync fails halfway through a batch?
Suggested fix: "If Notion sync fails, the UI will display an error message for the failed entries and keep them in the review queue with a 'Retry Sync' option, while successfully synced entries are cleared."
```

## 2. Refined Requirements

### Core Workflow
- **[REFINED]** The user inputs a day's worth of raw text entries via a web UI text area or simple file upload.
- **[NEEDS CLARIFICATION]** The app fetches the valid Main Type and Sub Type options dynamically from the target Notion Database schema on application load to ensure accurate AI suggestions. (Or uses a hardcoded configuration if preferred).
- **[REFINED]** The app sends the raw text entries to the Gemini API, instructing it to extract the time/duration and map each entry to the closest matching Main Type and Sub Type from the valid options.
- **[REFINED]** The UI displays a review table containing the original text, extracted time, suggested Main Type, and suggested Sub Type for each entry.
- **[REFINED]** The user can approve each row as-is or manually override the Main Type, Sub Type, and time via dropdowns and text inputs.
- **[REFINED]** The user clicks a "Sync to Notion" button to append all approved entries as rows in the target Notion table via the Notion API.

### Error Handling & Edge Cases
- **[NEEDS CLARIFICATION]** API keys for Gemini and Notion, as well as the Notion Database ID, are provided by the user via environment variables (e.g., `.env` file) as this is a local utility.
- **[REFINED]** If the AI fails to parse a line or extract a duration, the UI will display the raw text with blank category/time fields, flag it visually, and require the user to manually enter the missing data before approval.
- **[REFINED]** If Notion sync fails (e.g., due to rate limits or network issues), the UI will display an error message for the failed entries, retain them in the review queue with a 'Retry Sync' option, and clear the successfully synced entries from the queue.

### Out of Scope (MVP)
- Real-time file watching.
- User authentication and multi-user support.
- Analytics or dashboards.
- Offline support for the categorization and sync steps.
