const axios = require('axios');
const pdfParse = require('pdf-parse');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { CohereClient } = require('cohere-ai');
const VoiceInterview = require('../models/VoiceInterview');
const Job = require('../models/Job');

function getGeminiModel() {
  if (!process.env.GEMINI_API_KEY) return null;
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  return genAI.getGenerativeModel({ model: modelName });
}

function parseJsonFromText(text) {
  if (!text) return null;
  let jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) jsonMatch = [jsonMatch[1]];
  }
  if (!jsonMatch) return null;
  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }
}

async function extractResumeText(user) {
  if (!user?.resumeUrl?.startsWith('http')) {
    return [
      user?.name ? `Name: ${user.name}` : '',
      user?.skills?.length ? `Skills: ${user.skills.join(', ')}` : '',
      user?.experience ? `Experience: ${user.experience}` : '',
      user?.bio ? `Bio: ${user.bio}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  }

  try {
    const response = await axios.get(user.resumeUrl, {
      responseType: 'arraybuffer',
      timeout: 12000,
    });
    const parsed = await pdfParse(response.data);
    const text = (parsed.text || '').trim();
    if (text.length > 100) return text.slice(0, 8000);
  } catch (err) {
    console.warn('Resume PDF parse failed:', err.message);
  }

  return [
    user.name ? `Name: ${user.name}` : '',
    user.skills?.length ? `Skills: ${user.skills.join(', ')}` : '',
    user.experience ? `Experience: ${user.experience}` : '',
    user.bio ? `Bio: ${user.bio}` : '',
    user.resumeUrl ? 'Resume uploaded (PDF text extraction unavailable)' : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function buildJobMarketStats(recentJobs) {
  const skillFrequency = {};
  const locationFrequency = {};

  recentJobs.forEach((job) => {
    (job.skills || []).forEach((skill) => {
      const key = skill.toLowerCase().trim();
      skillFrequency[key] = (skillFrequency[key] || 0) + 1;
    });
    if (job.location) {
      const loc = job.location.toLowerCase().trim();
      locationFrequency[loc] = (locationFrequency[loc] || 0) + 1;
    }
  });

  const topSkills = Object.entries(skillFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([skill, count]) => ({ skill, count }));

  const topLocations = Object.entries(locationFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([location, count]) => ({ location, count }));

  return { skillFrequency, topSkills, topLocations };
}

function findMissingSkills(userSkills, topSkills) {
  const normalized = (userSkills || []).map((s) => s.toLowerCase().trim());
  return topSkills
    .map((t) => t.skill)
    .filter((skill) => {
      return !normalized.some(
        (cs) => cs === skill || cs.includes(skill) || skill.includes(cs)
      );
    })
    .slice(0, 8);
}

function scoreJobMatch(job, user, missingSkills) {
  const userSkills = (user.skills || []).map((s) => s.toLowerCase());
  const jobSkills = (job.skills || []).map((s) => s.toLowerCase());
  if (jobSkills.length === 0) return { matchScore: 50, matchReason: 'Open role — apply to explore fit' };

  const matched = jobSkills.filter((js) =>
    userSkills.some((us) => us.includes(js) || js.includes(us))
  );
  const matchScore = Math.round((matched.length / jobSkills.length) * 100);
  const gapSkills = jobSkills.filter((js) => !matched.includes(js)).slice(0, 2);

  let matchReason;
  if (matchScore >= 75) {
    matchReason = `Strong fit — you match ${matched.length}/${jobSkills.length} required skills (${matched.slice(0, 3).join(', ')})`;
  } else if (matchScore >= 50) {
    matchReason = `Good potential — consider upskilling in ${gapSkills.join(', ') || 'role-specific tools'}`;
  } else {
    matchReason = `Stretch role — build skills in ${gapSkills.join(', ') || missingSkills.slice(0, 2).join(', ') || 'key requirements'}`;
  }

  return { matchScore, matchReason, matchedSkills: matched };
}

async function callGemini(prompt) {
  const model = getGeminiModel();
  if (!model) return null;
  try {
    const result = await model.generateContent(prompt);
    const text = await result.response.text();
    return parseJsonFromText(text);
  } catch (err) {
    console.warn('Gemini call failed:', err.message);
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
      temperature: 0.5,
    });
    return parseJsonFromText(response.text);
  } catch (err) {
    console.warn('Cohere call failed:', err.message);
    return null;
  }
}

async function getRecentVoiceInterview(candidateId) {
  return VoiceInterview.findOne({
    candidate: candidateId,
    status: 'completed',
  })
    .populate('job', 'title companyName skills')
    .sort({ completedAt: -1 });
}

async function generateInterviewPrepDashboard(user, applications) {
  const recentSession = await getRecentVoiceInterview(user._id);
  const resumeText = await extractResumeText(user);

  const recentInterview = recentSession
    ? {
        sessionId: recentSession._id.toString(),
        jobRole: recentSession.jobRole,
        jobTitle: recentSession.job?.title,
        companyName: recentSession.job?.companyName,
        prepScore: recentSession.aiAnalysis?.overallScore ?? 0,
        status:
          (recentSession.aiAnalysis?.overallScore ?? 0) >= 80
            ? 'READY'
            : (recentSession.aiAnalysis?.overallScore ?? 0) >= 60
            ? 'NEEDS PRACTICE'
            : 'NOT READY',
        completedAt: recentSession.completedAt,
        summary:
          recentSession.aiAnalysis?.summary ||
          recentSession.aiAnalysis?.detailedFeedback ||
          '',
        strengths: recentSession.aiAnalysis?.strengths || [],
        weaknesses: recentSession.aiAnalysis?.improvements || [],
        improvementTips: recentSession.aiAnalysis?.recommendations || [],
        questions: (recentSession.questions || []).map((q, i) => ({
          number: i + 1,
          question: q.question,
          answer: q.transcript || q.answer || '',
          evaluation: q.evaluation,
        })),
      }
    : null;

  let aiInsights = null;

  if (recentInterview) {
    const prompt = `You are an expert interview coach. A candidate just completed a voice interview practice session.

Job Role: ${recentInterview.jobRole}
Score: ${recentInterview.prepScore}/100
Status: ${recentInterview.status}
Summary: ${recentInterview.summary || 'N/A'}
Strengths: ${recentInterview.strengths.join('; ') || 'None'}
Weak Areas: ${recentInterview.weaknesses.join('; ') || 'None'}
Prior Tips: ${recentInterview.improvementTips.join('; ') || 'None'}

Candidate Resume/Profile excerpt:
${resumeText.slice(0, 2000)}

Return ONLY JSON:
{
  "headline": "<one sentence on their latest performance>",
  "focusAreas": ["<3-4 specific areas to improve before next attempt>"],
  "nextSteps": ["<3-4 concrete actions for the next 7 days>"],
  "preparationTips": ["<3-4 tailored prep tips for this role>"]
}`;

    aiInsights = (await callGemini(prompt)) || (await callCohere(prompt));
  }

  const targetRole =
    recentInterview?.jobRole ||
    applications[0]?.job?.title ||
    'your target role';

  return {
    hasRecentInterview: !!recentInterview,
    recentInterview,
    aiInsights: aiInsights || {
      headline: recentInterview
        ? `Last practice: ${recentInterview.prepScore}/100 for ${recentInterview.jobRole}`
        : 'Complete a voice interview to get personalized AI feedback',
      focusAreas: recentInterview?.weaknesses?.slice(0, 4) || [],
      nextSteps: recentInterview?.improvementTips?.slice(0, 4) || [
        'Start a voice interview practice session',
        'Review the job description before practicing',
      ],
      preparationTips: [
        `Research ${targetRole} interview questions`,
        'Prepare STAR method examples from your experience',
        'Practice speaking answers out loud for 2-3 minutes each',
      ],
    },
    targetRole,
    generatedAt: new Date().toISOString(),
    source: aiInsights ? 'ai' : recentInterview ? 'interview-data' : 'default',
  };
}

async function generateProfileAnalysis(user, applications, calculateProfileCompleteness) {
  const resumeText = await extractResumeText(user);
  const completeness = calculateProfileCompleteness(user);

  const recentJobs = await Job.find({
    status: 'active',
    isApproved: true,
  })
    .select('title companyName skills location description requirements experienceRequired')
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  const { topSkills, topLocations, skillFrequency } = buildJobMarketStats(recentJobs);
  const missingSkills = findMissingSkills(user.skills, topSkills);

  const targetRoles = [
    ...new Set(applications.map((a) => a.job?.title).filter(Boolean)),
  ];

  const profileContext = `
Candidate Profile:
- Name: ${user.name}
- Skills: ${user.skills?.join(', ') || 'Not specified'}
- Experience: ${user.experience || 'Not specified'}
- Bio: ${user.bio || 'Not specified'}
- Portfolio: ${user.portfolio || 'Not provided'}
- LinkedIn: ${user.linkedIn || 'Not provided'}
- GitHub: ${user.github || 'Not provided'}
- Resume: ${user.resumeUrl ? 'Uploaded' : 'Not uploaded'}
- Profile Completeness: ${completeness}%

Resume / Profile Text:
${resumeText.slice(0, 3500)}

Recent Applications: ${applications.map((a) => `${a.job?.title} at ${a.job?.companyName || 'Company'}`).join(', ') || 'None'}
Target Roles: ${targetRoles.join(', ') || 'Not specified'}

Job Market (${recentJobs.length} active postings):
- Top skills in demand: ${topSkills.slice(0, 15).map((s) => `${s.skill} (${s.count} jobs)`).join(', ')}
- Top locations: ${topLocations.slice(0, 5).map((l) => `${l.location} (${l.count})`).join(', ')}
- Missing high-demand skills for this candidate: ${missingSkills.slice(0, 8).join(', ') || 'None identified'}
`.trim();

  const analysisPrompt = `You are an expert career coach. Analyze this candidate's REAL resume/profile against current job market data.

${profileContext}

Return ONLY valid JSON:
{
  "overallScore": <1-100 based on resume quality AND market alignment>,
  "strengths": [<4-6 specific strengths from their actual resume/profile>],
  "improvements": [<4-6 specific gaps vs job market>],
  "marketability": "<2-3 sentences on employer appeal based on real data>",
  "recommendations": [<5-7 actionable steps referencing their actual profile gaps>],
  "roleAlignment": "<2-3 sentences on fit for target roles>",
  "missingSkills": [<3-6 skills from job market they lack>],
  "skillCourses": [{"skill": "...", "courseTitle": "...", "platform": "Coursera|Udemy|freeCodeCamp|YouTube", "reason": "..."}],
  "jobMarketTrends": "<3-4 sentences on current hiring trends from the data>"
}`;

  let analysis = (await callGemini(analysisPrompt)) || (await callCohere(analysisPrompt));

  const hasResume = !!user.resumeUrl;
  const hasSkills = user.skills?.length > 0;

  if (!analysis || typeof analysis.overallScore !== 'number') {
    const strengths = [];
    if (hasResume) strengths.push('Resume uploaded for employer review');
    if (hasSkills) strengths.push(`Technical skills listed: ${user.skills.slice(0, 5).join(', ')}`);
    if (user.experience) strengths.push(`Experience documented: ${user.experience}`);
    if (user.bio) strengths.push('Professional summary provided');

    analysis = {
      overallScore: Math.min(100, completeness + (hasResume ? 5 : 0) + (hasSkills ? 5 : 0)),
      strengths: strengths.length ? strengths : ['Profile started — add resume and skills for better analysis'],
      improvements: missingSkills.length
        ? [`Add in-demand skills: ${missingSkills.slice(0, 3).join(', ')}`]
        : ['Upload resume and add more skills for deeper analysis'],
      marketability: hasResume && hasSkills
        ? 'Moderate market presence — resume and skills present but can be strengthened'
        : 'Limited market data — complete your profile and upload resume for accurate analysis',
      recommendations: [
        !hasResume ? 'Upload your resume PDF' : null,
        !hasSkills ? 'Add at least 5 relevant skills' : null,
        'Practice voice interviews for roles you target',
        missingSkills.length ? `Learn ${missingSkills[0]} — high demand in current postings` : null,
      ].filter(Boolean),
      roleAlignment: targetRoles.length
        ? `Targeting ${targetRoles[0]} — align resume keywords with role requirements`
        : 'Apply to roles matching your skills to get tailored alignment analysis',
      missingSkills: missingSkills.slice(0, 5),
      skillCourses: missingSkills.slice(0, 3).map((skill) => ({
        skill,
        courseTitle: `${skill.charAt(0).toUpperCase() + skill.slice(1)} — Complete Guide`,
        platform: 'Udemy',
        reason: `Appears in ${skillFrequency[skill] || 1}+ active job postings`,
      })),
      jobMarketTrends: `Top hiring skills: ${topSkills.slice(0, 5).map((s) => s.skill).join(', ')}.`,
    };
  }

  const scoredJobs = recentJobs
    .map((job) => {
      const { matchScore, matchReason, matchedSkills } = scoreJobMatch(job, user, missingSkills);
      return {
        _id: job._id,
        title: job.title,
        companyName: job.companyName,
        location: job.location,
        matchScore,
        matchReason,
        matchedSkills,
      };
    })
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 6);

  return {
    overallScore: Math.max(1, Math.min(100, Math.round(analysis.overallScore))),
    strengths: Array.isArray(analysis.strengths) ? analysis.strengths : [],
    improvements: Array.isArray(analysis.improvements) ? analysis.improvements : [],
    marketability: analysis.marketability || '',
    recommendations: Array.isArray(analysis.recommendations) ? analysis.recommendations : [],
    roleAlignment: analysis.roleAlignment || '',
    missingSkills: Array.isArray(analysis.missingSkills) ? analysis.missingSkills : missingSkills.slice(0, 5),
    skillCourses: Array.isArray(analysis.skillCourses) ? analysis.skillCourses : [],
    jobMarketTrends: analysis.jobMarketTrends || '',
    recommendedJobs: scoredJobs,
    profileCompleteness: completeness,
    resumeAnalyzed: resumeText.length > 50,
    lastUpdated: user.updatedAt || user.createdAt,
    generatedAt: new Date().toISOString(),
    source: analysis ? 'ai' : 'market-data',
  };
}

module.exports = {
  generateInterviewPrepDashboard,
  generateProfileAnalysis,
  extractResumeText,
};
