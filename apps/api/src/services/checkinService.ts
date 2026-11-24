import { generate, generateWithTools, parseJsonResponse } from '../lib/anthropic'
import { CHECKIN_SYSTEM, checkinPrompt, type CheckinInput } from '../lib/prompts'
import { CHECKIN_TOOLS, type PlanToolScope } from '../lib/mcp/supabaseTools'
import { createPlanToolDispatcher } from '../lib/mcp/registry'
import type { PlanCheckin } from '@educarseia/types'

// scope absent  → Phase 1: uses manually provided data via generate()
// scope present → Phase 2: Claude fetches real session data from Supabase via MCP
export const runCheckin = async (input: CheckinInput, scope?: PlanToolScope): Promise<PlanCheckin> => {
  const response = scope
    ? await generateWithTools(
        CHECKIN_SYSTEM,
        checkinPrompt(input),
        CHECKIN_TOOLS,
        createPlanToolDispatcher(scope),
        1024,
        3,
      )
    : await generate(CHECKIN_SYSTEM, checkinPrompt(input), 1024)

  return parseJsonResponse<PlanCheckin>(response, 'check-in')
}
