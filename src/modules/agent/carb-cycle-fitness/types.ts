export type AgentLoopConfig = {
  agentId: string
  maxIterations?: number
  modelProvider: ModelProvider
  toolRegistry: ToolRegistry
  memoryStore: MemoryStore
  logger?: AgentLogger
}

export type AgentLoopState = {
  iteration: number
  messages: ModelMessage[]
  contextBlocks: AgentContextBlock[]
  plannerResult?: PlannerResult
  toolResults: ToolResultEnvelope[]
  finalResponse?: FinalAgentResponse
}

export type AgentEvent =
  | { type: 'log'; level: 'info' | 'warn' | 'error'; message: string }
  | { type: 'planner'; payload: PlannerResult }
  | { type: 'context_ready'; payload: AgentContextBlock[] }
  | { type: 'model_call_start'; iteration: number }
  | { type: 'model_call_result'; iteration: number; payload: ModelResponse }
  | { type: 'tool_call'; iteration: number; calls: ToolCall[] }
  | { type: 'tool_result'; iteration: number; results: ToolResultEnvelope[] }
  | { type: 'response_ready'; payload: FinalAgentResponse }
  | { type: 'done'; state: AgentLoopState }
  | { type: 'error'; error: Error }

export type PlannerInput = {
  latestUserMessage: string
  conversationSummary?: string
  history: ModelMessage[]
}

export type PlannerResult = {
  intent: 'carbon_cycle_plan' | 'diet_analysis' | 'training_plan' | 'general_question'
  needsTools: boolean
  missingInformation: string[]
  suggestedToolCalls: ToolCall[]
  followUpQuestion?: string
  rationale: string
}

export type AgentContextBlock = {
  id: string
  label: string
  content: string
  source: 'memory' | 'planner' | 'system' | 'skill'
}

export type ToolCall = {
  id: string
  name: string
  args: Record<string, unknown>
}

export type ToolResultEnvelope = {
  ok: boolean
  toolName: string
  data?: unknown
  error?: string
}

export type ModelMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  name?: string
}

export type ModelResponse = {
  message: ModelMessage
  toolCalls?: ToolCall[]
  raw?: unknown
}

export type ModelProvider = {
  invoke: (input: { messages: ModelMessage[]; temperature?: number }) => Promise<ModelResponse>
}

export type ToolRegistry = {
  getTool: (name: string) => ToolDefinition | null
}

export type ToolDefinition = {
  name: string
  description?: string
  execute: (args: Record<string, unknown>, context: ToolExecutionContext) => Promise<ToolResultEnvelope>
}

export type ToolExecutionContext = {
  userId: string
  iteration: number
}

export type MemoryStore = {
  loadUserProfile: (userId: string) => Promise<UserProfile | null>
  loadActivePlan: (userId: string) => Promise<ActivePlan | null>
  saveConversationSnapshot: (payload: ConversationSnapshot) => Promise<void>
}

export type UserProfile = {
  id: string
  displayName?: string
  age?: number
  heightCm?: number
  weightKg?: number
  bodyFatPercent?: number
  goals?: string
}

export type ActivePlan = {
  cycleType: 'high' | 'medium' | 'low'
  updatedAt: string
  targets: Record<string, string | number>
}

export type ConversationSnapshot = {
  userId: string
  threadId?: string
  summary: string
  updatedAt: string
}

export type FinalAgentResponse = {
  text: string
  structured?: Record<string, unknown>
  toolResults?: ToolResultEnvelope[]
}

export type AgentLogger = {
  debug?: (...args: unknown[]) => void
  info?: (...args: unknown[]) => void
  warn?: (...args: unknown[]) => void
  error?: (...args: unknown[]) => void
}
