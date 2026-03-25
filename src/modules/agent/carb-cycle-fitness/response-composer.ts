import type { FinalAgentResponse, ModelResponse, PlannerResult, ToolResultEnvelope } from './types'

export function composeResponse(params: {
  modelResponse: ModelResponse
  plannerResult: PlannerResult
  toolResults: ToolResultEnvelope[]
}): FinalAgentResponse {
  const { modelResponse, plannerResult, toolResults } = params
  const structured: Record<string, unknown> = {
    intent: plannerResult.intent,
    missingInformation: plannerResult.missingInformation,
  }
  if (toolResults.length) {
    structured.tools = toolResults
  }
  return {
    text: modelResponse.message.content,
    structured,
    toolResults,
  }
}
