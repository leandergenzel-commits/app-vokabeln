import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages serviert das Repo unter /app-vokabeln/
const base = process.env.VITE_BASE ?? '/app-vokabeln/';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Parliamo! Italienisch-Vokabeltrainer',
        short_name: 'Parliamo!',
        description: 'Italienisch lernen mit Karteikarten, Eselsbrücken und Wiederholungsplan',
        lang: 'de',
        theme_color: '#008C45',
        background_color: '#FBF7F0',
        display: 'standalone',
        orientation: 'any',
        start_url: '.',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Die Browser-KI (WebLLM) ist groß und wird nur bei Bedarf geladen
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        globIgnores: ['**/webllm-*.js'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
  ],
  build: {
    // Die Startdaten (1000+ Vokabeln) stecken im Hauptbundle
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        chunkFileNames: (chunk) =>
          chunk.moduleIds.some((id) => id.includes('@mlc-ai/web-llm'))
            ? 'assets/webllm-[hash].js'
            : 'assets/[name]-[hash].js',
      },
    },
  },
  test: {
    environment: 'node',
  },
});
