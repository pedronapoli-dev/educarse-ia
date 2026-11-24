import { generate, generateWithTools, parseJsonResponse } from '../lib/anthropic'
import { RECALIBRATE_SYSTEM, recalibratePrompt, type RecalibrateInput } from '../lib/prompts'
import { RECALIBRATE_TOOLS, type PlanToolScope } from '../lib/mcp/supabaseTools'
import { createPlanToolDispatcher } from '../lib/mcp/registry'
import type { RecalibrateResult } from '@educarseia/types'

// scope absent  → Phase 1: manual data via generate()
// scope present → Phase 2: Claude fetches plan state from Supabase via MCP
export const runRecalibration = async (input: RecalibrateInput, scope?: PlanToolScope): Promise<RecalibrateResult> => {
  const response = scope
    ? await generateWithTools(
        RECALIBRATE_SYSTEM,
        recalibratePrompt(input),
        RECALIBRATE_TOOLS,
        createPlanToolDispatcher(scope),
        2048,
        3,
      )
    : await generate(RECALIBRATE_SYSTEM, recalibratePrompt(input), 2048)

  return parseJsonResponse<RecalibrateResult>(response, 'recalibração')
}
