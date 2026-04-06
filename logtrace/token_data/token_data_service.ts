export interface TokenDataPoint {
  timestamp: number
  priceUsd: number
  volumeUsd: number
  marketCapUsd: number
}

export class TokenDataFetcher {
  constructor(
    private apiBase: string,
    private timeoutMs: number = 10000,
    private debug: boolean = false
  ) {}

  /**
   * Fetches an array of TokenDataPoint for the given token symbol.
   * Expects endpoint: `${apiBase}/tokens/${symbol}/history`
   */
  async fetchHistory(symbol: string): Promise<TokenDataPoint[]> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      const res = await fetch(
        `${this.apiBase}/tokens/${encodeURIComponent(symbol)}/history`,
        { signal: controller.signal }
      )
      if (!res.ok) {
        throw new Error(`Failed to fetch history for ${symbol}: ${res.status}`)
      }
      const raw = (await res.json()) as any[]
      return raw.map(r => ({
        timestamp: (r.time ?? r.timestamp) * 1000,
        priceUsd: Number(r.priceUsd ?? r.price),
        volumeUsd: Number(r.volumeUsd ?? r.volume),
        marketCapUsd: Number(r.marketCapUsd ?? r.marketCap),
      }))
    } catch (err: any) {
      if (this.debug) {
        console.error(`[TokenDataFetcher] Error fetching ${symbol}:`, err.message)
      }
      throw err
    } finally {
      clearTimeout(timer)
    }
  }

  /**
   * Get the latest data point for a token.
   */
  async fetchLatest(symbol: string): Promise<TokenDataPoint | null> {
    const history = await this.fetchHistory(symbol)
    if (history.length === 0) return null
    return history[history.length - 1]
  }

  /**
   * Fetch multiple tokens in parallel.
   */
  async fetchMultiple(symbols: string[]): Promise<Record<string, TokenDataPoint[]>> {
    const results: Record<string, TokenDataPoint[]> = {}
    await Promise.all(
      symbols.map(async sym => {
        try {
          results[sym] = await this.fetchHistory(sym)
        } catch {
          results[sym] = []
        }
      })
    )
    return results
  }
}
