function isExpandedAppleMapsUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase() === 'maps.apple.com'
  } catch {
    return false
  }
}

async function resolveAppleMapsShortLink(url) {
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

export default async function handler(request, response) {
  const requestUrl = new URL(request.url, `https://${request.headers.host}`)
  const appleUrl = requestUrl.searchParams.get('url')

  response.setHeader('content-type', 'application/json')

  if (!appleUrl) {
    response.status(400).json({ error: 'Missing url parameter' })
    return
  }

  try {
    const parsedUrl = new URL(appleUrl)
    const host = parsedUrl.hostname.replace(/^www\./, '').toLowerCase()

    if (host !== 'maps.apple') {
      response.status(400).json({ error: 'Only maps.apple short links can be resolved' })
      return
    }

    const finalUrl = await resolveAppleMapsShortLink(parsedUrl)

    if (!finalUrl) {
      response.status(502).json({ error: 'Apple did not return an expanded Maps URL' })
      return
    }

    response.status(200).json({ finalUrl })
  } catch {
    response.status(502).json({ error: 'Could not resolve that Apple Maps short link' })
  }
}
