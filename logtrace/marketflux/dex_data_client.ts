export interface PairInfo {
  exchange: string
  pairAddress: string
  baseSymbol: string
  quoteSymbol: string
  liquidityUsd: number
  volume24hUsd: number
  priceUsd: number
  lastUpdated?: number
}

export interface DexSuiteConfig {
  apis: Array<{ name: string; baseUrl: string; apiKey?: string }>
  timeoutMs?: number
  debug?: boolean
}

export class DexSuite {
  constructor(private config: DexSuiteConfig) {}

  private async fetchFromApi<T>(
    api: { name: string; baseUrl: string; apiKey?: string },
    path: string
  ): Promise<T> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs ?? 10000)
    try {
      const res = await fetch(`${api.baseUrl}${path}`, {
        headers: api.apiKey ? { Authorization: `Bearer ${api.apiKey}` } : {},
        signal: controller.signal,
      })
      if (!res.ok) throw new Error(`${api.name} ${path} ${res.status}`)
      return (await res.json()) as T
    } finally {
      clearTimeout(timer)
    }
  }

  /**
   * Retrieve aggregated pair info across all configured DEX APIs.
   */
  async getPairInfo(pairAddress: string): Promise<PairInfo[]> {
    const results: PairInfo[] = []
    const tasks = this.config.apis.map(async api => {
      try {
        const data = await this.fetchFromApi<any>(api, `/pair/${pairAddress}`)
        results.push({
          exchange: api.name,
          pairAddress,
          baseSymbol: data.token0?.symbol ?? "UNKNOWN",
          quoteSymbol: data.token1?.symbol ?? "UNKNOWN",
          liquidityUsd: Number(data.liquidityUsd ?? 0),
          volume24hUsd: Number(data.volume24hUsd ?? 0),
          priceUsd: Number(data.priceUsd ?? 0),
          lastUpdated: Date.now(),
        })
      } catch (err: any) {
        if (this.config.debug) {
          console.warn(`[DexSuite] Failed to fetch from ${api.name}:`, err.message)
        }
      }
    })
    await Promise.all(tasks)
    return results
  }

  /**
   * Compare a list of pairs across exchanges, returning best volume and liquidity.
   */
  async comparePairs(
    pairs: string[]
  ): Promise<Record<string, { bestVolume?: PairInfo; bestLiquidity?: PairInfo }>> {
    const entries: Array<[string, { bestVolume?: PairInfo; bestLiquidity?: PairInfo }]> = []
    for (const addr of pairs) {
      const infos = await this.getPairInfo(addr)
      if (infos.length === 0) {
        entries.push([addr, {}])
        continue
      }
      const bestVolume = infos.reduce((a, b) =>
        b.volume24hUsd > a.volume24hUsd ? b : a
      )
      const bestLiquidity = infos.reduce((a, b) =>
        b.liquidityUsd > a.liquidityUsd ? b : a
      )
      entries.push([addr, { bestVolume, bestLiquidity }])
    }
    return Object.fromEntries(entries)
  }

  /**
   * Get summary stats across all exchanges for a given pair.
   */
  async summarizePair(pairAddress: string): Promise<{
    totalLiquidity: number
    totalVolume24h: number
    avgPrice: number
  }> {
    const infos = await this.getPairInfo(pairAddress)
    if (infos.length === 0) {
      return { totalLiquidity: 0, totalVolume24h: 0, avgPrice: 0 }
    }
    const totalLiquidity = infos.reduce((sum, p) => sum + p.liquidityUsd, 0)
    const totalVolume24h = infos.reduce((sum, p) => sum + p.volume24hUsd, 0)
    const avgPrice =
      infos.reduce((sum, p) => sum + p.priceUsd, 0) / infos.length
    return { totalLiquidity, totalVolume24h, avgPrice }
  }
}

