const MarketJob = require('../models/MarketJob');
const { extractSkillsFromText, normalizeSkill } = require('./skillExtractionService');
const { parseResumeFromSource } = require('./resumeParseService');

function normalizeSkillSet(skills = []) {
  return new Set(skills.map((s) => normalizeSkill(s).toLowerCase()));
}

function computeMatchScore(candidateSkills, jobSkills) {
  if (!jobSkills.length) return 50;
  const candidate = normalizeSkillSet(candidateSkills);
  const job = normalizeSkillSet(jobSkills);
  if (job.size === 0) return 50;

  let matched = 0;
  for (const skill of job) {
    if (candidate.has(skill)) matched += 1;
  }
  return Math.round((matched / job.size) * 100);
}

function getMissingSkills(candidateSkills, jobSkills) {
  const candidate = normalizeSkillSet(candidateSkills);
  return jobSkills.filter((s) => !candidate.has(normalizeSkill(s).toLowerCase()));
}

async function matchResumeToJobs({ resumeSource, limit = 10 }) {
  const parsed = await parseResumeFromSource(resumeSource);
  const candidateSkills = [
    ...(parsed.skills || []),
    ...extractSkillsFromText(
      [...(parsed.experience || []), ...(parsed.projects || [])].join(' ')
    ),
  ];

  const uniqueCandidateSkills = [...new Set(candidateSkills.map((s) => normalizeSkill(s)))];

  const jobs = await MarketJob.find().sort({ postedAt: -1 }).limit(500).lean();
  const scored = jobs
    .map((job) => {
      const jobSkills = job.skills?.length
        ? job.skills
        : extractSkillsFromText(`${job.title} ${job.description}`);
      const matchScore = computeMatchScore(uniqueCandidateSkills, jobSkills);
      const missingSkills = getMissingSkills(uniqueCandidateSkills, jobSkills).slice(0, 8);
      const avgSal =
        job.salaryMin && job.salaryMax
          ? Math.round((job.salaryMin + job.salaryMax) / 2)
          : job.salaryMin || job.salaryMax || null;

      return {
        jobId: job._id,
        adzunaId: job.adzunaId,
        title: job.title,
        company: job.company,
        location: job.location,
        city: job.city,
        isRemote: job.isRemote,
        matchScore,
        missingSkills,
        matchedSkills: jobSkills.filter((s) =>
          normalizeSkillSet(uniqueCandidateSkills).has(normalizeSkill(s).toLowerCase())
        ),
        salaryMin: job.salaryMin,
        salaryMax: job.salaryMax,
        avgSalary: avgSal,
        sourceUrl: job.sourceUrl,
        category: job.category,
      };
    })
    .filter((j) => j.matchScore >= 20)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, limit);

  const overallMatch =
    scored.length > 0
      ? Math.round(scored.reduce((sum, j) => sum + j.matchScore, 0) / scored.length)
      : 0;

  const allMissing = new Map();
  for (const job of scored) {
    for (const skill of job.missingSkills) {
      allMissing.set(skill, (allMissing.get(skill) || 0) + 1);
    }
  }

  const topMissingSkills = Array.from(allMissing.entries())
    .map(([skill, count]) => ({ skill, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    candidateSkills: uniqueCandidateSkills,
    overallMatchScore: overallMatch,
    recommendedJobs: scored,
    missingSkills: topMissingSkills,
    parsedResume: {
      name: parsed.name,
      email: parsed.email,
      skills: uniqueCandidateSkills,
    },
  };
}

module.exports = { matchResumeToJobs, computeMatchScore };
