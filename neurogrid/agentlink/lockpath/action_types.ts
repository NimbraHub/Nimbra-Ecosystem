import { z } from "zod"

/**
 * Base types for any Flow action.
 */
export type FlowActionSchema = z.ZodObject<z.ZodRawShape>

export interface FlowActionResponse<T> {
  notice: string
  data?: T
  error?: string
  timestamp?: number
}

export interface BaseFlowAction<
  S extends FlowActionSchema,
  R,
  Ctx = unknown
> {
  id: string
  summary: string
  input: S
  execute(args: { payload: z.infer<S>; context: Ctx }): Promise<FlowActionResponse<R>>
}
