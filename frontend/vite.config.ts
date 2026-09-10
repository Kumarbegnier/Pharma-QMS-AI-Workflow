import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  server: {
    port: 5173,
    proxy: {
      '/api':    { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/health': { target: 'http://127.0.0.1:8000', changeOrigin: true },
    },
  },

  build: {
    // Warn when a chunk exceeds 400 kB (down from 500 kB default)
    chunkSizeWarningLimit: 400,

    rollupOptions: {
      output: {
        // Split vendor code into cacheable separate chunks.
        // React + react-dom never change between deploys → long-lived cache hit.
        manualChunks: {
          // React core — changes rarely
          'vendor-react': ['react', 'react-dom'],

          // State management — changes occasionally
          'vendor-redux': ['@reduxjs/toolkit', 'react-redux'],
        },
      },
    },

    // Enable minification (default terser → esbuild is faster, equally effective)
    minify: 'esbuild',

    // Inline assets ≤ 4 kB as base64 data URIs (saves extra HTTP requests)
    assetsInlineLimit: 4096,

    // Emit source maps only in development (speeds up CI, reduces output size)
    sourcemap: false,
  },
})
