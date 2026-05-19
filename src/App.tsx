import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'

type ConversionResult =
  | {
      status: 'ready'
      label: string
      googleUrl: string
    }
  | {
      status: 'empty' | 'loading' | 'error'
      message: string
    }

const coordinatePattern = /(-?\d{1,2}(?:\.\d+)?),\s*(-?\d{1,3}(?:\.\d+)?)/

function normalizeUrl(value: string) {
  const trimmed = value.trim()

  if (!trimmed) {
    return ''
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed
  }

  return `https://${trimmed}`
}

function getSearchParam(url: URL, names: string[]) {
  for (const name of names) {
    const value = url.searchParams.get(name)

    if (value?.trim()) {
      return value.trim()
    }
  }

  return ''
}

function toGoogleMapsUrl(query: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}

function usefulPlaceName(name: string) {
  return name.toLowerCase() === 'my location' ? '' : name
}

function coordinatesFrom(value: string) {
  const match = value.match(coordinatePattern)

  if (!match) {
    return ''
  }

  const latitude = Number(match[1])
  const longitude = Number(match[2])

  if (
    Number.isNaN(latitude) ||
    Number.isNaN(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  ) {
    return ''
  }

  return `${latitude},${longitude}`
}

function convertExpandedAppleMapsUrl(normalized: string): ConversionResult {
  try {
    const url = new URL(normalized)
    const host = url.hostname.replace(/^www\./, '').toLowerCase()

    if (host !== 'maps.apple.com') {
      return {
        status: 'error',
        message: 'That does not look like an Apple Maps URL.',
      }
    }

    const coordinateQuery = getSearchParam(url, ['coordinate', 'll', 'sll'])

    if (coordinateQuery) {
      const cleanCoordinates = coordinatesFrom(coordinateQuery)

      if (cleanCoordinates) {
        const placeName = usefulPlaceName(getSearchParam(url, ['q', 'name']))
        const label = placeName ? `${placeName} (${cleanCoordinates})` : cleanCoordinates

        return {
          status: 'ready',
          label,
          googleUrl: toGoogleMapsUrl(placeName ? `${placeName} ${cleanCoordinates}` : cleanCoordinates),
        }
      }
    }

    const addressQuery = getSearchParam(url, ['address', 'q', 'name'])

    if (addressQuery) {
      return {
        status: 'ready',
        label: addressQuery,
        googleUrl: toGoogleMapsUrl(addressQuery),
      }
    }

    const coordinatesInUrl = coordinatesFrom(normalized)

    if (coordinatesInUrl) {
      return {
        status: 'ready',
        label: coordinatesInUrl,
        googleUrl: toGoogleMapsUrl(coordinatesInUrl),
      }
    }

    return {
      status: 'error',
      message: 'I could not find a place, address, or coordinates in that link.',
    }
  } catch {
    return {
      status: 'error',
      message: 'That URL is malformed.',
    }
  }
}

async function resolveShortAppleMapsUrl(normalized: string) {
  const response = await fetch(`/api/resolve-apple-maps?url=${encodeURIComponent(normalized)}`)
  const payload = (await response.json().catch(() => ({}))) as { error?: string; finalUrl?: string }

  if (!response.ok) {
    throw new Error(payload.error ?? 'Could not expand that Apple Maps short link.')
  }

  if (!payload.finalUrl) {
    throw new Error('That Apple Maps short link did not return a destination.')
  }

  return payload.finalUrl
}

async function convertAppleMapsUrl(value: string): Promise<ConversionResult> {
  const normalized = normalizeUrl(value)

  if (!normalized) {
    return {
      status: 'empty',
      message: 'Paste an Apple Maps URL.',
    }
  }

  try {
    const url = new URL(normalized)
    const host = url.hostname.replace(/^www\./, '').toLowerCase()

    if (host === 'maps.apple') {
      const expandedUrl = await resolveShortAppleMapsUrl(normalized)
      return convertExpandedAppleMapsUrl(expandedUrl)
    }

    return convertExpandedAppleMapsUrl(normalized)
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'That URL is malformed.',
    }
  }
}

function App() {
  const [appleUrl, setAppleUrl] = useState('')
  const [copyState, setCopyState] = useState<'idle' | 'copying' | 'copied' | 'error'>('idle')
  const [result, setResult] = useState<ConversionResult>({
    status: 'empty',
    message: 'Paste an Apple Maps URL.',
  })
  const canCopy = useMemo(() => result.status === 'ready', [result.status])

  useEffect(() => {
    if (copyState === 'idle') {
      return
    }

    const timeoutId = window.setTimeout(() => setCopyState('idle'), 2000)

    return () => window.clearTimeout(timeoutId)
  }, [copyState])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setCopyState('idle')
    setResult({
      status: 'loading',
      message: 'Converting...',
    })
    setResult(await convertAppleMapsUrl(appleUrl))
  }

  async function handleCopy() {
    if (result.status === 'ready') {
      setCopyState('copying')

      try {
        await navigator.clipboard.writeText(result.googleUrl)
        setCopyState('copied')
      } catch {
        setCopyState('error')
      }
    }
  }

  return (
    <main className="app-shell">
      <section className="converter" aria-labelledby="app-title">
        <div className="heading">
          <h1 id="app-title">Apple to Google Maps</h1>
        </div>

        <form className="url-form" onSubmit={handleSubmit}>
          <label htmlFor="apple-url">Apple Maps URL</label>
          <div className="input-row">
            <input
              id="apple-url"
              type="text"
              inputMode="url"
              placeholder="https://maps.apple/p/..."
              value={appleUrl}
              onChange={(event) => setAppleUrl(event.target.value)}
            />
            <button type="submit">Convert</button>
          </div>
        </form>

        <div className={`result result-${result.status}`} aria-live="polite">
          {result.status === 'ready' ? (
            <>
              <span className="result-label">{result.label}</span>
              <a className="result-url" href={result.googleUrl}>
                {result.googleUrl}
              </a>
              <button
                className={`copy-button copy-button-${copyState}`}
                type="button"
                onClick={handleCopy}
                disabled={!canCopy || copyState === 'copying'}
              >
                {copyState === 'copying'
                  ? 'Copying...'
                  : copyState === 'copied'
                    ? 'Copied'
                    : copyState === 'error'
                      ? 'Copy failed'
                      : 'Copy URL'}
              </button>
              <p className={`copy-status copy-status-${copyState}`} aria-live="polite">
                {copyState === 'copied'
                  ? 'Copied to clipboard.'
                  : copyState === 'error'
                    ? 'Clipboard blocked. Select the URL above and copy it manually.'
                    : ''}
              </p>
            </>
          ) : (
            <p>{result.message}</p>
          )}
        </div>
      </section>
    </main>
  )
}

export default App
