import { prisma } from '@/server/db/prisma'

export type TrainingType = 'lower' | 'upper' | 'rest'

export type DayType = 'high' | 'medium' | 'low'

export type CreateSnapshotInput = {
  threadId: string
  messageId: string
  trainingType?: TrainingType
  dayType?: DayType
  targetCalories?: number
  targetProteinG?: number
  targetCarbsG?: number
  targetFatG?: number
  consumedCalories?: number
  consumedProteinG?: number
  consumedCarbsG?: number
  consumedFatG?: number
  remainingCalories?: number
  remainingProteinG?: number
  remainingCarbsG?: number
  remainingFatG?: number
  nextSuggestions?: Record<string, unknown>
}

export const createSnapshot = async (input: CreateSnapshotInput) => {
  return prisma.nutritionSnapshot.create({
    data: {
      threadId: input.threadId,
      messageId: input.messageId,
      trainingType: input.trainingType ?? null,
      dayType: input.dayType ?? null,
      targetCalories: input.targetCalories,
      targetProteinG: input.targetProteinG,
      targetCarbsG: input.targetCarbsG,
      targetFatG: input.targetFatG,
      consumedCalories: input.consumedCalories,
      consumedProteinG: input.consumedProteinG,
      consumedCarbsG: input.consumedCarbsG,
      consumedFatG: input.consumedFatG,
      remainingCalories: input.remainingCalories,
      remainingProteinG: input.remainingProteinG,
      remainingCarbsG: input.remainingCarbsG,
      remainingFatG: input.remainingFatG,
      nextSuggestions: input.nextSuggestions ? JSON.stringify(input.nextSuggestions) : null,
    },
  })
}
