import { type Grid } from './types.ts'
import { MatchEngine } from './MatchEngine.ts'
import { GameBoard } from './GameBoard.ts'

// ============================================================
// ShuffleEngine — Kiểm tra nước đi hợp lệ và shuffle lưới
// ============================================================

export class ShuffleEngine {
  constructor(
    private readonly matchEngine: MatchEngine,
    private readonly gameBoard: GameBoard,
  ) {}

  // ----------------------------------------------------------
  // §2.4 — Kiểm tra nước đi hợp lệ
  // ----------------------------------------------------------

  /**
   * Duyệt tất cả swap có thể (phải và xuống), early return khi tìm thấy match.
   * Độ phức tạp: O(rows × cols) nhờ early return.
   */
  hasValidMoves(grid: Grid, rows: number, cols: number): boolean {
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        // Thử swap sang phải
        if (col + 1 < cols) {
          this._swapInPlace(grid, row, col, row, col + 1)
          const hasMatch = this.matchEngine.findAllMatches(grid, rows, cols).length > 0
          this._swapInPlace(grid, row, col, row, col + 1) // hoàn tác
          if (hasMatch) return true
        }

        // Thử swap xuống dưới
        if (row + 1 < rows) {
          this._swapInPlace(grid, row, col, row + 1, col)
          const hasMatch = this.matchEngine.findAllMatches(grid, rows, cols).length > 0
          this._swapInPlace(grid, row, col, row + 1, col) // hoàn tác
          if (hasMatch) return true
        }
      }
    }
    return false
  }

  // ----------------------------------------------------------
  // §2.5 — Thuật toán Fisher-Yates và shuffle board
  // ----------------------------------------------------------

  /**
   * Thuật toán Fisher-Yates shuffle in-place.
   * Mỗi phần tử có xác suất bằng nhau xuất hiện ở bất kỳ vị trí nào.
   */
  fisherYatesShuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const tmp = arr[i]
      arr[i] = arr[j]
      arr[j] = tmp
    }
    return arr
  }

  /**
   * Shuffle lưới và kiểm tra hợp lệ, tối đa 100 lần.
   * Sau shuffle: không có match sẵn VÀ có ít nhất 1 nước đi hợp lệ.
   * Fallback sau 100 lần: tạo lại board bằng GameBoard.initBoard.
   */
  shuffleBoard(grid: Grid, rows: number, cols: number): Grid {
    // Thu thập tất cả kẹo không null
    const candies = []
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (grid[row][col] !== null) {
          candies.push(grid[row][col]!)
        }
      }
    }

    let attempts = 0

    while (true) {
      attempts++

      // Fallback: tạo lại board sau 100 lần thất bại
      if (attempts > 100) {
        return this.gameBoard.initBoard(rows, cols)
      }

      // Fisher-Yates shuffle mảng kẹo
      this.fisherYatesShuffle(candies)

      // Đặt lại kẹo vào lưới theo thứ tự row-major
      let idx = 0
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          if (grid[row][col] !== null) {
            const candy = candies[idx++]
            candy.row = row
            candy.col = col
            grid[row][col] = candy
          }
        }
      }

      // Kiểm tra: không có match sẵn VÀ có ít nhất 1 nước đi hợp lệ
      const noMatches = this.matchEngine.findAllMatches(grid, rows, cols).length === 0
      const hasMoves = this.hasValidMoves(grid, rows, cols)

      if (noMatches && hasMoves) {
        return grid
      }
    }
  }

  // ----------------------------------------------------------
  // Private helpers
  // ----------------------------------------------------------

  /** Hoán đổi hai ô trong lưới in-place (không tạo bản sao) */
  private _swapInPlace(
    grid: Grid,
    r1: number, c1: number,
    r2: number, c2: number,
  ): void {
    const tmp = grid[r1][c1]
    grid[r1][c1] = grid[r2][c2]
    grid[r2][c2] = tmp

    // Cập nhật tọa độ kẹo
    if (grid[r1][c1]) { grid[r1][c1]!.row = r1; grid[r1][c1]!.col = c1 }
    if (grid[r2][c2]) { grid[r2][c2]!.row = r2; grid[r2][c2]!.col = c2 }
  }
}
