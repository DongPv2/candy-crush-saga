import {
  type Grid,
  type Candy,
  type Position,
  type Match,
  type GameState,
  type CascadeResult,
  type SwapResult,
  type FallInfo,
  GameStatus,
} from './types.ts'
import { GameBoard } from './GameBoard.ts'
import { MatchEngine } from './MatchEngine.ts'
import { ShuffleEngine } from './ShuffleEngine.ts'
import { ScoreManager } from './ScoreManager.ts'

// ============================================================
// GameManager — Điều phối vòng lặp game và State Machine
// ============================================================

/** Optional interfaces for AnimationManager and Renderer (injected at Task 13) */
export interface IAnimationManager {
  queueSwapAnimation(pos1: Position, pos2: Position, candy1?: Candy, candy2?: Candy): Promise<void>
  queueMatchAnimation(matches: Match[]): Promise<void>
  queueFallAnimation(fallInfos: FallInfo[], tileSize?: number): Promise<void>
  queueShuffleAnimation(): Promise<void>
  queueInvalidSwapAnimation(pos1: Position, pos2: Position, candy1?: Candy, candy2?: Candy): Promise<void>
  playComboAnimation(combo: number): Promise<void>
  isAnimating(): boolean
  update(deltaTime: number): void
}

export interface ISoundEngine {
  swap(): void
  invalidSwap(): void
  match(count: number): void
  fall(): void
  combo(level: number): void
  shuffle(): void
}

export interface IRenderer {
  render(state: GameState, timeRemaining?: number, deltaTime?: number): void
}

export class GameManager {
  private status: GameStatus = GameStatus.IDLE
  private isAnimating: boolean = false

  private animationManager: IAnimationManager | null = null
  private renderer: IRenderer | null = null
  private sound: ISoundEngine | null = null

  private readonly rows: number
  private readonly cols: number

  constructor(
    private readonly gameBoard: GameBoard,
    private readonly matchEngine: MatchEngine,
    private readonly shuffleEngine: ShuffleEngine,
    private readonly scoreManager: ScoreManager,
    rows: number = 9,
    cols: number = 9,
  ) {
    this.rows = rows
    this.cols = cols
  }

  // ----------------------------------------------------------
  // Dependency injection for optional managers (Task 13)
  // ----------------------------------------------------------

  setAnimationManager(am: IAnimationManager): void {
    this.animationManager = am
  }

  setRenderer(renderer: IRenderer): void {
    this.renderer = renderer
  }

  setSound(sound: ISoundEngine): void {
    this.sound = sound
  }

  // ----------------------------------------------------------
  // State Machine
  // ----------------------------------------------------------

  /** Trả về GameState hiện tại */
  getState(): GameState {
    return {
      status: this.status,
      board: {
        grid: this.gameBoard.getGrid(),
        rows: this.rows,
        cols: this.cols,
      },
      score: this.scoreManager.getScore(),
      highScore: this.scoreManager.getHighScore(),
      comboCount: 0,
    }
  }

  private setState(status: GameStatus): void {
    this.status = status
  }

  // ----------------------------------------------------------
  // §2.6 — isAdjacent
  // ----------------------------------------------------------

  /**
   * Kiểm tra hai ô có liền kề trực tiếp (không chéo).
   * Property 6: |row1-row2| + |col1-col2| = 1
   */
  isAdjacent(pos1: Position, pos2: Position): boolean {
    const dr = Math.abs(pos1.row - pos2.row)
    const dc = Math.abs(pos1.col - pos2.col)
    return dr + dc === 1
  }

  // ----------------------------------------------------------
  // §2.6 — checkSwap (chỉ kiểm tra, không cascade)
  // ----------------------------------------------------------

  /**
   * Kiểm tra swap có hợp lệ không (tạo match).
   * Nếu không hợp lệ: hoàn tác và trả về null.
   * Nếu hợp lệ: giữ nguyên swap trên board, trả về matches tìm được.
   */
  private checkSwap(pos1: Position, pos2: Position): Match[] | null {
    if (!this.isAdjacent(pos1, pos2)) return null

    this.gameBoard.swapCandies(pos1, pos2)
    const grid = this.gameBoard.getGrid()
    const matches = this.matchEngine.findAllMatches(grid, this.rows, this.cols)

    if (matches.length === 0) {
      this.gameBoard.swapCandies(pos1, pos2) // hoàn tác
      return null
    }

    return matches
  }

  /**
   * Xử lý một vòng cascade: xóa matches, gravity, refill.
   * Trả về fall infos và matches mới (nếu có cascade tiếp).
   */
  private processCascadeStep(matches: Match[]): {
    fallInfos: FallInfo[]
    nextMatches: Match[]
    roundScore: number
    comboCount: number
  } {
    const grid = this.gameBoard.getGrid()

    // Tính điểm
    const comboCount = 1 // caller tự track
    const roundScore = this.scoreManager.calculateScore(matches, comboCount)
    this.scoreManager.addScore(roundScore)

    // Xóa match + đặt kẹo đặc biệt
    this.matchEngine.removeMatches(grid, matches)
    for (const match of matches) {
      if (match.specialCreated) {
        this.matchEngine.placeSpecialCandy(grid, match)
      }
    }

    // Gravity + refill → thu thập fall infos
    const gravityFalls = this.gameBoard.applyGravity()
    const refillFalls = this.gameBoard.refill()
    const fallInfos = [...gravityFalls, ...refillFalls]

    // Kiểm tra cascade tiếp
    const nextMatches = this.matchEngine.findAllMatches(grid, this.rows, this.cols)

    return { fallInfos, nextMatches, roundScore, comboCount }
  }

  // ----------------------------------------------------------
  // Entry point từ InputHandler
  // ----------------------------------------------------------

  /**
   * Entry point từ InputHandler.
   * Xen kẽ logic game và animation từng bước để mượt mà.
   */
  async onSwap(pos1: Position, pos2: Position): Promise<void> {
    if (this.isAnimating || this.status !== GameStatus.IDLE) return

    this.isAnimating = true
    this.setState(GameStatus.SWAPPING)

    try {
      // Lấy candy references TRƯỚC khi swap (để animation biết vị trí gốc)
      const candy1 = this.gameBoard.getCandy(pos1)
      const candy2 = this.gameBoard.getCandy(pos2)

      // Bước 1: Kiểm tra swap
      const initialMatches = this.checkSwap(pos1, pos2)

      if (initialMatches === null) {
        // Swap không hợp lệ — animation rung lắc
        if (this.animationManager) {
          await this.animationManager.queueInvalidSwapAnimation(pos1, pos2, candy1 ?? undefined, candy2 ?? undefined)
        }
        this.sound?.invalidSwap()
        return
      }

      // Bước 2: Animation swap
      this.sound?.swap()
      if (this.animationManager) {
        await this.animationManager.queueSwapAnimation(pos1, pos2, candy1 ?? undefined, candy2 ?? undefined)
      }

      // Bước 3: Cascade loop — mỗi vòng: match animation → xóa → fall animation
      let currentMatches = initialMatches
      let combo = 0

      while (currentMatches.length > 0) {
        combo++
        this.setState(GameStatus.MATCHING)

        if (this.animationManager) {
          await this.animationManager.queueMatchAnimation(currentMatches)
        }
        this.sound?.match(currentMatches.flatMap(m => m.candies).length)

        const { fallInfos, nextMatches, roundScore } = this.processCascadeStep(currentMatches)
        if (combo > 1) {
          this.scoreManager.addScore(roundScore * (combo - 1))
        }

        this.setState(GameStatus.REFILLING)

        if (this.animationManager && fallInfos.length > 0) {
          await this.animationManager.queueFallAnimation(fallInfos)
          this.sound?.fall()
        }

        currentMatches = nextMatches
      }

      // Hiển thị combo text 1 lần duy nhất sau khi cascade kết thúc, chỉ khi combo ≥ 3
      if (combo >= 3 && this.animationManager) {
        void this.animationManager.playComboAnimation(combo)
        this.sound?.combo(combo)
      }

      // Bước 4: Kiểm tra shuffle
      this.setState(GameStatus.CHECKING)
      const grid = this.gameBoard.getGrid()
      if (!this.shuffleEngine.hasValidMoves(grid, this.rows, this.cols)) {
        this.setState(GameStatus.SHUFFLING)
        this.shuffleEngine.shuffleBoard(grid, this.rows, this.cols)
        this.sound?.shuffle()
        if (this.animationManager) {
          await this.animationManager.queueShuffleAnimation()
        }
      }

    } finally {
      this.setState(GameStatus.IDLE)
      this.isAnimating = false
    }
  }

  // ----------------------------------------------------------
  // Game loop hooks (placeholder — AnimationManager & Renderer injected at Task 13)
  // ----------------------------------------------------------

  /** Cập nhật animation state. Placeholder cho AnimationManager. */
  update(deltaTime: number): void {
    if (this.animationManager) {
      this.animationManager.update(deltaTime)
    }
  }

  /** Vẽ toàn bộ game lên canvas. Placeholder cho Renderer. */
  render(ctx: CanvasRenderingContext2D): void {
    if (this.renderer) {
      this.renderer.render(this.getState())
    }
    // ctx is available for direct drawing if needed before Renderer is injected
    void ctx
  }
}
