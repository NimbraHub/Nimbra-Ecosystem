export interface VolumePoint {
  timestamp: number
  volumeUsd: number
}

export interface SpikeEvent {
  timestamp: number
  volume: number
  spikeRatio: number
  averageWindow: number
  windowStart: number
  windowEnd: number
}

/**
 * Detects spikes in trading volume compared to a rolling average window.
 * Enhancements:
 * - Tracks the averageWindow used
 * - Records window start and end timestamps for context
 * - Supports minimum absolute volume filter
 * - Utility to compute summary stats from spike events
 */
export function detectVolumeSpikes(
  points: VolumePoint[],
  windowSize: number = 10,
  spikeThreshold: number = 2.0,
  minVolume: number = 0
): SpikeEvent[] {
  const events: SpikeEvent[] = []
  if (points.length < windowSize) return events

  const volumes = points.map(p => p.volumeUsd)
  for (let i = windowSize; i < volumes.length; i++) {
    const window = volumes.slice(i - windowSize, i)
    const avg = window.reduce((sum, v) => sum + v, 0) / (window.length || 1)
    const curr = volumes[i]
    const ratio = avg > 0 ? curr / avg : Infinity

    if (ratio >= spikeThreshold && curr >= minVolume) {
      events.push({
        timestamp: points[i].timestamp,
        volume: curr,
        spikeRatio: Math.round(ratio * 100) / 100,
        averageWindow: Math.round(avg * 100) / 100,
        windowStart: points[i - windowSize].timestamp,
        windowEnd: points[i - 1].timestamp,
      })
    }
  }
  return events
}

/**
 * Summarize spike events: count, average ratio, and highest spike.
 */
export function summarizeSpikes(events: SpikeEvent[]): {
  totalSpikes: number
  avgRatio: number
  maxSpike?: SpikeEvent
} {
  if (events.length === 0) return { totalSpikes: 0, avgRatio: 0 }
  const totalSpikes = events.length
  const avgRatio =
    events.reduce((sum, e) => sum + e.spikeRatio, 0) / totalSpikes
  const maxSpike = events.reduce((max, e) => (e.spikeRatio > max.spikeRatio ? e : max), events[0])
  return {
    totalSpikes,
    avgRatio: Math.round(avgRatio * 100) / 100,
    maxSpike,
  }
}
