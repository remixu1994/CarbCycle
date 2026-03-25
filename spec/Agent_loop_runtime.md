# Carb Cycle Agent Loop Runtime

This document outlines the production-ready single-agent loop used by FitTrack Carb Cycle. It mirrors the stages from the planning brief while documenting concrete behaviors, modules, and integration points.

## Goals

- Support carbon-cycle planning, diet analysis, and training-plan guidance.
- Stream results back to the chat UI via `AgentEvent`s.
- Allow tool/skill execution with normalized envelopes.
- Remain agnostic of model providers and persistence layers.

## High-Level Stages

1. **Planner** (`planner.ts`)
   - Classifies intent via keyword heuristics.
   - Records missing personal info (age/weight heuristics today).
   - Proposes tool calls (e.g., `generate_carbon_cycle_plan`).
   - Emits `planner` event with rationale + follow-up question if data is missing.
2. **Context Builder** (`context-builder.ts` + `skills.ts`)
   - Loads user profile & active plan from `MemoryStore` (stubbed `InMemoryStore`).
   - Pulls the relevant skill markdown (carbon plan / diet analysis / training plan) from `resources/skills` and injects it as a context block when the planner intent matches.
   - Converts blocks into `[system]` messages prepended with `CARB_CYCLE_SYSTEM_PROMPT`.
   - Emits `context_ready` with structured `AgentContextBlock[]`.
3. **LLM Call** (`agent-loop.ts`)
   - Invokes `ModelProvider` with built messages, supporting Azure/OpenAI wrappers.
   - Emits `model_call_start` and `model_call_result` events.
4. **Tool Detection**
   - Checks `ModelResponse.toolCalls` for structured tool requests.
   - Emits `tool_call` event so the UI can show "calling tool" state.
5. **Tool Execution** (`tool-executor.ts`)
   - Resolves tools from `ToolRegistry`, executes async handlers, wraps in `{ ok, toolName, data, error }`.
   - Emits `tool_result`; results become `tool` messages appended to history.
6. **Loop Continuation**
   - If tools ran, loop restarts with new context.
   - Loop exits when no tool call arrives or when the max iteration (default 3) is hit.
7. **Response Composer** (`response-composer.ts`)
   - Merges LLM text, planner metadata, skill info, and accumulated tool results.
   - Emits `response_ready` with `FinalAgentResponse` consumed by the API.
8. **Memory Hook** (`memory.ts`)
   - Saves lightweight conversation snapshot (TODO: replace with Prisma). Emits `done`.

## Module Inventory

| Module | Notes |
| --- | --- |
| `types.ts` | All interfaces (config, state, events, planner, context, tools, provider, memory, logger). |
| `prompts/system-prompt.ts` | FitTrack system persona. |
| `skills.ts` | Loads markdown skill playbooks from `resources/skills` and caches them for context injection. |
| `planner.ts` | Keyword heuristics for three domain intents, missing-info detection, tool call proposals. |
| `context-builder.ts` | Load `MemoryStore`, convert planner + skill blocks into system messages. |
| `tool-executor.ts` | Run async tools via `ToolRegistry`, capture envelopes, protect against missing tools/errors. |
| `response-composer.ts` | Produce the final `FinalAgentResponse` with structured metadata. |
| `memory.ts` | In-memory stub of `MemoryStore` with TODOs for Prisma/SQLite later. |
| `agent-loop.ts` | Generator-based runtime orchestrating every stage and emitting streaming events. |

## Event Stream

`runCarbCycleAgentLoopGenerator` is an `AsyncGenerator<AgentEvent>` that yields:

- `planner` ? `context_ready` ? `model_call_start` ? `model_call_result`
- If tools requested: `tool_call` + `tool_result`, then the loop continues
- When no more tools are needed: `response_ready` ? `done`

An imperative helper `runCarbCycleAgentLoop` consumes the generator, optionally forwarding events to a UI stream and returning the final `AgentLoopState`.

## Tooling Surface

Registry must expose the following handles (stubs allowed):

- `generate_carbon_cycle_plan`
- `analyze_diet`
- `generate_training_plan`
- `calculate_bmr`
- `calculate_tdee`

All tools return the agreed envelope shape. Tool results are automatically appended to chat history and included in the composed response.

## Memory Strategy

`MemoryStore` interface supports `loadUserProfile`, `loadActivePlan`, and `saveConversationSnapshot`. The default `InMemoryStore` keeps simple Maps so the loop is runnable today; swap in Prisma-backed implementations later without touching the loop.

## Usage

```
const state = await runCarbCycleAgentLoop(
  {
    agentId: 'fittrack-v1',
    modelProvider,
    toolRegistry,
    memoryStore,
  },
  { userId: thread.userId, history: threadMessages },
  (event) => streamToClient(event),
)
```

## TODOs

- Replace `InMemoryStore` with Prisma-backed persistence.
- Improve planner intent detection with LLM classification and more robust missing-info checks.
- Implement real tool handlers for carbon-cycle planning, diet analysis, training plans, BMR/TDEE.
- Add guardrails (max tokens, fallback prompts) to `ModelProvider` implementations.

This runtime now serves as the baseline architecture for FitTrack's single-coach agent.
