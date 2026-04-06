import { exec } from "child_process"

/**
 * Execute a shell command and return its trimmed stdout.
 * Rejects with stderr or execution error.
 */
export function execCommand(command: string, timeoutMs: number = 30_000): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!command || command.trim().length === 0) {
      return reject(new Error("No command specified"))
    }

    const start = Date.now()
    const child = exec(command, { timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      const duration = Date.now() - start

      if (error) {
        const msg = [
          `Command execution failed`,
          `cmd: ${command}`,
          `duration: ${duration}ms`,
          `error: ${error.message}`,
          stderr ? `stderr: ${stderr.trim()}` : "",
        ].filter(Boolean).join("\n")
        return reject(new Error(msg))
      }

      const output = stdout.trim()
      resolve(output)
    })

    // defensive: capture spawn errors
    child.on("error", (err) => {
      reject(new Error(`Failed to start command: ${err.message}`))
    })
  })
}
