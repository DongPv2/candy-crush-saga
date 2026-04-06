import './ui.css'
import { GameBoard } from './GameBoard.ts'
import { MatchEngine } from './MatchEngine.ts'
import { ShuffleEngine } from './ShuffleEngine.ts'
import { ScoreManager } from './ScoreManager.ts'
import { ParticleEngine } from './ParticleEngine.ts'
import { VisualDesigner } from './VisualDesigner.ts'
import { AnimationManager } from './AnimationManager.ts'
import { Renderer } from './Renderer.ts'
import { InputHandler } from './InputHandler.ts'
import { GameManager } from './GameManager.ts'
import { loadSession, submitScore, fetchMyBestScore, type UserSession } from './session.ts'
import { createAuthScreen, createLeaderboardScreen, createGameHud } from './screens.ts'
import { Sound } from './sound.ts'
import { findHintMove } from './hint.ts'

// ── Canvas ────────────────────────────────────────────────────

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement
const noCanvasEl = document.getElementById('no-canvas') as HTMLDivElement

if (!canvas?.getContext?.('2d')) {
  if (noCanvasEl) noCanvasEl.style.display = 'block'
  throw new Error('Canvas không được hỗ trợ')
}

// ── Game setup ────────────────────────────────────────────────

const ROWS = 9, COLS = 9
const gameBoard = new GameBoard()
const matchEngine = new MatchEngine()
const shuffleEngine = new ShuffleEngine(matchEngine, gameBoard)
const scoreManager = new ScoreManager()
const particleEngine = new ParticleEngine()
const visualDesigner = new VisualDesigner()
const animationManager = new AnimationManager(particleEngine)
const renderer = new Renderer(canvas, visualDesigner, particleEngine)
const gameManager = new GameManager(gameBoard, matchEngine, shuffleEngine, scoreManager, ROWS, COLS)

gameManager.setAnimationManager(animationManager)
gameManager.setRenderer(renderer)
gameManager.setSound(Sound)
animationManager.setComboTextCallback((text, opacity) => renderer.setComboText(text, opacity))

let inputHandler: InputHandler | null = null
let gameLoopId: number | null = null
let lastTime = 0
let currentSession: UserSession | null = null
let lastSubmittedScore = 0

// ── Timer & Hint ──────────────────────────────────────────────

const GAME_DURATION_MS = 2 * 60 * 1000
let timeRemaining = GAME_DURATION_MS
let gameOver = false
let idleTime = 0           // ms người chơi không tương tác
const HINT_DELAY_MS = 5000 // hiện hint sau 5s đứng yên

// ── Game loop ─────────────────────────────────────────────────

function startGameLoop() {
  if (gameLoopId !== null) return
  lastTime = 0

  function loop(ts: number) {
    const dt = lastTime ? ts - lastTime : 0
    lastTime = ts

    if (!gameOver) {
      timeRemaining = Math.max(0, timeRemaining - dt)
      if (timeRemaining <= 0 && !gameOver) {
        gameOver = true
        handleGameOver()
        return
      }

      // Hint: đếm idle time
      idleTime += dt
      if (idleTime >= HINT_DELAY_MS) {
        const hint = findHintMove(gameBoard.getGrid(), 9, 9, matchEngine)
        renderer.setHint(hint?.pos1 ?? null, hint?.pos2 ?? null)
      } else {
        renderer.setHint(null, null)
      }
    }

    gameManager.update(dt)
    particleEngine.updateParticles(dt)
    renderer.render(gameManager.getState(), timeRemaining, dt)

    // Submit score + kiểm tra kỷ lục
    const score = scoreManager.getScore()
    if (currentSession && score > lastSubmittedScore && score > 0) {
      lastSubmittedScore = score
      submitScore(score, currentSession.token)

      // Phá kỷ lục cá nhân
      if (score > scoreManager.getHighScore()) {
        renderer.showNewRecord()
        Sound.newRecord()
      }
    }

    gameLoopId = requestAnimationFrame(loop)
  }
  gameLoopId = requestAnimationFrame(loop)
}

/** Reset idle timer khi người chơi tương tác */
function resetIdle() {
  idleTime = 0
  renderer.setHint(null, null)
}

function handleGameOver() {
  stopGameLoop()
  if (inputHandler) { inputHandler.destroy(); inputHandler = null }
  Sound.gameOver()

  const score = scoreManager.getScore()
  if (currentSession && score > 0) {
    submitScore(score, currentSession.token)
  }

  showGameOver(score)
}

function stopGameLoop() {
  if (gameLoopId !== null) { cancelAnimationFrame(gameLoopId); gameLoopId = null }
}

// ── Screen management ─────────────────────────────────────────

let hudEl: HTMLElement | null = null

function showGame(session: UserSession) {
  currentSession = session
  lastSubmittedScore = 0
  timeRemaining = GAME_DURATION_MS
  gameOver = false

  // Remove existing screens
  document.querySelectorAll('.screen').forEach(s => s.remove())
  if (hudEl) hudEl.remove()

  // Init board
  gameBoard.initBoard(ROWS, COLS)
  scoreManager.reset()

  // Fetch điểm cao nhất từ server — hiển thị 0 trước, cập nhật khi có
  fetchMyBestScore(session.token).then(best => {
    scoreManager.setHighScore(best)
  }).catch(() => { /* silent fail */ })

  renderer.resize(window.innerWidth, window.innerHeight)
  animationManager.setTileSize(renderer.getTileSize())

  const { offsetX, offsetY } = renderer.getGridOffset()
  if (inputHandler) inputHandler.destroy()
  inputHandler = new InputHandler(canvas, gameManager, renderer.getTileSize(), offsetX, offsetY)
  // Reset idle khi người chơi tương tác
  canvas.addEventListener('mousedown', resetIdle, { passive: true })
  canvas.addEventListener('touchstart', resetIdle, { passive: true })

  const allCandies = gameBoard.getGrid().flat().filter((c): c is NonNullable<typeof c> => c !== null)
  animationManager.startIdleAnimations(allCandies)

  // HUD
  hudEl = createGameHud(
    session.nickname,
    () => showLeaderboard(session),
  )
  document.body.appendChild(hudEl)

  startGameLoop()
}

function showAuth() {
  stopGameLoop()
  if (hudEl) { hudEl.remove(); hudEl = null }
  document.querySelectorAll('.screen').forEach(s => s.remove())

  const authScreen = createAuthScreen((session) => {
    authScreen.remove()
    showGame(session)
  })

  // Leaderboard button on auth screen
  authScreen.querySelector('#leaderboard-btn')?.addEventListener('click', () => {
    authScreen.classList.add('hidden')
    const lb = createLeaderboardScreen(null, () => {
      lb.remove()
      authScreen.classList.remove('hidden')
    })
    document.body.appendChild(lb)
  })

  document.body.appendChild(authScreen)
}

function showLeaderboard(session: UserSession) {
  stopGameLoop()
  const lb = createLeaderboardScreen(session.nickname, () => {
    lb.remove()
    showGame(session)
  })
  document.body.appendChild(lb)
}

function showGameOver(score: number) {
  if (hudEl) { hudEl.remove(); hudEl = null }
  document.querySelectorAll('.screen').forEach(s => s.remove())

  const prevBest = scoreManager.getHighScore()
  const isNewRecord = score > prevBest && score > 0
  if (isNewRecord) scoreManager.setHighScore(score)

  const screen = document.createElement('div')
  screen.className = 'screen'
  screen.innerHTML = `
    <div class="card" style="text-align:center">
      <div style="font-size:3rem;margin-bottom:8px">${isNewRecord ? '🏆' : '⏰'}</div>
      <h1>${isNewRecord ? 'Kỷ lục mới!' : 'Hết giờ!'}</h1>
      <p class="subtitle">Thời gian 2 phút đã kết thúc</p>
      <div style="margin:20px 0;padding:16px;background:rgba(255,215,0,0.1);border-radius:12px;border:1px solid rgba(255,215,0,0.3)">
        <div style="font-size:0.85rem;color:rgba(255,255,255,0.5);margin-bottom:4px">ĐIỂM CỦA BẠN</div>
        <div style="font-size:2.5rem;font-weight:700;color:#FFD700">${score.toLocaleString()}</div>
        ${isNewRecord ? '<div style="font-size:0.8rem;color:#86efac;margin-top:4px">🎉 Phá kỷ lục cá nhân!</div>' : ''}
      </div>
      <button class="btn btn-primary" id="go-play-again">🎮 Chơi lại</button>
      <button class="btn btn-secondary" id="go-leaderboard" style="margin-top:8px">🏆 Bảng xếp hạng</button>
    </div>
  `

  screen.querySelector('#go-play-again')!.addEventListener('click', () => {
    screen.remove()
    if (currentSession) showGame(currentSession)
    else showAuth()
  })

  screen.querySelector('#go-leaderboard')!.addEventListener('click', () => {
    screen.remove()
    if (currentSession) showLeaderboard(currentSession)
    else showAuth()
  })

  document.body.appendChild(screen)
}

// ── Resize ────────────────────────────────────────────────────

window.addEventListener('resize', () => {
  renderer.resize(window.innerWidth, window.innerHeight)
  animationManager.setTileSize(renderer.getTileSize())
  if (inputHandler) {
    const { offsetX, offsetY } = renderer.getGridOffset()
    inputHandler.updateLayout(renderer.getTileSize(), offsetX, offsetY)
  }
})

// ── Boot ──────────────────────────────────────────────────────

const session = loadSession()
if (session) {
  showGame(session)
} else {
  showAuth()
}

// ── Auto-save khi tắt tab / chuyển app ───────────────────────

function saveCurrentScore() {
  if (!currentSession) return
  const score = scoreManager.getScore()
  if (score <= 0) return
  // dùng sendBeacon để đảm bảo request được gửi dù tab đang đóng
  const payload = JSON.stringify({ score })
  const blob = new Blob([payload], { type: 'application/json' })
  navigator.sendBeacon(
    `/api/scores/submit?token=${encodeURIComponent(currentSession.token)}`,
    blob,
  )
}

window.addEventListener('beforeunload', saveCurrentScore)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') saveCurrentScore()
})
