import { Chess } from 'chess.js'

export interface ValidatedMove {
  index: number
  san: string
  /** true once this move has been successfully applied to the board */
  ok: boolean
  /** legal SAN moves available at this point, for correction suggestions */
  legalMoves: string[]
  /** FEN before this move was attempted */
  fenBefore: string
}

export interface ValidationResult {
  moves: ValidatedMove[]
  /** FEN reached by applying every ok move in order, stopping at the first failure */
  finalFen: string
  firstErrorIndex: number | null
}

/** Replays OCR'd SAN moves through a fresh game, flagging the first move that doesn't parse/apply. */
export function validateMoves(sanMoves: string[]): ValidationResult {
  const chess = new Chess()
  const moves: ValidatedMove[] = []
  let firstErrorIndex: number | null = null

  for (let i = 0; i < sanMoves.length; i++) {
    const raw = sanMoves[i].trim()
    const fenBefore = chess.fen()
    const legalMoves = chess.moves()

    if (!raw || raw === '?' || firstErrorIndex !== null) {
      moves.push({ index: i, san: raw, ok: false, legalMoves, fenBefore })
      if (firstErrorIndex === null) firstErrorIndex = i
      continue
    }

    try {
      chess.move(raw)
      moves.push({ index: i, san: raw, ok: true, legalMoves, fenBefore })
    } catch {
      moves.push({ index: i, san: raw, ok: false, legalMoves, fenBefore })
      firstErrorIndex = i
    }
  }

  return { moves, finalFen: chess.fen(), firstErrorIndex }
}

/** Re-validates from scratch after the user edits one move's SAN text. */
export function applyCorrection(sanMoves: string[], index: number, newSan: string): string[] {
  const copy = [...sanMoves]
  copy[index] = newSan
  return copy
}

/** Ranks legal moves by similarity to what the OCR guessed, for one-tap correction suggestions. */
export function suggestLegalMoves(attempted: string, legalMoves: string[], limit = 5): string[] {
  const target = attempted.toUpperCase().replace(/[+#]/g, '')
  return [...legalMoves]
    .map((m) => ({ m, score: similarity(target, m.toUpperCase().replace(/[+#]/g, '')) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.m)
}

function similarity(a: string, b: string): number {
  const dist = levenshtein(a, b)
  return 1 - dist / Math.max(a.length, b.length, 1)
}

function levenshtein(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0))
  for (let i = 0; i <= a.length; i++) dp[i][0] = i
  for (let j = 0; j <= b.length; j++) dp[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1])
    }
  }
  return dp[a.length][b.length]
}
