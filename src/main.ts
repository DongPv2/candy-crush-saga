/**
 * main.ts — Entry point cho Candy Crush Saga
 * Task 13: Kết nối toàn bộ hệ thống
 *
 * Requirements: 1.1, 8.10, 11.1, 12.1
 */

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

// --------------- Canvas Setup ---------------

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null
const noCanvasEl = document.getElementById('no-canvas') as HTMLDivElement | null

if (!canvas || !canvas.getContext || !canvas.getContext('2d')) {
  if (noCanvasEl) noCanvasEl.style.display = 'block'
  throw new Error('HTML5 Canvas không được hỗ trợ trên trình duyệt này.')
}

// --------------- Khởi tạo các module ---------------

const ROWS = 9
const COLS = 9

// Core engines
const gameBoard = new GameBoard()
const matchEngine = new MatchEngine()
const shuffleEngine = new ShuffleEngine(matchEngine, gameBoard)
const scoreManager = new ScoreManager()

// Visual / rendering
const particleEngine = new ParticleEngine()
const visualDesigner = new VisualDesigner()
const animationManager = new AnimationManager(particleEngine)
const renderer = new Renderer(canvas, visualDesigner, particleEngine)

// Game manager
const gameManager = new GameManager(gameBoard, matchEngine, shuffleEngine, scoreManager, ROWS, COLS)

// --------------- Khởi tạo board ---------------

gameBoard.initBoard(ROWS, COLS)

// --------------- Inject dependencies vào GameManager ---------------

gameManager.setAnimationManager(animationManager)
gameManager.setRenderer(renderer)

// --------------- Kết nối combo text callback ---------------

animationManager.setComboTextCallback((text: string, opacity: number) => {
  renderer.setComboText(text, opacity)
})

// --------------- Resize canvas ban đầu ---------------

renderer.resize(window.innerWidth, window.innerHeight)
animationManager.setTileSize(renderer.getTileSize())

// --------------- Khởi tạo InputHandler ---------------

const { offsetX: initOffsetX, offsetY: initOffsetY } = renderer.getGridOffset()
const inputHandler = new InputHandler(canvas, gameManager, renderer.getTileSize(), initOffsetX, initOffsetY)

// --------------- Xử lý window resize ---------------

window.addEventListener('resize', () => {
  renderer.resize(window.innerWidth, window.innerHeight)
  animationManager.setTileSize(renderer.getTileSize())
  const { offsetX, offsetY } = renderer.getGridOffset()
  inputHandler.updateLayout(renderer.getTileSize(), offsetX, offsetY)
})

// --------------- Khởi động idle animations ---------------

const allCandies = gameBoard.getGrid().flat().filter((c) => c !== null)
animationManager.startIdleAnimations(allCandies)

// --------------- Game Loop ---------------

let lastTime = 0

function gameLoop(timestamp: number): void {
  const deltaTime = timestamp - lastTime
  lastTime = timestamp

  gameManager.update(deltaTime)
  particleEngine.updateParticles(deltaTime)
  renderer.render(gameManager.getState())

  requestAnimationFrame(gameLoop)
}

requestAnimationFrame(gameLoop)

// Export canvas để các module khác có thể dùng
export { canvas }
