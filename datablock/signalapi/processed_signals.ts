import type { Signal } from "./SignalApiClient"

/**
 * SignalProcessor converts raw signals into structured insights.
 * Enhancements:
 * - Validation of input signals
 * - Support for multiple type filtering
 * - Aggregation with counts, percentages, and time ranges
 * - Summaries with truncation for large payloads
 * - Utilities: compute overall stats, group by day, and sort by recency
 */
export class SignalProcessor {
  /**
   * Filter signals by one or many types and a minimum timestamp.
   */
  filter(signals: Signal[], types: string | string[], sinceTimestamp: number): Signal[] {
    const typeSet = Array.isArray(types) ? new Set(types) : new Set([types])
    return signals.filter(
      s =>
        !!s &&
        typeof s.type === "string" &&
        typeSet.has(s.type) &&
        typeof s.timestamp === "number" &&
        s.timestamp > sinceTimestamp
    )
  }

  /**
   * Aggregate signals by type, returning counts, percentages, and time ranges.
   */
  aggregateByType(
    signals: Signal[]
  ): Record<string, { count: number; share: number; earliest: number; latest: number }> {
    const total = signals.length
    const groups: Record<
      string,
      { count: number; earliest: number; latest: number }
    > = {}

    for (const s of signals) {
      if (!groups[s.type]) {
        groups[s.type] = { count: 0, earliest: s.timestamp, latest: s.timestamp }
      }
      groups[s.type].count++
      if (s.timestamp < groups[s.type].earliest) groups[s.type].earliest = s.timestamp
      if (s.timestamp > groups[s.type].latest) groups[s.type].latest = s.timestamp
    }

    const result: Record<
      string,
      { count: number; share: number; earliest: number; latest: number }
    > = {}
    for (const [type, g] of Object.entries(groups)) {
      result[type] = {
        count: g.count,
        share: total > 0 ? g.count / total : 0,
        earliest: g.earliest,
        latest: g.latest,
      }
    }
    return result
  }

  /**
   * Transform a signal into a human-readable summary string.
   * Large payloads will be truncated for readability.
   */
  summarize(signal: Signal, maxPayloadLength = 200): string {
    if (!signal || typeof signal.type !== "string" || typeof signal.timestamp !== "number") {
      return "Invalid signal"
    }
    const time = new Date(signal.timestamp).toISOString()
    let payloadStr = JSON.stringify(signal.payload)
    if (payloadStr.length > maxPayloadLength) {
      payloadStr = payloadStr.slice(0, maxPayloadLength) + "...[truncated]"
    }
    return `[${time}] ${signal.type.toUpperCase()}: ${payloadStr}`
  }

  /**
   * Compute basic statistics across all signals.
   */
  getStats(signals: Signal[]): { total: number; earliest?: number; latest?: number } {
    if (signals.length === 0) return { total: 0 }
    const timestamps = signals.map(s => s.timestamp).filter(t => typeof t === "number")
    return {
      total: signals.length,
      earliest: Math.min(...timestamps),
      latest: Math.max(...timestamps),
    }
  }

  /**
   * Group signals by UTC day.
   */
  groupByDay(signals: Signal[]): Record<string, Signal[]> {
    return signals.reduce((acc, s) => {
      const day = new Date(s.timestamp).toISOString().slice(0, 10)
      if (!acc[day]) acc[day] = []
      acc[day].push(s)
      return acc
    }, {} as Record<string, Signal[]>)
  }

  /**
   * Sort signals by recency (latest first).
   */
  sortByTimestamp(signals: Signal[]): Signal[] {
    return [...signals].sort((a, b) => b.timestamp - a.timestamp)
  }
}
