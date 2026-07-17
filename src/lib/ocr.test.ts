import { afterEach, describe, expect, it, vi } from 'vitest'
import { countMovesInPartialJson, transcribeScoresheet, type ScanProgress } from './ocr'

function sseResponse(events: object[]): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      for (const event of events) {
        controller.enqueue(encoder.encode(`event: x\ndata: ${JSON.stringify(event)}\n\n`))
      }
      controller.close()
    },
  })
  return new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } })
}

afterEach(() => vi.unstubAllGlobals())

describe('transcribeScoresheet (streamed)', () => {
  it('assembles deltas, reports progress, and parses the final JSON', async () => {
    const json = '{"event":"HOF","site":"","date":"2026.07.15","round":"4","white":"A","black":"B","result":"1-0","moves":["d4","d5","c4"]}'
    const chunks = [json.slice(0, 40), json.slice(40, 90), json.slice(90)]
    vi.stubGlobal('fetch', vi.fn(async () =>
      sseResponse(chunks.map((text) => ({ type: 'content_block_delta', delta: { type: 'text_delta', text } }))),
    ))

    const progress: ScanProgress[] = []
    const result = await transcribeScoresheet(
      [{ base64: 'aGk=', mediaType: 'image/jpeg' }],
      'test-key',
      'test-model',
      (p) => progress.push(p),
    )

    expect(result.moves).toEqual(['d4', 'd5', 'c4'])
    expect(result.white).toBe('A')
    expect(progress[0]).toEqual({ stage: 'uploading', moveCount: 0 })
    expect(progress.some((p) => p.stage === 'transcribing')).toBe(true)
    expect(progress[progress.length - 1]).toEqual({ stage: 'transcribing', moveCount: 3 })
  })

  it('surfaces max_tokens truncation as a clear error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      sseResponse([
        { type: 'content_block_delta', delta: { type: 'text_delta', text: '{"moves":["d4"' } },
        { type: 'message_delta', delta: { stop_reason: 'max_tokens' } },
      ]),
    ))

    await expect(
      transcribeScoresheet([{ base64: 'aGk=', mediaType: 'image/jpeg' }], 'test-key', 'test-model'),
    ).rejects.toThrow(/cut off/)
  })
})

describe('countMovesInPartialJson', () => {
  it('returns 0 before the moves array appears', () => {
    expect(countMovesInPartialJson('')).toBe(0)
    expect(countMovesInPartialJson('{"event":"HOF 2026","white":"Tero"')).toBe(0)
    expect(countMovesInPartialJson('{"event":"x","moves"')).toBe(0)
  })

  it('counts only complete quoted moves, ignoring a partial one mid-stream', () => {
    expect(countMovesInPartialJson('{"event":"x","moves":[')).toBe(0)
    expect(countMovesInPartialJson('{"event":"x","moves":["d4"')).toBe(1)
    expect(countMovesInPartialJson('{"event":"x","moves":["d4","d5","Nf3","Nf')).toBe(3)
  })

  it('counts the full list once the JSON is complete', () => {
    expect(countMovesInPartialJson('{"event":"x","moves":["d4","d5","c4","e6"]}')).toBe(4)
  })

  it('is not confused by quotes in header fields before the moves array', () => {
    const text = '{"event":"Club \\"Open\\" 2026","white":"A","black":"B","moves":["e4","e5"'
    expect(countMovesInPartialJson(text)).toBe(2)
  })
})
