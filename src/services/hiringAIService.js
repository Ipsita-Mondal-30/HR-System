const { GoogleGenerativeAI } = require('@google/generative-ai');
const HiringInsight = require('../models/HiringInsight');
const { getDashboardAnalytics } = require('./hiringAnalyticsService');

function getGeminiModel() {
  if (!process.env.GEMINI_API_KEY) return null;
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  return genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-2.5-flash' });
}

function parseJsonFromText(text) {
  if (!text) return null;
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

function buildFallbackInsights(analytics) {
  const topSkill = analytics.topSkills?.[0];
  const growing = analytics.fastestGrowingTechnologies?.[0];
  const topCity = analytics.jobsByLocation?.[0];

  return {
    summary: `Market intelligence covers ${analytics.overview?.totalJobs || 0} live job listings across ${analytics.overview?.totalCompanies || 0} companies.`,
    bulletPoints: [
      topSkill
        ? `${topSkill.skill} is the most in-demand skill with ${topSkill.count} job mentions.`
        : 'Skill data is being aggregated from job descriptions.',
      growing
        ? `Demand for ${growing.skill} increased by ${growing.growthPct}% compared to last month.`
        : 'Emerging technology trends are being tracked.',
      analytics.remoteVsOnsite?.remotePct
        ? `${analytics.remoteVsOnsite.remotePct}% of tracked roles offer remote or hybrid work.`
        : 'Remote vs onsite distribution is available in the dashboard.',
      topCity
        ? `Highest job concentration is in ${topCity.location} with ${topCity.count} openings.`
        : 'Location heatmap shows hiring hotspots across India.',
    ],
    skillHighlights: (analytics.fastestGrowingTechnologies || []).slice(0, 5).map((s) => ({
      skill: s.skill,
      changePct: s.growthPct,
    })),
    locationHighlights: (analytics.jobsByLocation || []).slice(0, 3).map((l) => l.location),
    recommendations: [
      'Prioritize upskilling in cloud and TypeScript for highest ROI.',
      'Target Bangalore, Delhi NCR, and Hyderabad for frontend and full-stack roles.',
      'Highlight AWS/Kubernetes experience for DevOps and platform engineering pipelines.',
    ],
    source: 'fallback',
  };
}

async function generateHiringInsights(forceRefresh = false) {
  const cacheCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  if (!forceRefresh) {
    const cached = await HiringInsight.findOne({ type: 'weekly', generatedAt: { $gte: cacheCutoff } })
      .sort({ generatedAt: -1 });
    if (cached) {
      return {
        summary: cached.summary,
        bulletPoints: cached.bulletPoints,
        skillHighlights: cached.skillHighlights,
        locationHighlights: cached.locationHighlights,
        recommendations: cached.recommendations,
        source: cached.source,
        generatedAt: cached.generatedAt,
      };
    }
  }

  const analytics = await getDashboardAnalytics();
  const model = getGeminiModel();

  if (!model) {
    return { ...buildFallbackInsights(analytics), generatedAt: new Date() };
  }

  const prompt = `You are a hiring market intelligence analyst for the Indian tech job market.

Analyze this job market data and return ONLY valid JSON:
{
  "summary": "2-3 sentence executive summary",
  "bulletPoints": ["insight 1", "insight 2", "insight 3", "insight 4"],
  "skillHighlights": [{ "skill": "TypeScript", "changePct": 24 }],
  "locationHighlights": ["Bangalore", "Delhi NCR", "Hyderabad"],
  "recommendations": ["recruiter recommendation 1", "recommendation 2", "recommendation 3"]
}

Use specific numbers from the data. Example style:
- "Demand for TypeScript increased by 24% compared to last month."
- "Cloud-related roles show strong growth, especially AWS and Kubernetes."
- "Frontend developer demand remains highest in Bangalore, Delhi NCR, and Hyderabad."

Data:
${JSON.stringify({
  overview: analytics.overview,
  topSkills: analytics.topSkills?.slice(0, 10),
  fastestGrowing: analytics.fastestGrowingTechnologies?.slice(0, 8),
  jobsByLocation: analytics.jobsByLocation?.slice(0, 8),
  remoteVsOnsite: analytics.remoteVsOnsite,
  salaryByRole: analytics.salaryByRole?.slice(0, 5),
  highestPayingSkills: analytics.highestPayingSkills?.slice(0, 5),
}).slice(0, 6000)}`;

  try {
    const result = await model.generateContent(prompt);
    const parsed = parseJsonFromText(result.response.text());
    if (!parsed) throw new Error('Invalid Gemini JSON');

    const insight = {
      type: 'weekly',
      summary: parsed.summary || '',
      bulletPoints: parsed.bulletPoints || [],
      skillHighlights: parsed.skillHighlights || [],
      locationHighlights: parsed.locationHighlights || [],
      recommendations: parsed.recommendations || [],
      source: 'gemini',
      generatedAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };

    await HiringInsight.create(insight);
    return insight;
  } catch (err) {
    console.warn('Gemini hiring insights failed:', err.message);
    return { ...buildFallbackInsights(analytics), generatedAt: new Date() };
  }
}

module.exports = { generateHiringInsights };
