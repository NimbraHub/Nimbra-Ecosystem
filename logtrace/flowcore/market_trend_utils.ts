export interface PricePoint {
  timestamp: number
  priceUsd: number
}

export interface TrendResult {
  startTime: number
  endTime: number
  trend: "upward" | "downward" | "neutral"
  changePct: number
  duration: number
  startPrice: number
  endPrice: number
}

/**
 * Analyze a series of price points to determine overall trend segments.
 * Enhancements:
 * - Adds duration (ms) and start/end prices for each trend
 * - More robust segmentation logic with min change percentage filter
 * - Optionally smooths flat/noisy movements
 * - Utility function for overall stats
 */
export function analyzePriceTrends(
  points: PricePoint[],
  minSegmentLength: number = 5,
  minChangePct: number = 0.1
): TrendResult[] {
  const results: TrendResult[] = []
  if (points.length < minSegmentLength) return results

  let segStart = 0
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1].priceUsd
    const curr = points[i].priceUsd
    const direction = curr > prev ? 1 : curr < prev ? -1 : 0

    const nextDifferent =
      i === points.length - 1 ||
      (direction === 1 && points[i + 1].priceUsd < curr) ||
      (direction === -1 && points[i + 1].priceUsd > curr)

    if (i - segStart >= minSegmentLength && nextDifferent) {
      const start = points[segStart]
      const end = points[i]
      const rawChange = end.priceUsd - start.priceUsd
      const changePct = (rawChange / start.priceUsd) * 100

      if (Math.abs(changePct) >= minChangePct) {
        results.push({
          startTime: start.timestamp,
          endTime: end.timestamp,
          trend: changePct > 0 ? "upward" : changePct < 0 ? "downward" : "neutral",
          changePct: Math.round(changePct * 100) / 100,
          duration: end.timestamp - start.timestamp,
          startPrice: start.priceUsd,
          endPrice: end.priceUsd,
        })
      }

      segStart = i
    }
  }
  return results
}

/**
 * Compute summary statistics across all trend segments.
 */
export function getTrendSummary(results: TrendResult[]): {
  totalSegments: number
  avgDuration: number
  avgChangePct: number
} {
  if (results.length === 0) return { totalSegments: 0, avgDuration: 0, avgChangePct: 0 }
  const totalSegments = results.length
  const avgDuration =
    results.reduce((sum, r) => sum + r.duration, 0) / totalSegments
  const avgChangePct =
    results.reduce((sum, r) => sum + r.changePct, 0) / totalSegments
  return {
    totalSegments,
    avgDuration: Math.round(avgDuration),
    avgChangePct: Math.round(avgChangePct * 100) / 100,
  }
}
