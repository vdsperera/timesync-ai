# TimeSync AI REST API

The local backend exposes the following internal endpoints for the frontend to consume. These endpoints proxy requests to Notion and Gemini securely.

## Endpoints

### Fetch Categories
```http
GET /api/categories
```
**Description:** Fetches the available options for `Main Type` and `Sub Type` from the configured Notion database schema.
**Authentication:** None (Localhost only)

**Response:**
*Success (200 OK)*
```json
{
  "mainTypes": ["ATGO", "FINGO", "FAMGO", "PHYGO", "EDGO", "PLEAGO", "CARGO"],
  "subTypes": ["hygiene", "general coding"]
}
```
*Server Error (502 Bad Gateway)*
```json
{
  "error": "Failed to fetch categories from Notion API"
}
```

### Parse Entries
```http
POST /api/parse
```
**Description:** Uses the Gemini API to parse an array of raw text logs into structured categorization objects.
**Authentication:** None (Localhost only)

**Request:**
*Headers:* `Content-Type: application/json`
*Body:*
```json
{
  "entries": [
    "08.00 - 08.10 - 0.2H - morning wash"
  ]
}
```
*(Note: Maximum of 50 entries allowed per request).*

**Response:**
*Success (200 OK)*
```json
{
  "results": [
    {
      "originalText": "08.00 - 08.10 - 0.2H - morning wash",
      "duration": "0.2H",
      "mainType": "famgo",
      "subType": "hygiene",
      "isAiFailure": false
    }
  ]
}
```
*Client Error (400 Bad Request)*
```json
{
  "error": "Payload too large. Maximum 50 entries allowed per request."
}
```
*Server Error (502 Bad Gateway)*
```json
{
  "error": "Failed to parse AI response as JSON"
}
```

### Sync Entries
```http
POST /api/sync
```
**Description:** Appends a batch of approved entries to the Notion database. Handles Notion rate limiting by returning partial successes to the client.
**Authentication:** None (Localhost only)

**Request:**
*Headers:* `Content-Type: application/json`
*Body:*
```json
{
  "entries": [
    {
      "originalText": "08.00 - 08.10 - 0.2H - morning wash",
      "duration": "0.2H",
      "mainType": "famgo",
      "subType": "hygiene",
      "date": "2026-08-17"
    }
  ]
}
```

**Response:**
*Success (200 OK)*
```json
{
  "successCount": 1,
  "failedEntries": []
}
```
*(Note: Returns 200 even if some entries failed due to rate limits. The failed entries will populate the `failedEntries` array).*

*Server Error (502 Bad Gateway)*
```json
{
  "error": "All sync attempts failed",
  "failedEntries": [
    {
      "entry": {
        "originalText": "08.00 - 08.10 - 0.2H - morning wash",
        "duration": "0.2H",
        "mainType": "famgo",
        "subType": "hygiene",
        "date": "2026-08-17"
      },
      "error": "Notion API error. Please try again."
    }
  ]
}
```
