module.exports = {
  ci: {
    collect: {
      staticDistDir: './dist',
      numberOfRuns: 3,
    },
    assert: {
      assertions: {
        // TODO: Tighten after UI overhaul optimization
        // Core scores (fail if below thresholds)
        'categories:performance': ['error', { minScore: 0.6 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['error', { minScore: 0.9 }],
        'categories:seo': ['error', { minScore: 0.8 }],

        // Core Web Vitals (fail if above thresholds)
        'first-contentful-paint': ['error', { maxNumericValue: 4500 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 5000 }],
        'total-blocking-time': ['error', { maxNumericValue: 300 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};
