// All persistence is local-only (localStorage). Nothing here ever leaves the device
// except direct calls to api.anthropic.com (OCR) and lichess.org (export).

const KEYS = {
  anthropicApiKey: 'chess-scanner:anthropic-api-key',
  anthropicModel: 'chess-scanner:anthropic-model',
  handwritingNotes: 'chess-scanner:handwriting-notes',
  lichessToken: 'chess-scanner:lichess-token',
  lichessUsername: 'chess-scanner:lichess-username',
} as const

export function getAnthropicApiKey(): string {
  return localStorage.getItem(KEYS.anthropicApiKey) ?? ''
}

export function setAnthropicApiKey(key: string): void {
  if (key) localStorage.setItem(KEYS.anthropicApiKey, key)
  else localStorage.removeItem(KEYS.anthropicApiKey)
}

export function getAnthropicModel(): string {
  return localStorage.getItem(KEYS.anthropicModel) ?? 'claude-sonnet-5'
}

export function setAnthropicModel(model: string): void {
  localStorage.setItem(KEYS.anthropicModel, model)
}

export function getHandwritingNotes(): string {
  return localStorage.getItem(KEYS.handwritingNotes) ?? ''
}

export function setHandwritingNotes(notes: string): void {
  if (notes) localStorage.setItem(KEYS.handwritingNotes, notes)
  else localStorage.removeItem(KEYS.handwritingNotes)
}

export interface LichessAuth {
  accessToken: string
  username: string
}

export function getLichessAuth(): LichessAuth | null {
  const accessToken = localStorage.getItem(KEYS.lichessToken)
  const username = localStorage.getItem(KEYS.lichessUsername)
  if (!accessToken || !username) return null
  return { accessToken, username }
}

export function setLichessAuth(auth: LichessAuth | null): void {
  if (auth) {
    localStorage.setItem(KEYS.lichessToken, auth.accessToken)
    localStorage.setItem(KEYS.lichessUsername, auth.username)
  } else {
    localStorage.removeItem(KEYS.lichessToken)
    localStorage.removeItem(KEYS.lichessUsername)
  }
}

/** Wipes every piece of app data from this browser. Does not affect lichess.org itself. */
export function clearAllData(): void {
  for (const key of Object.values(KEYS)) localStorage.removeItem(key)
}
