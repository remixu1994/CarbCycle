import type { PlannerInput, PlannerResult, ToolCall } from './types'

const TOOL_MAPPING: Record<string, { intent: PlannerResult['intent']; tool: string; keywords: string[] }> = {
  carbon_cycle_plan: {
    intent: 'carbon_cycle_plan',
    tool: 'generate_carbon_cycle_plan',
    keywords: ['?', 'carb', '??', '?', 'plan'],
  },
  diet_analysis: {
    intent: 'diet_analysis',
    tool: 'analyze_diet',
    keywords: ['??', 'meal', 'diet', '?', '??'],
  },
  training_plan: {
    intent: 'training_plan',
    tool: 'generate_training_plan',
    keywords: ['??', '????', 'workout', '???', '??'],
  },
}

export async function runPlanner(input: PlannerInput): Promise<PlannerResult> {
  const normalized = input.latestUserMessage.toLowerCase()
  const missingInformation: string[] = []
  if (!/\d{2}/.test(normalized)) {
    missingInformation.push('??')
  }
  if (!normalized.includes('kg')) {
    missingInformation.push('??')
  }

  const suggestedToolCalls: ToolCall[] = []
  let detectedIntent: PlannerResult['intent'] = 'general_question'

  for (const entry of Object.values(TOOL_MAPPING)) {
    if (entry.keywords.some((keyword) => normalized.includes(keyword.toLowerCase()))) {
      detectedIntent = entry.intent
      suggestedToolCalls.push({
        id: `${entry.tool}-${Date.now()}`,
        name: entry.tool,
        args: { text: input.latestUserMessage },
      })
      break
    }
  }

  const needsTools = suggestedToolCalls.length > 0
  const rationale = needsTools
    ? '??????????,????????????'
    : '?????????,?????'

  return {
    intent: detectedIntent,
    needsTools,
    missingInformation,
    suggestedToolCalls,
    followUpQuestion: missingInformation.length ? '???:' + missingInformation.join('?') : undefined,
    rationale,
  }
}
