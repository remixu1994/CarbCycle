import {
  CarbCyclePlan,
  CarbCycleRequest,
  CarbDayType,
  MacroTargets,
} from '@/types/nutrition'

const DEFAULT_SEQUENCE: CarbDayType[] = [
  'high',
  'medium',
  'low',
  'medium',
  'high',
  'medium',
  'low',
]

const DAY_SPLITS: Record<CarbDayType, { carbShare: number; fatShare: number }> = {
  high: { carbShare: 0.75, fatShare: 0.25 },
  medium: { carbShare: 0.6, fatShare: 0.4 },
  low: { carbShare: 0.4, fatShare: 0.6 },
}

const DEFAULT_PROTEIN_PER_KG = 2
const DEFAULT_FAT_FLOOR_PER_KG = 0.8

const round = (value: number) => Math.round(value)

const resolveSequence = (sequence?: CarbDayType[]): CarbDayType[] => {
  if (!sequence || sequence.length === 0) {
    return DEFAULT_SEQUENCE
  }

  return sequence
}

const ensurePositiveCalories = (calories: number) => {
  if (!Number.isFinite(calories) || calories <= 0) {
    throw new Error('Calorie target must be greater than zero')
  }
}

const enforceCalorieConsistency = (
  targets: MacroTargets,
  desiredCalories: number,
): MacroTargets => {
  const totalCalories =
    targets.protein * 4 + targets.carbs * 4 + targets.fats * 9
  const delta = desiredCalories - totalCalories

  if (Math.abs(delta) < 4) {
    return targets
  }

  const carbAdjustment = round(delta / 4)
  return {
    ...targets,
    carbs: Math.max(0, targets.carbs + carbAdjustment),
  }
}

const buildDayTargets = (
  input: CarbCycleRequest,
  dayType: CarbDayType,
): MacroTargets => {
  ensurePositiveCalories(input.calorieTarget)

  const calories = round(input.calorieTarget)
  const proteinPerKg = input.proteinPerKg ?? DEFAULT_PROTEIN_PER_KG
  const fatFloorPerKg = input.fatFloorPerKg ?? DEFAULT_FAT_FLOOR_PER_KG

  const protein = Math.max(
    round(input.weightKg * proteinPerKg),
    round(input.weightKg * 1.4),
  )
  const proteinCalories = protein * 4

  if (proteinCalories >= calories) {
    throw new Error(
      'Calorie target too low to accommodate minimum protein requirement',
    )
  }

  const remainingCalories = calories - proteinCalories
  const split = DAY_SPLITS[dayType]

  let fatCalories = remainingCalories * split.fatShare
  let fats = round(fatCalories / 9)
  const fatFloor = round(input.weightKg * fatFloorPerKg)

  if (fats < fatFloor) {
    fats = fatFloor
    fatCalories = fats * 9
  }

  let carbs = round((calories - proteinCalories - fats * 9) / 4)
  if (carbs < 0) {
    carbs = 0
    fats = round((calories - proteinCalories) / 9)
  }

  const baseTargets: MacroTargets = {
    dayType,
    calories,
    protein,
    carbs,
    fats,
  }

  return enforceCalorieConsistency(baseTargets, calories)
}

export const calculateCarbCyclePlan = (
  input: CarbCycleRequest,
): CarbCyclePlan => {
  const sequence = resolveSequence(input.sequence)

  const days = sequence.map((dayType) => buildDayTargets(input, dayType))

  return {
    sequence,
    days,
  }
}

export const mapTrainingLoadToSequence = (
  trainingDays: ('lift' | 'cardio' | 'rest')[],
): CarbDayType[] => {
  if (trainingDays.length === 0) {
    return DEFAULT_SEQUENCE
  }

  return trainingDays.map((session) => {
    switch (session) {
      case 'lift':
        return 'high'
      case 'cardio':
        return 'medium'
      default:
        return 'low'
    }
  })
}
