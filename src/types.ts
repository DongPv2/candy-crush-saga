// ============================================================
// Candy Crush Saga — Type Definitions
// ============================================================

// --------------- Enums ---------------

export enum CandyType {
  RED = 0,
  ORANGE = 1,
  YELLOW = 2,
  GREEN = 3,
  BLUE = 4,
  PURPLE = 5,
}

export enum SpecialType {
  NORMAL = 'NORMAL',
  STRIPED_H = 'STRIPED_H',   // match 4 ngang
  STRIPED_V = 'STRIPED_V',   // match 4 dọc
  WRAPPED = 'WRAPPED',       // match L/T
  COLOR_BOMB = 'COLOR_BOMB', // match 5
}

export enum MatchType {
  MATCH_3 = 'MATCH_3',
  MATCH_4 = 'MATCH_4',
  MATCH_5 = 'MATCH_5',
  MATCH_L = 'MATCH_L',
  MATCH_T = 'MATCH_T',
}

export enum GameStatus {
  IDLE = 'IDLE',
  SWAPPING = 'SWAPPING',
  MATCHING = 'MATCHING',
  REMOVING = 'REMOVING',
  REFILLING = 'REFILLING',
  CASCADING = 'CASCADING',
  CHECKING = 'CHECKING',
  SHUFFLING = 'SHUFFLING',
}

export enum Direction {
  UP = 'UP',
  DOWN = 'DOWN',
  LEFT = 'LEFT',
  RIGHT = 'RIGHT',
}

export enum ParticleType {
  SPARK = 'SPARK',   // tia lửa nhỏ, bay nhanh
  STAR = 'STAR',     // ngôi sao nhỏ, xoay, rơi chậm
  BURST = 'BURST',   // vòng tròn nở ra rồi mờ
  TRAIL = 'TRAIL',   // vệt sáng theo đường thẳng
}

export enum CandyShape {
  HEART = 'HEART',     // RED    — hình trái tim
  DIAMOND = 'DIAMOND', // ORANGE — hình thoi
  STAR = 'STAR',       // YELLOW — hình ngôi sao 6 cánh
  CLOVER = 'CLOVER',   // GREEN  — hình lá cỏ 4 lá
  CIRCLE = 'CIRCLE',   // BLUE   — hình tròn với viền gợn sóng
  HEXAGON = 'HEXAGON', // PURPLE — hình lục giác
}

// --------------- Core Interfaces ---------------

export interface Position {
  row: number
  col: number
}

export interface SwapPair {
  pos1: Position
  pos2: Position
}

export interface CandyAnimState {
  idlePhase: number      // phase cho idle bounce (0–2π)
  selectScale: number    // scale khi được chọn (1.0–1.15)
  opacity: number        // opacity khi nổ (1.0–0.0)
  offsetX: number        // offset ngang (swap/invalid)
  offsetY: number        // offset dọc (fall)
  rotation: number       // góc xoay (shuffle)
  scaleY: number         // squash/stretch dọc (fall bounce)
  glowRadius: number     // bán kính glow khi được chọn
  flashOpacity: number   // flash trắng khi match
}

export interface Candy {
  id: number             // unique id để track animation
  type: CandyType        // loại kẹo (màu sắc)
  special: SpecialType   // kẹo thường hay đặc biệt
  row: number            // vị trí hàng hiện tại
  col: number            // vị trí cột hiện tại
  animState: CandyAnimState
}

export interface BoardState {
  grid: Grid             // lưới ROWS x COLS
  rows: number           // số hàng (mặc định 9)
  cols: number           // số cột (mặc định 9)
}

export interface Match {
  candies: Candy[]              // danh sách kẹo trong match
  type: MatchType               // loại match
  specialCreated?: SpecialType  // kẹo đặc biệt tạo ra (nếu có)
  pivotPos?: Position           // vị trí tạo kẹo đặc biệt
}

export interface GameState {
  status: GameStatus
  board: BoardState
  score: number
  highScore: number
  comboCount: number
}

// --------------- Grid ---------------

export type Grid = (Candy | null)[][]

// --------------- Animation ---------------

export type EasingFn = (t: number) => number

export interface AnimationClip {
  id: string
  duration: number
  elapsed: number
  easing: EasingFn
  onUpdate: (t: number) => void  // t ∈ [0, 1]
  onComplete?: () => void
  loop?: boolean
}

export interface FallInfo {
  candy: Candy
  fromRow: number
  toRow: number
}

// --------------- Particle ---------------

export interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  ax: number
  ay: number
  life: number           // 1.0 → 0.0
  decay: number
  size: number
  color: string
  type: ParticleType
  rotation: number
  rotationSpeed: number
}

// --------------- Visual ---------------

export interface CandyVisual {
  shape: CandyShape
  baseColor: string
  gradientTop: string
  gradientBottom: string
  highlightColor: string
  shadowColor: string
  rimColor: string
}

export interface DrawOptions {
  scale: number
  opacity: number
  rotation: number
  glowColor?: string
  glowRadius?: number
}

// --------------- Game Results ---------------

export interface SwapResult {
  newGrid: Grid
  matches: Match[]
  score: number
  fallInfos: FallInfo[]
}

export interface CascadeResult {
  grid: Grid
  totalScore: number
  comboCount: number
  allMatches: Match[]
  allFallInfos: FallInfo[]
}
