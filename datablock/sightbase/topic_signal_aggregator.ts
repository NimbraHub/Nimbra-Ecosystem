import type { SightCoreMessage } from "./WebSocketClient"

export interface AggregatedSignal {
  topic: string
  count: number
  lastPayload: any
  lastTimestamp: number
  firstTimestamp?: number
  lastLatencyMs?: number
  payloadHistory?: any[]
}

/**
 * SignalAggregator collects messages by topic and produces aggregate statistics.
 * Enhancements:
 * - Track firstTimestamp for each topic
 * - Track latency between last two messages
 * - Keep limited history of payloads
 * - Provide utilities: top topics, stats, reset by topic
 * - Validation for incoming messages
 */
export class SignalAggregator {
  private counts: Record<string, AggregatedSignal> = {}
  private historyLimit: number

  constructor(historyLimit = 5) {
    this.historyLimit = historyLimit
  }

  processMessage(msg: SightCoreMessage): AggregatedSignal {
    if (!msg || typeof msg.topic !== "string" || typeof msg.timestamp !== "number") {
      throw new Error("Invalid SightCoreMessage")
    }

    const { topic, payload, timestamp } = msg
    const entry = this.counts[topic] || {
      topic,
      count: 0,
      lastPayload: null,
      lastTimestamp: 0,
      firstTimestamp: timestamp,
      payloadHistory: [],
    }

    // track latency
    if (entry.lastTimestamp > 0) {
      entry.lastLatencyMs = timestamp - entry.lastTimestamp
    }

    entry.count += 1
    entry.lastPayload = payload
    entry.lastTimestamp = timestamp

    // update history
    entry.payloadHistory = [...(entry.payloadHistory || []), payload].slice(-this.historyLimit)

    this.counts[topic] = entry
    return entry
  }

  getAggregated(topic: string): AggregatedSignal | undefined {
    return this.counts[topic]
  }

  getAllAggregated(): AggregatedSignal[] {
    return Object.values(this.counts)
  }

  /**
   * Returns the top N topics by message count.
   */
  getTopTopics(limit = 5): AggregatedSignal[] {
    return Object.values(this.counts)
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)
  }

  /**
   * Returns summary statistics across all topics.
   */
  getStats(): { totalTopics: number; totalMessages: number } {
    const all = Object.values(this.counts)
    const totalMessages = all.reduce((acc, s) => acc + s.count, 0)
    return { totalTopics: all.length, totalMessages }
  }

  reset(): void {
    this.counts = {}
  }

  resetTopic(topic: string): void {
    delete this.counts[topic]
  }
}
