import { execCommand } from "./execCommand"

export interface ShellTask {
  id: string
  command: string
  description?: string
  retries?: number
  timeoutMs?: number
}

export interface ShellResult {
  taskId: string
  output?: string
  error?: string
  executedAt: number
  durationMs: number
  attempt: number
}

/**
 * ShellTaskRunner: schedules and executes shell tasks sequentially.
 * Enhancements:
 * - Supports retries with configurable count
 * - Supports optional timeout per task
 * - Tracks execution duration and attempt count
 * - Utilities to list and clear tasks without execution
 */
export class ShellTaskRunner {
  private tasks: ShellTask[] = []

  /**
   * Schedule a shell task for execution.
   */
  scheduleTask(task: ShellTask): void {
    this.tasks.push(task)
  }

  /**
   * List all scheduled tasks.
   */
  listTasks(): ShellTask[] {
    return [...this.tasks]
  }

  /**
   * Clear all scheduled tasks.
   */
  clearTasks(): void {
    this.tasks = []
  }

  /**
   * Execute all scheduled tasks in sequence with retry and timeout support.
   */
  async runAll(): Promise<ShellResult[]> {
    const results: ShellResult[] = []
    for (const task of this.tasks) {
      const maxAttempts = (task.retries ?? 0) + 1
      let attempt = 0
      let lastError: any = null

      while (attempt < maxAttempts) {
        attempt++
        const start = Date.now()
        try {
          const output = await this.runWithTimeout(task.command, task.timeoutMs)
          const durationMs = Date.now() - start
          results.push({
            taskId: task.id,
            output,
            executedAt: start,
            durationMs,
            attempt,
          })
          lastError = null
          break
        } catch (err: any) {
          lastError = err
          if (attempt >= maxAttempts) {
            const durationMs = Date.now() - start
            results.push({
              taskId: task.id,
              error: err.message,
              executedAt: start,
              durationMs,
              attempt,
            })
          }
        }
      }
    }
    this.clearTasks()
    return results
  }

  /**
   * Run a command with optional timeout.
   */
  private runWithTimeout(command: string, timeoutMs?: number): Promise<string> {
    if (!timeoutMs || timeoutMs <= 0) {
      return execCommand(command)
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Command timed out")), timeoutMs)
      execCommand(command)
        .then(output => {
          clearTimeout(timer)
          resolve(output)
        })
        .catch(err => {
          clearTimeout(timer)
          reject(err)
        })
    })
  }
}
