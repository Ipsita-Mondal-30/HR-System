const DEFAULT_FRONTEND_URL = 'https://hr-frontend-54b2.vercel.app';

function getBackendOrigin() {
  const base = process.env.BASE_URL || 'https://hr-system-x2uf.onrender.com';
  try {
    return new URL(base).origin;
  } catch {
    return 'https://hr-system-x2uf.onrender.com';
  }
}

function isValidFrontendUrl(candidate, backendOrigin) {
  if (!candidate || typeof candidate !== 'string') return false;

  try {
    const parsed = new URL(candidate);
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;
    if (parsed.origin === backendOrigin) return false;
    return true;
  } catch {
    return false;
  }
}

function normalizeFrontendUrl(url) {
  return String(url).replace(/\/$/, '');
}

/**
 * Resolve the Vercel (or local) frontend origin for OAuth redirects.
 * Never returns the backend API origin.
 */
function resolveFrontendUrl(req) {
  const backendOrigin = getBackendOrigin();
  const envFrontend = process.env.FRONTEND_URL || DEFAULT_FRONTEND_URL;

  const refererOrigin = (() => {
    try {
      const referer = req.get('referer') || '';
      return referer ? new URL(referer).origin : '';
    } catch {
      return '';
    }
  })();

  let stateHint = '';
  try {
    stateHint = decodeURIComponent(req.query?.state || '');
  } catch {
    stateHint = '';
  }

  const candidates = [
    req.query?.frontend,
    req.cookies?.frontend_url,
    refererOrigin,
    req.headers?.origin,
    stateHint,
    envFrontend,
    DEFAULT_FRONTEND_URL,
    'http://localhost:3000',
  ];

  for (const candidate of candidates) {
    if (isValidFrontendUrl(candidate, backendOrigin)) {
      return normalizeFrontendUrl(candidate);
    }
  }

  return normalizeFrontendUrl(envFrontend);
}

module.exports = {
  DEFAULT_FRONTEND_URL,
  resolveFrontendUrl,
  isValidFrontendUrl,
};
