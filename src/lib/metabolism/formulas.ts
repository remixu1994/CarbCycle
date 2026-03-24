import {
  ActivityLevel,
  Goal,
  MetabolismResult,
  ProfileInput,
} from '@/types/nutrition'

const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.85,
  athlete: 1.95,
}

const GOAL_ADJUSTMENTS: Record<Goal, number> = {
  fat_loss: -0.15,
  maintenance: 0,
  muscle_gain: 0.1,
}

const DEFAULT_PROTEIN_METHOD = 'mifflin-st-jeor'

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)

const roundToInt = (value: number) => Math.round(value)

export const calculateBmrKatchMcardle = ({
  weightKg,
  bodyFatPercent,
}: Pick<ProfileInput, 'weightKg' | 'bodyFatPercent'>): number => {
  if (bodyFatPercent === undefined) {
    throw new Error('Body fat percent is required for Katch-McArdle')
  }

  const normalized = clamp(bodyFatPercent, 2, 70) / 100
  const leanBodyMass = weightKg * (1 - normalized)
  return 370 + 21.6 * leanBodyMass
}

export const calculateBmrMifflinStJeor = ({
  sex,
  weightKg,
  heightCm,
  age,
}: ProfileInput): number => {
  const sexOffset = sex === 'male' ? 5 : -161
  return 10 * weightKg + 6.25 * heightCm - 5 * age + sexOffset
}

export const calculateBaseBmr = (
  profile: ProfileInput,
): { value: number; method: MetabolismResult['method'] } => {
  if (typeof profile.bodyFatPercent === 'number') {
    return {
      value: calculateBmrKatchMcardle(profile),
      method: 'katch-mcardle',
    }
  }

  return {
    value: calculateBmrMifflinStJeor(profile),
    method: DEFAULT_PROTEIN_METHOD,
  }
}

export const calculateTdee = (
  bmr: number,
  activityLevel: ActivityLevel,
): number => {
  const factor = ACTIVITY_FACTORS[activityLevel] ?? ACTIVITY_FACTORS.sedentary
  return bmr * factor
}

export const calculateCalorieTarget = (
  tdee: number,
  goal: Goal = 'maintenance',
): number => {
  const adjustment = GOAL_ADJUSTMENTS[goal] ?? 0
  return tdee * (1 + adjustment)
}

export const evaluateMetabolism = (profile: ProfileInput): MetabolismResult => {
  const { value: rawBmr, method } = calculateBaseBmr(profile)
  const bmr = roundToInt(rawBmr)
  const tdee = roundToInt(calculateTdee(bmr, profile.activityLevel))
  const calorieTarget = roundToInt(
    calculateCalorieTarget(tdee, profile.goal ?? 'maintenance'),
  )

  return {
    bmr,
    method,
    tdee,
    calorieTarget,
  }
}
