const MarketJob = require('../models/MarketJob');
const HiringSnapshot = require('../models/HiringSnapshot');

function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function prevMonthKey(date = new Date()) {
  const d = new Date(date);
  d.setMonth(d.getMonth() - 1);
  return monthKey(d);
}

function avgSalary(job) {
  if (job.salaryMin && job.salaryMax) return (job.salaryMin + job.salaryMax) / 2;
  return job.salaryMin || job.salaryMax || null;
}

async function buildSkillStats(jobs, previousSnapshot) {
  const freq = new Map();
  for (const job of jobs) {
    for (const skill of job.skills || []) {
      freq.set(skill, (freq.get(skill) || 0) + 1);
    }
  }

  const prevMap = new Map(
    (previousSnapshot?.skillStats || []).map((s) => [s.skill, s.count])
  );

  return Array.from(freq.entries())
    .map(([skill, count]) => {
      const prev = prevMap.get(skill) || 0;
      const growthPct = prev > 0 ? Math.round(((count - prev) / prev) * 100) : count > 0 ? 100 : 0;
      return { skill, count, growthPct };
    })
    .sort((a, b) => b.count - a.count);
}

async function saveMonthlySnapshot(jobs) {
  const currentMonth = monthKey();
  const prevSnapshot = await HiringSnapshot.findOne({ month: prevMonthKey() });
  const skillStats = await buildSkillStats(jobs, prevSnapshot);

  const companyMap = new Map();
  const locationMap = new Map();
  const roleSalaryMap = new Map();
  const citySalaryMap = new Map();
  let salarySum = 0;
  let salaryCount = 0;
  let remoteCount = 0;

  for (const job of jobs) {
    companyMap.set(job.company, (companyMap.get(job.company) || 0) + 1);
    locationMap.set(job.city || job.location, (locationMap.get(job.city || job.location) || 0) + 1);
    if (job.isRemote) remoteCount += 1;

    const sal = avgSalary(job);
    if (sal) {
      salarySum += sal;
      salaryCount += 1;
      const roleKey = job.category || job.title.split(' ').slice(0, 2).join(' ');
      if (!roleSalaryMap.has(roleKey)) roleSalaryMap.set(roleKey, { sum: 0, count: 0 });
      const r = roleSalaryMap.get(roleKey);
      r.sum += sal;
      r.count += 1;

      const city = job.city || 'Unknown';
      if (!citySalaryMap.has(city)) citySalaryMap.set(city, { sum: 0, count: 0 });
      const c = citySalaryMap.get(city);
      c.sum += sal;
      c.count += 1;
    }
  }

  const snapshot = {
    month: currentMonth,
    totalJobs: jobs.length,
    totalCompanies: companyMap.size,
    remoteCount,
    onsiteCount: jobs.length - remoteCount,
    avgSalary: salaryCount ? Math.round(salarySum / salaryCount) : 0,
    skillStats: skillStats.slice(0, 50),
    topCompanies: Array.from(companyMap.entries())
      .map(([company, count]) => ({ company, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15),
    locationStats: Array.from(locationMap.entries())
      .map(([location, count]) => ({ location, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20),
    salaryByRole: Array.from(roleSalaryMap.entries())
      .map(([role, { sum, count }]) => ({ role, avgSalary: Math.round(sum / count), count }))
      .sort((a, b) => b.avgSalary - a.avgSalary)
      .slice(0, 15),
    salaryByCity: Array.from(citySalaryMap.entries())
      .map(([city, { sum, count }]) => ({ city, avgSalary: Math.round(sum / count), count }))
      .sort((a, b) => b.avgSalary - a.avgSalary)
      .slice(0, 15),
  };

  await HiringSnapshot.findOneAndUpdate({ month: currentMonth }, snapshot, { upsert: true, new: true });
  return snapshot;
}

async function getDashboardAnalytics() {
  const jobs = await MarketJob.find().lean();
  const currentSnapshot = await HiringSnapshot.findOne({ month: monthKey() });
  const prevSnapshot = await HiringSnapshot.findOne({ month: prevMonthKey() });
  const historicalSnapshots = await HiringSnapshot.find().sort({ month: 1 }).limit(12).lean();

  if (jobs.length === 0) {
    return {
      overview: { totalJobs: 0, totalCompanies: 0, totalSkillsTracked: 0, avgSalary: 0, remoteCount: 0, onsiteCount: 0 },
      topCompanies: [],
      topSkills: [],
      emergingTechnologies: [],
      jobsByLocation: [],
      remoteVsOnsite: { remote: 0, onsite: 0, remotePct: 0 },
      skillTrends: [],
      hiringTrend: [],
      salaryTrend: [],
      salaryByRole: [],
      salaryByCity: [],
      highestPayingSkills: [],
      fastestGrowingTechnologies: [],
      needsSync: true,
    };
  }

  const snapshot = currentSnapshot || (await saveMonthlySnapshot(jobs));
  const skillStats = snapshot.skillStats?.length
    ? snapshot.skillStats
    : (await buildSkillStats(jobs, prevSnapshot)).slice(0, 20);

  const companyMap = new Map();
  const locationMap = new Map();
  const skillSalaryMap = new Map();
  let remoteCount = 0;

  for (const job of jobs) {
    companyMap.set(job.company, (companyMap.get(job.company) || 0) + 1);
    locationMap.set(job.city || job.location, (locationMap.get(job.city || job.location) || 0) + 1);
    if (job.isRemote) remoteCount += 1;
    const sal = avgSalary(job);
    if (sal) {
      for (const skill of job.skills || []) {
        if (!skillSalaryMap.has(skill)) skillSalaryMap.set(skill, { sum: 0, count: 0 });
        const s = skillSalaryMap.get(skill);
        s.sum += sal;
        s.count += 1;
      }
    }
  }

  const topSkills = skillStats.slice(0, 20);
  const emerging = skillStats.filter((s) => s.growthPct >= 15).slice(0, 10);
  const fastestGrowing = [...skillStats].sort((a, b) => b.growthPct - a.growthPct).slice(0, 10);

  const highestPayingSkills = Array.from(skillSalaryMap.entries())
    .filter(([, v]) => v.count >= 2)
    .map(([skill, { sum, count }]) => ({ skill, avgSalary: Math.round(sum / count), count }))
    .sort((a, b) => b.avgSalary - a.avgSalary)
    .slice(0, 10);

  const skillTrends = historicalSnapshots.map((snap) => ({
    month: snap.month,
    totalJobs: snap.totalJobs,
    topSkill: snap.skillStats?.[0]?.skill || 'N/A',
    topSkillCount: snap.skillStats?.[0]?.count || 0,
  }));

  const hiringTrend = historicalSnapshots.map((snap) => ({
    month: snap.month,
    jobs: snap.totalJobs,
    companies: snap.totalCompanies,
  }));

  const salaryTrend = historicalSnapshots.map((snap) => ({
    month: snap.month,
    avgSalary: snap.avgSalary,
  }));

  return {
    overview: {
      totalJobs: jobs.length,
      totalCompanies: companyMap.size,
      totalSkillsTracked: skillStats.length,
      avgSalary: snapshot.avgSalary || 0,
      remoteCount,
      onsiteCount: jobs.length - remoteCount,
    },
    topCompanies: Array.from(companyMap.entries())
      .map(([company, count]) => ({ company, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    topSkills,
    emergingTechnologies: emerging,
    fastestGrowingTechnologies: fastestGrowing,
    jobsByLocation: Array.from(locationMap.entries())
      .map(([location, count]) => ({ location, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15),
    remoteVsOnsite: {
      remote: remoteCount,
      onsite: jobs.length - remoteCount,
      remotePct: jobs.length ? Math.round((remoteCount / jobs.length) * 100) : 0,
    },
    skillTrends,
    hiringTrend,
    salaryTrend,
    salaryByRole: snapshot.salaryByRole || [],
    salaryByCity: snapshot.salaryByCity || [],
    highestPayingSkills,
    needsSync: false,
    lastUpdated: jobs[0]?.fetchedAt,
  };
}

module.exports = {
  getDashboardAnalytics,
  saveMonthlySnapshot,
  buildSkillStats,
  monthKey,
};
