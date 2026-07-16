import { useEffect, useState } from 'react'
import { Capture, type CapturedImage } from './components/Capture'
import { ReviewBoard } from './components/ReviewBoard'
import { ExportPanel } from './components/ExportPanel'
import { Settings } from './components/Settings'
import { transcribeScoresheet } from './lib/ocr'
import { applyCorrection, validateMoves } from './lib/validate'
import type { GameMetadata } from './lib/pgn'
import { getAnthropicApiKey, getAnthropicModel } from './lib/storage'
import { completeLoginIfRedirected } from './lib/lichess'
import './App.css'

type Step = 'capture' | 'review'

// Logging in to lichess is a full-page redirect (and back), which would otherwise wipe all
// React state. We stash the in-progress scan here (sessionStorage: cleared when the tab closes,
// never sent anywhere) and restore it on load so the review/export step survives the round trip.
const SESSION_KEY = 'chess-scanner:session-state'

interface SessionState {
  step: Step
  sanMoves: string[]
  metadata: GameMetadata
}

function loadSessionState(): SessionState | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

const EMPTY_METADATA: GameMetadata = {
  event: '', site: '', date: '', round: '', white: '', black: '', result: '*',
}

export default function App() {
  const [images, setImages] = useState<CapturedImage[]>([])
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [sanMoves, setSanMoves] = useState<string[]>(() => loadSessionState()?.sanMoves ?? [])
  const [metadata, setMetadata] = useState<GameMetadata>(() => loadSessionState()?.metadata ?? EMPTY_METADATA)
  const [step, setStep] = useState<Step>(() => loadSessionState()?.step ?? 'capture')
  const [showSettings, setShowSettings] = useState(false)
  const [lichessError, setLichessError] = useState<string | null>(null)

  useEffect(() => {
    completeLoginIfRedirected().catch((e) => setLichessError(e.message))
  }, [])

  useEffect(() => {
    if (step === 'review') {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ step, sanMoves, metadata }))
    } else {
      sessionStorage.removeItem(SESSION_KEY)
    }
  }, [step, sanMoves, metadata])

  const validation = validateMoves(sanMoves)
  const allMovesValid = sanMoves.length > 0 && validation.firstErrorIndex === null

  async function handleScan() {
    setScanning(true)
    setScanError(null)
    try {
      const apiKey = getAnthropicApiKey()
      const model = getAnthropicModel()
      const result = await transcribeScoresheet(
        images.map((i) => ({ base64: i.base64, mediaType: i.mediaType })),
        apiKey,
        model,
      )
      setSanMoves(result.moves)
      setMetadata({
        event: result.event, site: result.site, date: result.date, round: result.round,
        white: result.white, black: result.black, result: result.result,
      })
      setStep('review')
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      const friendly = message.includes('529') || message.includes('overloaded')
        ? "Anthropic's API is temporarily overloaded (this happens occasionally). Please wait a moment and try scanning again."
        : message
      setScanError(friendly)
    } finally {
      setScanning(false)
    }
  }

  function handleCorrect(index: number, newSan: string) {
    setSanMoves((prev) => applyCorrection(prev, index, newSan))
  }

  return (
    <div className="app">
      <header>
        <h1>Chess Scanner</h1>
        <button type="button" onClick={() => setShowSettings(true)}>Settings</button>
      </header>

      {lichessError && <p className="error">{lichessError}</p>}

      {step === 'capture' && (
        <Capture
          images={images}
          onImagesChange={setImages}
          onScan={handleScan}
          scanning={scanning}
          error={scanError}
        />
      )}

      {step === 'review' && (
        <>
          <div className="step">
            <h2>2. Review & correct</h2>
            <p className="hint">Click a move to view the board at that point, double-click to edit it.</p>
            <ReviewBoard
              moves={validation.moves}
              finalFen={validation.finalFen}
              firstErrorIndex={validation.firstErrorIndex}
              onCorrect={handleCorrect}
            />
            <button
              type="button"
              onClick={() => {
                sessionStorage.removeItem(SESSION_KEY)
                setStep('capture')
                setSanMoves([])
              }}
            >
              Back to photos
            </button>
          </div>

          <ExportPanel
            legalMoves={sanMoves}
            metadata={metadata}
            onMetadataChange={setMetadata}
            allMovesValid={allMovesValid}
          />
        </>
      )}

      {showSettings && <Settings onClose={() => setShowSettings(false)} />}
    </div>
  )
}
