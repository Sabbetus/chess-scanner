import { useRef } from 'react'
import { fileToBase64 } from '../lib/ocr'

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
  error: string | null
}

export function Capture({ images, onImagesChange, onScan, scanning, error }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

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
        {scanning ? 'Scanning…' : 'Scan scoresheet'}
      </button>
    </div>
  )
}
