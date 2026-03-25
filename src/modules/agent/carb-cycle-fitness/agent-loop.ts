/**
 * Carb Cycle Fitness Agent Loop Architecture
 *
 * Stages executed per iteration:
 * 1. Planner      - classify intent + tool needs.
 * 2. Context      - gather memory + planner guidance into model messages.
 * 3. Model Call   - single provider abstraction for LLMs.
 * 4. Tool Detect  - inspect provider response for tool calls.
 * 5. Tool Exec    - run deterministic tools via registry + normalized envelope.
 * 6. Tool Inject  - append tool results as messages for subsequent iterations.
 * 7. Continuation - loop until no more tool calls or max iterations hit.
 * 8. Response     - compose final user-facing answer w/ structured payload.
 * 9. Memory Hook  - stubbed persistence entry point for future storage.
 */

import { buildContext } from './context-builder'
import { InMemoryStore } from './memory'
import { composeResponse } from './response-composer'
import { executeTools } from './tool-executor'
import { runPlanner } from './planner'
import type {
  AgentEvent,
  AgentLoopConfig,
  AgentLoopState,
  FinalAgentResponse,
  ModelMessage,
} from './types'

const DEFAULT_MAX_ITERATIONS = 3

export type AgentLoopInput = {
  userId: string
  history: ModelMessage[]
}

export async function* runCarbCycleAgentLoopGenerator(
  config: AgentLoopConfig,
  input: AgentLoopInput,
): AsyncGenerator<AgentEvent, AgentLoopState, void> {
  const logger = config.logger ?? console
  const state: AgentLoopState = {
    iteration: 0,
    messages: input.history,
    contextBlocks: [],
    toolResults: [],
  }

  const plannerResult = await runPlanner({
    latestUserMessage: extractLatestUserUtterance(input.history),
    history: input.history,
  })
  state.plannerResult = plannerResult
  yield { type: 'planner', payload: plannerResult }

  const maxIterations = config.maxIterations ?? DEFAULT_MAX_ITERATIONS
  const memoryStore = config.memoryStore ?? new InMemoryStore()

  while (state.iteration < maxIterations) {
    state.iteration += 1
    const { blocks, messages } = await buildContext({
      plannerResult,
      memoryStore,
      userId: input.userId,
      history: state.messages,
    })
    state.contextBlocks = blocks
    yield { type: 'context_ready', payload: blocks }

    yield { type: 'model_call_start', iteration: state.iteration }
    const modelResponse = await config.modelProvider.invoke({ messages })
    yield { type: 'model_call_result', iteration: state.iteration, payload: modelResponse }
    state.messages = [...messages, modelResponse.message]

    if (modelResponse.toolCalls?.length) {
      yield { type: 'tool_call', iteration: state.iteration, calls: modelResponse.toolCalls }
      const toolResults = await executeTools(modelResponse.toolCalls, config.toolRegistry, {
        userId: input.userId,
        iteration: state.iteration,
      })
      state.toolResults.push(...toolResults)
      yield { type: 'tool_result', iteration: state.iteration, results: toolResults }
      toolResults.forEach((result) => {
        state.messages.push({ role: 'tool', name: result.toolName, content: JSON.stringify(result) })
      })
      continue
    }

    const finalResponse: FinalAgentResponse = composeResponse({
      modelResponse,
      plannerResult,
      toolResults: state.toolResults,
    })
    state.finalResponse = finalResponse
    yield { type: 'response_ready', payload: finalResponse }

    try {
      await memoryStore.saveConversationSnapshot({
        userId: input.userId,
        summary: finalResponse.text.slice(0, 280),
        updatedAt: new Date().toISOString(),
      })
    } catch (error) {
      logger.warn?.('Failed to persist memory snapshot', error)
    }

    yield { type: 'done', state }
    return state
  }

  const fallbackResponse: FinalAgentResponse = {
    text: 'Reached iteration limit without final response. Please try again.',
  }
  state.finalResponse = fallbackResponse
  yield { type: 'response_ready', payload: fallbackResponse }
  yield { type: 'done', state }
  return state
}

export async function runCarbCycleAgentLoop(
  config: AgentLoopConfig,
  input: AgentLoopInput,
  emit?: (event: AgentEvent) => void,
): Promise<AgentLoopState> {
  let finalState: AgentLoopState | null = null
  for await (const event of runCarbCycleAgentLoopGenerator(config, input)) {
    emit?.(event)
    if (event.type === 'done') {
      finalState = event.state
    }
  }
  if (!finalState) {
    throw new Error('Agent loop completed without emitting done event')
  }
  return finalState
}

const extractLatestUserUtterance = (history: ModelMessage[]) => {
  const reversed = [...history].reverse()
  const latest = reversed.find((message) => message.role === 'user')
  return latest?.content ?? ''
}
