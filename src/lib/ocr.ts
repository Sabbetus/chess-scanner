// Sends scoresheet photo(s) straight from the browser to the Anthropic API using the
// user's own key. Nothing is proxied through any server the app author controls.

export interface OcrResult {
  event: string
  site: string
  date: string
  round: string
  white: string
  black: string
  result: string
  /** SAN moves in order, White's 1st move first, alternating W/B */
  moves: string[]
}

const SYSTEM_PROMPT = `You transcribe handwritten chess tournament scoresheets into structured JSON.
The scoresheet uses English algebraic notation (K, Q, R, B, N for pieces, no letter for pawns).
Read every move in order, left column then right column (or however the columns are laid out), alternating White then Black.
Preserve check (+), checkmate (#), captures (x), promotions (=Q etc.), and castling (O-O, O-O-O) exactly as written.
If a move is illegible or missing, put your best guess but do not invent moves that aren't there — use "?" for a move you truly cannot read.
Also read any header fields on the sheet (event, site/location, date, round, white player, black player, result).
Respond with ONLY a JSON object matching this TypeScript type, no prose, no markdown fences:
{
  "event": string, "site": string, "date": string, "round": string,
  "white": string, "black": string, "result": string,
  "moves": string[]
}
Use "" for any header field you cannot find. Use "*" for result if unknown.`

export async function transcribeScoresheet(
  images: { base64: string; mediaType: string }[],
  apiKey: string,
  model: string,
): Promise<OcrResult> {
  if (!apiKey) throw new Error('No Anthropic API key set. Add one in Settings.')
  if (images.length === 0) throw new Error('No images to transcribe.')

  const content: unknown[] = images.map((img) => ({
    type: 'image',
    source: { type: 'base64', media_type: img.mediaType, data: img.base64 },
  }))
  content.push({
    type: 'text',
    text: 'Transcribe this chess scoresheet into the JSON format described in your instructions.',
  })

  const requestBody = JSON.stringify({
    model,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content }],
  })

  const res = await fetchWithRetry(requestBody, apiKey)
  const data = await res.json()
  const text: string = data?.content?.find((b: { type: string }) => b.type === 'text')?.text ?? ''
  return parseOcrJson(text)
}

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 529])

/** Anthropic occasionally returns 529 (overloaded) or other 5xx errors; retry a few times with backoff. */
async function fetchWithRetry(body: string, apiKey: string, maxAttempts = 4): Promise<Response> {
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body,
    })

    if (res.ok) return res

    const responseBody = await res.text().catch(() => '')
    lastError = new Error(`Anthropic API error ${res.status}: ${responseBody.slice(0, 500)}`)

    if (!RETRYABLE_STATUSES.has(res.status) || attempt === maxAttempts) {
      throw lastError
    }

    const delayMs = 1000 * 2 ** (attempt - 1)
    await new Promise((resolve) => setTimeout(resolve, delayMs))
  }

  throw lastError ?? new Error('Anthropic API request failed.')
}

function parseOcrJson(text: string): OcrResult {
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Model did not return JSON. Raw response: ' + text.slice(0, 300))
  let parsed: unknown
  try {
    parsed = JSON.parse(jsonMatch[0])
  } catch {
    throw new Error('Could not parse model JSON response.')
  }
  const p = parsed as Partial<OcrResult>
  return {
    event: p.event ?? '',
    site: p.site ?? '',
    date: p.date ?? '',
    round: p.round ?? '',
    white: p.white ?? '',
    black: p.black ?? '',
    result: p.result ?? '*',
    moves: Array.isArray(p.moves) ? p.moves.map((m) => String(m)) : [],
  }
}

export function fileToBase64(file: File): Promise<{ base64: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const base64 = result.split(',')[1] ?? ''
      resolve({ base64, mediaType: file.type || 'image/jpeg' })
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}
