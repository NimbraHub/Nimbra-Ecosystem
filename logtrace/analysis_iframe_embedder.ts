import type { TokenMetrics } from "./tokenAnalysisCalculator"

export interface IframeConfig {
  containerId: string
  srcUrl: string
  metrics: TokenMetrics
  refreshIntervalMs?: number
  debug?: boolean
}

export class TokenAnalysisIframe {
  private iframeEl: HTMLIFrameElement | null = null
  private refreshTimer?: ReturnType<typeof setInterval>

  constructor(private config: IframeConfig) {}

  init(): void {
    const container = document.getElementById(this.config.containerId)
    if (!container) throw new Error("Container not found: " + this.config.containerId)

    const iframe = document.createElement("iframe")
    iframe.src = this.config.srcUrl
    iframe.width = "100%"
    iframe.height = "100%"
    iframe.style.border = "none"
    iframe.onload = () => this.postMetrics()
    container.appendChild(iframe)
    this.iframeEl = iframe

    if (this.config.refreshIntervalMs && this.config.refreshIntervalMs > 0) {
      this.refreshTimer = setInterval(
        () => this.postMetrics(),
        this.config.refreshIntervalMs
      )
    }
  }

  private postMetrics(): void {
    if (!this.iframeEl?.contentWindow) return
    try {
      this.iframeEl.contentWindow.postMessage(
        { type: "TOKEN_ANALYSIS_METRICS", payload: this.config.metrics },
        "*"
      )
      if (this.config.debug) {
        console.log("[TokenAnalysisIframe] Posted metrics:", this.config.metrics)
      }
    } catch (err: any) {
      if (this.config.debug) {
        console.error("[TokenAnalysisIframe] Failed to post metrics:", err.message)
      }
    }
  }

  /**
   * Update metrics dynamically and post to iframe immediately.
   */
  updateMetrics(metrics: TokenMetrics): void {
    this.config.metrics = metrics
    this.postMetrics()
  }

  /**
   * Destroy the iframe and clear refresh interval.
   */
  destroy(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer)
      this.refreshTimer = undefined
    }
    if (this.iframeEl && this.iframeEl.parentNode) {
      this.iframeEl.parentNode.removeChild(this.iframeEl)
      this.iframeEl = null
    }
  }
}
