import type { Grid, Position } from './types.ts'
import type { MatchEngine } from './MatchEngine.ts'

export interface HintMove {
  pos1: Position
  pos2: Position
}

/** Tìm một nước đi hợp lệ để gợi ý */
export function findHintMove(
  grid: Grid,
  rows: number,
  cols: number,
  matchEngine: MatchEngine,
): HintMove | null {
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      // Thử swap phải
      if (col + 1 < cols) {
        const c1 = grid[row][col]
        const c2 = grid[row][col + 1]
        grid[row][col] = c2
        grid[row][col + 1] = c1
        if (c1) { c1.row = row; c1.col = col + 1 }
        if (c2) { c2.row = row; c2.col = col }

        const hasMatch = matchEngine.findAllMatches(grid, rows, cols).length > 0

        grid[row][col] = c1
        grid[row][col + 1] = c2
        if (c1) { c1.row = row; c1.col = col }
        if (c2) { c2.row = row; c2.col = col + 1 }

        if (hasMatch) return { pos1: { row, col }, pos2: { row, col: col + 1 } }
      }

      // Thử swap xuống
      if (row + 1 < rows) {
        const c1 = grid[row][col]
        const c2 = grid[row + 1][col]
        grid[row][col] = c2
        grid[row + 1][col] = c1
        if (c1) { c1.row = row + 1; c1.col = col }
        if (c2) { c2.row = row; c2.col = col }

        const hasMatch = matchEngine.findAllMatches(grid, rows, cols).length > 0

        grid[row][col] = c1
        grid[row + 1][col] = c2
        if (c1) { c1.row = row; c1.col = col }
        if (c2) { c2.row = row + 1; c2.col = col }

        if (hasMatch) return { pos1: { row, col }, pos2: { row: row + 1, col } }
      }
    }
  }
  return null
}
