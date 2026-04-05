// ============================================================
// Renderer — Vẽ toàn bộ game lên HTML5 Canvas
// Tích hợp VisualDesigner + ParticleEngine
// Design §4.5
// ============================================================

import { type Candy, type GameState } from './types.ts'
import { VisualDesigner } from './VisualDesigner.ts'
import { ParticleEngine } from './ParticleEngine.ts'
import { type IRenderer } from './GameManager.ts'

// Padding quanh lưới (px, trước khi scale)
const GRID_PADDING = 8

export class Renderer implements IRenderer {
  private readonly ctx: CanvasRenderingContext2D
  private readonly dpr: number
  private tileSize: number = 0
  private canvasWidth: number = 0
  private canvasHeight: number = 0

  // Kẹo đang được chọn (set bởi InputHandler / AnimationManager)
  private selectedCandy: Candy | null = null

  // Combo text hiển thị tạm thời
  private comboText: string | null = null
  private comboTextOpacity: number = 0

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly visualDesigner: VisualDesigner,
    private readonly particleEngine: ParticleEngine,
  ) {
    // Kiểm tra hỗ trợ Canvas
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error(
        'Canvas 2D context không được hỗ trợ trên trình duyệt này. ' +
        'Vui lòng sử dụng trình duyệt hiện đại hỗ trợ HTML5 Canvas.',
      )
    }
    this.ctx = ctx

    // devicePixelRatio cho retina display
    this.dpr = window.devicePixelRatio || 1

    // Tính tileSize ban đầu từ kích thước canvas hiện tại
    this.updateTileSize(canvas.width / this.dpr, canvas.height / this.dpr)
  }

  // ----------------------------------------------------------
  // resize — điều chỉnh canvas theo kích thước màn hình
  // ----------------------------------------------------------

  resize(width: number, height: number): void {
    this.canvasWidth = width
    this.canvasHeight = height

    // Áp dụng devicePixelRatio để hỗ trợ retina
    this.canvas.width = Math.round(width * this.dpr)
    this.canvas.height = Math.round(height * this.dpr)
    this.canvas.style.width = `${width}px`
    this.canvas.style.height = `${height}px`

    // Scale context theo dpr
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)

    // Cập nhật tileSize và xóa gradient cache
    this.updateTileSize(width, height)
    this.visualDesigner.invalidateCache()
  }

  private updateTileSize(width: number, height: number): void {
    this.canvasWidth = width
    this.canvasHeight = height
    // tileSize = chiều nhỏ hơn chia cho số ô (9), trừ padding
    const usable = Math.min(width, height) - GRID_PADDING * 2
    this.tileSize = usable / 9
  }

  // ----------------------------------------------------------
  // getTileSize — dùng cho InputHandler
  // ----------------------------------------------------------

  getTileSize(): number {
    return this.tileSize
  }

  getGridOffset(): { offsetX: number; offsetY: number } {
    const gridW = 9 * this.tileSize
    const gridH = 9 * this.tileSize
    return {
      offsetX: (this.canvasWidth - gridW) / 2,
      offsetY: (this.canvasHeight - gridH) / 2,
    }
  }

  // ----------------------------------------------------------
  // setSelectedCandy — lưu kẹo đang được chọn
  // ----------------------------------------------------------

  setSelectedCandy(candy: Candy | null): void {
    this.selectedCandy = candy
  }

  // ----------------------------------------------------------
  // setComboText — hiển thị combo text tạm thời
  // ----------------------------------------------------------

  setComboText(text: string, opacity: number): void {
    this.comboText = text
    this.comboTextOpacity = opacity
  }

  // ----------------------------------------------------------
  // render — pipeline render đầy đủ (design §4.5)
  // ----------------------------------------------------------

  render(state: GameState): void {
    const { ctx } = this
    const { board, score, highScore, comboCount } = state
    const { grid, rows, cols } = board

    // Tính offset để căn giữa lưới
    const gridW = cols * this.tileSize
    const gridH = rows * this.tileSize
    const offsetX = (this.canvasWidth - gridW) / 2
    const offsetY = (this.canvasHeight - gridH) / 2

    // 1. clearRect
    ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight)

    // 2. drawBackground
    this.drawBackground(ctx)

    // 3. drawGrid
    this.drawGrid(ctx, rows, cols, offsetX, offsetY)

    // 4. drawSelectGlow (vẽ trước kẹo)
    if (this.selectedCandy !== null) {
      this.drawSelectGlow(ctx, this.selectedCandy, offsetX, offsetY)
    }

    // 5. Vẽ tất cả kẹo thường (không phải kẹo được chọn)
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const candy = grid[row]?.[col]
        if (candy === null || candy === undefined) continue
        if (this.selectedCandy !== null && candy.id === this.selectedCandy.id) continue

        const cx = offsetX + col * this.tileSize + this.tileSize / 2 + (candy.animState.offsetX ?? 0)
        const cy = offsetY + row * this.tileSize + this.tileSize / 2 + (candy.animState.offsetY ?? 0)
        const radius = this.tileSize * 0.42

        this.visualDesigner.drawCandy(ctx, candy, cx, cy, radius, {
          scale: (candy.animState.selectScale ?? 1.0) * (candy.animState.scaleY ?? 1.0),
          opacity: candy.animState.opacity ?? 1.0,
          rotation: candy.animState.rotation ?? 0,
        })
      }
    }

    // 6. Vẽ kẹo được chọn (scale lớn hơn, vẽ sau cùng)
    if (this.selectedCandy !== null) {
      const sel = this.selectedCandy
      const cx = offsetX + sel.col * this.tileSize + this.tileSize / 2 + (sel.animState.offsetX ?? 0)
      const cy = offsetY + sel.row * this.tileSize + this.tileSize / 2 + (sel.animState.offsetY ?? 0)
      const radius = this.tileSize * 0.42

      this.visualDesigner.drawCandy(ctx, sel, cx, cy, radius, {
        scale: sel.animState.selectScale ?? 1.12,
        opacity: sel.animState.opacity ?? 1.0,
        rotation: sel.animState.rotation ?? 0,
        glowColor: 'rgba(255,255,255,0.4)',
        glowRadius: sel.animState.glowRadius ?? 1.0,
      })
    }

    // 7. particleEngine.renderParticles
    this.particleEngine.renderParticles(ctx)

    // 8. drawComboText (nếu có combo)
    if (this.comboText !== null && this.comboTextOpacity > 0) {
      this.drawComboText(ctx, this.comboText, this.comboTextOpacity)
    }

    // 9. drawHUD
    this.drawHUD(ctx, score, highScore, comboCount)
  }

  // ----------------------------------------------------------
  // drawBackground — nền gradient tím đậm
  // ----------------------------------------------------------

  private drawBackground(ctx: CanvasRenderingContext2D): void {
    const grad = ctx.createLinearGradient(0, 0, 0, this.canvasHeight)
    grad.addColorStop(0, '#1a0533')
    grad.addColorStop(0.5, '#2d0a4e')
    grad.addColorStop(1, '#1a0533')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight)
  }

  // ----------------------------------------------------------
  // drawGrid — ô lưới nhẹ
  // ----------------------------------------------------------

  private drawGrid(
    ctx: CanvasRenderingContext2D,
    rows: number,
    cols: number,
    offsetX: number,
    offsetY: number,
  ): void {
    ctx.save()
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'
    ctx.lineWidth = 1

    for (let row = 0; row <= rows; row++) {
      const y = offsetY + row * this.tileSize
      ctx.beginPath()
      ctx.moveTo(offsetX, y)
      ctx.lineTo(offsetX + cols * this.tileSize, y)
      ctx.stroke()
    }

    for (let col = 0; col <= cols; col++) {
      const x = offsetX + col * this.tileSize
      ctx.beginPath()
      ctx.moveTo(x, offsetY)
      ctx.lineTo(x, offsetY + rows * this.tileSize)
      ctx.stroke()
    }

    // Nền ô lưới nhẹ
    ctx.fillStyle = 'rgba(255,255,255,0.02)'
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if ((row + col) % 2 === 0) {
          ctx.fillRect(
            offsetX + col * this.tileSize,
            offsetY + row * this.tileSize,
            this.tileSize,
            this.tileSize,
          )
        }
      }
    }

    ctx.restore()
  }

  // ----------------------------------------------------------
  // drawSelectGlow — glow kẹo được chọn (vẽ trước kẹo)
  // ----------------------------------------------------------

  private drawSelectGlow(
    ctx: CanvasRenderingContext2D,
    candy: Candy,
    offsetX: number,
    offsetY: number,
  ): void {
    const cx = offsetX + candy.col * this.tileSize + this.tileSize / 2 + (candy.animState.offsetX ?? 0)
    const cy = offsetY + candy.row * this.tileSize + this.tileSize / 2 + (candy.animState.offsetY ?? 0)
    const r = this.tileSize * 0.42
    const glowRadius = candy.animState.glowRadius ?? 1.0

    const glowGrad = ctx.createRadialGradient(cx, cy, r * 0.8, cx, cy, r * glowRadius * 1.6)
    glowGrad.addColorStop(0, 'rgba(255,255,255,0.4)')
    glowGrad.addColorStop(1, 'rgba(255,255,255,0)')

    ctx.save()
    ctx.beginPath()
    ctx.arc(cx, cy, r * glowRadius * 1.6, 0, 2 * Math.PI)
    ctx.fillStyle = glowGrad
    ctx.fill()
    ctx.restore()
  }

  // ----------------------------------------------------------
  // drawComboText — hiển thị combo text
  // ----------------------------------------------------------

  private drawComboText(
    ctx: CanvasRenderingContext2D,
    text: string,
    opacity: number,
  ): void {
    ctx.save()
    ctx.globalAlpha = Math.max(0, Math.min(1, opacity))
    ctx.font = `bold ${Math.round(this.tileSize * 0.8)}px Arial, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#FFD700'
    ctx.shadowColor = 'rgba(255,165,0,0.8)'
    ctx.shadowBlur = 12
    ctx.fillText(text, this.canvasWidth / 2, this.canvasHeight / 2)
    ctx.restore()
  }

  // ----------------------------------------------------------
  // drawHUD — điểm, highScore, combo
  // ----------------------------------------------------------

  drawHUD(
    ctx: CanvasRenderingContext2D,
    score: number,
    highScore: number,
    comboCount: number,
  ): void {
    const fontSize = Math.max(12, Math.round(this.tileSize * 0.38))
    ctx.save()

    // Nền HUD phía trên
    const hudH = fontSize * 2.8
    const hudGrad = ctx.createLinearGradient(0, 0, 0, hudH)
    hudGrad.addColorStop(0, 'rgba(0,0,0,0.55)')
    hudGrad.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = hudGrad
    ctx.fillRect(0, 0, this.canvasWidth, hudH)

    ctx.font = `bold ${fontSize}px Arial, sans-serif`
    ctx.textBaseline = 'top'

    // Score (trái)
    ctx.textAlign = 'left'
    ctx.fillStyle = 'rgba(255,255,255,0.6)'
    ctx.fillText('ĐIỂM', 12, 8)
    ctx.font = `bold ${Math.round(fontSize * 1.4)}px Arial, sans-serif`
    ctx.fillStyle = '#FFFFFF'
    ctx.fillText(score.toLocaleString(), 12, 8 + fontSize * 0.9)

    // High Score (giữa)
    ctx.font = `bold ${fontSize}px Arial, sans-serif`
    ctx.textAlign = 'center'
    ctx.fillStyle = 'rgba(255,255,255,0.6)'
    ctx.fillText('CAO NHẤT', this.canvasWidth / 2, 8)
    ctx.font = `bold ${Math.round(fontSize * 1.4)}px Arial, sans-serif`
    ctx.fillStyle = '#FFD700'
    ctx.fillText(highScore.toLocaleString(), this.canvasWidth / 2, 8 + fontSize * 0.9)

    // Combo (phải)
    if (comboCount >= 2) {
      ctx.font = `bold ${fontSize}px Arial, sans-serif`
      ctx.textAlign = 'right'
      ctx.fillStyle = 'rgba(255,255,255,0.6)'
      ctx.fillText('COMBO', this.canvasWidth - 12, 8)
      ctx.font = `bold ${Math.round(fontSize * 1.4)}px Arial, sans-serif`
      ctx.fillStyle = comboCount >= 5 ? '#FFD700' : comboCount >= 3 ? '#FF8C00' : '#FFFFFF'
      ctx.fillText(`×${comboCount}`, this.canvasWidth - 12, 8 + fontSize * 0.9)
    }

    ctx.restore()
  }
}
