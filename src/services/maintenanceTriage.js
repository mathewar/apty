const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function triageRequest({ title, description, location }) {
    const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });

    const prompt = `You are a building maintenance triage assistant. Classify this maintenance request and return ONLY a valid JSON object (no markdown, no code blocks):

{
  "category": "plumbing|electrical|hvac|structural|appliances|common_area|other",
  "suggested_priority": "low|normal|high|emergency",
  "vendor_type": "plumber|electrician|hvac_tech|general_contractor|building_super|other",
  "summary": "one-sentence triage summary",
  "urgency_reason": "why this priority was suggested"
}

Rules:
- emergency: immediate safety risk (flooding, gas, fire hazard, no heat in winter)
- high: significant disruption or risk of damage if not addressed quickly
- normal: standard maintenance that should be scheduled soon
- low: cosmetic or minor issues with no urgency
- Choose the most specific vendor_type that applies

Maintenance request:
Title: ${title || '(none)'}
Description: ${description || '(none)'}
Location: ${location || '(none)'}`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    let triage;
    try {
        const cleaned = responseText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
        triage = JSON.parse(cleaned);
    } catch (e) {
        throw new Error('AI returned invalid JSON: ' + e.message);
    }

    const validCategories = ['plumbing', 'electrical', 'hvac', 'structural', 'appliances', 'common_area', 'other'];
    const validPriorities = ['low', 'normal', 'high', 'emergency'];
    const validVendors = ['plumber', 'electrician', 'hvac_tech', 'general_contractor', 'building_super', 'other'];

    if (!validCategories.includes(triage.category)) triage.category = 'other';
    if (!validPriorities.includes(triage.suggested_priority)) triage.suggested_priority = 'normal';
    if (!validVendors.includes(triage.vendor_type)) triage.vendor_type = 'other';
    if (!triage.summary) triage.summary = 'Maintenance request received.';
    if (!triage.urgency_reason) triage.urgency_reason = '';

    return triage;
}

module.exports = { triageRequest };
