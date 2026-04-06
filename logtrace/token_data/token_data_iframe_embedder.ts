import type { TokenDataPoint } from "./tokenDataFetcher"

export interface DataIframeConfig {
  containerId: string
  iframeUrl: string
  token: string
  refreshMs?: number
  apiBase?: string
  debug?: boolean
}

export class TokenDataIframeEmbedder {
  private iframe?: HTMLIFrameElement
  private refreshTimer?: ReturnType<typeof setInterval>

  constructor(private cfg: DataIframeConfig) {}

  async init() {
    const container = document.getElementById(this.cfg.containerId)
    if (!container) throw new Error(`Container not found: ${this.cfg.containerId}`)

    this.iframe = document.createElement("iframe")
    this.iframe.src = this.cfg.iframeUrl
    this.iframe.style.border = "none"
    this.iframe.width = "100%"
    this.iframe.height = "100%"
    this.iframe.onload = () => this.postTokenData()
    container.appendChild(this.iframe)

    if (this.cfg.refreshMs && this.cfg.refreshMs > 0) {
      this.refreshTimer = setInterval(() => this.postTokenData(), this.cfg.refreshMs)
    }
  }

  private async postTokenData() {
    if (!this.iframe?.contentWindow) return
    try {
      const fetcherModule = await import("./tokenDataFetcher")
      const apiBase = this.cfg.apiBase ?? this.cfg.iframeUrl
      const fetcher = new fetcherModule.TokenDataFetcher(apiBase)
      const data: TokenDataPoint[] = await fetcher.fetchHistory(this.cfg.token)

      this.iframe.contentWindow.postMessage(
        { type: "TOKEN_DATA", token: this.cfg.token, data },
        "*"
      )
    } catch (err: any) {
      if (this.cfg.debug) {
        console.error("[TokenDataIframeEmbedder] Failed to post token data:", err.message)
      }
    }
  }

  /**
   * Stop auto-refresh and remove the iframe.
   */
  destroy() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer)
      this.refreshTimer = undefined
    }
    if (this.iframe && this.iframe.parentNode) {
      this.iframe.parentNode.removeChild(this.iframe)
      this.iframe = undefined
    }
  }
}
