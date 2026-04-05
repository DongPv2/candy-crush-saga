import { Match, MatchType } from './types.ts'

const HIGH_SCORE_KEY = 'candy-crush-highscore'

const MATCH_SCORES: Record<MatchType, number> = {
  [MatchType.MATCH_3]: 60,
  [MatchType.MATCH_4]: 120,
  [MatchType.MATCH_5]: 200,
  [MatchType.MATCH_L]: 150,
  [MatchType.MATCH_T]: 150,
}

export class ScoreManager {
  private score: number = 0
  private highScore: number = 0

  constructor() {
    this.highScore = this.loadHighScore()
  }

  private loadHighScore(): number {
    try {
      const stored = localStorage.getItem(HIGH_SCORE_KEY)
      if (stored === null) return 0
      const parsed = parseInt(stored, 10)
      return isNaN(parsed) ? 0 : parsed
    } catch {
      return 0
    }
  }

  /**
   * Tính điểm cho một tập match với hệ số combo.
   * combo = 1 → ×1, combo = 2 → ×2, ...
   */
  calculateScore(matches: Match[], combo: number): number {
    const multiplier = Math.max(1, combo)
    let total = 0
    for (const match of matches) {
      total += MATCH_SCORES[match.type] ?? 0
    }
    return total * multiplier
  }

  /** Cộng điểm vào score hiện tại, cập nhật highScore nếu cần. */
  addScore(points: number): void {
    this.score += points
    if (this.score > this.highScore) {
      this.highScore = this.score
      this.saveHighScore()
    }
  }

  getScore(): number {
    return this.score
  }

  getHighScore(): number {
    return this.highScore
  }

  /** Lưu highScore vào localStorage. */
  saveHighScore(): void {
    try {
      localStorage.setItem(HIGH_SCORE_KEY, String(this.highScore))
    } catch {
      // localStorage không khả dụng — bỏ qua
    }
  }

  /** Reset score về 0, giữ nguyên highScore. */
  reset(): void {
    this.score = 0
  }
}
