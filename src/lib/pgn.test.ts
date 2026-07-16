import { Chess } from 'chess.js'
import { describe, expect, it } from 'vitest'
import { buildPgn } from './pgn'

describe('buildPgn', () => {
  it('includes provided headers and moves', () => {
    const pgn = buildPgn(['e4', 'e5', 'Nf3', 'Nc6'], {
      event: 'Club Championship',
      white: 'Sabbe',
      black: 'Opponent',
      result: '*',
    })
    expect(pgn).toContain('[Event "Club Championship"]')
    expect(pgn).toContain('[White "Sabbe"]')
    expect(pgn).toContain('1. e4 e5 2. Nf3 Nc6')
  })

  it('round-trips through chess.js (produced PGN is itself valid)', () => {
    const moves = ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6']
    const pgn = buildPgn(moves, { white: 'A', black: 'B', result: '*' })
    const replay = new Chess()
    replay.loadPgn(pgn)
    expect(replay.history()).toEqual(moves)
  })

  it('fills in defaults for missing metadata', () => {
    const pgn = buildPgn(['e4'], {})
    expect(pgn).toContain('[Result "*"]')
  })
})
