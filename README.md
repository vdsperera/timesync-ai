# TimeSync AI

TimeSync AI is a personal, offline-first tool designed to seamlessly process and categorize your daily raw text logs into structured Notion entries. By leveraging the Gemini API to parse natural language durations and categories, it eliminates manual data entry while maintaining a fast, lightweight, and secure local environment.

## Quick start
1. Clone the repository
2. Run `npm install`
3. Copy `.env.example` to `.env` and fill in your keys
4. Run `npm start`
5. Open `http://localhost:3000` in your browser

## Prerequisites
- Node.js >= 18.0
- A Notion integration token (Internal Integration Secret)
- A Gemini API Key
- A Notion Database with the properties: `Entry` (Text), `Date` (Date), `Regular Hours` (Number), `Main Type` (Select), `Sub Type` (Select).

## Installation
```bash
git clone <repository_url> timesync-ai
cd timesync-ai
npm install
```

## Configuration
Create a `.env` file in the root directory with the following variables:

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `PORT` | Number | No | `3000` | The port the local server will run on. |
| `NOTION_API_KEY` | String | Yes | - | Your Notion Internal Integration token. |
| `NOTION_DATABASE_ID` | String | Yes | - | The ID of the Notion Database to sync to. |
| `GEMINI_API_KEY` | String | Yes | - | Your Google Gemini API key. |

## Usage
1. Start the local server:
   ```bash
   npm start
   ```
2. Open your browser and navigate to `http://localhost:3000`.
3. Paste your raw text logs into the input area.
4. Click "Process Logs" to use AI categorization.
5. Review the AI's suggestions in the table, making any necessary manual corrections.
6. Click "Sync to Notion" to securely push the approved entries to your database.

## Project structure
- `public/` - Static assets for the Vanilla JS frontend (HTML, CSS, JS)
- `server.js` - Express backend for proxying external APIs securely
- `tests/` - Jest and Supertest automated test suite
- `docs/` - Project documentation, architecture, and SDLC artifacts

## License
MIT
