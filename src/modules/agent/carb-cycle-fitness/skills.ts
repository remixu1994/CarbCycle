import fs from 'node:fs'
import path from 'node:path'

const SKILL_FILES: Record<string, string> = {
  carbon_cycle_plan: 'Carbon_Cycle_Planning.md',
  diet_analysis: 'Diet_Analysis.md',
  training_plan: 'Training_Plan_Generation.md',
}

const cache = new Map<string, string>()

const resolveSkillPath = (filename: string) => {
  return path.resolve(process.cwd(), 'resources', 'skills', filename)
}

const loadSkillFile = (filename: string) => {
  const filePath = resolveSkillPath(filename)
  return fs.readFileSync(filePath, 'utf8')
}

export const getSkillPrompt = (intent: string): string | null => {
  const file = SKILL_FILES[intent]
  if (!file) return null
  if (cache.has(file)) {
    return cache.get(file) ?? null
  }
  try {
    const data = loadSkillFile(file)
    cache.set(file, data)
    return data
  } catch (error) {
    console.error('Failed to load skill file', file, error)
    return null
  }
}
