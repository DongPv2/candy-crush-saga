// ============================================================
// VisualDesigner — Vẽ kẹo với hình dạng đặc trưng, gradient, highlight, shadow
// ============================================================

import {
  CandyType,
  CandyShape,
  SpecialType,
  type Candy,
  type CandyVisual,
  type DrawOptions,
} from './types.ts'

// --------------- Bảng màu §3.1 ---------------

export const CANDY_VISUALS: Record<CandyType, CandyVisual> = {
  [CandyType.RED]: {
    shape: CandyShape.HEART,
    baseColor: '#E8334A',
    gradientTop: '#FF6B7A',
    gradientBottom: '#B01E30',
    highlightColor: 'rgba(255,255,255,0.6)',
    shadowColor: 'rgba(176,30,48,0.5)',
    rimColor: '#8B1220',
  },
  [CandyType.ORANGE]: {
    shape: CandyShape.DIAMOND,
    baseColor: '#F5820D',
    gradientTop: '#FFB347',
    gradientBottom: '#C45E00',
    highlightColor: 'rgba(255,255,255,0.55)',
    shadowColor: 'rgba(196,94,0,0.5)',
    rimColor: '#8B4200',
  },
  [CandyType.YELLOW]: {
    shape: CandyShape.STAR,
    baseColor: '#F5D000',
    gradientTop: '#FFE94D',
    gradientBottom: '#C4A000',
    highlightColor: 'rgba(255,255,255,0.65)',
    shadowColor: 'rgba(196,160,0,0.5)',
    rimColor: '#8B7200',
  },
  [CandyType.GREEN]: {
    shape: CandyShape.CLOVER,
    baseColor: '#2ECC40',
    gradientTop: '#5EE87A',
    gradientBottom: '#1A8A28',
    highlightColor: 'rgba(255,255,255,0.5)',
    shadowColor: 'rgba(26,138,40,0.5)',
    rimColor: '#0F5A18',
  },
  [CandyType.BLUE]: {
    shape: CandyShape.CIRCLE,
    baseColor: '#0074D9',
    gradientTop: '#4AABFF',
    gradientBottom: '#004A8F',
    highlightColor: 'rgba(255,255,255,0.6)',
    shadowColor: 'rgba(0,74,143,0.5)',
    rimColor: '#003060',
  },
  [CandyType.PURPLE]: {
    shape: CandyShape.HEXAGON,
    baseColor: '#9B59B6',
    gradientTop: '#C47FD5',
    gradientBottom: '#6C3483',
    highlightColor: 'rgba(255,255,255,0.55)',
    shadowColor: 'rgba(108,52,131,0.5)',
    rimColor: '#4A1F5C',
  },
}

// --------------- Gradient Cache ---------------

// Key: `${CandyType}-body-${radius}` — cache gradient theo loại kẹo và bán kính
// CanvasGradient gắn với context nên cache theo context reference + key
type GradientCache = Map<string, CanvasGradient>

// --------------- VisualDesigner Class ---------------

export class VisualDesigner {
  private readonly visuals: Record<CandyType, CandyVisual> = CANDY_VISUALS
  // Cache gradient theo context + key để tránh tạo lại mỗi frame
  private gradientCache: GradientCache = new Map()
  private lastCtx: CanvasRenderingContext2D | null = null

  /** Xóa cache khi context thay đổi (ví dụ resize canvas) */
  invalidateCache(): void {
    this.gradientCache.clear()
    this.lastCtx = null
  }

  private getOrCreateGradient(
    ctx: CanvasRenderingContext2D,
    key: string,
    factory: () => CanvasGradient,
  ): CanvasGradient {
    // Nếu context thay đổi, xóa cache cũ
    if (ctx !== this.lastCtx) {
      this.gradientCache.clear()
      this.lastCtx = ctx
    }
    let grad = this.gradientCache.get(key)
    if (!grad) {
      grad = factory()
      this.gradientCache.set(key, grad)
    }
    return grad
  }

  // ----------------------------------------------------------------
  // Public API — §3.2 Pipeline 5 lớp
  // ----------------------------------------------------------------

  drawCandy(
    ctx: CanvasRenderingContext2D,
    candy: Candy,
    cx: number,
    cy: number,
    radius: number,
    opts: DrawOptions,
  ): void {
    const visual = this.visuals[candy.type]
    const r = radius * opts.scale

    ctx.save()
    ctx.globalAlpha = opts.opacity
    ctx.translate(cx, cy)
    ctx.rotate(opts.rotation)

    // Glow khi được chọn
    if (opts.glowColor && opts.glowRadius && opts.glowRadius > 0) {
      this.drawGlow(ctx, r, opts.glowColor, opts.glowRadius)
    }

    // Layer 1: Bóng đổ
    this.drawDropShadow(ctx, candy.type, r, visual.shadowColor)

    // Layer 2: Thân kẹo
    this.drawCandyBody(ctx, candy.type, r, visual)

    // Layer 3: Viền ngoài
    this.drawCandyRim(ctx, candy.type, r, visual.rimColor)

    // Layer 4: Highlight
    this.drawHighlight(ctx, r, visual.highlightColor)

    // Layer 5: Icon đặc biệt
    if (candy.special !== SpecialType.NORMAL) {
      this.drawSpecialIcon(ctx, candy.special, r)
    }

    ctx.restore()
  }

  // ----------------------------------------------------------------
  // Layer 1 — Drop Shadow §3.4
  // ----------------------------------------------------------------

  private drawDropShadow(
    ctx: CanvasRenderingContext2D,
    type: CandyType,
    r: number,
    shadowColor: string,
  ): void {
    ctx.save()
    ctx.shadowColor = shadowColor
    ctx.shadowBlur = r * 0.4
    ctx.shadowOffsetX = r * 0.05
    ctx.shadowOffsetY = r * 0.1
    this.drawCandyOutline(ctx, type, r)
    ctx.restore()
  }

  // Vẽ outline (fill) để shadow engine có hình dạng đúng
  private drawCandyOutline(
    ctx: CanvasRenderingContext2D,
    type: CandyType,
    r: number,
  ): void {
    const visual = this.visuals[type]
    ctx.fillStyle = visual.baseColor
    this.buildCandyPath(ctx, type, r)
    ctx.fill()
  }

  // ----------------------------------------------------------------
  // Layer 2 — Thân kẹo §3.3
  // ----------------------------------------------------------------

  private drawCandyBody(
    ctx: CanvasRenderingContext2D,
    type: CandyType,
    r: number,
    visual: CandyVisual,
  ): void {
    switch (visual.shape) {
      case CandyShape.HEART:    this.drawHeart(ctx, r, visual); break
      case CandyShape.DIAMOND:  this.drawDiamond(ctx, r, visual); break
      case CandyShape.STAR:     this.drawStar6(ctx, r, visual); break
      case CandyShape.CLOVER:   this.drawClover(ctx, r, visual); break
      case CandyShape.CIRCLE:   this.drawWaveCircle(ctx, r, visual); break
      case CandyShape.HEXAGON:  this.drawHexagon(ctx, r, visual); break
    }
  }

  // ----------------------------------------------------------------
  // Layer 3 — Viền ngoài (Rim)
  // ----------------------------------------------------------------

  private drawCandyRim(
    ctx: CanvasRenderingContext2D,
    type: CandyType,
    r: number,
    rimColor: string,
  ): void {
    ctx.save()
    ctx.strokeStyle = rimColor
    ctx.lineWidth = r * 0.06
    this.buildCandyPath(ctx, type, r)
    ctx.stroke()
    ctx.restore()
  }

  // ----------------------------------------------------------------
  // Layer 4 — Highlight §3.4
  // ----------------------------------------------------------------

  private drawHighlight(
    ctx: CanvasRenderingContext2D,
    r: number,
    highlightColor: string,
  ): void {
    const grad = ctx.createRadialGradient(
      -r * 0.3, -r * 0.35, 0,
      -r * 0.3, -r * 0.35, r * 0.5,
    )
    grad.addColorStop(0, highlightColor)
    grad.addColorStop(1, 'rgba(255,255,255,0)')

    ctx.beginPath()
    ctx.ellipse(-r * 0.25, -r * 0.3, r * 0.35, r * 0.22, -Math.PI / 4, 0, 2 * Math.PI)
    ctx.fillStyle = grad
    ctx.fill()
  }

  // ----------------------------------------------------------------
  // Glow (select)
  // ----------------------------------------------------------------

  private drawGlow(
    ctx: CanvasRenderingContext2D,
    r: number,
    glowColor: string,
    glowRadius: number,
  ): void {
    const outerR = r * glowRadius * 1.6
    const grad = ctx.createRadialGradient(0, 0, r * 0.8, 0, 0, outerR)
    grad.addColorStop(0, glowColor)
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.beginPath()
    ctx.arc(0, 0, outerR, 0, 2 * Math.PI)
    ctx.fillStyle = grad
    ctx.fill()
  }

  // ----------------------------------------------------------------
  // Hình dạng §3.3 — buildCandyPath (dùng cho rim & shadow)
  // ----------------------------------------------------------------

  private buildCandyPath(
    ctx: CanvasRenderingContext2D,
    type: CandyType,
    r: number,
  ): void {
    const shape = this.visuals[type].shape
    switch (shape) {
      case CandyShape.HEART:   this.buildHeartPath(ctx, r); break
      case CandyShape.DIAMOND: this.buildDiamondPath(ctx, r); break
      case CandyShape.STAR:    this.buildStar6Path(ctx, r); break
      case CandyShape.CLOVER:  this.buildCloverPath(ctx, r); break
      case CandyShape.CIRCLE:  this.buildWaveCirclePath(ctx, r); break
      case CandyShape.HEXAGON: this.buildHexagonPath(ctx, r); break
    }
  }

  // ----------------------------------------------------------------
  // RED — Trái Tim §3.3
  // ----------------------------------------------------------------

  private buildHeartPath(ctx: CanvasRenderingContext2D, r: number): void {
    ctx.beginPath()
    ctx.moveTo(0, r * 0.3)
    ctx.bezierCurveTo(-r * 1.0, -r * 0.1, -r * 1.0, -r * 0.8, -r * 0.5, -r * 0.8)
    ctx.bezierCurveTo(-r * 0.2, -r * 0.8, 0, -r * 0.5, 0, -r * 0.3)
    ctx.bezierCurveTo(0, -r * 0.5, r * 0.2, -r * 0.8, r * 0.5, -r * 0.8)
    ctx.bezierCurveTo(r * 1.0, -r * 0.8, r * 1.0, -r * 0.1, 0, r * 0.3)
    ctx.closePath()
  }

  private drawHeart(ctx: CanvasRenderingContext2D, r: number, visual: CandyVisual): void {
    const key = `heart-${r}`
    const grad = this.getOrCreateGradient(ctx, key, () => {
      const g = ctx.createRadialGradient(-r * 0.2, -r * 0.3, r * 0.1, 0, 0, r)
      g.addColorStop(0, visual.gradientTop)
      g.addColorStop(1, visual.gradientBottom)
      return g
    })

    this.buildHeartPath(ctx, r)
    ctx.fillStyle = grad
    ctx.fill()
  }

  // ----------------------------------------------------------------
  // ORANGE — Hình Thoi §3.3
  // ----------------------------------------------------------------

  private buildDiamondPath(ctx: CanvasRenderingContext2D, r: number): void {
    ctx.beginPath()
    ctx.moveTo(0, -r)
    ctx.lineTo(r * 0.75, 0)
    ctx.lineTo(0, r)
    ctx.lineTo(-r * 0.75, 0)
    ctx.closePath()
  }

  private drawDiamond(ctx: CanvasRenderingContext2D, r: number, visual: CandyVisual): void {
    const key = `diamond-${r}`
    const grad = this.getOrCreateGradient(ctx, key, () => {
      const g = ctx.createLinearGradient(-r * 0.5, -r, r * 0.5, r)
      g.addColorStop(0, visual.gradientTop)
      g.addColorStop(0.5, visual.baseColor)
      g.addColorStop(1, visual.gradientBottom)
      return g
    })

    this.buildDiamondPath(ctx, r)
    ctx.fillStyle = grad
    ctx.fill()

    this.drawDiamondFacets(ctx, r, visual.rimColor)
  }

  private drawDiamondFacets(ctx: CanvasRenderingContext2D, r: number, rimColor: string): void {
    ctx.save()
    ctx.strokeStyle = rimColor
    ctx.lineWidth = r * 0.04
    ctx.globalAlpha = 0.4

    // Đường chéo ngang giữa
    ctx.beginPath()
    ctx.moveTo(-r * 0.75, 0)
    ctx.lineTo(r * 0.75, 0)
    ctx.stroke()

    // Đường từ đỉnh trên xuống hai bên
    ctx.beginPath()
    ctx.moveTo(0, -r)
    ctx.lineTo(-r * 0.35, -r * 0.2)
    ctx.moveTo(0, -r)
    ctx.lineTo(r * 0.35, -r * 0.2)
    ctx.stroke()

    ctx.restore()
  }

  // ----------------------------------------------------------------
  // YELLOW — Ngôi Sao 6 Cánh §3.3
  // ----------------------------------------------------------------

  private buildStar6Path(ctx: CanvasRenderingContext2D, r: number): void {
    ctx.beginPath()
    for (let i = 0; i < 12; i++) {
      const angle = (i * Math.PI) / 6 - Math.PI / 2
      const radius = i % 2 === 0 ? r : r * 0.5
      const x = Math.cos(angle) * radius
      const y = Math.sin(angle) * radius
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.closePath()
  }

  private drawStar6(ctx: CanvasRenderingContext2D, r: number, visual: CandyVisual): void {
    const key = `star6-${r}`
    const grad = this.getOrCreateGradient(ctx, key, () => {
      const g = ctx.createRadialGradient(0, -r * 0.2, r * 0.1, 0, 0, r)
      g.addColorStop(0, visual.gradientTop)
      g.addColorStop(1, visual.gradientBottom)
      return g
    })

    this.buildStar6Path(ctx, r)
    ctx.fillStyle = grad
    ctx.fill()
  }

  // ----------------------------------------------------------------
  // GREEN — Lá Cỏ 4 Lá §3.3
  // ----------------------------------------------------------------

  private buildCloverPath(ctx: CanvasRenderingContext2D, r: number): void {
    // Dùng path tổng hợp 4 arc
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2
      const lx = Math.cos(angle) * r * 0.45
      const ly = Math.sin(angle) * r * 0.45
      ctx.beginPath()
      ctx.arc(lx, ly, r * 0.48, 0, 2 * Math.PI)
    }
  }

  private drawClover(ctx: CanvasRenderingContext2D, r: number, visual: CandyVisual): void {
    const key = `clover-${r}`
    const grad = this.getOrCreateGradient(ctx, key, () => {
      const g = ctx.createRadialGradient(0, 0, r * 0.1, 0, 0, r)
      g.addColorStop(0, visual.gradientTop)
      g.addColorStop(1, visual.gradientBottom)
      return g
    })

    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2
      const lx = Math.cos(angle) * r * 0.45
      const ly = Math.sin(angle) * r * 0.45
      ctx.beginPath()
      ctx.arc(lx, ly, r * 0.48, 0, 2 * Math.PI)
      ctx.fillStyle = grad
      ctx.fill()
    }
  }

  // ----------------------------------------------------------------
  // BLUE — Tròn Gợn Sóng §3.3
  // ----------------------------------------------------------------

  private buildWaveCirclePath(ctx: CanvasRenderingContext2D, r: number): void {
    const waves = 8
    const total = waves * 2
    ctx.beginPath()
    for (let i = 0; i <= total; i++) {
      const angle = (i / total) * 2 * Math.PI
      const waveR = r + (i % 2 === 0 ? r * 0.08 : -r * 0.04)
      const x = Math.cos(angle) * waveR
      const y = Math.sin(angle) * waveR
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.closePath()
  }

  private drawWaveCircle(ctx: CanvasRenderingContext2D, r: number, visual: CandyVisual): void {
    const key = `wave-${r}`
    const grad = this.getOrCreateGradient(ctx, key, () => {
      const g = ctx.createRadialGradient(-r * 0.25, -r * 0.25, r * 0.05, 0, 0, r)
      g.addColorStop(0, visual.gradientTop)
      g.addColorStop(1, visual.gradientBottom)
      return g
    })

    this.buildWaveCirclePath(ctx, r)
    ctx.fillStyle = grad
    ctx.fill()
  }

  // ----------------------------------------------------------------
  // PURPLE — Lục Giác §3.3
  // ----------------------------------------------------------------

  private buildHexagonPath(ctx: CanvasRenderingContext2D, r: number): void {
    ctx.beginPath()
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3 - Math.PI / 6
      const x = Math.cos(angle) * r
      const y = Math.sin(angle) * r
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.closePath()
  }

  private drawHexagon(ctx: CanvasRenderingContext2D, r: number, visual: CandyVisual): void {
    const key = `hexagon-${r}`
    const grad = this.getOrCreateGradient(ctx, key, () => {
      const g = ctx.createLinearGradient(0, -r, 0, r)
      g.addColorStop(0, visual.gradientTop)
      g.addColorStop(1, visual.gradientBottom)
      return g
    })

    this.buildHexagonPath(ctx, r)
    ctx.fillStyle = grad
    ctx.fill()
  }

  // ----------------------------------------------------------------
  // Layer 5 — Icon Kẹo Đặc Biệt §3.5
  // ----------------------------------------------------------------

  private drawSpecialIcon(
    ctx: CanvasRenderingContext2D,
    special: SpecialType,
    r: number,
  ): void {
    switch (special) {
      case SpecialType.STRIPED_H:
        this.drawStripedH(ctx, r)
        break
      case SpecialType.STRIPED_V:
        this.drawStripedV(ctx, r)
        break
      case SpecialType.WRAPPED:
        this.drawWrappedIcon(ctx, r)
        break
      case SpecialType.COLOR_BOMB:
        this.drawColorBombIcon(ctx, r)
        break
    }
  }

  // 3 sọc ngang
  private drawStripedH(ctx: CanvasRenderingContext2D, r: number): void {
    ctx.fillStyle = 'rgba(255,255,255,0.7)'
    for (let i = -1; i <= 1; i++) {
      ctx.fillRect(-r * 0.7, i * r * 0.25 - r * 0.06, r * 1.4, r * 0.12)
    }
  }

  // 3 sọc dọc
  private drawStripedV(ctx: CanvasRenderingContext2D, r: number): void {
    ctx.fillStyle = 'rgba(255,255,255,0.7)'
    for (let i = -1; i <= 1; i++) {
      ctx.fillRect(i * r * 0.25 - r * 0.06, -r * 0.7, r * 0.12, r * 1.4)
    }
  }

  // Hình thoi outline
  private drawWrappedIcon(ctx: CanvasRenderingContext2D, r: number): void {
    ctx.save()
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'
    ctx.lineWidth = r * 0.08
    ctx.beginPath()
    ctx.moveTo(0, -r * 0.45)
    ctx.lineTo(r * 0.35, 0)
    ctx.lineTo(0, r * 0.45)
    ctx.lineTo(-r * 0.35, 0)
    ctx.closePath()
    ctx.stroke()
    ctx.restore()
  }

  // Quả cầu đen + 6 chấm màu
  private drawColorBombIcon(ctx: CanvasRenderingContext2D, r: number): void {
    // Quả cầu đen
    ctx.fillStyle = 'rgba(0,0,0,0.6)'
    ctx.beginPath()
    ctx.arc(0, 0, r * 0.5, 0, 2 * Math.PI)
    ctx.fill()

    // 6 chấm màu
    const colors = ['#FF4444', '#FF8800', '#FFEE00', '#44FF44', '#4488FF', '#AA44FF']
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3
      ctx.fillStyle = colors[i]
      ctx.beginPath()
      ctx.arc(
        Math.cos(angle) * r * 0.65,
        Math.sin(angle) * r * 0.65,
        r * 0.12,
        0,
        2 * Math.PI,
      )
      ctx.fill()
    }
  }
}
