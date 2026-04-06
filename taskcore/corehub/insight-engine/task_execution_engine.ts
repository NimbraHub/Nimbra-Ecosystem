/**
 * Simple task executor with typed handlers, retries, timeouts, and optional concurrency.
 */

type Handler<In = any, Out = any> = (params: In) => Promise<Out>

export interface Task<In = any> {
  id: string
  type: string
  params: In
  retries?: number           // number of retry attempts on failure (default: 0)
  timeoutMs?: number         // per-task timeout (default: none)
}

export interface TaskResult<Out = any> {
  id: string
  type: string
  result?: Out
  error?: string
  attempts: number
  startedAt: number
  durationMs: number
}

export class ExecutionEngine {
  private handlers: Record<string, Handler<any, any>> = {}
  private queue: Task[] = []

  /**
   * Register a handler for a task type. Throws if the type is already registered.
   */
  register<In = any, Out = any>(type: string, handler: Handler<In, Out>): void {
    if (this.handlers[type]) {
      throw new Error(`Handler for type "${type}" is already registered`)
    }
    this.handlers[type] = handler as Handler<any, any>
  }

  /**
   * Replace or add a handler for a task type (no error if it exists).
   */
  upsert<In = any, Out = any>(type: string, handler: Handler<In, Out>): void {
    this.handlers[type] = handler as Handler<any, any>
  }

  /**
   * Unregister an existing handler.
   */
  unregister(type: string): boolean {
    if (!this.handlers[type]) return false
    delete this.handlers[type]
    return true
  }

  hasHandler(type: string): boolean {
    return Boolean(this.handlers[type])
  }

  /**
   * Enqueue a task for later execution.
   */
  enqueue<In = any>(id: string, type: string, params: In, options?: { retries?: number; timeoutMs?: number }): void {
    if (!this.handlers[type]) throw new Error(`No handler for ${type}`)
    this.queue.push({
      id,
      type,
      params,
      retries: options?.retries ?? 0,
      timeoutMs: options?.timeoutMs,
    })
  }

  /**
   * Get a shallow copy of the current queue.
   */
  list(): Task[] {
    return [...this.queue]
  }

  size(): number {
    return this.queue.length
  }

  clear(): void {
    this.queue = []
  }

  /**
   * Run the next task in the queue (FIFO). Returns its result or undefined if empty.
   */
  async runNext(): Promise<TaskResult | undefined> {
    const task = this.queue.shift()
    if (!task) return undefined
    return this.executeTask(task)
  }

  /**
   * Execute all scheduled tasks with optional concurrency.
   * @param concurrency number of parallel workers (default 1)
   */
  async runAll(concurrency = 1): Promise<TaskResult[]> {
    const results: TaskResult[] = []
    const workers = Math.max(1, Math.floor(concurrency))
    const runWorker = async () => {
      while (this.queue.length) {
        const task = this.queue.shift()
        if (!task) break
        const res = await this.executeTask(task)
        results.push(res)
      }
    }
    await Promise.all(Array.from({ length: workers }, () => runWorker()))
    return results
  }

  /**
   * Internal: execute a single task with retries and timeout.
   */
  private async executeTask(task: Task): Promise<TaskResult> {
    const handler = this.handlers[task.type]
    if (!handler) {
      return this.buildResult(task, 0, 0, undefined, `No handler for ${task.type}`)
    }

    const maxAttempts = (task.retries ?? 0) + 1
    let attempts = 0
    let lastError: any = null
    const startedAt = Date.now()

    // linear backoff: 250ms * attemptIndex (0, 250, 500, ...)
    const backoffMs = (i: number) => 250 * i

    while (attempts < maxAttempts) {
      attempts++
      try {
        const result = await this.runWithTimeout(handler(task.params), task.timeoutMs)
        const durationMs = Date.now() - startedAt
        return this.buildResult(task, attempts, durationMs, result)
      } catch (err: any) {
        lastError = err
        if (attempts < maxAttempts) {
          const wait = backoffMs(attempts - 1)
          if (wait > 0) {
            await new Promise(res => setTimeout(res, wait))
          }
        }
      }
    }

    const durationMs = Date.now() - startedAt
    return this.buildResult(task, attempts, durationMs, undefined, lastError?.message ?? "UNKNOWN_ERROR")
  }

  /**
   * Wrap a promise with a timeout if provided.
   */
  private runWithTimeout<T>(p: Promise<T>, timeoutMs?: number): Promise<T> {
    if (!timeoutMs || timeoutMs <= 0) return p
    let timer: any
    const timeoutPromise = new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new Error("Task timed out")), timeoutMs)
    })
    return Promise.race([p, timeoutPromise]).finally(() => {
      if (timer) clearTimeout(timer)
    })
  }

  private buildResult<Out = any>(
    task: Task,
    attempts: number,
    durationMs: number,
    result?: Out,
    error?: string
  ): TaskResult<Out> {
    return {
      id: task.id,
      type: task.type,
      result,
      error,
      attempts,
      startedAt: Date.now() - durationMs,
      durationMs,
    }
  }
}
