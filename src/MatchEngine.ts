import {
  type Candy,
  type Grid,
  type Match,
  type Position,
  MatchType,
  SpecialType,
  Direction,
} from './types.ts'

// ============================================================
// MatchEngine — Phát hiện, phân loại và xử lý match
// ============================================================

export class MatchEngine {
  // ----------------------------------------------------------
  // Task 3.1 — Match cơ bản
  // ----------------------------------------------------------

  /**
   * Quét toàn bộ lưới theo ngang và dọc, thu thập run ≥ 3 kẹo cùng loại,
   * sau đó gộp các match chồng lấp. (design §2.3)
   */
  findAllMatches(grid: Grid, rows: number, cols: number): Match[] {
    const matches: Match[] = []

    // Quét ngang
    for (let row = 0; row < rows; row++) {
      let col = 0
      while (col <= cols - 3) {
        const cell = grid[row][col]
        if (cell !== null) {
          const run = this._collectHorizontalRun(grid, row, col, cols)
          if (run.length >= 3) {
            matches.push(this._createMatch(run, Direction.RIGHT))
            col += run.length
          } else {
            col++
          }
        } else {
          col++
        }
      }
    }

    // Quét dọc
    for (let col = 0; col < cols; col++) {
      let row = 0
      while (row <= rows - 3) {
        const cell = grid[row][col]
        if (cell !== null) {
          const run = this._collectVerticalRun(grid, row, col, rows)
          if (run.length >= 3) {
            matches.push(this._createMatch(run, Direction.DOWN))
            row += run.length
          } else {
            row++
          }
        } else {
          row++
        }
      }
    }

    return this.mergeOverlappingMatches(matches)
  }

  /**
   * Gộp các match có ít nhất một kẹo chung (cùng id).
   * Dùng Union-Find để gộp hiệu quả.
   */
  mergeOverlappingMatches(matches: Match[]): Match[] {
    if (matches.length === 0) return []

    // parent[i] = chỉ số cha trong Union-Find
    const parent = matches.map((_, i) => i)

    const find = (i: number): number => {
      if (parent[i] !== i) parent[i] = find(parent[i])
      return parent[i]
    }

    const union = (a: number, b: number) => {
      parent[find(a)] = find(b)
    }

    // Xây dựng map: candy.id → danh sách chỉ số match chứa kẹo đó
    const idToMatchIndices = new Map<number, number[]>()
    for (let i = 0; i < matches.length; i++) {
      for (const candy of matches[i].candies) {
        const list = idToMatchIndices.get(candy.id) ?? []
        list.push(i)
        idToMatchIndices.set(candy.id, list)
      }
    }

    // Union các match có kẹo chung
    for (const indices of idToMatchIndices.values()) {
      for (let k = 1; k < indices.length; k++) {
        union(indices[0], indices[k])
      }
    }

    // Nhóm các match theo root
    const groups = new Map<number, Match[]>()
    for (let i = 0; i < matches.length; i++) {
      const root = find(i)
      const group = groups.get(root) ?? []
      group.push(matches[i])
      groups.set(root, group)
    }

    // Gộp từng nhóm thành một match
    const result: Match[] = []
    for (const group of groups.values()) {
      if (group.length === 1) {
        result.push(group[0])
      } else {
        result.push(this._mergeGroup(group))
      }
    }

    return result
  }

  /**
   * Set null cho tất cả ô kẹo bị match, trả về grid đã sửa.
   */
  removeMatches(grid: Grid, matches: Match[]): Grid {
    for (const match of matches) {
      for (const candy of match.candies) {
        grid[candy.row][candy.col] = null
      }
    }
    return grid
  }

  // ----------------------------------------------------------
  // Task 3.3 — Phân loại match đặc biệt
  // ----------------------------------------------------------

  /**
   * Phân loại match theo số kẹo và hình dạng. (design §2.9)
   * Trả về { type: MatchType, specialCreated: SpecialType }
   */
  classifyMatch(
    candies: Candy[],
    direction: Direction,
  ): { type: MatchType; specialCreated: SpecialType } {
    const n = candies.length

    if (n >= 5) {
      return { type: MatchType.MATCH_5, specialCreated: SpecialType.COLOR_BOMB }
    }

    if (n === 4) {
      const special =
        direction === Direction.RIGHT || direction === Direction.LEFT
          ? SpecialType.STRIPED_H
          : SpecialType.STRIPED_V
      return { type: MatchType.MATCH_4, specialCreated: special }
    }

    if (this.isPartOfLShape(candies)) {
      return { type: MatchType.MATCH_L, specialCreated: SpecialType.WRAPPED }
    }

    if (this.isPartOfTShape(candies)) {
      return { type: MatchType.MATCH_T, specialCreated: SpecialType.WRAPPED }
    }

    return { type: MatchType.MATCH_3, specialCreated: SpecialType.NORMAL }
  }

  /**
   * Kiểm tra xem danh sách kẹo có tạo thành hình L không.
   * Hình L: có ít nhất 3 kẹo nằm ngang VÀ ít nhất 2 kẹo nằm dọc (hoặc ngược lại),
   * với một kẹo chung ở góc.
   */
  isPartOfLShape(candies: Candy[]): boolean {
    if (candies.length < 5) return false
    return this._hasLOrTShape(candies, 'L')
  }

  /**
   * Kiểm tra xem danh sách kẹo có tạo thành hình T không.
   * Hình T: có ít nhất 3 kẹo nằm ngang VÀ ít nhất 3 kẹo nằm dọc,
   * với một kẹo chung ở giữa.
   */
  isPartOfTShape(candies: Candy[]): boolean {
    if (candies.length < 5) return false
    return this._hasLOrTShape(candies, 'T')
  }

  /**
   * Đặt kẹo đặc biệt tại pivotPos của match.
   * Kẹo đặc biệt kế thừa type từ kẹo đầu tiên trong match.
   */
  placeSpecialCandy(grid: Grid, match: Match): Grid {
    if (!match.specialCreated || match.specialCreated === SpecialType.NORMAL) {
      return grid
    }
    if (!match.pivotPos) return grid

    const { row, col } = match.pivotPos
    const existing = grid[row][col]
    if (existing === null) return grid

    existing.special = match.specialCreated
    return grid
  }

  // ----------------------------------------------------------
  // Task 3.5 — Kích hoạt kẹo đặc biệt
  // ----------------------------------------------------------

  /**
   * Kích hoạt kẹo đặc biệt, trả về danh sách Position bị xóa.
   * COLOR_BOMB cần thêm targetType để biết xóa kẹo màu nào.
   */
  activateSpecialCandy(
    grid: Grid,
    candy: Candy,
    rows: number,
    cols: number,
    targetType?: number,
  ): Position[] {
    switch (candy.special) {
      case SpecialType.STRIPED_H:
        return this._activateStripedH(grid, candy.row, cols)

      case SpecialType.STRIPED_V:
        return this._activateStripedV(grid, candy.col, rows)

      case SpecialType.WRAPPED:
        return this._activateWrapped(grid, candy.row, candy.col, rows, cols)

      case SpecialType.COLOR_BOMB:
        if (targetType === undefined) return []
        return this._activateColorBomb(grid, targetType, rows, cols)

      default:
        return []
    }
  }

  // ----------------------------------------------------------
  // Private helpers
  // ----------------------------------------------------------

  /** Thu thập run ngang liên tiếp cùng type bắt đầu từ (row, col) */
  private _collectHorizontalRun(
    grid: Grid,
    row: number,
    col: number,
    cols: number,
  ): Candy[] {
    const first = grid[row][col]!
    const run: Candy[] = [first]
    let c = col + 1
    while (c < cols && grid[row][c]?.type === first.type) {
      run.push(grid[row][c]!)
      c++
    }
    return run
  }

  /** Thu thập run dọc liên tiếp cùng type bắt đầu từ (row, col) */
  private _collectVerticalRun(
    grid: Grid,
    row: number,
    col: number,
    rows: number,
  ): Candy[] {
    const first = grid[row][col]!
    const run: Candy[] = [first]
    let r = row + 1
    while (r < rows && grid[r][col]?.type === first.type) {
      run.push(grid[r][col]!)
      r++
    }
    return run
  }

  /** Tạo Match từ run kẹo và hướng quét */
  private _createMatch(candies: Candy[], direction: Direction): Match {
    const { type, specialCreated } = this.classifyMatch(candies, direction)
    const pivotPos = this._choosePivot(candies)
    return { candies: [...candies], type, specialCreated, pivotPos }
  }

  /** Chọn vị trí pivot (giữa run) để đặt kẹo đặc biệt */
  private _choosePivot(candies: Candy[]): Position {
    const mid = Math.floor(candies.length / 2)
    return { row: candies[mid].row, col: candies[mid].col }
  }

  /** Gộp một nhóm match thành một match duy nhất */
  private _mergeGroup(group: Match[]): Match {
    // Gộp tất cả kẹo, loại bỏ trùng lặp theo id
    const seen = new Set<number>()
    const allCandies: Candy[] = []
    for (const m of group) {
      for (const c of m.candies) {
        if (!seen.has(c.id)) {
          seen.add(c.id)
          allCandies.push(c)
        }
      }
    }

    // Ưu tiên match có specialCreated cao hơn (COLOR_BOMB > WRAPPED > STRIPED > NORMAL)
    const priority = (s: SpecialType | undefined): number => {
      switch (s) {
        case SpecialType.COLOR_BOMB: return 4
        case SpecialType.WRAPPED:    return 3
        case SpecialType.STRIPED_H:  return 2
        case SpecialType.STRIPED_V:  return 2
        default:                     return 0
      }
    }

    const best = group.reduce((a, b) =>
      priority(a.specialCreated) >= priority(b.specialCreated) ? a : b,
    )

    // Phân loại lại dựa trên hình dạng thực tế của merged candies
    const rows = new Set(allCandies.map(c => c.row))
    const cols = new Set(allCandies.map(c => c.col))
    let type = best.type
    if (rows.size >= 2 && cols.size >= 2) {
      // Hình L hoặc T
      type = cols.size >= 3 && rows.size >= 3 ? MatchType.MATCH_T : MatchType.MATCH_L
    }

    return {
      candies: allCandies,
      type,
      specialCreated: best.specialCreated,
      pivotPos: best.pivotPos,
    }
  }

  /**
   * Phát hiện hình L hoặc T từ danh sách kẹo.
   * Chiến lược: tìm các hàng và cột có ≥ 3 kẹo cùng loại,
   * kiểm tra xem chúng có giao nhau không.
   */
  private _hasLOrTShape(candies: Candy[], shape: 'L' | 'T'): boolean {
    // Nhóm kẹo theo hàng
    const byRow = new Map<number, Candy[]>()
    const byCol = new Map<number, Candy[]>()
    for (const c of candies) {
      const r = byRow.get(c.row) ?? []
      r.push(c)
      byRow.set(c.row, r)
      const col = byCol.get(c.col) ?? []
      col.push(c)
      byCol.set(c.col, col)
    }

    const hRuns = [...byRow.values()].filter(r => r.length >= 3)
    const vRuns = [...byCol.values()].filter(r => r.length >= 3)

    if (hRuns.length === 0 || vRuns.length === 0) return false

    // Kiểm tra giao nhau
    for (const hRun of hRuns) {
      const hCols = new Set(hRun.map(c => c.col))
      const hRow = hRun[0].row
      for (const vRun of vRuns) {
        const vCol = vRun[0].col
        const vRows = new Set(vRun.map(c => c.row))
        if (hCols.has(vCol) && vRows.has(hRow)) {
          if (shape === 'T') {
            // T-shape: giao điểm ở giữa cả hai run
            const hMid = hRun[Math.floor(hRun.length / 2)].col
            const vMid = vRun[Math.floor(vRun.length / 2)].row
            return hMid === vCol && vMid === hRow
          }
          // L-shape: giao điểm ở đầu hoặc cuối ít nhất một run
          return true
        }
      }
    }

    return false
  }

  /** STRIPED_H: xóa toàn bộ hàng ngang */
  private _activateStripedH(grid: Grid, row: number, cols: number): Position[] {
    const positions: Position[] = []
    for (let col = 0; col < cols; col++) {
      if (grid[row][col] !== null) {
        positions.push({ row, col })
        grid[row][col] = null
      }
    }
    return positions
  }

  /** STRIPED_V: xóa toàn bộ cột dọc */
  private _activateStripedV(grid: Grid, col: number, rows: number): Position[] {
    const positions: Position[] = []
    for (let row = 0; row < rows; row++) {
      if (grid[row][col] !== null) {
        positions.push({ row, col })
        grid[row][col] = null
      }
    }
    return positions
  }

  /** WRAPPED: xóa vùng 3×3 xung quanh */
  private _activateWrapped(
    grid: Grid,
    centerRow: number,
    centerCol: number,
    rows: number,
    cols: number,
  ): Position[] {
    const positions: Position[] = []
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const r = centerRow + dr
        const c = centerCol + dc
        if (r >= 0 && r < rows && c >= 0 && c < cols && grid[r][c] !== null) {
          positions.push({ row: r, col: c })
          grid[r][c] = null
        }
      }
    }
    return positions
  }

  /** COLOR_BOMB: xóa tất cả kẹo cùng targetType */
  private _activateColorBomb(
    grid: Grid,
    targetType: number,
    rows: number,
    cols: number,
  ): Position[] {
    const positions: Position[] = []
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const candy = grid[row][col]
        if (candy !== null && candy.type === targetType) {
          positions.push({ row, col })
          grid[row][col] = null
        }
      }
    }
    return positions
  }
}
