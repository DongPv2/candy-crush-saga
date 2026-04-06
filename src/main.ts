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
import { loadSession, submitScore, type UserSession } from './session.ts'
import { createAuthScreen, createLeaderboardScreen, createGameHud } from './screens.ts'

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
animationManager.setComboTextCallback((text, opacity) => renderer.setComboText(text, opacity))

let inputHandler: InputHandler | null = null
let gameLoopId: number | null = null
let lastTime = 0
let currentSession: UserSession | null = null
let lastSubmittedScore = 0

// ── Game loop ─────────────────────────────────────────────────

function startGameLoop() {
  if (gameLoopId !== null) return
  lastTime = 0

  function loop(ts: number) {
    const dt = lastTime ? ts - lastTime : 0
    lastTime = ts
    gameManager.update(dt)
    particleEngine.updateParticles(dt)
    renderer.render(gameManager.getState())

    // Submit score khi có điểm mới
    const score = scoreManager.getScore()
    if (currentSession && score > lastSubmittedScore && score > 0) {
      lastSubmittedScore = score
      submitScore(score, currentSession.token)
    }

    gameLoopId = requestAnimationFrame(loop)
  }
  gameLoopId = requestAnimationFrame(loop)
}

function stopGameLoop() {
  if (gameLoopId !== null) { cancelAnimationFrame(gameLoopId); gameLoopId = null }
}

// ── Screen management ─────────────────────────────────────────

let hudEl: HTMLElement | null = null

function showGame(session: UserSession) {
  currentSession = session
  lastSubmittedScore = 0

  // Remove existing screens
  document.querySelectorAll('.screen').forEach(s => s.remove())
  if (hudEl) hudEl.remove()

  // Init board
  gameBoard.initBoard(ROWS, COLS)
  scoreManager.reset()

  renderer.resize(window.innerWidth, window.innerHeight)
  animationManager.setTileSize(renderer.getTileSize())

  const { offsetX, offsetY } = renderer.getGridOffset()
  if (inputHandler) inputHandler.destroy()
  inputHandler = new InputHandler(canvas, gameManager, renderer.getTileSize(), offsetX, offsetY)

  const allCandies = gameBoard.getGrid().flat().filter(c => c !== null)
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
