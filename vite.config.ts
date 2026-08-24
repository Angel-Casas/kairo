import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  build: {
    rollupOptions: {
      // Two entries: the app (/) and the marketing page (/landing.html,
      // Slice 16 — the Pastel River landing).
      input: {
        main: 'index.html',
        landing: 'landing.html',
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Kairo',
        short_name: 'Kairo',
        description:
          'Generate videos in any format with your own NanoGPT API key — script, art, animation, export.',
        theme_color: '#1d2434',
        background_color: '#1d2434',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
})
