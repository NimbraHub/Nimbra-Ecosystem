import type { BaseFlowAction, FlowActionResponse } from "./flow_action_base"
import { z } from "zod"

interface AgentContext {
  apiEndpoint: string
  apiKey: string
  timeoutMs?: number
  metadata?: Record<string, any>
}

/**
 * Central Flow Agent: routes calls to registered actions.
 * Enhancements:
 * - Prevents duplicate registrations
 * - Provides unregister and list methods
 * - Safer payload validation against schema
 * - Error wrapping into FlowActionResponse
 */
export class FlowAgent {
  private actions = new Map<string, BaseFlowAction<any, any, AgentContext>>()

  register<S, R>(action: BaseFlowAction<S, R, AgentContext>): void {
    if (this.actions.has(action.id)) {
      throw new Error(`Action with id "${action.id}" is already registered.`)
    }
    this.actions.set(action.id, action)
  }

  unregister(id: string): boolean {
    return this.actions.delete(id)
  }

  listActions(): { id: string; summary: string }[] {
    return Array.from(this.actions.values()).map(a => ({
      id: a.id,
      summary: a.summary,
    }))
  }

  getAction(id: string): BaseFlowAction<any, any, AgentContext> | undefined {
    return this.actions.get(id)
  }

  async invoke<R>(
    actionId: string,
    payload: unknown,
    ctx: AgentContext
  ): Promise<FlowActionResponse<R>> {
    const action = this.actions.get(actionId)
    if (!action) {
      return {
        notice: `Unknown action "${actionId}"`,
        error: "NOT_FOUND",
        timestamp: Date.now(),
      }
    }

    try {
      const parsedPayload = action.input.parse(payload)
      return await action.execute({ payload: parsedPayload, context: ctx })
    } catch (err: any) {
      return {
        notice: `Failed to execute action "${actionId}"`,
        error: err.message ?? "UNKNOWN_ERROR",
        timestamp: Date.now(),
      }
    }
  }
}
