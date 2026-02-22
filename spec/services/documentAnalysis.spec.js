'use strict';

// Unit tests for src/services/documentAnalysis.js

// Mock pdf-parse v2 API: { PDFParse } constructor with getText() method
const mockGetText = jest.fn().mockResolvedValue({
    text: 'This is a detailed annual budget report with revenue of $985,000 and expenses of $890,000 for fiscal year 2024.',
});
const MockPDFParse = jest.fn().mockImplementation(() => ({ getText: mockGetText }));
jest.mock('pdf-parse', () => ({ PDFParse: MockPDFParse }));

jest.mock('fs', () => ({
    readFileSync: jest.fn(() => Buffer.from('%PDF-1.4 fake pdf content')),
}));

const mockGenerateContent = jest.fn().mockResolvedValue({
    response: {
        text: () => JSON.stringify({
            title: 'Test Budget',
            summary: 'A test budget document.',
            highlights: ['Revenue up 4%'],
            charts: [],
        }),
    },
});
jest.mock('@google/generative-ai', () => ({
    GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
        getGenerativeModel: jest.fn().mockReturnValue({
            generateContent: mockGenerateContent,
        }),
    })),
}));

describe('analyzeDocument', () => {
    beforeEach(() => {
        mockGetText.mockClear();
        MockPDFParse.mockClear();
        mockGenerateContent.mockClear();
    });

    test('successfully parses pdf and returns analysis', async () => {
        const { analyzeDocument } = require('../../src/services/documentAnalysis');
        const result = await analyzeDocument('/fake/path/budget.pdf');

        expect(MockPDFParse).toHaveBeenCalledWith({ data: expect.any(Buffer) });
        expect(mockGetText).toHaveBeenCalled();
        expect(result.title).toBe('Test Budget');
        expect(result.summary).toBe('A test budget document.');
        expect(result.highlights).toEqual(['Revenue up 4%']);
        expect(Array.isArray(result.charts)).toBe(true);
    });

    test('throws if PDF has insufficient text', async () => {
        mockGetText.mockResolvedValueOnce({ text: 'short' });

        const { analyzeDocument } = require('../../src/services/documentAnalysis');
        await expect(analyzeDocument('/fake/path/short.pdf')).rejects.toThrow(
            'Could not extract meaningful text from PDF',
        );
    });

    test('throws if AI returns invalid JSON', async () => {
        mockGenerateContent.mockResolvedValueOnce({
            response: { text: () => 'not json at all' },
        });

        const { analyzeDocument } = require('../../src/services/documentAnalysis');
        await expect(analyzeDocument('/fake/path/budget.pdf')).rejects.toThrow(
            'AI returned invalid JSON',
        );
    });
});
