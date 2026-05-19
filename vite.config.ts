import { defineConfig, type Plugin } from 'vite'
import { URL } from 'node:url'
import react from '@vitejs/plugin-react'

function isExpandedAppleMapsUrl(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase() === 'maps.apple.com'
  } catch {
    return false
  }
}

async function resolveAppleMapsShortLink(url: URL) {
  const requestHeaders = {
    accept: 'text/html,application/xhtml+xml',
    'user-agent': 'Mozilla/5.0 AppleMapsToGoogleMaps/1.0',
  }

  const manualResponse = await fetch(url, {
    headers: requestHeaders,
    method: 'HEAD',
    redirect: 'manual',
  })
  const manualLocation = manualResponse.headers.get('location')

  if (manualLocation && isExpandedAppleMapsUrl(manualLocation)) {
    return manualLocation
  }

  const followedResponse = await fetch(url, {
    headers: requestHeaders,
    method: 'GET',
    redirect: 'follow',
  })

  if (isExpandedAppleMapsUrl(followedResponse.url)) {
    return followedResponse.url
  }

  return ''
}

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

          const finalUrl = await resolveAppleMapsShortLink(parsedUrl)

          if (!finalUrl) {
            response.statusCode = 502
            response.end(JSON.stringify({ error: 'Apple did not return an expanded Maps URL' }))
            return
          }

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
