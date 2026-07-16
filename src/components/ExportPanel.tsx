import { useEffect, useState } from 'react'
import type { GameMetadata } from '../lib/pgn'
import { buildPgn } from '../lib/pgn'
import * as lichess from '../lib/lichess'
import type { Study } from '../lib/lichess'
import type { LichessAuth } from '../lib/storage'

interface Props {
  legalMoves: string[]
  metadata: GameMetadata
  onMetadataChange: (m: GameMetadata) => void
  allMovesValid: boolean
}

export function ExportPanel({ legalMoves, metadata, onMetadataChange, allMovesValid }: Props) {
  const [auth, setAuth] = useState<LichessAuth | null>(lichess.currentAuth())
  const [studies, setStudies] = useState<Study[]>([])
  const [selectedStudy, setSelectedStudy] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const pgn = allMovesValid ? buildPgn(legalMoves, metadata) : ''

  useEffect(() => {
    if (auth) {
      lichess
        .listStudies(auth)
        .then(setStudies)
        .catch((e) => setStatus(`Couldn't load studies: ${e.message}`))
    }
  }, [auth])

  function updateField(key: keyof GameMetadata, value: string) {
    onMetadataChange({ ...metadata, [key]: value })
  }

  async function handleImport() {
    if (!auth || !selectedStudy || !pgn) return
    setBusy(true)
    setStatus(null)
    try {
      const chapterName = `${metadata.white || '?'} - ${metadata.black || '?'} | ${formatResult(metadata.result)}`
      await lichess.importPgnToStudy(auth, selectedStudy, pgn, chapterName)
      setStatus('Imported into lichess study ✓')
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function copyPgn() {
    await navigator.clipboard.writeText(pgn)
    setStatus('PGN copied to clipboard.')
  }

  function downloadPgn() {
    const blob = new Blob([pgn], { type: 'application/x-chess-pgn' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${metadata.white || 'white'}-vs-${metadata.black || 'black'}.pgn`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="step">
      <h2>3. Game details & export</h2>

      <div className="metadata-form">
        <label>
          Event <input value={metadata.event} onChange={(e) => updateField('event', e.target.value)} />
        </label>
        <label>
          Site <input value={metadata.site} onChange={(e) => updateField('site', e.target.value)} />
        </label>
        <label>
          Date (YYYY.MM.DD) <input value={metadata.date} onChange={(e) => updateField('date', e.target.value)} />
        </label>
        <label>
          Round <input value={metadata.round} onChange={(e) => updateField('round', e.target.value)} />
        </label>
        <label>
          White <input value={metadata.white} onChange={(e) => updateField('white', e.target.value)} />
        </label>
        <label>
          Black <input value={metadata.black} onChange={(e) => updateField('black', e.target.value)} />
        </label>
        <label>
          Result
          <select value={metadata.result} onChange={(e) => updateField('result', e.target.value)}>
            <option value="*">*</option>
            <option value="1-0">1-0</option>
            <option value="0-1">0-1</option>
            <option value="1/2-1/2">1/2-1/2</option>
          </select>
        </label>
      </div>

      {!allMovesValid && <p className="error">Resolve the flagged move above before exporting.</p>}

      {allMovesValid && (
        <>
          <textarea className="pgn-output" readOnly value={pgn} rows={8} />
          <div className="button-row">
            <button type="button" onClick={copyPgn}>Copy PGN</button>
            <button type="button" onClick={downloadPgn}>Download PGN</button>
          </div>

          <div className="lichess-export">
            {!auth ? (
              <button type="button" onClick={() => lichess.beginLogin()}>Log in to lichess</button>
            ) : (
              <>
                <p>Logged in as {auth.username}. <button type="button" onClick={() => { lichess.logout(); setAuth(null) }}>Log out</button></p>
                <label>
                  Study
                  <select value={selectedStudy} onChange={(e) => setSelectedStudy(e.target.value)}>
                    <option value="">Select a study…</option>
                    {studies.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </label>
                <button type="button" disabled={!selectedStudy || busy} onClick={handleImport}>
                  {busy ? 'Importing…' : 'Import as new chapter'}
                </button>
              </>
            )}
          </div>
        </>
      )}

      {status && <p className="status">{status}</p>}
    </div>
  )
}

/** Chapter-name result format: comma as decimal separator, e.g. "1/2-1/2" -> "0,5-0,5". */
function formatResult(result: string): string {
  if (result === '1/2-1/2') return '0,5-0,5'
  return result
}
