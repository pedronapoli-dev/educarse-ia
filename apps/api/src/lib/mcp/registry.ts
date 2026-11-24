// MCP Tool Registry
// Maps tool names to executor functions.
// All tool calls in generateWithTools() go through here.

import { executeSupabaseTool, SUPABASE_TOOLS, type PlanToolScope } from './supabaseTools'
import { executeSpacedRepTool } from './spacedRepTools'
import { executeResourceTool }  from './resourceTools'

type ToolExecutor = (name: string, input: unknown) => Promise<unknown>

const SYNC_TO_ASYNC = (fn: (name: string, input: unknown) => unknown): ToolExecutor =>
  async (name, input) => fn(name, input)

const PLAN_SCOPED_TOOL_NAMES = new Set(SUPABASE_TOOLS.map(tool => tool.name))

// Tools that do not read student data and therefore need no scope
const STATELESS_TOOL_MAP: Record<string, ToolExecutor> = {
  // SM-2 Algorithm (sync — pure computation wrapped as async)
  calculate_review_schedule: SYNC_TO_ASYNC(executeSpacedRepTool),
  get_next_reviews_due:      SYNC_TO_ASYNC(executeSpacedRepTool),
  // Resource Discovery (async — YouTube API)
  search_youtube_education:  executeResourceTool,
}

// The scope comes from the authenticated request, never from model output.
export const createPlanToolDispatcher = (scope: PlanToolScope): ToolExecutor =>
  async (name, input) => {
    if (PLAN_SCOPED_TOOL_NAMES.has(name)) return executeSupabaseTool(scope, name, input)

    const executor = STATELESS_TOOL_MAP[name]
    if (!executor) throw new Error(`MCP tool not registered: ${name}`)
    return executor(name, input)
  }
