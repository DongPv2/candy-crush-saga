import { type Position, Direction } from './types.ts'
import { type GameManager } from './GameManager.ts'

// ============================================================
// InputHandler — §2.10 Touch & Mouse Input
// ============================================================

/**
 * Chuyển đổi tọa độ pixel (clientX, clientY) → ô lưới (row, col).
 * Property 5: Với mọi (x, y) hợp lệ trong canvas, trả về (row, col) ∈ [0, ROWS) × [0, COLS).
 */
export function getTilePosition(
  clientX: number,
  clientY: number,
  canvas: HTMLCanvasElement,
  tileSize: number,
): Position {
  const rect = canvas.getBoundingClientRect()
  const x = clientX - rect.left
  const y = clientY - rect.top
  return {
    row: Math.floor(y / tileSize),
    col: Math.floor(x / tileSize),
  }
}

/**
 * Xác định hướng kéo từ start → end (4 hướng, không chéo).
 * Trả về null nếu không đủ ngưỡng kéo (< 10px).
 */
export function getSwapDirection(
  start: Position & { x?: number; y?: number },
  end: { x: number; y: number },
): Direction | null {
  // Nếu start có tọa độ pixel thì dùng, ngược lại không xác định được hướng
  const sx = (start as { x?: number }).x
  const sy = (start as { x?: number; y?: number }).y
  if (sx === undefined || sy === undefined) return null

  const dx = end.x - sx
  const dy = end.y - sy
  const absDx = Math.abs(dx)
  const absDy = Math.abs(dy)

  // Ngưỡng tối thiểu để tránh tap nhầm thành swipe
  if (absDx < 10 && absDy < 10) return null

  if (absDx >= absDy) {
    return dx > 0 ? Direction.RIGHT : Direction.LEFT
  } else {
    return dy > 0 ? Direction.DOWN : Direction.UP
  }
}

/** Áp dụng hướng lên một vị trí để lấy ô đích */
function applyDirection(pos: Position, dir: Direction): Position {
  switch (dir) {
    case Direction.UP:    return { row: pos.row - 1, col: pos.col }
    case Direction.DOWN:  return { row: pos.row + 1, col: pos.col }
    case Direction.LEFT:  return { row: pos.row, col: pos.col - 1 }
    case Direction.RIGHT: return { row: pos.row, col: pos.col + 1 }
  }
}

// ============================================================
// InputHandler class
// ============================================================

export class InputHandler {
  private touchStartPos: (Position & { x: number; y: number }) | null = null
  private mouseStartPos: (Position & { x: number; y: number }) | null = null
  private isMouseDown = false

  // Bound handlers (lưu để có thể removeEventListener)
  private readonly onTouchStart: (e: TouchEvent) => void
  private readonly onTouchEnd: (e: TouchEvent) => void
  private readonly onTouchMove: (e: TouchEvent) => void
  private readonly onMouseDown: (e: MouseEvent) => void
  private readonly onMouseUp: (e: MouseEvent) => void
  private readonly onMouseMove: (e: MouseEvent) => void

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly gameManager: GameManager,
    private tileSize: number,
    private gridOffsetX: number = 0,
    private gridOffsetY: number = 0,
  ) {
    // Bind handlers
    this.onTouchStart = this.handleTouchStart.bind(this)
    this.onTouchEnd = this.handleTouchEnd.bind(this)
    this.onTouchMove = this.handleTouchMove.bind(this)
    this.onMouseDown = this.handleMouseDown.bind(this)
    this.onMouseUp = this.handleMouseUp.bind(this)
    this.onMouseMove = this.handleMouseMove.bind(this)

    this.attach()
  }

  /** Cập nhật tileSize và grid offset khi resize */
  updateLayout(tileSize: number, gridOffsetX: number, gridOffsetY: number): void {
    this.tileSize = tileSize
    this.gridOffsetX = gridOffsetX
    this.gridOffsetY = gridOffsetY
  }

  private getTileFromClient(clientX: number, clientY: number): Position {
    const rect = this.canvas.getBoundingClientRect()
    const x = clientX - rect.left - this.gridOffsetX
    const y = clientY - rect.top - this.gridOffsetY
    return {
      row: Math.floor(y / this.tileSize),
      col: Math.floor(x / this.tileSize),
    }
  }

  private isValidTile(pos: Position, rows = 9, cols = 9): boolean {
    return pos.row >= 0 && pos.row < rows && pos.col >= 0 && pos.col < cols
  }



  private attach(): void {
    this.canvas.addEventListener('touchstart', this.onTouchStart, { passive: false })
    this.canvas.addEventListener('touchend', this.onTouchEnd, { passive: false })
    this.canvas.addEventListener('touchmove', this.onTouchMove, { passive: false })

    this.canvas.addEventListener('mousedown', this.onMouseDown)
    this.canvas.addEventListener('mouseup', this.onMouseUp)
    this.canvas.addEventListener('mousemove', this.onMouseMove)
  }

  /** Gỡ bỏ tất cả event listeners */
  destroy(): void {
    this.canvas.removeEventListener('touchstart', this.onTouchStart)
    this.canvas.removeEventListener('touchend', this.onTouchEnd)
    this.canvas.removeEventListener('touchmove', this.onTouchMove)

    this.canvas.removeEventListener('mousedown', this.onMouseDown)
    this.canvas.removeEventListener('mouseup', this.onMouseUp)
    this.canvas.removeEventListener('mousemove', this.onMouseMove)
  }

  // ----------------------------------------------------------
  // Touch handlers
  // ----------------------------------------------------------

  private handleTouchStart(e: TouchEvent): void {
    const touch = e.touches[0]
    if (!touch) return
    const pos = this.getTileFromClient(touch.clientX, touch.clientY)
    this.touchStartPos = { ...pos, x: touch.clientX, y: touch.clientY }
  }

  private handleTouchEnd(e: TouchEvent): void {
    if (!this.touchStartPos) return
    const touch = e.changedTouches[0]
    if (!touch) return

    const direction = getSwapDirection(this.touchStartPos, {
      x: touch.clientX,
      y: touch.clientY,
    })

    if (direction !== null) {
      const pos2 = applyDirection(this.touchStartPos, direction)
      if (this.isValidTile(this.touchStartPos) && this.isValidTile(pos2)) {
        void this.gameManager.onSwap(this.touchStartPos, pos2)
      }
    }

    this.touchStartPos = null
  }

  private handleTouchMove(e: TouchEvent): void {
    // Ngăn cuộn trang khi đang kéo trên canvas
    e.preventDefault()
  }

  // ----------------------------------------------------------
  // Mouse handlers (desktop testing)
  // ----------------------------------------------------------

  private handleMouseDown(e: MouseEvent): void {
    this.isMouseDown = true
    const pos = this.getTileFromClient(e.clientX, e.clientY)
    this.mouseStartPos = { ...pos, x: e.clientX, y: e.clientY }
  }

  private handleMouseUp(e: MouseEvent): void {
    if (!this.isMouseDown || !this.mouseStartPos) return
    this.isMouseDown = false

    const direction = getSwapDirection(this.mouseStartPos, {
      x: e.clientX,
      y: e.clientY,
    })

    if (direction !== null) {
      const pos2 = applyDirection(this.mouseStartPos, direction)
      if (this.isValidTile(this.mouseStartPos) && this.isValidTile(pos2)) {
        void this.gameManager.onSwap(this.mouseStartPos, pos2)
      }
    }

    this.mouseStartPos = null
  }

  private handleMouseMove(_e: MouseEvent): void {
    // Placeholder — có thể dùng để highlight ô đang hover sau này
  }
}

// ----------------------------------------------------------
// Factory helper (§2.10)
// ----------------------------------------------------------

/**
 * Tạo và gắn InputHandler vào canvas.
 * Trả về instance để caller có thể gọi destroy() khi cần.
 */
export function handleTouchInput(
  canvas: HTMLCanvasElement,
  gameManager: GameManager,
  tileSize: number,
): InputHandler {
  return new InputHandler(canvas, gameManager, tileSize)
}
