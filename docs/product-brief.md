# Product Brief — TimeSync AI

## Problem
The user tracks their day in a local, offline-first free-form text file to maintain speed and avoid internet dependencies. However, to analyze this data in Notion, entries must be tagged with specific "Main Type" and "Sub Type" categories. Manually tagging every free-form entry is tedious, time-consuming, and breaks the low-friction nature of the offline text file workflow.

## Target Users
- Primary: The user (personal productivity tool).
- Secondary: None.
- Not for: Enterprise teams, multiple concurrent users, or complex billing scenarios.

## Value Proposition
For the personal user who tracks time in a fast, free-form local text file, TimeSync AI is a web utility that uses AI to automatically categorize daily logs into predefined Notion properties. Unlike manual tagging or complex time-tracking apps, it preserves the offline-first text workflow while eliminating the friction of data entry into Notion.

## Business Model
- Revenue model: Internal/personal tool (Free).
- Pricing direction: N/A.
- Free vs paid: N/A. The user brings their own API keys (Notion, Gemini).

## MVP Scope
### Core hypothesis
An AI model (like Gemini) can accurately parse free-form time tracking lines and reliably map them to a strict, predefined set of Notion Main Types and Sub Types, significantly reducing the time spent on manual data entry.

### In MVP (launch features)
1. **Input Mechanism**: Web UI text area to paste the day's raw text entries or a simple file upload. (Why: Essential for getting data into the pipeline).
2. **AI Categorization Engine**: Integration with Gemini (or similar AI) to read each entry, extract time/duration, and suggest the best Main Type and Sub Type from a predefined list. (Why: The core value proposition).
3. **Review Interface**: A UI to display each parsed entry alongside the AI's suggested categories, with dropdowns/inputs to approve as-is or manually correct the categories. (Why: User needs final approval before syncing).
4. **Notion Sync**: Integration with Notion API to append approved entries as rows in the target Notion table. (Why: Completes the workflow).

### NOT in MVP (deferred)
1. **Real-time file watching**: Automatically reading the local `.txt` file as it changes (copy-paste or manual load is simpler for MVP).
2. **Authentication/Multi-user support**: This is a single-user tool. A simple passcode or local environment variable is enough.
3. **Analytics/Dashboards**: Notion already handles this.
4. **Offline support for the Web UI itself**: The sync step fundamentally requires the internet.

### Success metric
The time spent reviewing and syncing a full day's worth of logs into Notion is reduced to under 2 minutes, with a >85% AI categorization accuracy rate requiring no manual corrections.

## Risks & Assumptions
| # | Risk | Assumption | Impact if wrong | Validation approach |
|---|------|-----------|----------------|-------------------|
| 1 | **Technical/AI Risk** | The AI can strictly output ONLY the predefined Notion categories without hallucinating new ones. | High - User will have to manually correct everything or Notion sync will fail. | Prototype the prompt first with a few examples and Gemini API to ensure strict JSON output matching predefined categories. |
| 2 | **Dependency Risk** | The Notion API and Gemini API free tiers are sufficient for daily usage. | Medium - Might incur unexpected costs. | Check API pricing and rate limits; daily usage should be well within free tiers. |
| 3 | **Format Consistency Risk** | The user's free-form text follows a somewhat parsable pattern (e.g., `08.00 - 08.10 - 0.2H - task`). | Medium - AI might fail to parse the raw text if it varies wildly. | Provide a few shot examples to the AI of how the text log looks. |

## Recommendation
**Go**

The core hypothesis is clear, the problem is well-defined, and the MVP scope is extremely tight. The pipeline is straightforward (Text -> Web UI -> AI -> Notion). The primary risk is AI hallucination, which can be mitigated with strict prompt engineering and the built-in manual review step. Proceed to Requirements Analysis.
