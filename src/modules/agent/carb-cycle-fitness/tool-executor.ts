import type { ToolCall, ToolRegistry, ToolResultEnvelope, ToolExecutionContext } from './types'

export async function executeTools(
  calls: ToolCall[],
  registry: ToolRegistry,
  context: ToolExecutionContext,
): Promise<ToolResultEnvelope[]> {
  const results: ToolResultEnvelope[] = []
  for (const call of calls) {
    const tool = registry.getTool(call.name)
    if (!tool) {
      results.push({ ok: false, toolName: call.name, error: 'Tool not found' })
      continue
    }

    try {
      const payload = await tool.execute(call.args ?? {}, context)
      results.push(payload)
    } catch (error) {
      results.push({ ok: false, toolName: call.name, error: error instanceof Error ? error.message : 'Unknown tool error' })
    }
  }
  return results
}
