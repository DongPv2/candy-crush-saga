// ── Web Audio Sound Engine ────────────────────────────────────
// Dùng Web Audio API để tạo âm thanh procedural, không cần file

let ctx: AudioContext | null = null

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext()
  // Resume nếu bị suspend (browser policy)
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

function playTone(
  freq: number,
  type: OscillatorType,
  duration: number,
  volume: number,
  freqEnd?: number,
) {
  try {
    const ac = getCtx()
    const osc = ac.createOscillator()
    const gain = ac.createGain()
    osc.connect(gain)
    gain.connect(ac.destination)

    osc.type = type
    osc.frequency.setValueAtTime(freq, ac.currentTime)
    if (freqEnd !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(freqEnd, ac.currentTime + duration)
    }

    gain.gain.setValueAtTime(volume, ac.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration)

    osc.start(ac.currentTime)
    osc.stop(ac.currentTime + duration)
  } catch {
    // Audio không khả dụng — bỏ qua
  }
}

export const Sound = {
  /** Tiếng swap kẹo */
  swap() {
    playTone(440, 'sine', 0.08, 0.15, 520)
  },

  /** Tiếng swap không hợp lệ */
  invalidSwap() {
    playTone(200, 'square', 0.12, 0.1, 150)
  },

  /** Tiếng kẹo nổ (match) */
  match(count: number) {
    // Nhiều kẹo → âm thanh to hơn và cao hơn
    const freq = 500 + count * 30
    playTone(freq, 'sine', 0.15, Math.min(0.3, 0.1 + count * 0.02), freq * 1.5)
  },

  /** Tiếng kẹo rơi */
  fall() {
    playTone(300, 'sine', 0.1, 0.08, 200)
  },

  /** Tiếng combo */
  combo(level: number) {
    // Mỗi level combo cao hơn 1 nốt
    const notes = [523, 659, 784, 1047, 1319]
    const freq = notes[Math.min(level - 3, notes.length - 1)] ?? 1319
    playTone(freq, 'triangle', 0.25, 0.25, freq * 1.2)
    // Thêm nốt thứ 2 sau 80ms
    setTimeout(() => playTone(freq * 1.25, 'sine', 0.2, 0.2), 80)
  },

  /** Tiếng shuffle */
  shuffle() {
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        playTone(200 + i * 80, 'sawtooth', 0.08, 0.08)
      }, i * 60)
    }
  },

  /** Tiếng game over */
  gameOver() {
    const notes = [523, 440, 349, 262]
    notes.forEach((freq, i) => {
      setTimeout(() => playTone(freq, 'sine', 0.4, 0.2), i * 200)
    })
  },

  /** Tiếng phá kỷ lục */
  newRecord() {
    const notes = [523, 659, 784, 1047]
    notes.forEach((freq, i) => {
      setTimeout(() => playTone(freq, 'triangle', 0.2, 0.25), i * 100)
    })
  },
}
