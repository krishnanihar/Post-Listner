import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import dotenv from 'dotenv'
import path from 'path'

// Load .env.local for server-side API routes. Vite's built-in env loader
// only handles VITE_-prefixed vars at build time and inlines them into the
// client bundle — we explicitly want ELEVENLABS_API_KEY to stay server-side.
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

function apiMiddleware() {
  return {
    name: 'api-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith('/api/')) return next()
        const route = req.url.split('?')[0].slice('/api/'.length).replace(/\/$/, '')
        if (!route) return next()
        try {
          const mod = await server.ssrLoadModule(`/api/${route}.js`)
          const handler = mod.default
          if (typeof handler !== 'function') {
            res.statusCode = 404
            res.end('handler not exported')
            return
          }
          await handler(req, res)
        } catch (e) {
          console.error(`[api/${route}] error:`, e)
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: e.message || 'internal error' }))
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), apiMiddleware()],
})
