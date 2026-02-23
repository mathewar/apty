const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function analyzeDocument(filePath) {
    // 1. Extract text via pdf-parse (v2 API)
    const { PDFParse } = require('pdf-parse');
    const buffer = fs.readFileSync(filePath);
    const parser = new PDFParse({ data: buffer });
    const data = await parser.getText();
    const text = data.text;

    if (!text || text.trim().length < 50) {
        throw new Error('Could not extract meaningful text from PDF');
    }

    // 2. Send to Gemini with structured prompt
    const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });

    const prompt = `You are a financial data analyst. Analyze the following building/co-op document text and extract key financial data to create interactive charts for residents.

Return ONLY a valid JSON object (no markdown, no code blocks) with this exact schema:
{
  "title": "document title",
  "summary": "plain English summary for residents (2-3 sentences)",
  "highlights": ["key highlight 1", "key highlight 2", "key highlight 3"],
  "charts": [
    {
      "type": "pie",
      "title": "chart title",
      "labels": ["Label1", "Label2"],
      "data": [1000, 2000],
      "unit": "$"
    },
    {
      "type": "bar",
      "title": "chart title",
      "labels": ["2022", "2023", "2024"],
      "datasets": [
        { "label": "Revenue", "data": [900000, 950000, 985000] },
        { "label": "Expenses", "data": [820000, 870000, 890000] }
      ],
      "unit": "$"
    }
  ]
}

Rules:
- Include 2-4 charts mixing pie and bar types where appropriate
- Extract real numbers from the document
- If no meaningful financial data exists, return at least a summary and highlights with an empty charts array
- highlights should be 3-5 bullet points of key takeaways for residents
- All monetary values should be numbers (not strings)

Document text:
${text.substring(0, 15000)}`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // 3. Parse and return JSON
    let analysis;
    try {
        // Strip any markdown code block wrappers if present
        const cleaned = responseText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
        analysis = JSON.parse(cleaned);
    } catch (e) {
        throw new Error('AI returned invalid JSON: ' + e.message);
    }

    // Validate required fields
    if (!analysis.summary) analysis.summary = 'Document analyzed successfully.';
    if (!Array.isArray(analysis.highlights)) analysis.highlights = [];
    if (!Array.isArray(analysis.charts)) analysis.charts = [];

    return analysis;
}

module.exports = { analyzeDocument };
