// ============================================================
// Candy Crush Saga — Animation Manager
// Hàng đợi animation, easing, idle/select/swap/match/fall/shuffle/combo/special
// Design §4.1–§4.2
// ============================================================

import {
  type Candy,
  type Position,
  type Match,
  type AnimationClip,
  type EasingFn,
  type FallInfo,
  Direction,
  ParticleType,
} from './types.ts'
import { ParticleEngine } from './ParticleEngine.ts'
import { type IAnimationManager } from './GameManager.ts'

// ============================================================
// §4.1 — Easing functions
// ============================================================

export const Easing = {
  linear: (t: number): number => t,

  easeInOut: (t: number): number =>
    t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,

  easeOutBack: (t: number): number => {
    const c = 1.70158
    return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2)
  },

  easeInBack: (t: number): number => {
    const c = 1.70158
    return (c + 1) * t * t * t - c * t * t
  },

  easeOutBounce: (t: number): number => {
    const n1 = 7.5625
    const d1 = 2.75
    if (t < 1 / d1) return n1 * t * t
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375
    return n1 * (t -= 2.625 / d1) * t + 0.984375
  },

  easeInQuad: (t: number): number => t * t,

  easeOutQuad: (t: number): number => t * (2 - t),

  spring: (t: number): number =>
    Math.sin(t * Math.PI * (0.2 + 2.5 * Math.pow(t, 3))) * Math.pow(1 - t, 2.2) + t,
} as const

// ============================================================
// Helpers
// ============================================================

let clipIdCounter = 0
function nextClipId(): string {
  return `clip_${++clipIdCounter}`
}

/** Tween một thuộc tính số của object từ from → to trong duration ms */
function makeTween(
  target: Record<string, number>,
  prop: string,
  from: number,
  to: number,
  duration: number,
  easing: EasingFn,
  onComplete?: () => void,
  loop = false,
): AnimationClip {
  return {
    id: nextClipId(),
    duration,
    elapsed: 0,
    easing,
    onUpdate: (t: number) => {
      target[prop] = from + (to - from) * t
    },
    onComplete,
    loop,
  }
}

/** Chờ một khoảng thời gian (ms) */
function makeDelay(duration: number, onComplete?: () => void): AnimationClip {
  return {
    id: nextClipId(),
    duration,
    elapsed: 0,
    easing: Easing.linear,
    onUpdate: () => { /* no-op */ },
    onComplete,
  }
}

/** Wrap một mảng clip chạy tuần tự thành một Promise */
function runSequential(
  clips: AnimationClip[],
  addClip: (clip: AnimationClip) => void,
): Promise<void> {
  return new Promise<void>((resolve) => {
    if (clips.length === 0) { resolve(); return }

    const run = (index: number): void => {
      if (index >= clips.length) { resolve(); return }
      const clip = clips[index]!
      clip.onComplete = () => run(index + 1)
      addClip(clip)
    }
    run(0)
  })
}

/** Chạy nhiều clip song song, resolve khi tất cả xong */
function runParallel(
  clips: AnimationClip[],
  addClip: (clip: AnimationClip) => void,
): Promise<void> {
  return new Promise<void>((resolve) => {
    if (clips.length === 0) { resolve(); return }
    let done = 0
    for (const clip of clips) {
      const origComplete = clip.onComplete
      clip.onComplete = () => {
        origComplete?.()
        done++
        if (done === clips.length) resolve()
      }
      addClip(clip)
    }
  })
}

// ============================================================
// AnimationManager
// ============================================================

export class AnimationManager implements IAnimationManager {
  /** Tất cả clip đang chạy (kể cả loop) */
  private readonly clips: Map<string, AnimationClip> = new Map()

  /** Idle loop clips — lưu riêng để có thể dừng */
  private readonly idleClips: Map<number, string> = new Map()
  private idleRunning = false

  /** Glow pulse clip id cho kẹo đang được chọn */
  private glowClipId: string | null = null

  /** Screen shake state */
  private shakeIntensity = 0
  private shakeDuration = 0
  private shakeElapsed = 0
  public shakeOffsetX = 0
  public shakeOffsetY = 0

  /** Renderer reference để set combo text (injected nếu cần) */
  private rendererSetComboText: ((text: string, opacity: number) => void) | null = null

  /** tileSize từ Renderer — dùng cho fall/swap animation */
  private tileSize: number = 64

  constructor(private readonly particleEngine: ParticleEngine) {}

  // ----------------------------------------------------------
  // Dependency injection
  // ----------------------------------------------------------

  setComboTextCallback(fn: (text: string, opacity: number) => void): void {
    this.rendererSetComboText = fn
  }

  setTileSize(size: number): void {
    this.tileSize = size
  }

  // ----------------------------------------------------------
  // §12.1 — Core clip management
  // ----------------------------------------------------------

  private addClip(clip: AnimationClip): void {
    this.clips.set(clip.id, clip)
  }

  private removeClip(id: string): void {
    this.clips.delete(id)
  }

  /**
   * Helper công khai để tạo AnimationClip tween.
   * tween(target, prop, from, to, duration, easing)
   */
  tween(
    target: Record<string, number>,
    prop: string,
    from: number,
    to: number,
    duration: number,
    easing: EasingFn,
  ): AnimationClip {
    return makeTween(target, prop, from, to, duration, easing)
  }

  /**
   * update(deltaTime) — cập nhật tất cả clip đang chạy.
   * Gọi onUpdate(t) với t ∈ [0,1], xóa clip khi hết thời gian.
   */
  update(deltaTime: number): void {
    // Screen shake
    if (this.shakeDuration > 0) {
      this.shakeElapsed += deltaTime
      const progress = Math.min(this.shakeElapsed / this.shakeDuration, 1)
      const intensity = this.shakeIntensity * (1 - progress)
      this.shakeOffsetX = (Math.random() * 2 - 1) * intensity
      this.shakeOffsetY = (Math.random() * 2 - 1) * intensity
      if (progress >= 1) {
        this.shakeDuration = 0
        this.shakeOffsetX = 0
        this.shakeOffsetY = 0
      }
    }

    for (const [id, clip] of this.clips) {
      clip.elapsed += deltaTime

      if (clip.duration <= 0) {
        // Instant clip
        clip.onUpdate(1)
        clip.onComplete?.()
        this.clips.delete(id)
        continue
      }

      const t = Math.min(clip.elapsed / clip.duration, 1)
      clip.onUpdate(clip.easing(t))

      if (t >= 1) {
        if (clip.loop === true) {
          clip.elapsed = 0
        } else {
          clip.onComplete?.()
          this.clips.delete(id)
        }
      }
    }
  }

  /**
   * isAnimating() — true khi có ít nhất 1 clip không phải idle/glow đang chạy.
   */
  isAnimating(): boolean {
    for (const [id] of this.clips) {
      if (!this.idleClips.has(this._idleKeyFromClipId(id)) && id !== this.glowClipId) {
        return true
      }
    }
    return false
  }

  private _idleKeyFromClipId(clipId: string): number {
    // idleClips maps candyId → clipId; check reverse
    for (const [candyId, cid] of this.idleClips) {
      if (cid === clipId) return candyId
    }
    return -1
  }

  // ----------------------------------------------------------
  // §12.2 — Idle và select animation
  // ----------------------------------------------------------

  /**
   * startIdleAnimations(candies) — idle bounce với golden ratio phase offset.
   * Mỗi kẹo: idlePhase += deltaTime × 0.0018, selectScale = 1.0 + sin(phase) × 0.03, offsetY = sin(phase) × 2
   */
  startIdleAnimations(candies: Candy[]): void {
    if (this.idleRunning) return
    this.idleRunning = true

    for (const candy of candies) {
      const phaseOffset = (candy.id * 0.618) % (2 * Math.PI)

      // Loop clip with duration=1000ms; elapsed resets each loop.
      // We track prevElapsed to compute per-frame delta correctly across loop resets.
      let prevElapsed = 0
      const idleClip: AnimationClip = {
        id: nextClipId(),
        duration: 1000,
        elapsed: 0,
        easing: Easing.linear,
        loop: true,
        onUpdate: (_t: number) => {
          const currentElapsed = idleClip.elapsed
          const delta = currentElapsed >= prevElapsed
            ? currentElapsed - prevElapsed
            : currentElapsed // loop reset: elapsed went back to ~0
          prevElapsed = currentElapsed

          candy.animState.idlePhase += delta * 0.0018
          const phase = candy.animState.idlePhase + phaseOffset
          const s = Math.sin(phase)
          candy.animState.selectScale = 1.0 + s * 0.03
          candy.animState.offsetY = s * 2.0
        },
        onComplete: undefined,
      }

      this.clips.set(idleClip.id, idleClip)
      this.idleClips.set(candy.id, idleClip.id)
    }
  }

  /** stopIdleAnimations() — dừng tất cả idle clip */
  stopIdleAnimations(): void {
    for (const [, clipId] of this.idleClips) {
      this.clips.delete(clipId)
    }
    this.idleClips.clear()
    this.idleRunning = false
  }

  /**
   * playSelectAnimation(candy) — phóng to 1.18× (80ms easeOutBack) → 1.12× (120ms easeInOut) + glow pulse loop
   */
  async playSelectAnimation(candy: Candy): Promise<void> {
    // Stop any existing glow
    if (this.glowClipId !== null) {
      this.clips.delete(this.glowClipId)
      this.glowClipId = null
    }

    const animState = candy.animState as unknown as Record<string, number>

    await runSequential([
      makeTween(animState, 'selectScale', 1.0, 1.18, 80, Easing.easeOutBack),
      makeTween(animState, 'selectScale', 1.18, 1.12, 120, Easing.easeInOut),
    ], (c) => this.addClip(c))

    // Glow pulse loop
    let glowTime = 0
    const glowClip: AnimationClip = {
      id: nextClipId(),
      duration: 1000,
      elapsed: 0,
      easing: Easing.linear,
      loop: true,
      onUpdate: (_t: number) => {
        glowTime = glowClip.elapsed
        candy.animState.glowRadius = 1.0 + Math.sin(glowTime * 0.005) * 0.15
      },
    }
    this.glowClipId = glowClip.id
    this.addClip(glowClip)
  }

  /**
   * playDeselectAnimation(candy) — thu về 1.0× trong 100ms
   */
  async playDeselectAnimation(candy: Candy): Promise<void> {
    // Stop glow
    if (this.glowClipId !== null) {
      this.clips.delete(this.glowClipId)
      this.glowClipId = null
    }

    const animState = candy.animState as unknown as Record<string, number>
    const currentScale = candy.animState.selectScale

    await runSequential([
      makeTween(animState, 'selectScale', currentScale, 1.0, 100, Easing.easeInOut),
    ], (c) => this.addClip(c))

    candy.animState.glowRadius = 1.0
  }

  // ----------------------------------------------------------
  // §12.3 — Swap và invalid swap animation
  // ----------------------------------------------------------

  /**
   * queueSwapAnimation — animate 2 kẹo di chuyển sang vị trí nhau.
   * Sau checkSwap, candy1 đã ở pos2 và candy2 đã ở pos1 trên board.
   * Ta set offset ngược chiều rồi tween về 0 để tạo hiệu ứng di chuyển.
   */
  async queueSwapAnimation(
    pos1: Position,
    pos2: Position,
    candy1?: Candy,
    candy2?: Candy,
  ): Promise<void> {
    const ts = this.tileSize
    const deltaX = (pos2.col - pos1.col) * ts
    const deltaY = (pos2.row - pos1.row) * ts

    if (!candy1 || !candy2) {
      // Fallback: chỉ delay
      await new Promise<void>((resolve) => { this.addClip(makeDelay(200, resolve)) })
      return
    }

    // candy1 đã ở pos2, cần xuất hiện từ pos1 → offset = -delta → tween về 0
    // candy2 đã ở pos1, cần xuất hiện từ pos2 → offset = +delta → tween về 0
    const a1 = candy1.animState as unknown as Record<string, number>
    const a2 = candy2.animState as unknown as Record<string, number>

    candy1.animState.offsetX = -deltaX
    candy1.animState.offsetY = -deltaY
    candy2.animState.offsetX = deltaX
    candy2.animState.offsetY = deltaY

    await runParallel([
      makeTween(a1, 'offsetX', -deltaX, 0, 200, Easing.easeInOut),
      makeTween(a1, 'offsetY', -deltaY, 0, 200, Easing.easeInOut),
      makeTween(a2, 'offsetX', deltaX, 0, 200, Easing.easeInOut),
      makeTween(a2, 'offsetY', deltaY, 0, 200, Easing.easeInOut),
    ], (c) => this.addClip(c))

    candy1.animState.offsetX = 0
    candy1.animState.offsetY = 0
    candy2.animState.offsetX = 0
    candy2.animState.offsetY = 0
  }

  /**
   * queueInvalidSwapAnimation — kẹo di chuyển 30% rồi quay lại + rung.
   */
  async queueInvalidSwapAnimation(
    pos1: Position,
    pos2: Position,
    candy1?: Candy,
    candy2?: Candy,
  ): Promise<void> {
    const ts = this.tileSize
    const deltaX = (pos2.col - pos1.col) * ts
    const deltaY = (pos2.row - pos1.row) * ts
    const midX = deltaX * 0.35
    const midY = deltaY * 0.35

    if (!candy1 || !candy2) {
      await new Promise<void>((resolve) => { this.addClip(makeDelay(300, resolve)) })
      return
    }

    const a1 = candy1.animState as unknown as Record<string, number>
    const a2 = candy2.animState as unknown as Record<string, number>

    // Di chuyển 35% về phía nhau
    await runParallel([
      makeTween(a1, 'offsetX', 0, midX, 100, Easing.easeInOut),
      makeTween(a1, 'offsetY', 0, midY, 100, Easing.easeInOut),
      makeTween(a2, 'offsetX', 0, -midX, 100, Easing.easeInOut),
      makeTween(a2, 'offsetY', 0, -midY, 100, Easing.easeInOut),
    ], (c) => this.addClip(c))

    // Quay lại với bounce
    await runParallel([
      makeTween(a1, 'offsetX', midX, 0, 180, Easing.easeOutBounce),
      makeTween(a1, 'offsetY', midY, 0, 180, Easing.easeOutBounce),
      makeTween(a2, 'offsetX', -midX, 0, 180, Easing.easeOutBounce),
      makeTween(a2, 'offsetY', -midY, 0, 180, Easing.easeOutBounce),
    ], (c) => this.addClip(c))

    candy1.animState.offsetX = 0; candy1.animState.offsetY = 0
    candy2.animState.offsetX = 0; candy2.animState.offsetY = 0
  }

  // ----------------------------------------------------------
  // §12.4 — Match explosion và fall animation
  // ----------------------------------------------------------

  /**
   * queueMatchAnimation(matches) — flash 50ms → scale 1.4× + fade 200ms + spawn SPARK particles.
   */
  async queueMatchAnimation(matches: Match[], tileSize = 64): Promise<void> {
    const allCandies = matches.flatMap((m) => m.candies)

    // Phase 1: Flash trắng 50ms
    const flashClips = allCandies.map((candy) => {
      const a = candy.animState as unknown as Record<string, number>
      return makeTween(a, 'flashOpacity', 0, 1, 50, Easing.linear)
    })
    await runParallel(flashClips, (c) => this.addClip(c))

    // Phase 2: Scale up + fade out 200ms (parallel)
    const explodeClips: AnimationClip[] = []
    for (const candy of allCandies) {
      const a = candy.animState as unknown as Record<string, number>
      explodeClips.push(makeTween(a, 'selectScale', 1.0, 1.4, 200, Easing.easeOutBack))
      explodeClips.push(makeTween(a, 'opacity', 1.0, 0.0, 200, Easing.easeInOut))
    }
    await runParallel(explodeClips, (c) => this.addClip(c))

    // Phase 3: Spawn SPARK particles
    for (const candy of allCandies) {
      const cx = candy.col * tileSize + tileSize / 2
      const cy = candy.row * tileSize + tileSize / 2
      this.particleEngine.spawnBurst(cx, cy, this._getCandyColor(candy.type), 8, ParticleType.SPARK)
    }

    // Reset animState — kẹo này sẽ bị xóa khỏi grid, nhưng reset để an toàn
    for (const candy of allCandies) {
      candy.animState.flashOpacity = 0
      candy.animState.opacity = 1.0
      candy.animState.selectScale = 1.0
    }
  }

  /**
   * queueFallAnimation(fallInfos, tileSize) — kẹo rơi từ fromRow xuống toRow.
   * fromRow có thể âm (kẹo mới spawn từ trên màn hình).
   */
  async queueFallAnimation(fallInfos: FallInfo[], tileSize = this.tileSize): Promise<void> {
    if (fallInfos.length === 0) return

    const fallingItems = fallInfos.filter(({ fromRow, toRow }) => fromRow !== toRow)
    if (fallingItems.length === 0) return

    // Set offsetY ban đầu để kẹo xuất hiện ở vị trí cũ (hoặc trên màn hình)
    for (const { candy, fromRow, toRow } of fallingItems) {
      const distance = (toRow - fromRow) * tileSize
      candy.animState.offsetY = -distance
      candy.animState.scaleY = 1.0
    }

    // Phase 1: Rơi xuống
    const fallClips: AnimationClip[] = []
    for (const { candy, fromRow, toRow } of fallingItems) {
      const distance = (toRow - fromRow) * tileSize
      const fallDuration = Math.min(80 + Math.abs(distance) * 0.5, 600)
      const a = candy.animState as unknown as Record<string, number>
      fallClips.push(makeTween(a, 'offsetY', -distance, 0, fallDuration, Easing.easeInQuad))
    }
    await runParallel(fallClips, (c) => this.addClip(c))

    // Phase 2: Squash khi chạm đáy
    const squashClips: AnimationClip[] = []
    for (const { candy } of fallingItems) {
      const a = candy.animState as unknown as Record<string, number>
      squashClips.push(makeTween(a, 'scaleY', 1.0, 0.82, 60, Easing.easeOutQuad))
      squashClips.push(makeTween(a, 'offsetY', 0, 4, 60, Easing.easeOutQuad))
    }
    await runParallel(squashClips, (c) => this.addClip(c))

    // Phase 3: Bounce trở lại
    const bounceClips: AnimationClip[] = []
    for (const { candy } of fallingItems) {
      const a = candy.animState as unknown as Record<string, number>
      bounceClips.push(makeTween(a, 'scaleY', 0.82, 1.0, 120, Easing.easeOutBounce))
      bounceClips.push(makeTween(a, 'offsetY', 4, 0, 120, Easing.easeOutBounce))
    }
    await runParallel(bounceClips, (c) => this.addClip(c))

    // Reset
    for (const { candy } of fallingItems) {
      candy.animState.offsetY = 0
      candy.animState.scaleY = 1.0
    }
  }

  private _getCandyColor(type: number): string {
    const colors = ['#E8334A', '#F5820D', '#F5D000', '#2ECC40', '#0074D9', '#9B59B6']
    return colors[type] ?? '#FFFFFF'
  }

  // ----------------------------------------------------------
  // §12.5 — Shuffle, combo và special candy animation
  // ----------------------------------------------------------

  /**
   * queueShuffleAnimation(candies, newPositions, tileSize) — thu nhỏ → xoáy → bay ra staggered 15ms/kẹo.
   */
  async queueShuffleAnimation(
    candies: Candy[] = [],
    newPositions: Position[] = [],
    tileSize = 64,
  ): Promise<void> {
    if (candies.length === 0) {
      // IAnimationManager compat: just delay
      await new Promise<void>((resolve) => {
        this.addClip(makeDelay(1000, resolve))
      })
      return
    }

    const centerX = 4 * tileSize + tileSize / 2
    const centerY = 4 * tileSize + tileSize / 2

    // Phase 1: Thu nhỏ về trung tâm (300ms)
    const shrinkClips: AnimationClip[] = []
    for (const candy of candies) {
      const a = candy.animState as unknown as Record<string, number>
      const targetOffsetX = centerX - (candy.col * tileSize + tileSize / 2)
      const targetOffsetY = centerY - (candy.row * tileSize + tileSize / 2)
      shrinkClips.push(makeTween(a, 'selectScale', 1.0, 0.0, 300, Easing.easeInBack))
      shrinkClips.push(makeTween(a, 'offsetX', 0, targetOffsetX, 300, Easing.easeInBack))
      shrinkClips.push(makeTween(a, 'offsetY', 0, targetOffsetY, 300, Easing.easeInBack))
    }
    await runParallel(shrinkClips, (c) => this.addClip(c))

    // Phase 2: Vortex effect — spawn BURST particles at center (200ms)
    this.particleEngine.spawnBurst(centerX, centerY, '#FFD700', 20, ParticleType.BURST)
    await new Promise<void>((resolve) => {
      this.addClip(makeDelay(200, resolve))
    })

    // Phase 3: Bay ra vị trí mới staggered 15ms/kẹo
    await new Promise<void>((resolve) => {
      let completed = 0
      const total = candies.length

      for (let i = 0; i < candies.length; i++) {
        const candy = candies[i]!
        const newPos = newPositions[i] ?? { row: candy.row, col: candy.col }
        const a = candy.animState as unknown as Record<string, number>

        const targetOffsetX = (newPos.col - candy.col) * tileSize
        const targetOffsetY = (newPos.row - candy.row) * tileSize

        const delay = makeDelay(i * 15, () => {
          const flyClips = [
            makeTween(a, 'selectScale', 0.0, 1.0, 300, Easing.easeOutBack),
            makeTween(a, 'offsetX', a['offsetX'] ?? 0, targetOffsetX, 300, Easing.easeOutBack),
            makeTween(a, 'offsetY', a['offsetY'] ?? 0, targetOffsetY, 300, Easing.easeOutBack),
          ]

          let flyDone = 0
          for (const clip of flyClips) {
            clip.onComplete = () => {
              flyDone++
              if (flyDone === flyClips.length) {
                completed++
                if (completed === total) resolve()
              }
            }
            this.addClip(clip)
          }
        })
        this.addClip(delay)
      }

      if (total === 0) resolve()
    })

    // Reset offsets
    for (const candy of candies) {
      candy.animState.offsetX = 0
      candy.animState.offsetY = 0
      candy.animState.selectScale = 1.0
    }
  }

  /**
   * playComboAnimation — hiển thị combo text với hiệu ứng theo cấp độ.
   * combo 2: "COMBO x2" nhỏ, combo 5+: "INCREDIBLE!" to, rực rỡ
   */
  async playComboAnimation(comboCount: number): Promise<void> {
    const setComboText = this.rendererSetComboText ?? (() => {})

    // Text và màu theo cấp độ
    const labels = ['', '', 'UẦYYY!', 'KINH ĐẾYY', 'BẠN THÌ HAY RỒIII', 'OÁCH PHẾT NHỜ :)', 'GỚM ĐẤYYY', "QÚA LÀ ĐẲNG's CẤP LUÔN!"]
    const label = comboCount < labels.length ? labels[comboCount] : `VUÝPPP x ${comboCount}!`

    // Scale cơ bản tăng theo combo: x2=1.0, x3=1.2, x4=1.4, x5+=1.6
    const baseScale = Math.min(1.0 + (comboCount - 2) * 0.2, 2.0)
    const state = { scale: 0, opacity: 1.0 }

    // Phase 1: Bung ra nhanh
    await runSequential([
      makeTween(state as unknown as Record<string, number>, 'scale', 0, baseScale * 1.3, 150, Easing.easeOutBack),
    ], (c) => {
      const orig = c.onUpdate
      c.onUpdate = (t) => { orig(t); setComboText(label, state.opacity) }
      this.addClip(c)
    })

    // Phase 2: Thu nhỏ về baseScale
    await runSequential([
      makeTween(state as unknown as Record<string, number>, 'scale', baseScale * 1.3, baseScale, 100, Easing.easeInOut),
    ], (c) => {
      const orig = c.onUpdate
      c.onUpdate = (t) => { orig(t); setComboText(label, state.opacity) }
      this.addClip(c)
    })

    // Phase 3: Giữ nguyên (thời gian tỉ lệ combo)
    const holdTime = 200 + comboCount * 60
    await new Promise<void>((resolve) => { this.addClip(makeDelay(holdTime, resolve)) })

    // Phase 4: Fade out
    await runSequential([
      makeTween(state as unknown as Record<string, number>, 'opacity', 1.0, 0.0, 250, Easing.easeInOut),
    ], (c) => {
      const orig = c.onUpdate
      c.onUpdate = (t) => { orig(t); setComboText(label, state.opacity) }
      this.addClip(c)
    })

    setComboText('', 0)

    // Particles — nhiều hơn theo combo
    const cx = window.innerWidth / 2
    const cy = window.innerHeight / 2
    const particleCount = 6 + comboCount * 4
    const colorSets = [
      ['#FFD700', '#FFA500'],
      ['#FFD700', '#FFA500', '#FF6347'],
      ['#FFD700', '#FF69B4', '#00BFFF', '#7FFF00'],
      ['#FFD700', '#FF69B4', '#00BFFF', '#7FFF00', '#FF4500'],
    ]
    const colors = colorSets[Math.min(comboCount - 2, colorSets.length - 1)]
    this.particleEngine.spawnStarburst(cx, cy, particleCount, colors, ParticleType.STAR)

    // Thêm burst particles cho combo cao
    if (comboCount >= 4) {
      this.particleEngine.spawnBurst(cx, cy, '#FFD700', comboCount * 3, ParticleType.SPARK)
    }

    // Screen shake tăng dần
    if (comboCount >= 3) {
      this.shakeIntensity = Math.min((comboCount - 2) * 2, 10)
      this.shakeDuration = 150 + comboCount * 20
      this.shakeElapsed = 0
    }
  }

  /**
   * playStripedActivation(candy, dir, tileSize, particleEngine) — tia sáng quét 300ms.
   */
  async playStripedActivation(
    candy: Candy,
    dir: Direction,
    tileSize = 64,
    particleEngine?: ParticleEngine,
  ): Promise<void> {
    const pe = particleEngine ?? this.particleEngine
    const cx = candy.col * tileSize + tileSize / 2
    const cy = candy.row * tileSize + tileSize / 2
    const color = this._getCandyColor(candy.type)

    if (dir === Direction.LEFT || dir === Direction.RIGHT) {
      // Horizontal beam — spawn trail across full row
      const from = { x: 0, y: cy }
      const to = { x: 9 * tileSize, y: cy }
      pe.spawnTrail(from, to, color, ParticleType.TRAIL, 20)
    } else {
      // Vertical beam
      const from = { x: cx, y: 0 }
      const to = { x: cx, y: 9 * tileSize }
      pe.spawnTrail(from, to, color, ParticleType.TRAIL, 20)
    }

    await new Promise<void>((resolve) => {
      this.addClip(makeDelay(300, resolve))
    })
  }

  /**
   * playWrappedActivation(candy, tileSize, particleEngine) — 2 vòng tròn nở ra 550ms.
   */
  async playWrappedActivation(
    candy: Candy,
    tileSize = 64,
    particleEngine?: ParticleEngine,
  ): Promise<void> {
    const pe = particleEngine ?? this.particleEngine
    const cx = candy.col * tileSize + tileSize / 2
    const cy = candy.row * tileSize + tileSize / 2
    const color = this._getCandyColor(candy.type)

    // Ring 1: radius 0 → tileSize*1.5 in 250ms
    const ring1 = { radius: 0, opacity: 1.0 }
    await runParallel([
      makeTween(ring1 as unknown as Record<string, number>, 'radius', 0, tileSize * 1.5, 250, Easing.easeOutQuad),
      makeTween(ring1 as unknown as Record<string, number>, 'opacity', 1.0, 0.0, 250, Easing.easeInQuad),
    ], (c) => this.addClip(c))

    // Wait 100ms
    await new Promise<void>((resolve) => {
      this.addClip(makeDelay(100, resolve))
    })

    // Ring 2: radius 0 → tileSize*2.5 in 300ms
    const ring2 = { radius: 0, opacity: 1.0 }
    await runParallel([
      makeTween(ring2 as unknown as Record<string, number>, 'radius', 0, tileSize * 2.5, 300, Easing.easeOutQuad),
      makeTween(ring2 as unknown as Record<string, number>, 'opacity', 1.0, 0.0, 300, Easing.easeInQuad),
    ], (c) => this.addClip(c))

    // Spawn BURST particles
    pe.spawnBurst(cx, cy, color, 16, ParticleType.BURST)
  }

  /**
   * playColorBombActivation(candy, targetCandies, particleEngine) — tia sét đến từng mục tiêu.
   */
  async playColorBombActivation(
    candy: Candy,
    targetCandies: Candy[],
    particleEngine?: ParticleEngine,
    tileSize = 64,
  ): Promise<void> {
    const pe = particleEngine ?? this.particleEngine
    const srcX = candy.col * tileSize + tileSize / 2
    const srcY = candy.row * tileSize + tileSize / 2

    // Fire bolts to each target sequentially (staggered)
    const boltPromises: Promise<void>[] = []

    for (const target of targetCandies) {
      const tgtX = target.col * tileSize + tileSize / 2
      const tgtY = target.row * tileSize + tileSize / 2
      const dx = tgtX - srcX
      const dy = tgtY - srcY
      const distance = Math.sqrt(dx * dx + dy * dy)
      const boltDuration = 100 + distance * 0.3

      const p = new Promise<void>((resolve) => {
        const boltState = { t: 0 }
        const boltClip = makeTween(
          boltState as unknown as Record<string, number>,
          't', 0, 1, boltDuration, Easing.easeInQuad,
          () => {
            // On bolt arrival: spawn sparks at target
            pe.spawnBurst(tgtX, tgtY, this._getCandyColor(target.type), 4, ParticleType.SPARK)
            resolve()
          },
        )
        // Spawn trail along bolt path
        pe.spawnTrail({ x: srcX, y: srcY }, { x: tgtX, y: tgtY }, '#FFD700', ParticleType.TRAIL, 5)
        this.addClip(boltClip)
      })

      boltPromises.push(p)
    }

    await Promise.all(boltPromises)
  }
}
