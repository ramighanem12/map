import { defineConfig, type Plugin } from 'vite'
import { URL } from 'node:url'
import react from '@vitejs/plugin-react'

function appleMapsResolver(): Plugin {
  return {
    name: 'apple-maps-resolver',
    configureServer(server) {
      server.middlewares.use('/api/resolve-apple-maps', async (request, response) => {
        const requestUrl = new URL(request.url ?? '', 'http://localhost')
        const appleUrl = requestUrl.searchParams.get('url')

        if (!appleUrl) {
          response.statusCode = 400
          response.end(JSON.stringify({ error: 'Missing url parameter' }))
          return
        }

        try {
          const parsedUrl = new URL(appleUrl)
          const host = parsedUrl.hostname.replace(/^www\./, '').toLowerCase()

          if (host !== 'maps.apple') {
            response.statusCode = 400
            response.end(JSON.stringify({ error: 'Only maps.apple short links can be resolved' }))
            return
          }

          const resolved = await fetch(parsedUrl, {
            method: 'HEAD',
            redirect: 'manual',
          })
          const finalUrl = resolved.headers.get('location') ?? parsedUrl.toString()

          response.setHeader('content-type', 'application/json')
          response.end(JSON.stringify({ finalUrl }))
        } catch {
          response.statusCode = 400
          response.end(JSON.stringify({ error: 'Could not resolve that Apple Maps URL' }))
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [appleMapsResolver(), react()],
})
