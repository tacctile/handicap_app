# AI Testing Infrastructure

## Overview

All AI-related tests run via GitHub Actions with the Gemini API key stored securely as a GitHub secret.

## Running AI Tests

### Via GitHub UI (Recommended)

1. Go to the repository on GitHub
2. Click **Actions** tab
3. Select **AI Validation Tests** workflow
4. Click **Run workflow**
5. Select test type:
   - `ai-comparison` — Run AI vs Algorithm comparison (112 races)
   - `all-ai-tests` — Run all AI-related tests
6. Click **Run workflow**
7. View results in the job summary and download artifacts

### Automatic Triggers

AI tests run automatically when:
- PRs are opened that modify `src/services/ai/**` files
- PRs are opened that modify AI test files

### Viewing Results

- **Job Summary**: Quick overview of win rates and comparison stats
- **Artifacts**: Full JSON results available for download (retained 90 days)

## Adding New AI Tests

1. Create test file in `src/__tests__/` with `ai` in the filename
2. Tests will automatically be included when running `all-ai-tests`
3. For dedicated workflow triggers, add path to `ai-validation.yml`

## API Key Management

The Gemini API key is stored as a GitHub secret named `VITE_GEMINI_API_KEY`.

To update:
1. Go to repository **Settings**
2. Click **Secrets and variables** → **Actions**
3. Update `VITE_GEMINI_API_KEY`

## Local Testing (Not Recommended)

If you must run AI tests locally:
1. Create `.env.local` in project root
2. Add `VITE_GEMINI_API_KEY=your_key_here`
3. Run `pnpm test -- --run src/__tests__/validation/aiVsAlgorithm.test.ts`

Note: Local testing is discouraged to avoid API key exposure.

## Test Costs

- ~$0.001 per race analyzed
- Full 112-race comparison: ~$0.12
- Budget accordingly for large test runs
