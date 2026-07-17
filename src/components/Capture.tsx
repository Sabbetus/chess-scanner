import { useEffect, useRef, useState } from 'react'
import { fileToBase64, type ScanProgress } from '../lib/ocr'

export interface CapturedImage {
  file: File
  previewUrl: string
  base64: string
  mediaType: string
}

interface Props {
  images: CapturedImage[]
  onImagesChange: (images: CapturedImage[]) => void
  onScan: () => void
  scanning: boolean
  scanProgress: ScanProgress
  error: string | null
}

export function Capture({ images, onImagesChange, onScan, scanning, scanProgress, error }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  // The browser sometimes buffers the whole (gzip-compressed) streamed response until it's
  // nearly done, so the move counter can go quiet for a while even though real progress is
  // happening server-side. An elapsed-time tick keeps the button visibly alive either way.
  useEffect(() => {
    if (!scanning) {
      setElapsedSeconds(0)
      return
    }
    const start = Date.now()
    const interval = setInterval(() => setElapsedSeconds(Math.floor((Date.now() - start) / 1000)), 1000)
    return () => clearInterval(interval)
  }, [scanning])

  async function handleFiles(fileList: FileList | null) {
    if (!fileList) return
    const additions: CapturedImage[] = []
    for (const file of Array.from(fileList)) {
      const { base64, mediaType } = await fileToBase64(file)
      additions.push({ file, previewUrl: URL.createObjectURL(file), base64, mediaType })
    }
    onImagesChange([...images, ...additions])
  }

  function removeImage(index: number) {
    const removed = images[index]
    URL.revokeObjectURL(removed.previewUrl)
    onImagesChange(images.filter((_, i) => i !== index))
  }

  return (
    <div className="step">
      <h2>1. Capture your scoresheet</h2>
      <p className="hint">
        Photograph each page of your scoresheet. Photos stay on your device and are sent only to
        the Anthropic API you've configured in Settings.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        hidden
        onChange={(e) => handleFiles(e.target.files)}
      />
      <button type="button" onClick={() => inputRef.current?.click()}>
        Add photo
      </button>

      {images.length > 0 && (
        <div className="thumb-grid">
          {images.map((img, i) => (
            <div className="thumb" key={img.previewUrl}>
              <img src={img.previewUrl} alt={`Scoresheet page ${i + 1}`} />
              <button type="button" className="remove" onClick={() => removeImage(i)} aria-label="Remove photo">
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {error && <p className="error">{error}</p>}

      <button type="button" disabled={images.length === 0 || scanning} onClick={onScan}>
        {scanning ? scanButtonLabel(scanProgress, elapsedSeconds) : 'Scan scoresheet'}
      </button>
    </div>
  )
}

function scanButtonLabel(progress: ScanProgress, elapsedSeconds: number): string {
  const suffix = elapsedSeconds > 0 ? ` (${elapsedSeconds}s)` : ''

  if (progress.stage === 'retrying' && progress.retry) {
    return `Retrying after a temporary error… (attempt ${progress.retry.attempt + 1} of ${progress.retry.maxAttempts})${suffix}`
  }

  if (progress.stage === 'uploading') {
    return `Uploading & reading scoresheet…${suffix}`
  }

  const moveNumber = Math.ceil(progress.moveCount / 2)
  return progress.moveCount > 0
    ? `Transcribing… move ${moveNumber}${suffix}`
    : `Transcribing moves…${suffix}`
}
