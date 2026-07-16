// OAuth2 Authorization Code + PKCE against lichess.org. No client secret needed,
// so this works entirely from a static site. Token is kept in localStorage only.

import { getLichessAuth, setLichessAuth, type LichessAuth } from './storage'

const CLIENT_ID = 'chess-scanner-local'
const AUTH_URL = 'https://lichess.org/oauth'
const TOKEN_URL = 'https://lichess.org/api/token'
// study:read is needed to list studies (including private ones); study:write to import the PGN.
const SCOPES = 'study:read study:write'
const PKCE_VERIFIER_KEY = 'chess-scanner:pkce-verifier'
const PKCE_STATE_KEY = 'chess-scanner:pkce-state'

function redirectUri(): string {
  return `${window.location.origin}${window.location.pathname}`
}

function base64UrlEncode(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let str = ''
  for (const b of arr) str += String.fromCharCode(b)
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function randomString(length = 64): string {
  const arr = new Uint8Array(length)
  crypto.getRandomValues(arr)
  return base64UrlEncode(arr).slice(0, length)
}

async function sha256(input: string): Promise<ArrayBuffer> {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
}

/** Redirects the browser to lichess to authorize. Call from a button click handler. */
export async function beginLogin(): Promise<void> {
  const verifier = randomString(64)
  const state = randomString(32)
  const challenge = base64UrlEncode(await sha256(verifier))

  sessionStorage.setItem(PKCE_VERIFIER_KEY, verifier)
  sessionStorage.setItem(PKCE_STATE_KEY, state)

  const url = new URL(AUTH_URL)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', CLIENT_ID)
  url.searchParams.set('redirect_uri', redirectUri())
  url.searchParams.set('scope', SCOPES)
  url.searchParams.set('state', state)
  url.searchParams.set('code_challenge_method', 'S256')
  url.searchParams.set('code_challenge', challenge)

  window.location.assign(url.toString())
}

/**
 * Call once on app load. If the URL contains an OAuth redirect (?code=...&state=...),
 * completes the token exchange, stores the auth, and cleans the URL. No-op otherwise.
 */
export async function completeLoginIfRedirected(): Promise<void> {
  const params = new URLSearchParams(window.location.search)
  const code = params.get('code')
  const state = params.get('state')
  if (!code || !state) return

  const expectedState = sessionStorage.getItem(PKCE_STATE_KEY)
  const verifier = sessionStorage.getItem(PKCE_VERIFIER_KEY)
  sessionStorage.removeItem(PKCE_STATE_KEY)
  sessionStorage.removeItem(PKCE_VERIFIER_KEY)

  // Always strip OAuth params from the URL, even on failure, so a refresh doesn't replay them.
  const cleanUrl = redirectUri()
  window.history.replaceState({}, '', cleanUrl)

  if (!verifier || state !== expectedState) {
    throw new Error('Lichess login failed: state mismatch. Please try again.')
  }

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code,
      code_verifier: verifier,
      redirect_uri: cleanUrl,
      client_id: CLIENT_ID,
    }),
  })
  if (!res.ok) throw new Error(`Lichess token exchange failed: ${res.status}`)
  const data = await res.json()
  const accessToken: string = data.access_token

  const account = await fetchJson('https://lichess.org/api/account', accessToken)
  setLichessAuth({ accessToken, username: account.username })
}

export function logout(): void {
  setLichessAuth(null)
}

export function currentAuth(): LichessAuth | null {
  return getLichessAuth()
}

export interface Study {
  id: string
  name: string
}

/** Lists studies owned by the logged-in user (NDJSON endpoint). */
export async function listStudies(auth: LichessAuth): Promise<Study[]> {
  const res = await fetch(`https://lichess.org/api/study/by/${auth.username}`, {
    headers: { authorization: `Bearer ${auth.accessToken}`, accept: 'application/x-ndjson' },
  })
  if (!res.ok) throw new Error(`Failed to list studies: ${res.status}`)
  const text = await res.text()
  return text
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .map((s) => ({ id: s.id, name: s.name }))
}

/** Imports a PGN as a new chapter in an existing study. */
export async function importPgnToStudy(auth: LichessAuth, studyId: string, pgn: string, chapterName: string): Promise<void> {
  const res = await fetch(`https://lichess.org/api/study/${studyId}/import-pgn`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${auth.accessToken}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ name: chapterName, pgn }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Failed to import PGN to study: ${res.status} ${body.slice(0, 300)}`)
  }
}

async function fetchJson(url: string, token: string): Promise<any> {
  const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error(`Request to ${url} failed: ${res.status}`)
  return res.json()
}
