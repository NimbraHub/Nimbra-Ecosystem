export interface LaunchConfig {
  contractName: string
  parameters: Record<string, any>
  deployEndpoint: string
  apiKey?: string
  timeoutMs?: number
  debug?: boolean
}

export interface LaunchResult {
  success: boolean
  address?: string
  transactionHash?: string
  error?: string
  durationMs?: number
  statusCode?: number
}

export class LaunchNode {
  constructor(private config: LaunchConfig) {}

  async deploy(): Promise<LaunchResult> {
    const { deployEndpoint, apiKey, contractName, parameters, timeoutMs, debug } = this.config
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs ?? 15000)
    const start = Date.now()
    try {
      const res = await fetch(deployEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({ contractName, parameters }),
        signal: controller.signal,
      })
      const duration = Date.now() - start
      if (!res.ok) {
        const text = await res.text()
        if (debug) {
          console.error("[LaunchNode] Deploy failed:", res.status, text)
        }
        return { success: false, error: `HTTP ${res.status}: ${text}`, durationMs: duration, statusCode: res.status }
      }
      const json = await res.json()
      return {
        success: true,
        address: json.contractAddress,
        transactionHash: json.txHash,
        durationMs: duration,
        statusCode: res.status,
      }
    } catch (err: any) {
      if (debug) {
        console.error("[LaunchNode] Error during deploy:", err.message)
      }
      return { success: false, error: err.message, durationMs: Date.now() - start }
    } finally {
      clearTimeout(timer)
    }
  }
}
