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

export default function App() {
  const [images, setImages] = useState<CapturedImage[]>([])
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [sanMoves, setSanMoves] = useState<string[]>([])
  const [metadata, setMetadata] = useState<GameMetadata>({
    event: '', site: '', date: '', round: '', white: '', black: '', result: '*',
  })
  const [step, setStep] = useState<Step>('capture')
  const [showSettings, setShowSettings] = useState(false)
  const [lichessError, setLichessError] = useState<string | null>(null)

  useEffect(() => {
    completeLoginIfRedirected().catch((e) => setLichessError(e.message))
  }, [])

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
      setScanError(e instanceof Error ? e.message : String(e))
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
            <button type="button" onClick={() => setStep('capture')}>Back to photos</button>
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
