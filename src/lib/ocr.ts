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
Use "" for any header field you cannot find. Use "*" for result if unknown.
Output compact, minified JSON on as few lines as possible — no indentation, no line breaks between array
elements. This matters: a long game's move list must fit comfortably within the output budget.`

export type ScanStage = 'uploading' | 'retrying' | 'transcribing'

export interface ScanProgress {
  stage: ScanStage
  /** full-move count so far; only meaningful once stage is 'transcribing' */
  moveCount: number
  /** only set when stage is 'retrying' */
  retry?: { attempt: number; maxAttempts: number }
}

export async function transcribeScoresheet(
  images: { base64: string; mediaType: string }[],
  apiKey: string,
  model: string,
  onProgress?: (progress: ScanProgress) => void,
): Promise<OcrResult> {
  if (!apiKey) throw new Error('No Anthropic API key set. Add one in Settings.')
  if (images.length === 0) throw new Error('No images to transcribe.')

  onProgress?.({ stage: 'uploading', moveCount: 0 })

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
    max_tokens: 8192,
    stream: true,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content }],
  })

  const res = await fetchWithRetry(requestBody, apiKey, (attempt, maxAttempts) =>
    onProgress?.({ stage: 'retrying', moveCount: 0, retry: { attempt, maxAttempts } }),
  )
  const { text, stopReason } = await readStream(res, onProgress)

  if (stopReason === 'max_tokens') {
    throw new Error(
      "The response was cut off before it finished (the game may be very long, or the photo has a lot of detail). " +
      'Try again — if it keeps happening, try scanning fewer pages at once.',
    )
  }

  return parseOcrJson(text)
}

/**
 * Consumes the SSE stream, reporting progress as it becomes known. Until the response text
 * contains the "moves" key, we're still in the opaque "uploading / model reading the photo"
 * phase from the client's point of view — there is no earlier signal to report.
 */
async function readStream(
  res: Response,
  onProgress?: (progress: ScanProgress) => void,
): Promise<{ text: string; stopReason: string | null }> {
  if (!res.body) throw new Error('No response body from Anthropic API.')

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let text = ''
  let stopReason: string | null = null
  let lastStage: ScanStage = 'uploading'
  let lastCount = -1

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    // SSE frames are separated by blank lines; keep any trailing partial frame in the buffer.
    const frames = buffer.split('\n\n')
    buffer = frames.pop() ?? ''

    for (const frame of frames) {
      for (const line of frame.split('\n')) {
        if (!line.startsWith('data: ')) continue
        let event: any
        try {
          event = JSON.parse(line.slice(6))
        } catch {
          continue
        }
        if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
          text += event.delta.text
        } else if (event.type === 'message_delta' && event.delta?.stop_reason) {
          stopReason = event.delta.stop_reason
        }
      }
    }

    if (onProgress) {
      const count = countMovesInPartialJson(text)
      const stage: ScanStage = text.includes('"moves"') ? 'transcribing' : 'uploading'
      if (stage !== lastStage || count !== lastCount) {
        lastStage = stage
        lastCount = count
        onProgress({ stage, moveCount: count })
      }
    }
  }

  return { text, stopReason }
}

/** Counts complete quoted strings after "moves":[ in a possibly-incomplete JSON response. */
export function countMovesInPartialJson(text: string): number {
  const movesKey = text.indexOf('"moves"')
  if (movesKey < 0) return 0
  const bracket = text.indexOf('[', movesKey)
  if (bracket < 0) return 0
  return (text.slice(bracket).match(/"[^"]*"/g) ?? []).length
}

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 529])

/** Anthropic occasionally returns 529 (overloaded) or other 5xx errors; retry a few times with backoff. */
async function fetchWithRetry(
  body: string,
  apiKey: string,
  onRetry?: (attempt: number, maxAttempts: number) => void,
  maxAttempts = 4,
): Promise<Response> {
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

    onRetry?.(attempt, maxAttempts)
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

// Phone photos are commonly 3000-4000px on the long edge, far more detail than OCR needs and
// slower to upload/process for no accuracy gain. Downscale before sending; leave small images
// (already-cropped scans, screenshots) untouched to avoid needless recompression.
const MAX_DIMENSION = 1600

export function fileToBase64(file: File): Promise<{ base64: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const img = new Image()

    img.onload = () => {
      const longEdge = Math.max(img.width, img.height)

      if (longEdge <= MAX_DIMENSION) {
        URL.revokeObjectURL(objectUrl)
        readFileAsBase64(file).then(resolve, reject)
        return
      }

      const scale = MAX_DIMENSION / longEdge
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      const ctx = canvas.getContext('2d')
      URL.revokeObjectURL(objectUrl)

      if (!ctx) {
        readFileAsBase64(file).then(resolve, reject)
        return
      }

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
      resolve({ base64: dataUrl.split(',')[1] ?? '', mediaType: 'image/jpeg' })
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      // Fall back to sending the original file rather than failing the whole capture.
      readFileAsBase64(file).then(resolve, reject)
    }

    img.src = objectUrl
  })
}

function readFileAsBase64(file: File): Promise<{ base64: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve({ base64: result.split(',')[1] ?? '', mediaType: file.type || 'image/jpeg' })
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}
