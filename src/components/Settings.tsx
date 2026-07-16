import { useState } from 'react'
import { clearAllData, getAnthropicApiKey, getAnthropicModel, setAnthropicApiKey, setAnthropicModel } from '../lib/storage'

interface Props {
  onClose: () => void
}

const MODELS = ['claude-sonnet-5', 'claude-opus-4-8', 'claude-haiku-4-5-20251001']

export function Settings({ onClose }: Props) {
  const [apiKey, setApiKeyState] = useState(getAnthropicApiKey())
  const [model, setModelState] = useState(getAnthropicModel())

  function save() {
    setAnthropicApiKey(apiKey.trim())
    setAnthropicModel(model)
    onClose()
  }

  function handleClearAll() {
    if (confirm('This clears your API key, lichess login, and any in-progress scan from this browser. Continue?')) {
      clearAllData()
      window.location.reload()
    }
  }

  return (
    <div className="settings-overlay">
      <div className="settings-panel">
        <h2>Settings</h2>
        <p className="hint">
          Your API key is stored only in this browser's local storage and is sent directly to
          Anthropic's API — never to any server run by this app's author. Anyone visiting this
          public site must supply their own key; your key and your usage are never shared.
        </p>

        <label>
          Anthropic API key
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKeyState(e.target.value)}
            placeholder="sk-ant-..."
            autoComplete="off"
          />
        </label>

        <label>
          Model
          <select value={model} onChange={(e) => setModelState(e.target.value)}>
            {MODELS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </label>

        <div className="button-row">
          <button type="button" onClick={save}>Save</button>
          <button type="button" onClick={onClose}>Cancel</button>
        </div>

        <hr />
        <button type="button" className="danger" onClick={handleClearAll}>
          Clear all local data
        </button>
      </div>
    </div>
  )
}
