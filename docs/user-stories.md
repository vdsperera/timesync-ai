# User Stories — TimeSync AI

## US-001
**Title:** Enter raw text logs
**Statement:** As a personal user, I want to input my day's raw text entries into the web application, so that I can begin the categorization process.
**Priority:** Must have — Core entry point of the pipeline.
**Assumptions:** The web application is running locally and accessible via a browser.
**Out of scope:** Real-time file watching of the `.txt` file; mobile-optimized upload flows.
**Acceptance criteria:**
```gherkin
# Happy path
Given the user has opened the application
When they paste multiple lines of text into the input area
And click the "Process Logs" button
Then the application accepts the input and proceeds to the processing state

# Edge case
Given the user has opened the application
When they click the "Process Logs" button with an empty input area
Then the application displays an error message "Please provide log entries to process"
And remains in the input state

# Sad path
Given the user has opened the application
When they paste a file that exceeds 10,000 lines (or reasonable limit)
Then the application displays a warning about excessive payload size
```

## US-002 [NEEDS CLARIFICATION]
**Title:** Fetch valid Notion categories dynamically
**Statement:** As a personal user, I want the application to dynamically fetch the valid Main Type and Sub Type options from my Notion database on load, so that the AI only suggests currently valid categories without requiring manual code updates.
**Priority:** Must have — Necessary to prevent AI hallucination and sync errors. *(Note: flagged from Phase 1 as needing clarification between dynamic vs hardcoded)*
**Assumptions:** Notion API key and Database ID are provided correctly in local environment variables.
**Out of scope:** UI for creating new categories in Notion from this app.
**Acceptance criteria:**
```gherkin
# Happy path
Given the application is starting up
When it attempts to load
Then it successfully fetches the properties schema from the Notion database
And extracts the available options for Main Type and Sub Type

# Sad path
Given the application is starting up
When the Notion API key or Database ID is missing or invalid
Then the application displays a critical setup error
And halts the startup process until the environment is configured correctly

# Sad path (Network error)
Given the application is starting up
When the Notion API is unreachable
Then the application displays an error message "Failed to connect to Notion"
And provides a "Retry Connection" button
```

## US-003
**Title:** Process entries via AI categorization
**Statement:** As a personal user, I want the AI to analyze my raw text entries against the valid Notion categories to extract duration and suggest types, so that I avoid manual data entry.
**Priority:** Must have — Core value proposition of the tool.
**Assumptions:** Gemini API key is provided correctly. The Notion categories have been successfully loaded.
**Out of scope:** Processing entries simultaneously from multiple users.
**Acceptance criteria:**
```gherkin
# Happy path
Given the user has submitted raw text logs
When the application sends the logs to the Gemini API
Then it receives a structured response mapping each entry to an extracted duration, Main Type, and Sub Type
And transitions the UI to the review state

# Sad path (AI Hallucination/Invalid format)
Given the user has submitted raw text logs
When the Gemini API returns a category that does not exist in the predefined Notion list
Then the application falls back to treating that line as an AI parse failure

# Sad path (AI failure)
Given the user has submitted raw text logs
When the AI fails to parse a specific, malformed text line
Then the application flags that specific line as an AI failure in the data structure
And continues processing the remaining lines
```

## US-004
**Title:** Review and correct AI suggestions
**Statement:** As a personal user, I want to review the AI's suggestions and manually correct any mistakes, so that I ensure my Notion data is perfectly accurate before syncing.
**Priority:** Must have — Necessary to mitigate AI errors.
**Assumptions:** The raw logs have been processed by the AI and returned to the frontend.
**Out of scope:** Bulk editing multiple entries at once.
**Acceptance criteria:**
```gherkin
# Happy path
Given the application is in the review state
When the user views the parsed entries
Then they see the original text, extracted time, and suggested categories for each entry
And they can approve each row or modify the fields via dropdowns and text inputs

# Edge case (AI failed to parse line)
Given the application is in the review state
When an entry was flagged as an AI parse failure
Then the UI displays the raw text with blank category/time fields
And highlights the row in red to require manual data entry before it can be approved

# Security / Validation
Given the user is manually correcting a category
When they open the category dropdown
Then they can only select from the valid Notion categories fetched during startup
```

## US-005
**Title:** Sync approved entries to Notion
**Statement:** As a personal user, I want to sync my approved entries to my Notion database, so that my tracking workflow is completed in my centralized system.
**Priority:** Must have — The final step of the pipeline.
**Assumptions:** At least one entry has been approved by the user.
**Out of scope:** Two-way sync (updating the local `.txt` file based on Notion changes).
**Acceptance criteria:**
```gherkin
# Happy path
Given the user has approved all entries in the review queue
When they click "Sync to Notion"
Then the application successfully appends each entry to the Notion database
And displays a success message
And clears the review queue

# Edge case (Partial selection)
Given the user has approved only 3 out of 5 entries
When they click "Sync to Notion"
Then only the 3 approved entries are synced
And the 2 unapproved entries remain in the review queue

# Sad path (Sync failure)
Given the user clicks "Sync to Notion"
When the Notion API rate limits the request halfway through the batch
Then the successfully synced entries are cleared from the queue
And the failed entries remain in the queue with a clear error message
And a "Retry Sync" option is provided for the failed entries
```
