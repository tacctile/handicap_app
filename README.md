# Handicap App

A horse racing handicapping application.

## Development

```bash
npm install
npm run dev
```

## Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run lint         # Run ESLint
npm run test         # Run tests
npm run test:coverage # Run tests with coverage
```

## Tech Stack

- Vite + React + TypeScript
- TailwindCSS
- Vitest for testing
- PWA with service worker

## CI/CD

This project uses GitHub Actions for continuous integration and deployment.

### Workflows

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| CI | Push/PR to main | Lint, type check, test, build |
| Quality | PRs only | Bundle size, console.log, any checks |
| Deploy | Push/PR to main | Vercel deployment |
| AI Validation | Manual or AI file changes | AI vs Algorithm comparison tests |

### Required Secrets

Configure these secrets in GitHub repository settings:

| Secret | Description |
|--------|-------------|
| `VERCEL_TOKEN` | Vercel authentication token |
| `VERCEL_ORG_ID` | Vercel organization ID (auto-configured by Vercel CLI) |
| `VERCEL_PROJECT_ID` | Vercel project ID (auto-configured by Vercel CLI) |
| `VITE_GEMINI_API_KEY` | Gemini API key for AI validation tests |

## AI Testing

AI validation tests run via GitHub Actions. See [docs/AI_TESTING.md](docs/AI_TESTING.md) for details.

To trigger manually:
1. Go to Actions → AI Validation Tests → Run workflow

## Branch Protection Rules

The following branch protection rules are recommended for the `main` branch:

### Required Settings

1. **Require a pull request before merging**
   - Require approvals: 1 (or more for teams)
   - Dismiss stale pull request approvals when new commits are pushed
   - Require review from Code Owners

2. **Require status checks to pass before merging**
   - Require branches to be up to date before merging
   - Required status checks:
     - `Lint`
     - `Type Check`
     - `Test`
     - `Build`

3. **Require conversation resolution before merging**

4. **Do not allow bypassing the above settings**

5. **Restrict who can push to matching branches**
   - Only allow merges through pull requests

### How to Configure

1. Go to Repository Settings > Branches
2. Click "Add branch protection rule"
3. Enter `main` as the branch name pattern
4. Enable the settings listed above
5. Click "Create" or "Save changes"
