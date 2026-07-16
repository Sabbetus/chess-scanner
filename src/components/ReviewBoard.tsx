import { Chessboard } from 'react-chessboard'
import { useEffect, useMemo, useState } from 'react'
import type { ValidatedMove } from '../lib/validate'
import { suggestLegalMoves } from '../lib/validate'

interface Props {
  moves: ValidatedMove[]
  finalFen: string
  firstErrorIndex: number | null
  onCorrect: (index: number, newSan: string) => void
}

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

export function ReviewBoard({ moves, finalFen, firstErrorIndex, onCorrect }: Props) {
  // currentIndex of -1 means "starting position, no moves played yet".
  // Otherwise it's the index of the move whose resulting position is shown.
  const [currentIndex, setCurrentIndex] = useState<number>(defaultIndex(moves, firstErrorIndex))
  const [orientation, setOrientation] = useState<'white' | 'black'>('white')

  // Jump to a sensible default whenever a fresh scan comes in (move count changes).
  useEffect(() => {
    setCurrentIndex(defaultIndex(moves, firstErrorIndex))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moves.length])

  const displayFen = useMemo(() => {
    if (currentIndex < 0) return moves[0]?.fenBefore ?? START_FEN
    return moves[currentIndex]?.fenAfter ?? finalFen
  }, [currentIndex, moves, finalFen])

  function goPrev() {
    setCurrentIndex((i) => Math.max(-1, i - 1))
  }
  function goNext() {
    setCurrentIndex((i) => Math.min(moves.length - 1, i + 1))
  }

  return (
    <div className="review-board">
      <div className="board-wrap">
        <Chessboard
          options={{ position: displayFen, allowDragging: false, id: 'review-board', boardOrientation: orientation }}
        />
        <div className="board-nav">
          <button type="button" onClick={goPrev} disabled={currentIndex < 0} aria-label="Previous move">
            ◀ Prev
          </button>
          <button
            type="button"
            onClick={() => setOrientation((o) => (o === 'white' ? 'black' : 'white'))}
            aria-label="Flip board"
            title="Flip board"
          >
            ⇅ Flip
          </button>
          <button type="button" onClick={goNext} disabled={currentIndex >= moves.length - 1} aria-label="Next move">
            Next ▶
          </button>
        </div>
        {firstErrorIndex !== null && (
          <p className="error">
            Move {firstErrorIndex + 1} ({moves[firstErrorIndex]?.san || '(blank)'}) doesn't look legal. Fix it below to
            continue.
          </p>
        )}
      </div>

      <ol className="move-list">
        {chunk(moves, 2).map((pair, moveNum) => (
          <li key={moveNum} className="move-row">
            <span className="move-num">{moveNum + 1}.</span>
            {pair.map((m) => (
              <MoveCell
                key={m.index}
                move={m}
                isCurrent={currentIndex === m.index}
                onSelect={() => setCurrentIndex(m.index)}
                onCorrect={(san) => onCorrect(m.index, san)}
              />
            ))}
          </li>
        ))}
      </ol>
    </div>
  )
}

function defaultIndex(moves: ValidatedMove[], firstErrorIndex: number | null): number {
  if (moves.length === 0) return -1
  return firstErrorIndex ?? moves.length - 1
}

function MoveCell({
  move,
  isCurrent,
  onSelect,
  onCorrect,
}: {
  move: ValidatedMove
  isCurrent: boolean
  onSelect: () => void
  onCorrect: (san: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(move.san)
  const suggestions = useMemo(
    () => (editing ? suggestLegalMoves(move.san, move.legalMoves) : []),
    [editing, move.san, move.legalMoves],
  )

  if (editing) {
    return (
      <span className="move-cell editing">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              onCorrect(text)
              setEditing(false)
            }
            if (e.key === 'Escape') setEditing(false)
          }}
          autoFocus
        />
        <button type="button" onClick={() => { onCorrect(text); setEditing(false) }}>
          ✓
        </button>
        {suggestions.length > 0 && (
          <div className="suggestions">
            {suggestions.map((s) => (
              <button
                type="button"
                key={s}
                onClick={() => {
                  onCorrect(s)
                  setEditing(false)
                }}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </span>
    )
  }

  return (
    <span
      className={`move-cell ${move.ok ? '' : 'invalid'} ${isCurrent ? 'current' : ''}`}
      onClick={onSelect}
      onDoubleClick={() => {
        setText(move.san)
        setEditing(true)
      }}
      title="Click to view resulting position, double-click to edit"
    >
      {move.san || '(blank)'}
    </span>
  )
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}
