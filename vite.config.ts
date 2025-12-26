import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { visualizer } from 'rollup-plugin-visualizer';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Bundle analyzer - only runs when ANALYZE=true
    ...(process.env.ANALYZE === 'true'
      ? [
          visualizer({
            filename: 'stats.html',
            template: 'treemap',
            open: false,
            gzipSize: true,
            brotliSize: true,
          }),
        ]
      : []),
    VitePWA({
      registerType: 'prompt', // Prompt user for updates
      includeAssets: [
        'favicon.svg',
        'favicon-192x192.png',
        'favicon-512x512.png',
        'favicon-32x32.png',
        'favicon-16x16.png',
        'apple-touch-icon.png',
      ],
      manifest: false, // Use existing manifest.json
      workbox: {
        // Precache all static assets at install time
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        // Don't precache source maps
        globIgnores: ['**/*.map'],
        // Maximum file size to precache (5MB for track database)
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // Runtime caching strategies
        runtimeCaching: [
          // Google Fonts stylesheets - CacheFirst (rarely change)
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-stylesheets',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          // Google Fonts webfont files - CacheFirst
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          // Material Icons - CacheFirst
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/icon.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'material-icons',
              expiration: {
                maxEntries: 5,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          // Static images - CacheFirst
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'static-images',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          // API calls - StaleWhileRevalidate (when API is added)
          {
            urlPattern: /\/api\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60, // 1 hour
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          // Auth endpoints - NetworkOnly (must always be fresh)
          {
            urlPattern: /\/auth\/.*/i,
            handler: 'NetworkOnly',
          },
          // Payment endpoints - NetworkOnly (security critical)
          {
            urlPattern: /\/payments?\/.*/i,
            handler: 'NetworkOnly',
          },
          // Stripe API - NetworkOnly
          {
            urlPattern: /^https:\/\/.*\.stripe\.com\/.*/i,
            handler: 'NetworkOnly',
          },
          // Supabase/Firebase auth - NetworkOnly
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /^https:\/\/.*\.firebaseapp\.com\/.*/i,
            handler: 'NetworkOnly',
          },
        ],
      },
      // Dev options
      devOptions: {
        enabled: false, // Disable in dev to avoid caching issues
      },
    }),
  ],
});
