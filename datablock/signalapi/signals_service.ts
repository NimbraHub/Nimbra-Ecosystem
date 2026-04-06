export interface Signal {
  id: string
  type: string
  timestamp: number
  payload: Record<string, any>
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  status?: number
  durationMs?: number
}

/**
 * SignalApiClient: HTTP client for working with signals API.
 * Enhancements:
 * - Added timeout handling for requests
 * - Returns HTTP status code and duration metrics
 * - Provides create, update, and delete methods
 * - Safer JSON parsing
 */
export class SignalApiClient {
  constructor(
    private baseUrl: string,
    private apiKey?: string,
    private timeoutMs = 10000
  ) {}

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = { "Content-Type": "application/json" }
    if (this.apiKey) headers["Authorization"] = `Bearer ${this.apiKey}`
    return headers
  }

  private async safeFetch<T>(url: string, options: RequestInit): Promise<ApiResponse<T>> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    const start = Date.now()
    try {
      const res = await fetch(url, { ...options, signal: controller.signal })
      const duration = Date.now() - start
      if (!res.ok) {
        return {
          success: false,
          status: res.status,
          durationMs: duration,
          error: `HTTP ${res.status}`,
        }
      }
      let data: T | undefined
      try {
        data = (await res.json()) as T
      } catch {
        return {
          success: false,
          status: res.status,
          durationMs: duration,
          error: "Invalid JSON response",
        }
      }
      return { success: true, data, status: res.status, durationMs: duration }
    } catch (err: any) {
      return { success: false, error: err.message, durationMs: Date.now() - start }
    } finally {
      clearTimeout(timer)
    }
  }

  async fetchAllSignals(): Promise<ApiResponse<Signal[]>> {
    return this.safeFetch<Signal[]>(`${this.baseUrl}/signals`, {
      method: "GET",
      headers: this.getHeaders(),
    })
  }

  async fetchSignalById(id: string): Promise<ApiResponse<Signal>> {
    return this.safeFetch<Signal>(`${this.baseUrl}/signals/${encodeURIComponent(id)}`, {
      method: "GET",
      headers: this.getHeaders(),
    })
  }

  async createSignal(signal: Omit<Signal, "id" | "timestamp">): Promise<ApiResponse<Signal>> {
    return this.safeFetch<Signal>(`${this.baseUrl}/signals`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(signal),
    })
  }

  async updateSignal(id: string, updates: Partial<Signal>): Promise<ApiResponse<Signal>> {
    return this.safeFetch<Signal>(`${this.baseUrl}/signals/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: this.getHeaders(),
      body: JSON.stringify(updates),
    })
  }

  async deleteSignal(id: string): Promise<ApiResponse<null>> {
    return this.safeFetch<null>(`${this.baseUrl}/signals/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: this.getHeaders(),
    })
  }
}
