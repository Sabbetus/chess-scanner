import { describe, expect, it } from 'vitest'
import { applyCorrection, suggestLegalMoves, validateMoves } from './validate'

describe('validateMoves', () => {
  it('accepts a fully legal game', () => {
    const result = validateMoves(['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'])
    expect(result.firstErrorIndex).toBeNull()
    expect(result.moves.every((m) => m.ok)).toBe(true)
  })

  it('flags the first illegal/unparseable move', () => {
    const result = validateMoves(['e4', 'e5', 'Zz9'])
    expect(result.firstErrorIndex).toBe(2)
    expect(result.moves[0].ok).toBe(true)
    expect(result.moves[1].ok).toBe(true)
    expect(result.moves[2].ok).toBe(false)
  })

  it('marks moves after an error as not-ok too', () => {
    const result = validateMoves(['e4', 'e5', 'Zz9', 'Nf3'])
    expect(result.firstErrorIndex).toBe(2)
    expect(result.moves[3].ok).toBe(false)
  })

  it('treats blank/? moves as errors', () => {
    const result = validateMoves(['e4', '?', 'Nf3'])
    expect(result.firstErrorIndex).toBe(1)
    expect(result.moves[2].ok).toBe(false)
  })
})

describe('applyCorrection', () => {
  it('replaces a single move by index without mutating the input', () => {
    const original = ['e4', 'e5', 'Zz9']
    const corrected = applyCorrection(original, 2, 'Nf3')
    expect(corrected).toEqual(['e4', 'e5', 'Nf3'])
    expect(original).toEqual(['e4', 'e5', 'Zz9'])
  })
})

describe('suggestLegalMoves', () => {
  it('ranks the closest legal move first', () => {
    const legal = ['Nf3', 'Nc3', 'e4', 'd4']
    const suggestions = suggestLegalMoves('Nf3x', legal, 2)
    expect(suggestions[0]).toBe('Nf3')
    expect(suggestions).toHaveLength(2)
  })
})
