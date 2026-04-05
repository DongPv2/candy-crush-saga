import {
  type Candy,
  type Grid,
  type Position,
  type FallInfo,
  CandyType,
  SpecialType,
} from './types.ts'

// Bộ đếm id tăng dần toàn cục để đảm bảo id kẹo duy nhất
let _nextId = 1

function createDefaultAnimState() {
  return {
    idlePhase: 0,
    selectScale: 1,
    opacity: 1,
    offsetX: 0,
    offsetY: 0,
    rotation: 0,
    scaleY: 1,
    glowRadius: 0,
    flashOpacity: 0,
  }
}

function createCandy(row: number, col: number, type: CandyType): Candy {
  return {
    id: _nextId++,
    type,
    special: SpecialType.NORMAL,
    row,
    col,
    animState: createDefaultAnimState(),
  }
}

function randomCandyType(): CandyType {
  return Math.floor(Math.random() * 6) as CandyType
}

/** Kiểm tra xem kẹo tại (row, col) có tạo match ngang không */
function wouldMatchHorizontal(grid: Grid, row: number, col: number, type: CandyType): boolean {
  // Kiểm tra 2 ô bên trái
  if (
    col >= 2 &&
    grid[row][col - 1]?.type === type &&
    grid[row][col - 2]?.type === type
  ) {
    return true
  }
  return false
}

/** Kiểm tra xem kẹo tại (row, col) có tạo match dọc không */
function wouldMatchVertical(grid: Grid, row: number, col: number, type: CandyType): boolean {
  // Kiểm tra 2 ô phía trên
  if (
    row >= 2 &&
    grid[row - 1][col]?.type === type &&
    grid[row - 2][col]?.type === type
  ) {
    return true
  }
  return false
}

export class GameBoard {
  private grid: Grid = []
  private rows: number = 0
  private cols: number = 0

  /**
   * Khởi tạo lưới rows×cols, gán kẹo ngẫu nhiên tránh match sẵn.
   * Theo design §2.2: với mỗi ô, chọn ngẫu nhiên type cho đến khi không tạo match ngang/dọc.
   */
  initBoard(rows: number, cols: number): Grid {
    this.rows = rows
    this.cols = cols

    const grid: Grid = Array.from({ length: rows }, () => Array(cols).fill(null))

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        let type: CandyType
        let attempts = 0
        do {
          type = randomCandyType()
          attempts++
          // Tránh vòng lặp vô hạn (không thể xảy ra với 6 màu, nhưng an toàn)
          if (attempts > 100) break
        } while (
          wouldMatchHorizontal(grid, row, col, type) ||
          wouldMatchVertical(grid, row, col, type)
        )
        grid[row][col] = createCandy(row, col, type)
      }
    }

    this.grid = grid
    return grid
  }

  /** Lấy kẹo tại vị trí pos, trả về null nếu ngoài biên hoặc ô trống */
  getCandy(pos: Position): Candy | null {
    const { row, col } = pos
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return null
    return this.grid[row][col]
  }

  /** Gán kẹo (hoặc null) tại vị trí pos */
  setCandy(pos: Position, candy: Candy | null): void {
    const { row, col } = pos
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return
    this.grid[row][col] = candy
    if (candy) {
      candy.row = row
      candy.col = col
    }
  }

  /**
   * Hoán đổi hai kẹo trên lưới, trả về grid mới (shallow copy).
   * Không kiểm tra tính hợp lệ — đó là trách nhiệm của MatchEngine/GameManager.
   */
  swapCandies(pos1: Position, pos2: Position): Grid {
    const c1 = this.grid[pos1.row][pos1.col]
    const c2 = this.grid[pos2.row][pos2.col]

    this.grid[pos1.row][pos1.col] = c2
    this.grid[pos2.row][pos2.col] = c1

    if (c1) { c1.row = pos2.row; c1.col = pos2.col }
    if (c2) { c2.row = pos1.row; c2.col = pos1.col }

    return this.grid
  }

  /**
   * Áp dụng gravity: kẹo rơi xuống theo từng cột, null nằm trên cùng.
   * Trả về danh sách FallInfo để AnimationManager biết kẹo nào rơi từ đâu.
   */
  applyGravity(): FallInfo[] {
    const fallInfos: FallInfo[] = []

    for (let col = 0; col < this.cols; col++) {
      // Thu thập các kẹo không null từ dưới lên, ghi nhớ row gốc
      const remaining: Array<{ candy: Candy; originalRow: number }> = []
      for (let row = this.rows - 1; row >= 0; row--) {
        const candy = this.grid[row][col]
        if (candy !== null) {
          remaining.push({ candy, originalRow: row })
        }
      }

      // Đặt kẹo từ dưới lên
      for (let i = 0; i < remaining.length; i++) {
        const targetRow = this.rows - 1 - i
        const { candy, originalRow } = remaining[i]
        if (originalRow !== targetRow) {
          fallInfos.push({ candy, fromRow: originalRow, toRow: targetRow })
        }
        candy.row = targetRow
        this.grid[targetRow][col] = candy
      }

      // Lấp đầy phần trên bằng null
      const emptyCount = this.rows - remaining.length
      for (let row = 0; row < emptyCount; row++) {
        this.grid[row][col] = null
      }
    }

    return fallInfos
  }

  /**
   * Lấp đầy tất cả ô null bằng kẹo ngẫu nhiên mới.
   * Trả về FallInfo với fromRow âm (spawn từ trên màn hình).
   */
  refill(): FallInfo[] {
    const fallInfos: FallInfo[] = []

    for (let col = 0; col < this.cols; col++) {
      // Đếm số ô null từ trên xuống (chúng liên tiếp sau gravity)
      let spawnOffset = 0
      for (let row = 0; row < this.rows; row++) {
        if (this.grid[row][col] === null) {
          const candy = createCandy(row, col, randomCandyType())
          this.grid[row][col] = candy
          // fromRow âm: kẹo spawn từ trên màn hình, cách row hiện tại (spawnOffset+1) tile
          fallInfos.push({ candy, fromRow: row - (spawnOffset + 1), toRow: row })
          spawnOffset++
        }
      }
    }

    return fallInfos
  }

  /** Trả về tham chiếu đến grid hiện tại */
  getGrid(): Grid {
    return this.grid
  }

  /** Số hàng */
  getRows(): number {
    return this.rows
  }

  /** Số cột */
  getCols(): number {
    return this.cols
  }
}
