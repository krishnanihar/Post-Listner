#!/usr/bin/env node
// Bundles conduct-relay/src/phone.js → conduct-relay/public/phone.bundle.js
//
// Single-file IIFE so the relay server.cjs can serve it as a plain <script>
// without ESM resolution. Browser target = es2020 (matches the rest of the
// app's runtime expectations).
//
// Usage:
//   node scripts/build-relay-phone.js          # one-shot build
//   node scripts/build-relay-phone.js --watch  # rebuild on changes
//
// Invoked by:
//   npm run build:relay-phone
//   npm run dev:relay  (runs --watch + node conduct-relay/server.cjs)

import * as esbuild from 'esbuild'

const watch = process.argv.includes('--watch')

const config = {
  entryPoints: ['conduct-relay/src/phone.js'],
  bundle: true,
  format: 'iife',
  target: ['es2020'],
  platform: 'browser',
  outfile: 'conduct-relay/public/phone.bundle.js',
  sourcemap: true,
  logLevel: 'info',
}

if (watch) {
  const ctx = await esbuild.context(config)
  await ctx.watch()
  console.log('[build-relay-phone] watching…')
} else {
  await esbuild.build(config)
  console.log('[build-relay-phone] built conduct-relay/public/phone.bundle.js')
}
