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
      <p class="subtitle">Đăng nhập để lưu điểm & xếp hạng</p>
      <div class="tabs">
        <button class="tab-btn active" data-tab="login">Đăng nhập</button>
        <button class="tab-btn" data-tab="register">Đăng ký</button>
      </div>
      <div id="tab-login">
        <div class="form-group">
          <label>Nickname</label>
          <input id="login-nick" type="text" placeholder="Nhập nickname..." autocomplete="username" />
        </div>
        <div class="form-group">
          <label>Mật khẩu</label>
          <input id="login-pass" type="password" placeholder="Nhập mật khẩu..." autocomplete="current-password" />
        </div>
        <button class="btn btn-primary" id="login-btn">Đăng nhập</button>
        <div class="msg" id="login-msg"></div>
      </div>
      <div id="tab-register" style="display:none">
        <div class="form-group">
          <label>Nickname</label>
          <input id="reg-nick" type="text" placeholder="Chọn nickname..." autocomplete="username" />
        </div>
        <div class="form-group">
          <label>Mật khẩu</label>
          <input id="reg-pass" type="password" placeholder="Tạo mật khẩu..." autocomplete="new-password" />
        </div>
        <button class="btn btn-primary" id="reg-btn">Tạo tài khoản</button>
        <div class="msg" id="reg-msg"></div>
      </div>
      <button class="btn btn-secondary" id="leaderboard-btn" style="margin-top:16px">🏆 Bảng xếp hạng</button>
    </div>
  `

  // Tab switching
  screen.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      screen.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      const tab = (btn as HTMLElement).dataset.tab!
      ;(screen.querySelector('#tab-login') as HTMLElement).style.display = tab === 'login' ? '' : 'none'
      ;(screen.querySelector('#tab-register') as HTMLElement).style.display = tab === 'register' ? '' : 'none'
    })
  })

  // Login
  const loginBtn = screen.querySelector('#login-btn') as HTMLButtonElement
  const loginMsg = screen.querySelector('#login-msg') as HTMLElement
  loginBtn.addEventListener('click', async () => {
    const nick = (screen.querySelector('#login-nick') as HTMLInputElement).value.trim()
    const pass = (screen.querySelector('#login-pass') as HTMLInputElement).value
    if (!nick || !pass) { setMsg(loginMsg, 'Vui lòng điền đầy đủ', 'error'); return }
    loginBtn.disabled = true
    loginBtn.textContent = 'Đang đăng nhập...'
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: nick, password: pass }),
      })
      const data = await res.json()
      if (!res.ok) { setMsg(loginMsg, data.error, 'error'); return }
      const session: UserSession = { token: data.token, nickname: data.nickname, id: data.id }
      saveSession(session)
      onLogin(session)
    } catch {
      setMsg(loginMsg, 'Lỗi kết nối', 'error')
    } finally {
      loginBtn.disabled = false
      loginBtn.textContent = 'Đăng nhập'
    }
  })

  // Register
  const regBtn = screen.querySelector('#reg-btn') as HTMLButtonElement
  const regMsg = screen.querySelector('#reg-msg') as HTMLElement
  regBtn.addEventListener('click', async () => {
    const nick = (screen.querySelector('#reg-nick') as HTMLInputElement).value.trim()
    const pass = (screen.querySelector('#reg-pass') as HTMLInputElement).value
    if (!nick || !pass) { setMsg(regMsg, 'Vui lòng điền đầy đủ', 'error'); return }
    regBtn.disabled = true
    regBtn.textContent = 'Đang tạo...'
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: nick, password: pass }),
      })
      const data = await res.json()
      if (!res.ok) { setMsg(regMsg, data.error, 'error'); return }
      const session: UserSession = { token: data.token, nickname: data.nickname, id: data.id }
      saveSession(session)
      setMsg(regMsg, 'Tạo tài khoản thành công!', 'success')
      setTimeout(() => onLogin(session), 800)
    } catch {
      setMsg(regMsg, 'Lỗi kết nối', 'error')
    } finally {
      regBtn.disabled = false
      regBtn.textContent = 'Tạo tài khoản'
    }
  })

  // Enter key support
  screen.querySelectorAll('input').forEach(input => {
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const isLogin = (screen.querySelector('#tab-login') as HTMLElement).style.display !== 'none'
        if (isLogin) loginBtn.click()
        else regBtn.click()
      }
    })
  })

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
