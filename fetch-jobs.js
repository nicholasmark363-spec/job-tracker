// fetch-jobs.js
// Pulls Data Analyst / Data Scientist roles from Adzuna (multi-country) + Remotive (remote)
// and writes/merges them into jobs.json. Designed to run daily via GitHub Actions.

const fs = require('fs');
const path = require('path');

const JOBS_FILE = path.join(__dirname, 'jobs.json');
const KEEP_DAYS = 45; // drop listings older than this from the file

// Adzuna country codes to search. Add/remove as you like.
// Full list: https://developer.adzuna.com/docs/countries
const ADZUNA_COUNTRIES = ['in', 'us', 'gb', 'au', 'ca', 'sg', 'de', 'nl'];
const SEARCH_TERMS = ['data analyst', 'data scientist'];

const ADZUNA_APP_ID = process.env.ADZUNA_APP_ID;
const ADZUNA_APP_KEY = process.env.ADZUNA_APP_KEY;

function makeId(source, rawId, url) {
  return `${source}:${rawId || url}`;
}

function classifyRole(title, fallbackTerm) {
  const t = (title || '').toLowerCase();
  const isScientist = /data scien|machine learning|\bml engineer|research scientist/.test(t);
  const isAnalyst = /data analy|business analy|analytics/.test(t);
  if (isScientist && !isAnalyst) return 'Data Scientist';
  if (isAnalyst && !isScientist) return 'Data Analyst';
  if (isScientist && isAnalyst) return /scientist/i.test(fallbackTerm) ? 'Data Scientist' : 'Data Analyst';
  // title didn't clearly match either — fall back to whichever search term found it
  return /scientist/i.test(fallbackTerm) ? 'Data Scientist' : 'Data Analyst';
}

async function fetchAdzuna() {
  if (!ADZUNA_APP_ID || !ADZUNA_APP_KEY) {
    console.warn('ADZUNA_APP_ID / ADZUNA_APP_KEY not set — skipping Adzuna (get free keys at https://developer.adzuna.com/)');
    return [];
  }

  const results = [];

  for (const country of ADZUNA_COUNTRIES) {
    for (const term of SEARCH_TERMS) {
      try {
        const url = `https://api.adzuna.com/v1/api/jobs/${country}/search/1?app_id=${ADZUNA_APP_ID}&app_key=${ADZUNA_APP_KEY}&results_per_page=50&what=${encodeURIComponent(term)}&content-type=application/json`;
        const res = await fetch(url);
        if (!res.ok) {
          console.warn(`Adzuna ${country}/${term} failed: ${res.status}`);
          continue;
        }
        const data = await res.json();
        for (const j of (data.results || [])) {
          results.push({
            id: makeId('adzuna', j.id, j.redirect_url),
            title: j.title?.replace(/<[^>]+>/g, '') || 'Untitled role',
            company: j.company?.display_name || 'Unknown company',
            location: j.location?.display_name || country.toUpperCase(),
            country: country.toUpperCase(),
            source: 'Adzuna',
            url: j.redirect_url,
            posted_date: j.created ? j.created.slice(0, 10) : null,
            role_type: classifyRole(j.title, term),
            salary_min: j.salary_min || null,
            salary_max: j.salary_max || null,
          });
        }
      } catch (err) {
        console.warn(`Adzuna ${country}/${term} error:`, err.message);
      }
    }
  }
  return results;
}

async function fetchRemotive() {
  const results = [];
  for (const term of SEARCH_TERMS) {
    try {
      const url = `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(term)}`;
      const res = await fetch(url);
      if (!res.ok) {
        console.warn(`Remotive ${term} failed: ${res.status}`);
        continue;
      }
      const data = await res.json();
      for (const j of (data.jobs || [])) {
        results.push({
          id: makeId('remotive', j.id, j.url),
          title: j.title,
          company: j.company_name,
          location: j.candidate_required_location || 'Remote',
          country: 'Remote',
          source: 'Remotive',
          url: j.url,
          posted_date: j.publication_date ? j.publication_date.slice(0, 10) : null,
          role_type: classifyRole(j.title, term),
          salary_min: null,
          salary_max: null,
        });
      }
    } catch (err) {
      console.warn(`Remotive ${term} error:`, err.message);
    }
  }
  return results;
}

function loadExisting() {
  if (!fs.existsSync(JOBS_FILE)) return { last_updated: null, jobs: [] };
  try {
    return JSON.parse(fs.readFileSync(JOBS_FILE, 'utf8'));
  } catch {
    return { last_updated: null, jobs: [] };
  }
}

function mergeJobs(existingJobs, freshJobs) {
  const byId = new Map();
  const now = new Date().toISOString().slice(0, 10);

  for (const j of existingJobs) byId.set(j.id, j);

  for (const j of freshJobs) {
    if (byId.has(j.id)) {
      // keep original first_seen, refresh other fields in case they changed
      const prev = byId.get(j.id);
      byId.set(j.id, { ...j, first_seen: prev.first_seen });
    } else {
      byId.set(j.id, { ...j, first_seen: now });
    }
  }

  // drop stale entries
  const cutoff = Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000;
  const merged = [...byId.values()].filter(j => {
    const d = new Date(j.posted_date || j.first_seen || now).getTime();
    return isNaN(d) || d >= cutoff;
  });

  merged.sort((a, b) => (b.posted_date || '').localeCompare(a.posted_date || ''));
  return merged;
}

async function main() {
  console.log('Fetching jobs...');
  const [adzuna, remotive] = await Promise.all([fetchAdzuna(), fetchRemotive()]);
  const fresh = [...adzuna, ...remotive];
  console.log(`Fetched ${adzuna.length} Adzuna + ${remotive.length} Remotive = ${fresh.length} total`);

  const existing = loadExisting();
  const merged = mergeJobs(existing.jobs || [], fresh);

  const output = {
    last_updated: new Date().toISOString(),
    total_jobs: merged.length,
    jobs: merged,
  };

  fs.writeFileSync(JOBS_FILE, JSON.stringify(output, null, 2));
  console.log(`Wrote ${merged.length} jobs to jobs.json`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
