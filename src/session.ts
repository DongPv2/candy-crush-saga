const TOKEN_KEY = 'candy_token'
const USER_KEY = 'candy_user'

export interface UserSession {
  id: number
  nickname: string
  token: string
}

export function saveSession(session: UserSession): void {
  localStorage.setItem(TOKEN_KEY, session.token)
  localStorage.setItem(USER_KEY, JSON.stringify({ id: session.id, nickname: session.nickname }))
}

export function loadSession(): UserSession | null {
  const token = localStorage.getItem(TOKEN_KEY)
  const raw = localStorage.getItem(USER_KEY)
  if (!token || !raw) return null
  try {
    const user = JSON.parse(raw)
    return { token, ...user }
  } catch {
    return null
  }
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

export async function submitScore(score: number, token: string): Promise<void> {
  try {
    await fetch('/api/scores/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ score }),
    })
  } catch {
    // silent fail — score submission is best-effort
  }
}

export async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  const res = await fetch('/api/scores/leaderboard')
  if (!res.ok) return []
  const data = await res.json()
  return data.leaderboard ?? []
}

export interface LeaderboardEntry {
  nickname: string
  best_score: number
  games_played: number
}
