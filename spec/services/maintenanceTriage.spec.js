'use strict';

// Unit tests for src/services/maintenanceTriage.js

const mockGenerateContent = jest.fn();
jest.mock('@google/generative-ai', () => ({
    GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
        getGenerativeModel: jest.fn().mockReturnValue({
            generateContent: mockGenerateContent,
        }),
    })),
}));

function makeAiResponse(obj) {
    return { response: { text: () => JSON.stringify(obj) } };
}

const VALID_TRIAGE = {
    category: 'plumbing',
    suggested_priority: 'high',
    vendor_type: 'plumber',
    summary: 'Burst pipe needs immediate repair.',
    urgency_reason: 'Active water leak risking structural damage.',
};

describe('triageRequest', () => {
    let triageRequest;

    beforeEach(() => {
        jest.resetModules();
        mockGenerateContent.mockClear();
        mockGenerateContent.mockResolvedValue(makeAiResponse(VALID_TRIAGE));
        ({ triageRequest } = require('../../src/services/maintenanceTriage'));
    });

    test('returns structured triage for a valid AI response', async () => {
        const result = await triageRequest({
            title: 'Burst pipe',
            description: 'Water spraying in lobby',
            location: 'Lobby ceiling',
        });
        expect(result.category).toBe('plumbing');
        expect(result.suggested_priority).toBe('high');
        expect(result.vendor_type).toBe('plumber');
        expect(result.summary).toBeTruthy();
        expect(result.urgency_reason).toBeTruthy();
    });

    test('sends title, description, and location to Gemini', async () => {
        await triageRequest({ title: 'No heat', description: 'HVAC down', location: 'Unit 4B' });

        expect(mockGenerateContent).toHaveBeenCalledTimes(1);
        const [prompt] = mockGenerateContent.mock.calls[0];
        expect(prompt).toContain('No heat');
        expect(prompt).toContain('HVAC down');
        expect(prompt).toContain('Unit 4B');
    });

    test('strips markdown code fences from AI response', async () => {
        mockGenerateContent.mockResolvedValueOnce({
            response: { text: () => '```json\n' + JSON.stringify(VALID_TRIAGE) + '\n```' },
        });
        const result = await triageRequest({ title: 'Leak', description: 'Dripping' });
        expect(result.category).toBe('plumbing');
    });

    test('normalises invalid category to "other"', async () => {
        mockGenerateContent.mockResolvedValueOnce(
            makeAiResponse({ ...VALID_TRIAGE, category: 'bogus' }),
        );
        const result = await triageRequest({ title: 'Weird issue', description: 'Unknown' });
        expect(result.category).toBe('other');
    });

    test('normalises invalid suggested_priority to "normal"', async () => {
        mockGenerateContent.mockResolvedValueOnce(
            makeAiResponse({ ...VALID_TRIAGE, suggested_priority: 'critical' }),
        );
        const result = await triageRequest({ title: 'Something', description: 'Bad priority' });
        expect(result.suggested_priority).toBe('normal');
    });

    test('normalises invalid vendor_type to "other"', async () => {
        mockGenerateContent.mockResolvedValueOnce(
            makeAiResponse({ ...VALID_TRIAGE, vendor_type: 'wizard' }),
        );
        const result = await triageRequest({ title: 'x', description: 'y' });
        expect(result.vendor_type).toBe('other');
    });

    test('defaults missing summary to fallback string', async () => {
        mockGenerateContent.mockResolvedValueOnce(
            makeAiResponse({ category: 'electrical', suggested_priority: 'low', vendor_type: 'electrician' }),
        );
        const result = await triageRequest({ title: 'Flickering lights', description: '' });
        expect(result.summary).toBe('Maintenance request received.');
    });

    test('defaults missing urgency_reason to empty string', async () => {
        mockGenerateContent.mockResolvedValueOnce(
            makeAiResponse({ ...VALID_TRIAGE, urgency_reason: undefined }),
        );
        const result = await triageRequest({ title: 'x', description: 'y' });
        expect(result.urgency_reason).toBe('');
    });

    test('throws if AI returns non-JSON text', async () => {
        mockGenerateContent.mockResolvedValueOnce({
            response: { text: () => 'Sorry, I cannot help with that.' },
        });
        await expect(
            triageRequest({ title: 'Broken door', description: 'Hinges snapped' }),
        ).rejects.toThrow('AI returned invalid JSON');
    });

    test('accepts all valid category values', async () => {
        const validCategories = ['plumbing', 'electrical', 'hvac', 'structural', 'appliances', 'common_area', 'other'];
        for (const category of validCategories) {
            mockGenerateContent.mockResolvedValueOnce(makeAiResponse({ ...VALID_TRIAGE, category }));
            const result = await triageRequest({ title: 'x', description: 'y' });
            expect(result.category).toBe(category);
        }
    });

    test('accepts all valid priority values', async () => {
        const validPriorities = ['low', 'normal', 'high', 'emergency'];
        for (const suggested_priority of validPriorities) {
            mockGenerateContent.mockResolvedValueOnce(makeAiResponse({ ...VALID_TRIAGE, suggested_priority }));
            const result = await triageRequest({ title: 'x', description: 'y' });
            expect(result.suggested_priority).toBe(suggested_priority);
        }
    });
});
