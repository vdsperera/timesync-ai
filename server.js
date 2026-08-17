require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { Client } = require('@notionhq/client');
const { GoogleGenAI } = require('@google/genai');

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Basic health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Helper for Notion Categories
async function getNotionCategories() {
    if (!process.env.NOTION_DATABASE_ID) {
        throw new Error('NOTION_DATABASE_ID is not configured');
    }
    if (!process.env.NOTION_API_KEY) {
        throw new Error('NOTION_API_KEY is not configured');
    }

    const database = await notion.databases.retrieve({
        database_id: process.env.NOTION_DATABASE_ID
    });

    const extractOptions = (propertyName) => {
        if (!database.properties) return []; // Fallback if properties object is missing (Linked DB)
        const prop = database.properties[propertyName];
        if (!prop) return [];
        if (prop.type === 'select') return prop.select.options.map(o => o.name);
        if (prop.type === 'multi_select') return prop.multi_select.options.map(o => o.name);
        return [];
    };

    const mainTypes = extractOptions('Main Type');
    const subTypes = extractOptions('Sub Type');

    // If API doesn't return properties, use a fallback list so AI has something to work with
    if (mainTypes.length === 0) {
        mainTypes.push("Work", "Personal", "Learning");
    }
    if (subTypes.length === 0) {
        subTypes.push("Coding", "Meetings", "Chores", "Admin");
    }

    return { mainTypes, subTypes };
}

app.get('/api/categories', async (req, res) => {
    try {
        const categories = await getNotionCategories();
        res.json(categories);
    } catch (error) {
        console.error('Error fetching categories from Notion:', error.message);
        res.status(502).json({ error: 'Failed to fetch categories from Notion API' });
    }
});

app.post('/api/parse', async (req, res) => {
    try {
        const entries = req.body?.entries;
        if (!Array.isArray(entries) || entries.length === 0) {
            return res.status(400).json({ error: 'Missing or invalid entries array' });
        }
        if (entries.length > 50) {
            return res.status(400).json({ error: 'Payload too large. Maximum 50 entries allowed per request.' });
        }
        if (!process.env.GEMINI_API_KEY) {
            return res.status(500).json({ error: 'GEMINI_API_KEY is not configured' });
        }

        const categories = await getNotionCategories();

        const prompt = `You are a data parsing assistant. Your task is to extract information from an array of free-form time tracking text entries and categorize them strictly into the provided Notion categories.

Valid Main Types: ${JSON.stringify(categories.mainTypes)}
Valid Sub Types: ${JSON.stringify(categories.subTypes)}

For each entry, extract the duration (e.g. "0.2H") and suggest the best matching Main Type and Sub Type. If a line is malformed or you cannot confidently categorize it, set isAiFailure to true and leave duration, mainType, and subType as empty strings. DO NOT hallucinate categories that are not in the valid lists.

Return ONLY a valid JSON array of objects with the exact following schema, nothing else:
[
  {
    "originalText": "the exact string provided",
    "duration": "extracted duration",
    "mainType": "closest valid main type",
    "subType": "closest valid sub type",
    "isAiFailure": boolean
  }
]

Input entries:
${JSON.stringify(entries, null, 2)}
`;

        const response = await ai.models.generateContent({
            model: 'gemini-3.6-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
            }
        });

        let parsedResults;
        try {
            parsedResults = JSON.parse(response.text);
        } catch (e) {
            console.error("Failed to parse Gemini JSON:", response.text);
            return res.status(502).json({ error: 'Failed to parse AI response as JSON' });
        }

        res.json({ results: parsedResults });
    } catch (error) {
        console.error('Error parsing with Gemini:', error.message);
        res.status(502).json({ error: 'Failed to parse entries with Gemini API' });
    }
});

app.post('/api/sync', async (req, res) => {
    try {
        const entries = req.body?.entries;
        if (!Array.isArray(entries) || entries.length === 0) {
            return res.status(400).json({ error: 'Missing or invalid entries array' });
        }
        if (entries.length > 50) {
            return res.status(400).json({ error: 'Payload too large. Maximum 50 entries allowed per request.' });
        }
        if (!process.env.NOTION_DATABASE_ID || !process.env.NOTION_API_KEY) {
            return res.status(500).json({ error: 'Notion environment variables are not configured' });
        }

        let successCount = 0;
        let failedEntries = [];

        // Process sequentially to respect rate limits (Notion is strict ~3 req/sec)
        for (const entry of entries) {
            try {
                const properties = {
                    "Entry": {
                        title: [
                            { text: { content: entry.originalText || "Untitled Entry" } }
                        ]
                    }
                };

                // Conditionally add fields if they exist
                if (entry.date) {
                    properties["Date"] = { date: { start: entry.date } };
                }
                if (entry.duration) {
                    const parsedHours = parseFloat(entry.duration.replace(/[^\d.-]/g, ''));
                    if (!isNaN(parsedHours)) {
                        properties["Regular Hours"] = { number: parsedHours };
                    }
                }
                if (entry.mainType) {
                    properties["Main Type"] = { select: { name: entry.mainType } };
                }
                if (entry.subType) {
                    properties["Sub Type"] = { select: { name: entry.subType } };
                }

                await notion.pages.create({
                    parent: { database_id: process.env.NOTION_DATABASE_ID },
                    properties: properties
                });

                successCount++;
            } catch (err) {
                console.error('Failed to sync entry to Notion:', entry.originalText, err.message);
                failedEntries.push({
                    entry,
                    error: "Notion API error. Please try again."
                });
            }
        }

        // If all failed, it's a 502. If some succeeded, return 200 with partial failure info.
        if (successCount === 0 && failedEntries.length > 0) {
            return res.status(502).json({ error: 'All sync attempts failed', failedEntries });
        }

        res.json({ successCount, failedEntries });
    } catch (error) {
        console.error('Fatal error during Notion sync:', error.message);
        res.status(500).json({ error: 'Internal server error during sync' });
    }
});

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server listening on http://localhost:${PORT}`);
    });
}

module.exports = app;
