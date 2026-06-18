const { GoogleGenerativeAI } = require('@google/generative-ai');
const { CohereClient } = require('cohere-ai');
const Employee = require('../models/Employee');
const Project = require('../models/Project');
const Feedback = require('../models/Feedback');
const OKR = require('../models/OKR');

function getGeminiModel() {
  if (!process.env.GEMINI_API_KEY) return null;
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  return genAI.getGenerativeModel({ model: modelName });
}

function parseJsonFromText(text) {
  if (!text) return null;
  let match = text.match(/```json\s*([\s\S]*?)\s*```/);
  if (match) {
    try {
      return JSON.parse(match[1]);
    } catch {
      /* fall through */
    }
  }
  match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

async function callGemini(prompt) {
  const model = getGeminiModel();
  if (!model) return null;
  try {
    const result = await model.generateContent(prompt);
    const text = await result.response.text();
    return parseJsonFromText(text);
  } catch (err) {
    console.warn('Employee AI — Gemini failed:', err.message);
    return null;
  }
}

async function callCohere(prompt) {
  if (!process.env.COHERE_API_KEY) return null;
  try {
    const cohere = new CohereClient({ token: process.env.COHERE_API_KEY });
    const response = await cohere.chat({
      message: prompt,
      model: 'command-r-plus',
      temperature: 0.4,
    });
    return parseJsonFromText(response.text);
  } catch (err) {
    console.warn('Employee AI — Cohere failed:', err.message);
    return null;
  }
}

function clampScore(value, fallback = 50) {
  const n = Number(value);
  if (Number.isNaN(n)) return fallback;
  return Math.min(Math.max(Math.round(n), 0), 100);
}

function asStringArray(value, fallback = []) {
  if (!Array.isArray(value)) return fallback;
  return value.filter((v) => typeof v === 'string' && v.trim()).map((v) => v.trim());
}

function buildFallbackInsights(employee) {
  const performanceScore = employee?.performanceScore ?? 50;
  const projectContribution = employee?.projectContribution ?? 0;

  return {
    summary: `${employee?.user?.name || 'This employee'} shows a performance score of ${performanceScore}% and project contribution of ${projectContribution}%. AI providers were unavailable — review metrics manually.`,
    aiSource: 'fallback',
    promotionReadiness: {
      score: clampScore(performanceScore + 8, 55),
      reasons:
        performanceScore >= 75
          ? ['Strong performance score relative to peers', 'Consistent project involvement']
          : ['Performance data suggests room to grow before promotion'],
      nextSteps: ['Set quarterly development goals with manager', 'Review OKR progress in next 1:1'],
      lastUpdated: new Date(),
    },
    attritionRisk: {
      score: clampScore(Math.max(100 - performanceScore - 15, 15), 25),
      factors:
        performanceScore < 60
          ? ['Below-target performance may affect engagement', 'Limited recent feedback on record']
          : ['Monitor workload and career growth conversations'],
      mitigation: ['Schedule regular check-ins', 'Discuss career path and learning opportunities'],
      lastUpdated: new Date(),
    },
    strengths: ['Team collaboration', 'Adaptability', 'Willingness to learn'],
    improvementAreas: ['Communication', 'Technical depth', 'Time management'],
    recommendations: [
      'Review project assignments for skill alignment',
      'Collect structured feedback from project leads',
    ],
    lastAnalyzed: new Date(),
  };
}

function normalizeInsights(raw, employee) {
  if (!raw || typeof raw !== 'object') {
    return buildFallbackInsights(employee);
  }

  return {
    summary:
      typeof raw.summary === 'string' && raw.summary.trim()
        ? raw.summary.trim()
        : buildFallbackInsights(employee).summary,
    aiSource: raw.aiSource || 'ai',
    promotionReadiness: {
      score: clampScore(raw.promotionReadiness?.score, employee?.performanceScore ?? 50),
      reasons: asStringArray(raw.promotionReadiness?.reasons, ['Performance trends reviewed']),
      nextSteps: asStringArray(raw.promotionReadiness?.nextSteps, ['Align on next-quarter goals']),
      lastUpdated: new Date(),
    },
    attritionRisk: {
      score: clampScore(raw.attritionRisk?.score, 30),
      factors: asStringArray(raw.attritionRisk?.factors, ['Engagement should be monitored']),
      mitigation: asStringArray(raw.attritionRisk?.mitigation, ['Maintain regular 1:1s']),
      lastUpdated: new Date(),
    },
    strengths: asStringArray(raw.strengths, ['Collaboration', 'Reliability']),
    improvementAreas: asStringArray(raw.improvementAreas, ['Skill development']),
    recommendations: asStringArray(raw.recommendations, ['Continue tracking performance metrics']),
    lastAnalyzed: new Date(),
  };
}

function buildAnalysisPrompt(employee, projects, feedback, okrs) {
  const skills = (employee.skills || [])
    .map((s) => `${s.name} (${s.level}${s.verified ? ', verified' : ''})`)
    .join(', ');

  const projectLines = projects.length
    ? projects
        .map(
          (p) =>
            `- ${p.name}: status=${p.status}, progress=${p.completionPercentage ?? 0}%, role contribution=${p.contributionPercentage ?? 0}%, hours=${p.hoursWorked ?? 0}`
        )
        .join('\n')
    : 'No projects on record';

  const feedbackLines = feedback.length
    ? feedback
        .map(
          (f) =>
            `- ${f.type || 'feedback'}: rating ${f.overallRating ?? 'N/A'}/5 — ${(f.content || f.summary || '').slice(0, 120)}`
        )
        .join('\n')
    : 'No feedback submitted';

  const okrLines = okrs.length
    ? okrs.map((o) => `- ${o.objective}: ${o.overallProgress ?? 0}% complete (${o.status || 'active'})`).join('\n')
    : 'No OKRs this year';

  return `You are an HR analytics assistant. Analyze this employee using ONLY the data provided. Be specific and actionable.

Employee: ${employee.user?.name || 'Unknown'}
Position: ${employee.position || 'N/A'}
Department: ${employee.department?.name || 'Unassigned'}
Hire date: ${employee.hireDate ? new Date(employee.hireDate).toISOString().slice(0, 10) : 'Unknown'}
Employment type: ${employee.employmentType || 'full-time'}
Performance score: ${employee.performanceScore ?? 0}%
Project contribution: ${employee.projectContribution ?? 0}%
Skills: ${skills || 'None listed'}

Projects (${projects.length}):
${projectLines}

Recent feedback (${feedback.length}):
${feedbackLines}

OKRs (${okrs.length}):
${okrLines}

Return ONLY valid JSON (no markdown) with this exact structure:
{
  "summary": "2-3 sentence executive summary of this employee's performance and trajectory",
  "promotionReadiness": {
    "score": 0-100,
    "reasons": ["specific reason 1", "specific reason 2"],
    "nextSteps": ["action 1", "action 2"]
  },
  "attritionRisk": {
    "score": 0-100,
    "factors": ["risk factor 1", "risk factor 2"],
    "mitigation": ["mitigation 1", "mitigation 2"]
  },
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "improvementAreas": ["area 1", "area 2", "area 3"],
  "recommendations": ["HR recommendation 1", "HR recommendation 2", "HR recommendation 3"]
}`;
}

async function gatherEmployeeAnalysisData(employeeId) {
  const employee = await Employee.findById(employeeId)
    .populate('user', 'name email')
    .populate('department', 'name');

  if (!employee) {
    return null;
  }

  const [projects, feedback, okrs] = await Promise.all([
    Project.find({
      $or: [{ 'teamMembers.employee': employeeId }, { projectManager: employeeId }],
    })
      .select('name status completionPercentage teamMembers projectManager startDate endDate')
      .sort({ updatedAt: -1 })
      .limit(15),
    Feedback.find({
      employee: employeeId,
      status: { $in: ['submitted', 'reviewed', 'completed'] },
    })
      .sort({ createdAt: -1 })
      .limit(10),
    OKR.find({ employee: employeeId, year: new Date().getFullYear() }).limit(10),
  ]);

  const projectsEnriched = projects.map((project) => {
    const id = employeeId.toString();
    const isPm = project.projectManager?.toString() === id;
    const member = project.teamMembers.find((m) => m.employee?.toString() === id);
    return {
      name: project.name,
      status: project.status,
      completionPercentage: project.completionPercentage,
      contributionPercentage: member?.contributionPercentage ?? (isPm ? 100 : 0),
      hoursWorked: member?.hoursWorked ?? 0,
    };
  });

  return { employee, projects: projectsEnriched, feedback, okrs };
}

async function generateEmployeeAIInsights(employeeId) {
  const data = await gatherEmployeeAnalysisData(employeeId);
  if (!data) {
    throw new Error('Employee not found');
  }

  const { employee, projects, feedback, okrs } = data;
  const prompt = buildAnalysisPrompt(employee, projects, feedback, okrs);

  console.log(`🤖 Generating employee AI insights for ${employee.user?.name}...`);

  let parsed = await callGemini(prompt);
  let aiSource = 'gemini';

  if (!parsed) {
    parsed = await callCohere(prompt);
    aiSource = parsed ? 'cohere' : 'fallback';
  }

  const insights = normalizeInsights(parsed ? { ...parsed, aiSource } : null, employee);

  employee.aiInsights = insights;
  await employee.save();

  console.log(`✅ Employee AI insights saved (source: ${insights.aiSource})`);

  return {
    employee: {
      id: employee._id,
      name: employee.user?.name,
      position: employee.position,
    },
    insights,
  };
}

module.exports = {
  generateEmployeeAIInsights,
  gatherEmployeeAnalysisData,
};
