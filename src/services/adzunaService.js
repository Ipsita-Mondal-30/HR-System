const axios = require('axios');
const MarketJob = require('../models/MarketJob');
const { extractSkillsFromText, detectRemote, extractCity } = require('./skillExtractionService');

const BASE_URL = 'https://api.adzuna.com/v1/api';
const DEFAULT_COUNTRY = process.env.ADZUNA_COUNTRY || 'in';

const SEARCH_QUERIES = [
  { what: 'software developer', where: 'Bangalore' },
  { what: 'software engineer', where: 'Delhi' },
  { what: 'frontend developer', where: 'Hyderabad' },
  { what: 'backend developer', where: 'Mumbai' },
  { what: 'data scientist', where: 'India' },
  { what: 'devops engineer', where: 'India' },
  { what: 'typescript developer', where: 'India' },
  { what: 'cloud engineer', where: 'India' },
  { what: 'react developer', where: 'India' },
  { what: 'python developer', where: 'India' },
];

function getCredentials() {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  if (!appId || !appKey) {
    throw new Error('ADZUNA_APP_ID and ADZUNA_APP_KEY must be configured');
  }
  return { appId, appKey };
}

async function fetchAdzunaPage({ country, page, what, where, resultsPerPage = 50 }) {
  const { appId, appKey } = getCredentials();
  const url = `${BASE_URL}/jobs/${country}/search/${page}`;
  const response = await axios.get(url, {
    params: {
      app_id: appId,
      app_key: appKey,
      results_per_page: resultsPerPage,
      'content-type': 'application/json',
      ...(what ? { what } : {}),
      ...(where ? { where } : {}),
    },
    timeout: 30000,
  });
  return response.data;
}

function mapAdzunaJob(raw, searchKeyword) {
  const locationDisplay = raw.location?.display_name || raw.location?.area?.join(', ') || '';
  const description = raw.description || '';
  const title = raw.title || 'Untitled';
  const skills = extractSkillsFromText(`${title} ${description}`);

  return {
    adzunaId: String(raw.id),
    title,
    company: raw.company?.display_name || 'Unknown Company',
    description,
    location: locationDisplay,
    city: extractCity(locationDisplay),
    region: raw.location?.area?.[1] || '',
    country: DEFAULT_COUNTRY,
    salaryMin: raw.salary_min || null,
    salaryMax: raw.salary_max || null,
    salaryCurrency: raw.salary_is_predicted ? 'INR' : 'INR',
    isRemote: detectRemote(title, description, locationDisplay),
    category: raw.category?.label || raw.category?.tag || '',
    skills,
    sourceUrl: raw.redirect_url || '',
    postedAt: raw.created ? new Date(raw.created) : new Date(),
    fetchedAt: new Date(),
    searchKeyword,
  };
}

async function syncJobsFromAdzuna({ country = DEFAULT_COUNTRY, maxPages = 2 } = {}) {
  let inserted = 0;
  let updated = 0;
  let fetched = 0;
  const errors = [];

  for (const query of SEARCH_QUERIES) {
    for (let page = 1; page <= maxPages; page += 1) {
      try {
        const data = await fetchAdzunaPage({
          country,
          page,
          what: query.what,
          where: query.where,
        });
        const results = data.results || [];
        fetched += results.length;

        for (const raw of results) {
          if (!raw?.id) continue;
          const mapped = mapAdzunaJob(raw, query.what);
          const existing = await MarketJob.findOne({ adzunaId: mapped.adzunaId });
          if (existing) {
            await MarketJob.updateOne({ adzunaId: mapped.adzunaId }, { $set: mapped });
            updated += 1;
          } else {
            await MarketJob.create(mapped);
            inserted += 1;
          }
        }
      } catch (err) {
        errors.push(`${query.what} page ${page}: ${err.message}`);
      }
    }
  }

  return { inserted, updated, fetched, totalInDb: await MarketJob.countDocuments(), errors };
}

module.exports = {
  fetchAdzunaPage,
  syncJobsFromAdzuna,
  SEARCH_QUERIES,
};
