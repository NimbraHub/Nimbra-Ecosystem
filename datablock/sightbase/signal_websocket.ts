export interface SightCoreConfig {
  url: string
  protocols?: string[]
  reconnectIntervalMs?: number
  maxReconnectAttempts?: number
  heartbeatIntervalMs?: number
  debug?: boolean
}

export type SightCoreMessage = {
  topic: string
  payload: any
  timestamp: number
}

/**
 * SightCoreWebSocket: resilient client with reconnection, heartbeat, and logging.
 * Enhancements:
 * - Configurable maxReconnectAttempts
 * - Heartbeat pings to keep connection alive
 * - Debug logging option
 * - Added onError callback
 * - Method to check connection status
 */
export class SightCoreWebSocket {
  private socket?: WebSocket
  private url: string
  private protocols?: string[]
  private reconnectInterval: number
  private maxReconnectAttempts: number
  private reconnectAttempts = 0
  private heartbeatInterval: number
  private heartbeatTimer?: ReturnType<typeof setInterval>
  private debug: boolean

  constructor(config: SightCoreConfig) {
    this.url = config.url
    this.protocols = config.protocols
    this.reconnectInterval = config.reconnectIntervalMs ?? 5000
    this.maxReconnectAttempts = config.maxReconnectAttempts ?? Infinity
    this.heartbeatInterval = config.heartbeatIntervalMs ?? 20000
    this.debug = config.debug ?? false
  }

  connect(
    onMessage: (msg: SightCoreMessage) => void,
    onOpen?: () => void,
    onClose?: () => void,
    onError?: (err: any) => void
  ): void {
    this.log("Connecting to", this.url)
    this.socket = this.protocols
      ? new WebSocket(this.url, this.protocols)
      : new WebSocket(this.url)

    this.socket.onopen = () => {
      this.log("Connection opened")
      this.reconnectAttempts = 0
      this.startHeartbeat()
      onOpen?.()
    }

    this.socket.onmessage = event => {
      try {
        const msg = JSON.parse(event.data) as SightCoreMessage
        if (msg && typeof msg.topic === "string" && typeof msg.timestamp === "number") {
          onMessage(msg)
        } else {
          this.log("Invalid message ignored:", event.data)
        }
      } catch (err) {
        this.log("Failed to parse message:", err)
        onError?.(err)
      }
    }

    this.socket.onclose = () => {
      this.log("Connection closed")
      this.stopHeartbeat()
      onClose?.()
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++
        this.log(`Reconnecting attempt ${this.reconnectAttempts}`)
        setTimeout(
          () => this.connect(onMessage, onOpen, onClose, onError),
          this.reconnectInterval
        )
      }
    }

    this.socket.onerror = err => {
      this.log("Socket error:", err)
      onError?.(err)
      this.socket?.close()
    }
  }

  send(topic: string, payload: any): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      const msg = JSON.stringify({ topic, payload, timestamp: Date.now() })
      this.socket.send(msg)
    } else {
      this.log("Send failed: socket not open")
      throw new Error("WebSocket is not open. Cannot send message.")
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat()
    this.heartbeatTimer = setInterval(() => {
      if (this.socket?.readyState === WebSocket.OPEN) {
        this.socket.send(
          JSON.stringify({ topic: "heartbeat", payload: {}, timestamp: Date.now() })
        )
        this.log("Heartbeat sent")
      }
    }, this.heartbeatInterval)
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = undefined
    }
  }

  disconnect(): void {
    this.log("Disconnect requested")
    this.maxReconnectAttempts = 0
    this.stopHeartbeat()
    this.socket?.close()
  }

  isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN
  }

  private log(...args: any[]): void {
    if (this.debug) {
      console.log("[SightCoreWebSocket]", ...args)
    }
  }
}
