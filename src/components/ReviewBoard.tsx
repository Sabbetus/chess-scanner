import { Chessboard } from 'react-chessboard'
import { useMemo, useState } from 'react'
import type { ValidatedMove } from '../lib/validate'
import { suggestLegalMoves } from '../lib/validate'

interface Props {
  moves: ValidatedMove[]
  finalFen: string
  firstErrorIndex: number | null
  onCorrect: (index: number, newSan: string) => void
}

export function ReviewBoard({ moves, finalFen, firstErrorIndex, onCorrect }: Props) {
  const [viewIndex, setViewIndex] = useState<number | null>(null)

  const displayFen = useMemo(() => {
    if (viewIndex === null) return finalFen
    const m = moves[viewIndex]
    return m?.fenBefore ?? finalFen
  }, [viewIndex, moves, finalFen])

  return (
    <div className="review-board">
      <div className="board-wrap">
        <Chessboard options={{ position: displayFen, allowDragging: false, id: 'review-board' }} />
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
                isCurrent={viewIndex === m.index}
                onSelect={() => setViewIndex(m.index)}
                onCorrect={(san) => onCorrect(m.index, san)}
              />
            ))}
          </li>
        ))}
      </ol>
      {viewIndex !== null && (
        <button type="button" onClick={() => setViewIndex(null)}>
          Back to final position
        </button>
      )}
    </div>
  )
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
      title="Click to view position, double-click to edit"
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
