import { Chess } from 'chess.js'

export interface GameMetadata {
  event: string
  site: string
  date: string
  round: string
  white: string
  black: string
  result: string
}

const DEFAULT_METADATA: GameMetadata = {
  event: '?',
  site: '?',
  date: '????.??.??',
  round: '?',
  white: '?',
  black: '?',
  result: '*',
}

/** Builds a PGN from a list of fully-legal SAN moves (only ok:true moves should be passed in). */
export function buildPgn(sanMoves: string[], metadata: Partial<GameMetadata>): string {
  const meta = { ...DEFAULT_METADATA, ...metadata }
  const chess = new Chess()

  chess.header(
    'Event', meta.event,
    'Site', meta.site,
    'Date', meta.date,
    'Round', meta.round,
    'White', meta.white,
    'Black', meta.black,
    'Result', meta.result,
  )

  for (const san of sanMoves) {
    chess.move(san)
  }

  return chess.pgn()
}
