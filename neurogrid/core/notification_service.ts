import nodemailer from "nodemailer"

export interface AlertConfig {
  email?: {
    host: string
    port: number
    user: string
    pass: string
    from: string
    to: string[]
    secure?: boolean
  }
  console?: boolean
}

export interface AlertSignal {
  title: string
  message: string
  level: "info" | "warning" | "critical"
  timestamp?: number
}

export class AlertService {
  constructor(private cfg: AlertConfig) {}

  private async sendEmail(signal: AlertSignal) {
    if (!this.cfg.email) return
    const { host, port, user, pass, from, to, secure } = this.cfg.email
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: secure ?? false,
      auth: { user, pass },
    })
    try {
      await transporter.sendMail({
        from,
        to,
        subject: `[${signal.level.toUpperCase()}] ${signal.title}`,
        text: signal.message,
      })
    } catch (err: any) {
      console.error("[AlertService] Failed to send email:", err.message)
    }
  }

  private logConsole(signal: AlertSignal) {
    if (!this.cfg.console) return
    const ts = signal.timestamp
      ? new Date(signal.timestamp).toISOString()
      : new Date().toISOString()
    console.log(
      `[Alert][${signal.level.toUpperCase()}][${ts}] ${signal.title}\n${signal.message}`
    )
  }

  async dispatch(signals: AlertSignal[]) {
    for (const sig of signals) {
      const withTs: AlertSignal = { ...sig, timestamp: sig.timestamp ?? Date.now() }
      await this.sendEmail(withTs)
      this.logConsole(withTs)
    }
  }
}
