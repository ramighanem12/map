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

    const resolved = await fetch(parsedUrl, {
      method: 'HEAD',
      redirect: 'manual',
    })
    const finalUrl = resolved.headers.get('location')

    if (!finalUrl) {
      response.status(502).json({ error: 'Apple did not return an expanded Maps URL' })
      return
    }

    response.status(200).json({ finalUrl })
  } catch {
    response.status(502).json({ error: 'Could not resolve that Apple Maps short link' })
  }
}
