# Data Analyst / Data Scientist Job Tracker

A self-updating job board (Adzuna + Remotive) with a built-in "already applied" tracker,
running entirely on free infrastructure.

## How it works
- `fetch-jobs.js` pulls listings and writes them to `jobs.json`
- `.github/workflows/update-jobs.yml` runs that script automatically every day (GitHub Actions, free)
- `index.html` is the site — open it directly, or host it for free on GitHub Pages
- "Mark Applied" / "Hide" are stored in your browser's localStorage — private to you, no login needed

## Setup (10 minutes)

### 1. Get a free Adzuna API key
Sign up at https://developer.adzuna.com/ (free) and grab your `app_id` and `app_key`.
(Remotive needs no key.)

### 2. Create a GitHub repo
Push these files to a new GitHub repository (public or private both work).

### 3. Add your Adzuna keys as repo secrets
In your repo: **Settings → Secrets and variables → Actions → New repository secret**
- `ADZUNA_APP_ID`
- `ADZUNA_APP_KEY`

### 4. Enable GitHub Pages
**Settings → Pages → Source: Deploy from branch → main → / (root)**
Your site will be live at `https://<username>.github.io/<repo-name>/`

### 5. Run the workflow once manually
**Actions tab → Update job listings → Run workflow**
This populates `jobs.json` for the first time. After that it runs automatically every day at 3 AM UTC.

## Running locally instead (no GitHub needed)
```bash
node fetch-jobs.js        # needs ADZUNA_APP_ID / ADZUNA_APP_KEY as env vars
# then just open index.html in your browser
```

## Customizing
- **Countries searched**: edit `ADZUNA_COUNTRIES` in `fetch-jobs.js` (full list: https://developer.adzuna.com/docs/countries)
- **Search terms**: edit `SEARCH_TERMS` in `fetch-jobs.js`
- **How long listings stay**: `KEEP_DAYS` in `fetch-jobs.js`
- **Schedule time**: the `cron` line in `.github/workflows/update-jobs.yml`

## Notes
- Applied/Hidden status lives in browser localStorage, tied to one browser. If you want it synced
  across devices, that would need a small backend (happy to add later if needed).
- LinkedIn/Indeed don't have public free APIs, so they're intentionally not included — scraping them
  violates their ToS and breaks constantly.
