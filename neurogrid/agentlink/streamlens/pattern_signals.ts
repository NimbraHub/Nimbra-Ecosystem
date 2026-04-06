import fetch from "node-fetch"

/*------------------------------------------------------
 * Types
 *----------------------------------------------------*/

interface Candle {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
}

export type CandlestickPattern =
  | "Hammer"
  | "ShootingStar"
  | "BullishEngulfing"
  | "BearishEngulfing"
  | "Doji"

export interface PatternSignal {
  timestamp: number
  pattern: CandlestickPattern
  confidence: number // 0..1
}

export interface DetectOptions {
  minConfidence?: number          // default 0.4
  maxSignals?: number             // optional hard cap
  dedupeSameTimestamp?: boolean   // default true
}

/*------------------------------------------------------
 * Detector
 *----------------------------------------------------*/

export class CandlestickPatternDetector {
  constructor(private readonly apiUrl: string) {}

  /* Fetch recent OHLC candles */
  async fetchCandles(symbol: string, limit = 100): Promise<Candle[]> {
    const res = await fetch(`${this.apiUrl}/markets/${symbol}/candles?limit=${limit}`, {
      timeout: 10_000,
    })
    if (!res.ok) {
      throw new Error(`Failed to fetch candles ${res.status}: ${res.statusText}`)
    }
    const data = (await res.json()) as Candle[]
    return this.normalizeCandles(data)
  }

  /* Ensure numeric fields and ascending timestamp order */
  private normalizeCandles(candles: Candle[]): Candle[] {
    const x = candles
      .map(c => ({
        timestamp: Number(c.timestamp),
        open: Number(c.open),
        high: Number(c.high),
        low: Number(c.low),
        close: Number(c.close),
      }))
      .filter(c => Number.isFinite(c.timestamp))
      .sort((a, b) => a.timestamp - b.timestamp)
    return x
  }

  /* ------------------------- Pattern helpers ---------------------- */

  private isHammer(c: Candle): number {
    const body = Math.abs(c.close - c.open)
    const total = c.high - c.low
    if (total <= 0) return 0
    const lowerWick = Math.min(c.open, c.close) - c.low
    const upperWick = c.high - Math.max(c.open, c.close)
    if (upperWick > body * 0.6) return 0
    const ratio = body > 0 ? lowerWick / body : 0
    const bodyShare = body / total
    if (ratio > 2 && bodyShare < 0.35) {
      return Math.min((ratio / 3) * (1 - bodyShare), 1)
    }
    return 0
  }

  private isShootingStar(c: Candle): number {
    const body = Math.abs(c.close - c.open)
    const total = c.high - c.low
    if (total <= 0) return 0
    const upperWick = c.high - Math.max(c.open, c.close)
    const lowerWick = Math.min(c.open, c.close) - c.low
    if (lowerWick > body * 0.6) return 0
    const ratio = body > 0 ? upperWick / body : 0
    const bodyShare = body / total
    if (ratio > 2 && bodyShare < 0.35) {
      return Math.min((ratio / 3) * (1 - bodyShare), 1)
    }
    return 0
  }

  private isBullishEngulfing(prev: Candle, curr: Candle): number {
    const cond =
      curr.close > curr.open &&
      prev.close < prev.open &&
      curr.close >= Math.max(prev.close, prev.open) &&
      curr.open <= Math.min(prev.close, prev.open)
    if (!cond) return 0
    const bodyPrev = Math.abs(prev.close - prev.open)
    const bodyCurr = Math.abs(curr.close - curr.open)
    const ratio = bodyPrev > 0 ? bodyCurr / bodyPrev : 1
    return Math.min(0.6 + Math.min(ratio, 1) * 0.4, 1)
  }

  private isBearishEngulfing(prev: Candle, curr: Candle): number {
    const cond =
      curr.close < curr.open &&
      prev.close > prev.open &&
      curr.open >= Math.min(prev.close, prev.open) &&
      curr.close <= Math.max(prev.close, prev.open)
    if (!cond) return 0
    const bodyPrev = Math.abs(prev.close - prev.open)
    const bodyCurr = Math.abs(curr.close - curr.open)
    const ratio = bodyPrev > 0 ? bodyCurr / bodyPrev : 1
    return Math.min(0.6 + Math.min(ratio, 1) * 0.4, 1)
  }

  private isDoji(c: Candle): number {
    const range = c.high - c.low
    const body = Math.abs(c.close - c.open)
    if (range <= 0) return 0
    const ratio = body / range
    return ratio < 0.1 ? 1 - ratio * 10 : 0
  }

  /* ------------------------- Detection API ------------------------ */

  /**
   * Detect patterns on a prepared candles array.
   */
  detectOnCandles(candles: Candle[], opts: DetectOptions = {}): PatternSignal[] {
    const minConfidence = opts.minConfidence ?? 0.4
    const dedupe = opts.dedupeSameTimestamp ?? true
    const signals: PatternSignal[] = []

    for (let i = 0; i < candles.length; i++) {
      const c = candles[i]
      const prev = candles[i - 1]

      const hammer = this.isHammer(c)
      if (hammer >= minConfidence) {
        signals.push({ timestamp: c.timestamp, pattern: "Hammer", confidence: this.clamp01(hammer) })
      }

      const star = this.isShootingStar(c)
      if (star >= minConfidence) {
        signals.push({ timestamp: c.timestamp, pattern: "ShootingStar", confidence: this.clamp01(star) })
      }

      if (prev) {
        const bull = this.isBullishEngulfing(prev, c)
        if (bull >= minConfidence) {
          signals.push({ timestamp: c.timestamp, pattern: "BullishEngulfing", confidence: this.clamp01(bull) })
        }
        const bear = this.isBearishEngulfing(prev, c)
        if (bear >= minConfidence) {
          signals.push({ timestamp: c.timestamp, pattern: "BearishEngulfing", confidence: this.clamp01(bear) })
        }
      }

      const doji = this.isDoji(c)
      if (doji >= minConfidence) {
        signals.push({ timestamp: c.timestamp, pattern: "Doji", confidence: this.clamp01(doji) })
      }
    }

    const deduped = dedupe ? this.dedupeByTimestamp(signals) : signals
    if (opts.maxSignals && opts.maxSignals > 0) {
      return deduped
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, opts.maxSignals)
    }
    return deduped
  }

  /**
   * Convenience method: fetch candles then detect.
   */
  async detectRecent(symbol: string, limit = 100, opts: DetectOptions = {}): Promise<PatternSignal[]> {
    const candles = await this.fetchCandles(symbol, limit)
    return this.detectOnCandles(candles, opts)
  }

  /* ------------------------- Utilities ---------------------------- */

  private clamp01(x: number): number {
    if (!Number.isFinite(x)) return 0
    return Math.max(0, Math.min(1, x))
  }

  /**
   * Keep only the highest-confidence signal per timestamp per pattern.
   * If multiple patterns share the same timestamp, keep them all but
   * dedupe duplicates of the same pattern.
   */
  private dedupeByTimestamp(signals: PatternSignal[]): PatternSignal[] {
    const map = new Map<string, PatternSignal>()
    for (const s of signals) {
      const key = `${s.timestamp}:${s.pattern}`
      const prev = map.get(key)
      if (!prev || s.confidence > prev.confidence) {
        map.set(key, s)
      }
    }
    return Array.from(map.values())
  }
}
