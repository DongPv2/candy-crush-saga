import { saveSession, clearSession, fetchLeaderboard, type UserSession, type LeaderboardEntry } from './session.ts'

// ── DOM helpers ──────────────────────────────────────────────

function show(el: HTMLElement) { el.classList.remove('hidden') }
function hide(el: HTMLElement) { el.classList.add('hidden') }
function setMsg(el: HTMLElement, text: string, type: 'error' | 'success' | '') {
  el.textContent = text
  el.className = `msg${type ? ' ' + type : ''}`
}

// ── Auth Screen ───────────────────────────────────────────────

export function createAuthScreen(onLogin: (session: UserSession) => void): HTMLElement {
  const screen = document.createElement('div')
  screen.className = 'screen'
  screen.id = 'auth-screen'

  screen.innerHTML = `
    <div class="card">
      <h1>🍬 Candy Crush</h1>
      <p class="subtitle">Nhập nickname để bắt đầu chơi</p>
      <div class="form-group">
        <label>Nickname của bạn</label>
        <input id="join-nick" type="text" placeholder="Nhập nickname..." autocomplete="username" maxlength="32" />
      </div>
      <button class="btn btn-primary" id="join-btn">Vào chơi 🎮</button>
      <div class="msg" id="join-msg"></div>
      <button class="btn btn-secondary" id="leaderboard-btn" style="margin-top:12px">🏆 Bảng xếp hạng</button>
    </div>
  `

  const joinBtn = screen.querySelector('#join-btn') as HTMLButtonElement
  const joinMsg = screen.querySelector('#join-msg') as HTMLElement
  const nickInput = screen.querySelector('#join-nick') as HTMLInputElement

  const doJoin = async () => {
    const nick = nickInput.value.trim()
    if (!nick) { setMsg(joinMsg, 'Vui lòng nhập nickname', 'error'); return }
    if (nick.length < 2) { setMsg(joinMsg, 'Nickname phải ít nhất 2 ký tự', 'error'); return }

    joinBtn.disabled = true
    joinBtn.textContent = 'Đang vào...'
    try {
      const res = await fetch('/api/auth/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: nick }),
      })
      const data = await res.json()
      if (!res.ok) { setMsg(joinMsg, data.error, 'error'); return }
      const session: UserSession = { token: data.token, nickname: data.nickname, id: data.id }
      saveSession(session)
      onLogin(session)
    } catch {
      setMsg(joinMsg, 'Lỗi kết nối', 'error')
    } finally {
      joinBtn.disabled = false
      joinBtn.textContent = 'Vào chơi 🎮'
    }
  }

  joinBtn.addEventListener('click', doJoin)
  nickInput.addEventListener('keydown', e => { if (e.key === 'Enter') doJoin() })

  // Focus input ngay khi hiện
  setTimeout(() => nickInput.focus(), 100)

  return screen
}

// ── Leaderboard Screen ────────────────────────────────────────

export function createLeaderboardScreen(
  currentNickname: string | null,
  onBack: () => void,
): HTMLElement {
  const screen = document.createElement('div')
  screen.className = 'screen'
  screen.id = 'leaderboard-screen'

  screen.innerHTML = `
    <div class="card" style="max-width:420px;width:100%">
      <h1>🏆 Bảng Xếp Hạng</h1>
      <p class="subtitle" id="lb-subtitle">Đang tải...</p>
      <ul class="leaderboard-list" id="lb-list"></ul>
      <button class="btn btn-secondary" id="lb-back-btn" style="margin-top:16px">← Quay lại</button>
    </div>
  `

  screen.querySelector('#lb-back-btn')!.addEventListener('click', onBack)

  // Load data
  fetchLeaderboard().then(entries => {
    const subtitle = screen.querySelector('#lb-subtitle') as HTMLElement
    const list = screen.querySelector('#lb-list') as HTMLElement

    if (entries.length === 0) {
      subtitle.textContent = 'Chưa có dữ liệu'
      return
    }

    subtitle.textContent = `Top ${Math.min(entries.length, 50)} người chơi`
    list.innerHTML = entries.map((e: LeaderboardEntry, i: number) => {
      const rankClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : ''
      const rankIcon = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`
      const isMe = e.nickname === currentNickname
      return `
        <li class="${isMe ? 'me' : ''}">
          <span class="rank ${rankClass}">${rankIcon}</span>
          <span class="lb-name">${e.nickname}${isMe ? ' (bạn)' : ''}</span>
          <span class="lb-score">${e.best_score.toLocaleString()}</span>
          <span class="lb-games">${e.games_played} ván</span>
        </li>
      `
    }).join('')
  }).catch(() => {
    const subtitle = screen.querySelector('#lb-subtitle') as HTMLElement
    subtitle.textContent = 'Không thể tải dữ liệu'
  })

  return screen
}

// ── Game HUD ──────────────────────────────────────────────────

export function createGameHud(
  nickname: string,
  onLeaderboard: () => void,
  onLogout: () => void,
): HTMLElement {
  const hud = document.createElement('div')
  hud.id = 'game-hud'
  hud.innerHTML = `
    <button class="hud-btn" id="hud-lb">🏆</button>
    <span class="hud-nickname">👤 ${nickname}</span>
    <button class="hud-btn" id="hud-logout">Đăng xuất</button>
  `
  hud.querySelector('#hud-lb')!.addEventListener('click', onLeaderboard)
  hud.querySelector('#hud-logout')!.addEventListener('click', () => {
    if (confirm('Đăng xuất?')) { clearSession(); onLogout() }
  })
  return hud
}
