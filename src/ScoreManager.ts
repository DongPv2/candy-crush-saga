import { Match, MatchType } from './types.ts'

const MATCH_SCORES: Record<MatchType, number> = {
  [MatchType.MATCH_3]: 60,
  [MatchType.MATCH_4]: 120,
  [MatchType.MATCH_5]: 200,
  [MatchType.MATCH_L]: 150,
  [MatchType.MATCH_T]: 150,
}

export class ScoreManager {
  private score: number = 0
  private highScore: number = 0  // luôn lấy từ server, không dùng localStorage

  calculateScore(matches: Match[], combo: number): number {
    const multiplier = Math.max(1, combo)
    let total = 0
    for (const match of matches) {
      total += MATCH_SCORES[match.type] ?? 0
    }
    return total * multiplier
  }

  addScore(points: number): void {
    this.score += points
    if (this.score > this.highScore) {
      this.highScore = this.score
    }
  }

  getScore(): number { return this.score }
  getHighScore(): number { return this.highScore }

  /** Set highScore từ server khi bắt đầu game */
  setHighScore(value: number): void {
    this.highScore = Math.max(this.highScore, value)
  }

  /** Reset score về 0, giữ nguyên highScore */
  reset(): void {
    this.score = 0
  }
}
