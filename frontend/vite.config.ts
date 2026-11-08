import { createHash } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * Content Security Policy (PRD §14). Applied to the production build only: the dev server injects
 * inline scripts (React Refresh) and a HMR websocket that a strict policy would block.
 * Inline scripts left in the built index.html (the pre-paint theme script) are allowed by their
 * SHA-256 hash, computed from the exact emitted text so the policy can't drift from the script.
 * The same policy, plus other security headers, is written to dist/_headers for Netlify and
 * Cloudflare Pages; `frame-ancestors` only works as a header, so it is left out of the meta tag.
 * Vercel ignores _headers: vercel.json sets the header-only directives (the meta tag carries the
 * hashed policy). Keep the two header lists in step.
 */
function cspPlugin(): Plugin {
  let outDir = 'dist'
  let policy = ''
  const directives = (scriptHashes: string[]) => [
    "default-src 'self'",
    `script-src 'self' ${scriptHashes.map((h) => `'sha256-${h}'`).join(' ')}`.trim(),
    // Inline style attributes and the toast library's injected <style> need 'unsafe-inline'.
    "style-src 'self' 'unsafe-inline'",
    // blob: for PNG export (an SVG rasterised through an <img>), data: for small inline images.
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ]
  return {
    name: 'solarsketch-csp',
    apply: 'build',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir)
    },
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        const hashes = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)]
          .map((m) => m[1])
          .filter((body) => body.trim())
          .map((body) => createHash('sha256').update(body, 'utf8').digest('base64'))
        policy = directives(hashes).join('; ')
        return html.replace(/(<meta charset="UTF-8" \/>)/i, `$1\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`)
      },
    },
    closeBundle() {
      if (!policy) return
      const headers = [
        '/*',
        `  Content-Security-Policy: ${policy}; frame-ancestors 'none'`,
        '  X-Content-Type-Options: nosniff',
        '  Referrer-Policy: no-referrer',
        '  X-Frame-Options: DENY',
        '  Cross-Origin-Opener-Policy: same-origin',
        '  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()',
        '',
        '/sw.js',
        '  Cache-Control: no-cache',
        '',
      ].join('\n')
      writeFileSync(path.join(outDir, '_headers'), headers)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    cspPlugin(),
    // Offline support (PRD P1): precache the built app, including the self-hosted fonts.
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'SolarSketch',
        short_name: 'SolarSketch',
        description: 'Solar PV virtual lab: wire, validate and simulate off-grid systems. Works offline; data stays in your browser.',
        theme_color: '#ec3013',
        background_color: '#f3f2f2',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,woff2}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: '/index.html',
      },
    }),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
})
