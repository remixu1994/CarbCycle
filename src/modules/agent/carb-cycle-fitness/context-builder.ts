import { CARB_CYCLE_SYSTEM_PROMPT } from './prompts/system-prompt'
import { getSkillPrompt } from './skills'
import type { AgentContextBlock, MemoryStore, ModelMessage, PlannerResult } from './types'

export type BuildContextInput = {
  plannerResult: PlannerResult
  memoryStore: MemoryStore
  userId: string
  history: ModelMessage[]
}

export async function buildContext({ plannerResult, memoryStore, userId, history }: BuildContextInput) {
  const blocks: AgentContextBlock[] = []
  const profile = await memoryStore.loadUserProfile(userId)
  if (profile) {
    blocks.push({
      id: 'profile',
      label: 'User profile',
      source: 'memory',
      content: JSON.stringify(profile),
    })
  }

  const plan = await memoryStore.loadActivePlan(userId)
  if (plan) {
    blocks.push({
      id: 'plan',
      label: 'Active plan',
      source: 'memory',
      content: JSON.stringify(plan),
    })
  }

  blocks.push({
    id: 'planner',
    label: 'Planner instructions',
    source: 'planner',
    content: `Intent: ${plannerResult.intent}. Missing: ${
      plannerResult.missingInformation.length ? plannerResult.missingInformation.join(', ') : 'none'
    }.`,
  })

  const skillPrompt = getSkillPrompt(plannerResult.intent)
  if (skillPrompt) {
    blocks.push({
      id: `skill-${plannerResult.intent}`,
      label: 'Skill instructions',
      source: 'skill',
      content: skillPrompt,
    })
  }

  const messages: ModelMessage[] = [
    { role: 'system', content: CARB_CYCLE_SYSTEM_PROMPT },
    ...blocks.map((block) => ({ role: 'system', content: `[${block.label}] ${block.content}` })),
    ...history,
  ]

  return { blocks, messages }
}
