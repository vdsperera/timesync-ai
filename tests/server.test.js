const request = require('supertest');

const mockRetrieveDatabase = jest.fn();
const mockCreatePage = jest.fn();
const mockGenerateContent = jest.fn();

jest.mock('@notionhq/client', () => ({
    Client: jest.fn().mockImplementation(() => ({
        databases: { retrieve: mockRetrieveDatabase },
        pages: { create: mockCreatePage }
    }))
}));

jest.mock('@google/genai', () => ({
    GoogleGenAI: jest.fn().mockImplementation(() => ({
        models: { generateContent: mockGenerateContent }
    }))
}));

const app = require('../server');

describe('TimeSync AI Backend API', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        // Reset environment variables
        process.env.NOTION_DATABASE_ID = 'test_db_id';
        process.env.NOTION_API_KEY = 'test_notion_key';
        process.env.GEMINI_API_KEY = 'test_gemini_key';
    });

    describe('GET /health', () => {
        it('should return status ok', async () => {
            const res = await request(app).get('/health');
            expect(res.statusCode).toEqual(200);
            expect(res.body).toEqual({ status: 'ok' });
        });
    });

    describe('GET /api/categories', () => {
        it('should return parsed mainTypes and subTypes on happy path', async () => {
            mockRetrieveDatabase.mockResolvedValue({
                properties: {
                    'Main Type': { type: 'select', select: { options: [{ name: 'famgo' }] } },
                    'Sub Type': { type: 'multi_select', multi_select: { options: [{ name: 'hygiene' }] } }
                }
            });

            const res = await request(app).get('/api/categories');
            expect(res.statusCode).toEqual(200);
            expect(res.body).toEqual({
                mainTypes: ['famgo'],
                subTypes: ['hygiene']
            });
        });

        it('should fail gracefully if NOTION_DATABASE_ID is missing', async () => {
            delete process.env.NOTION_DATABASE_ID;
            const res = await request(app).get('/api/categories');
            expect(res.statusCode).toEqual(502); // Server wraps the error in 502
            expect(res.body).toEqual({ error: 'Failed to fetch categories from Notion API' });
        });

        it('should fail gracefully if Notion network request fails', async () => {
            mockRetrieveDatabase.mockRejectedValue(new Error('Network Error'));
            const res = await request(app).get('/api/categories');
            expect(res.statusCode).toEqual(502);
            expect(res.body).toEqual({ error: 'Failed to fetch categories from Notion API' });
        });
    });

    describe('POST /api/parse', () => {
        beforeEach(() => {
            mockRetrieveDatabase.mockResolvedValue({
                properties: {
                    'Main Type': { type: 'select', select: { options: [{ name: 'famgo' }] } },
                    'Sub Type': { type: 'multi_select', multi_select: { options: [{ name: 'hygiene' }] } }
                }
            });
        });

        it('should return structured array on happy path', async () => {
            mockGenerateContent.mockResolvedValue({
                text: JSON.stringify([{
                    originalText: '08.00 - 08.10 - 0.2H - wash',
                    duration: '0.2H',
                    mainType: 'famgo',
                    subType: 'hygiene',
                    isAiFailure: false
                }])
            });

            const res = await request(app).post('/api/parse').send({
                entries: ['08.00 - 08.10 - 0.2H - wash']
            });
            
            expect(res.statusCode).toEqual(200);
            expect(res.body.results).toHaveLength(1);
            expect(res.body.results[0].duration).toEqual('0.2H');
        });

        it('should reject payload with 0 entries (400)', async () => {
            const res = await request(app).post('/api/parse').send({ entries: [] });
            expect(res.statusCode).toEqual(400);
            expect(res.body.error).toMatch(/Missing or invalid entries array/);
        });

        it('should reject payload with > 50 entries (400)', async () => {
            const entries = new Array(51).fill('log entry');
            const res = await request(app).post('/api/parse').send({ entries });
            expect(res.statusCode).toEqual(400);
            expect(res.body.error).toMatch(/Payload too large/);
        });

        it('should handle Gemini API returning malformed JSON (502)', async () => {
            mockGenerateContent.mockResolvedValue({ text: 'Not a JSON array' });
            
            const res = await request(app).post('/api/parse').send({
                entries: ['log entry']
            });
            
            expect(res.statusCode).toEqual(502);
            expect(res.body.error).toEqual('Failed to parse AI response as JSON');
        });
    });

    describe('POST /api/sync', () => {
        const payload = [
            { originalText: 'test1', duration: '1H' },
            { originalText: 'test2', duration: '2H' }
        ];

        it('should return successCount matching input size', async () => {
            mockCreatePage.mockResolvedValue({}); // Succeeds for both
            
            const res = await request(app).post('/api/sync').send({ entries: payload });
            expect(res.statusCode).toEqual(200);
            expect(res.body.successCount).toEqual(2);
            expect(res.body.failedEntries).toHaveLength(0);
        });

        it('should handle partial rate limiting, returning 200 with partial failure', async () => {
            // First call succeeds, second fails
            mockCreatePage.mockResolvedValueOnce({});
            mockCreatePage.mockRejectedValueOnce(new Error('Rate limited'));
            
            const res = await request(app).post('/api/sync').send({ entries: payload });
            
            expect(res.statusCode).toEqual(200);
            expect(res.body.successCount).toEqual(1);
            expect(res.body.failedEntries).toHaveLength(1);
            expect(res.body.failedEntries[0].entry.originalText).toEqual('test2');
        });

        it('should handle total failure, returning 502 with all entries', async () => {
            mockCreatePage.mockRejectedValue(new Error('API Down'));
            
            const res = await request(app).post('/api/sync').send({ entries: payload });
            
            expect(res.statusCode).toEqual(502);
            expect(res.body.error).toEqual('All sync attempts failed');
            expect(res.body.failedEntries).toHaveLength(2);
        });

        it('should not leak raw error.message in JSON on total failure (Security)', async () => {
            const secretError = 'SENSITIVE_INTERNAL_IP_10.0.0.1';
            mockCreatePage.mockRejectedValue(new Error(secretError));
            
            const res = await request(app).post('/api/sync').send({ entries: payload });
            
            expect(res.statusCode).toEqual(502);
            const responseText = JSON.stringify(res.body);
            expect(responseText).not.toContain(secretError);
            expect(res.body.failedEntries[0].error).toEqual('Notion API error. Please try again.');
        });
    });
});
