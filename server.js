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

    let mainTypes = extractOptions('Main Type');
    const subTypes = extractOptions('Sub Type');

    // Force main types to always be the user's requested list
    mainTypes = ["ATGO", "FINGO", "FAMGO", "PHYGO", "EDGO", "PLEAGO", "CARGO"];

    // If API doesn't return properties for subTypes, use a fallback list so AI has something to work with
    if (subTypes.length === 0) {
        subTypes.push(
            // FAMGO
            "Myself", "Family Member", "House Maintenance", "Pets", "Chores",
            // ATGO
            "Meditation/Mindfulness", "Journaling/Reflection", "Therapy/Mental Health", "Goal Setting",
            // FINGO
            "Budgeting & Bills", "Investing", "Income Generation", "Taxes/Admin",
            // PHYGO
            "Gym/Strength", "Cardio/Sports", "Meal Prep", "Medical",
            // EDGO
            "Coursework", "Reading", "Skill Practice", "Research",
            // PLEAGO
            "Gaming", "Screen Time", "Socializing", "Hobbies",
            // CARGO
            "Deep Work", "Meetings/Calls", "Admin/Emails", "Networking", "Job Search"
        );
    }

    const subTypeMapping = {
        "FAMGO": ["Myself", "Family Member", "House Maintenance", "Pets", "Chores"],
        "ATGO": ["Meditation/Mindfulness", "Journaling/Reflection", "Therapy/Mental Health", "Goal Setting"],
        "FINGO": ["Budgeting & Bills", "Investing", "Income Generation", "Taxes/Admin"],
        "PHYGO": ["Gym/Strength", "Cardio/Sports", "Meal Prep", "Medical"],
        "EDGO": ["Coursework", "Reading", "Skill Practice", "Research"],
        "PLEAGO": ["Gaming", "Screen Time", "Socializing", "Hobbies"],
        "CARGO": ["Deep Work", "Meetings/Calls", "Admin/Emails", "Networking", "Job Search"]
    };

    return { mainTypes, subTypes, subTypeMapping };
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
        const { entries } = req.body;
        if (!entries || !Array.isArray(entries)) {
            return res.status(400).json({ error: 'Missing or invalid entries array' });
        }
        if (entries.length > 50) {
            return res.status(400).json({ error: 'Payload too large. Maximum 50 entries allowed per request.' });
        }
        if (!process.env.GEMINI_API_KEY) {
            return res.status(500).json({ error: 'GEMINI_API_KEY is not configured' });
        }

        const categories = await getNotionCategories();

        const mainTypeDefinitions = {
            "ATGO": "attitude, mind related things",
            "FINGO": "financial related things",
            "FAMGO": "family, home related things",
            "PHYGO": "physical, health related things",
            "EDGO": "learning, getting education related things",
            "PLEAGO": "pleasure, entertainment related things",
            "CARGO": "career related things"
        };

        const subTypeDefinitions = {
            // FAMGO
            "Myself": "Personal chores, taking care of oneself",
            "Family Member": "Time spent helping, talking to, or caring for family members",
            "House Maintenance": "Cleaning, cooking, DIY, grocery shopping",
            "Pets": "Walking the dog, feeding pets",
            "Chores": "General errands, cleaning, and routine household tasks",
            // ATGO
            "Meditation/Mindfulness": "Quiet time, breathing exercises",
            "Journaling/Reflection": "Planning your week, writing thoughts",
            "Therapy/Mental Health": "Appointments or specific mental health exercises",
            "Goal Setting": "Reviewing goals, planning next steps",
            // FINGO
            "Budgeting & Bills": "Paying rent, balancing the checkbook",
            "Investing": "Researching stocks, managing portfolios",
            "Income Generation": "Side hustles, selling things online",
            "Taxes/Admin": "Doing tax returns, managing paperwork",
            // PHYGO
            "Gym/Strength": "Weightlifting, structured workouts",
            "Cardio/Sports": "Running, cycling, playing sports",
            "Meal Prep": "Cooking healthy food specifically for the week",
            "Medical": "Doctor/Dentist appointments, sick time",
            // EDGO
            "Coursework": "Watching lectures, taking formal classes",
            "Reading": "Reading educational books, articles",
            "Skill Practice": "Practicing coding, a language, or an instrument",
            "Research": "Going down a Wikipedia rabbit hole on a useful topic",
            // PLEAGO
            "Gaming": "Video games, board games",
            "Screen Time": "Movies, TV, YouTube, scrolling",
            "Socializing": "Hanging out with friends, parties",
            "Hobbies": "Art, music, reading fiction",
            // CARGO
            "Deep Work": "Focused, uninterrupted project work",
            "Meetings/Calls": "Zoom calls, syncs, standups",
            "Admin/Emails": "Replying to Slack, organizing your inbox",
            "Networking": "LinkedIn, catching up with colleagues",
            "Job Search": "Updating resume, applying for roles"
        };

        const todayDate = new Date().toISOString().split('T')[0];

        const prompt = `You are a data parsing assistant. Your task is to extract information from an array of free-form time tracking text entries and categorize them strictly into the provided Notion categories.

Valid Main Types: ${JSON.stringify(categories.mainTypes)}
Main Type Definitions: ${JSON.stringify(mainTypeDefinitions, null, 2)}
Valid Sub Types: ${JSON.stringify(categories.subTypes)}
Sub Type Definitions: ${JSON.stringify(subTypeDefinitions, null, 2)}

Today's date is: ${todayDate}.

For each entry, extract the duration (e.g. "0.2H"). Determine the date for the entry in YYYY-MM-DD format. If the entry text explicitly mentions a date, use that. If the entry falls underneath a preceding date header in the input array, apply that header's date to the entry. If no date is found and there is no preceding date header, leave the date field completely empty (""). DO NOT default to today's date.
Then suggest the best matching Main Type and Sub Type. 
IMPORTANT: If an entry is simply a date header (e.g., "2026.08.16") or contains no actual time-tracking activity, completely ignore it and DO NOT include it in the output JSON array. 
If a line appears to be an activity but is malformed, set isAiFailure to true and leave duration, mainType, and subType as empty strings. DO NOT hallucinate categories that are not in the valid lists.

Return a JSON array of objects with this exact structure:
[
  {
    "originalText": "the exact string provided",
    "date": "YYYY-MM-DD",
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

        // 1. Identify unique dates
        const uniqueDates = [...new Set(entries.map(e => e.date).filter(Boolean))];

        // 2. Query and archive existing entries for those dates
        for (const dateStr of uniqueDates) {
            try {
                // The @notionhq/client version installed is missing databases.query, so we use native fetch
                const queryRes = await fetch(`https://api.notion.com/v1/databases/${process.env.NOTION_DATABASE_ID}/query`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${process.env.NOTION_API_KEY}`,
                        'Notion-Version': '2022-06-28',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        filter: { property: "Date", date: { equals: dateStr } }
                    })
                });
                
                if (!queryRes.ok) {
                    throw new Error(`Notion API error: ${queryRes.status} ${queryRes.statusText}`);
                }
                
                const queryData = await queryRes.json();

                for (const page of queryData.results) {
                    await notion.pages.update({
                        page_id: page.id,
                        archived: true
                    });
                }
            } catch (err) {
                console.error(`Failed to clear existing entries for date ${dateStr}:`, err.message);
            }
        }

        // 3. Process sequentially to insert new entries (Notion is strict ~3 req/sec)
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
                        properties["Regular hours"] = { number: parsedHours };
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
