// ============================================================
// Candy Crush Saga — Particle Engine
// Object pool + spark/star/burst/trail rendering
// ============================================================

import { Particle, ParticleType } from './types.ts'

const MAX_PARTICLES = 300
const POOL_SIZE = 200

// ---- helpers -----------------------------------------------

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

function createBlankParticle(): Particle {
  return {
    x: 0, y: 0,
    vx: 0, vy: 0,
    ax: 0, ay: 0,
    life: 0,
    decay: 0,
    size: 0,
    color: '#ffffff',
    type: ParticleType.SPARK,
    rotation: 0,
    rotationSpeed: 0,
  }
}

// ---- mini-star path helper ---------------------------------

function drawMiniStar(ctx: CanvasRenderingContext2D, size: number, color: string): void {
  const spikes = 5
  const outerR = size
  const innerR = size * 0.45
  ctx.beginPath()
  for (let i = 0; i < spikes * 2; i++) {
    const angle = (i * Math.PI) / spikes - Math.PI / 2
    const r = i % 2 === 0 ? outerR : innerR
    const x = Math.cos(angle) * r
    const y = Math.sin(angle) * r
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
  ctx.fillStyle = color
  ctx.fill()
}

// ============================================================
// ParticleEngine
// ============================================================

export class ParticleEngine {
  // Object pool — pre-allocated particles
  private readonly pool: Particle[] = []
  private poolIndex = 0

  // Active particles (subset of pool + overflow)
  private readonly active: Particle[] = []

  constructor() {
    for (let i = 0; i < POOL_SIZE; i++) {
      this.pool.push(createBlankParticle())
    }
  }

  // ---- pool allocation ------------------------------------

  private acquire(): Particle | null {
    if (this.active.length >= MAX_PARTICLES) return null

    // Try to grab from pool
    const start = this.poolIndex
    for (let i = 0; i < POOL_SIZE; i++) {
      const idx = (start + i) % POOL_SIZE
      const p = this.pool[idx]
      if (p.life <= 0) {
        this.poolIndex = (idx + 1) % POOL_SIZE
        return p
      }
    }

    // Pool exhausted but under MAX_PARTICLES — allocate extra
    return createBlankParticle()
  }

  private emit(p: Particle): void {
    this.active.push(p)
  }

  // ---- public spawn API -----------------------------------

  /**
   * Spawn particles in all directions from (x, y).
   * Req 10.1 — 8 SPARK per candy match; also used for BURST/STAR.
   */
  spawnBurst(x: number, y: number, color: string, count: number, type: ParticleType): void {
    for (let i = 0; i < count; i++) {
      const p = this.acquire()
      if (!p) break

      const angle = (i / count) * Math.PI * 2 + randomBetween(-0.3, 0.3)
      const speed = randomBetween(80, 200)

      p.x = x
      p.y = y
      p.vx = Math.cos(angle) * speed
      p.vy = Math.sin(angle) * speed
      p.ax = 0
      p.ay = 300
      p.life = 1.0
      p.decay = randomBetween(0.02, 0.04)
      p.size = randomBetween(3, 7)
      p.color = color
      p.type = type
      p.rotation = randomBetween(0, Math.PI * 2)
      p.rotationSpeed = randomBetween(-5, 5)

      this.emit(p)
    }
  }

  /**
   * Spawn particles evenly distributed along a straight line from→to.
   * Req 10.4 — TRAIL for striped candy activation.
   */
  spawnTrail(
    from: { x: number; y: number },
    to: { x: number; y: number },
    color: string,
    type: ParticleType,
    count: number,
  ): void {
    for (let i = 0; i < count; i++) {
      const p = this.acquire()
      if (!p) break

      const t = count > 1 ? i / (count - 1) : 0
      const px = from.x + (to.x - from.x) * t
      const py = from.y + (to.y - from.y) * t

      const angle = randomBetween(0, Math.PI * 2)
      const speed = randomBetween(20, 60)

      p.x = px
      p.y = py
      p.vx = Math.cos(angle) * speed
      p.vy = Math.sin(angle) * speed
      p.ax = 0
      p.ay = 80
      p.life = 1.0
      p.decay = randomBetween(0.025, 0.05)
      p.size = randomBetween(2, 5)
      p.color = color
      p.type = type
      p.rotation = randomBetween(0, Math.PI * 2)
      p.rotationSpeed = randomBetween(-3, 3)

      this.emit(p)
    }
  }

  /**
   * Spawn multi-color star-burst (combo effect).
   * Req 10.2 — STAR particles for combo.
   */
  spawnStarburst(
    x: number,
    y: number,
    count: number,
    colors: string[],
    type: ParticleType,
  ): void {
    for (let i = 0; i < count; i++) {
      const p = this.acquire()
      if (!p) break

      const angle = (i / count) * Math.PI * 2 + randomBetween(-0.5, 0.5)
      const speed = randomBetween(60, 180)
      const color = colors[i % colors.length]

      p.x = x
      p.y = y
      p.vx = Math.cos(angle) * speed
      p.vy = Math.sin(angle) * speed
      p.ax = 0
      p.ay = 150
      p.life = 1.0
      p.decay = randomBetween(0.015, 0.03)
      p.size = randomBetween(4, 9)
      p.color = color
      p.type = type
      p.rotation = randomBetween(0, Math.PI * 2)
      p.rotationSpeed = randomBetween(-6, 6)

      this.emit(p)
    }
  }

  // ---- update & render ------------------------------------

  /**
   * Update all active particles.
   * Req 10.6, 10.7 — update position/velocity, remove when life ≤ 0.
   * Property 19 — life decreases by exactly decay each frame.
   */
  updateParticles(deltaTime: number): void {
    const dt = deltaTime / 1000

    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i]

      p.vx += p.ax * dt
      p.vy += p.ay * dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.rotation += p.rotationSpeed * dt
      p.life -= p.decay

      if (p.life <= 0) {
        p.life = 0 // mark as free in pool
        this.active.splice(i, 1)
      }
    }
  }

  /**
   * Render all active particles onto the canvas.
   * Req 10.6 — SPARK (rect), STAR (mini-star), BURST (circle stroke), TRAIL (fading circle).
   */
  renderParticles(ctx: CanvasRenderingContext2D): void {
    for (const p of this.active) {
      ctx.save()
      ctx.globalAlpha = Math.max(0, p.life)
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rotation)

      switch (p.type) {
        case ParticleType.SPARK:
          ctx.fillStyle = p.color
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2)
          break

        case ParticleType.STAR:
          drawMiniStar(ctx, p.size, p.color)
          break

        case ParticleType.BURST:
          ctx.strokeStyle = p.color
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.arc(0, 0, p.size, 0, Math.PI * 2)
          ctx.stroke()
          break

        case ParticleType.TRAIL:
          ctx.fillStyle = p.color
          ctx.beginPath()
          ctx.arc(0, 0, p.size * p.life, 0, Math.PI * 2)
          ctx.fill()
          break
      }

      ctx.restore()
    }
  }

  /**
   * Remove all active particles and reset pool state.
   */
  clear(): void {
    for (const p of this.active) {
      p.life = 0
    }
    this.active.length = 0
    this.poolIndex = 0
  }

  /** Expose active count for debugging / tests. */
  get activeCount(): number {
    return this.active.length
  }
}
