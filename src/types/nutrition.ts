export type Sex = 'male' | 'female'

export type ActivityLevel =
  | 'sedentary'
  | 'light'
  | 'moderate'
  | 'active'
  | 'very_active'
  | 'athlete'

export type Goal = 'fat_loss' | 'maintenance' | 'muscle_gain'

export type CarbDayType = 'high' | 'medium' | 'low'

export interface ProfileInput {
  sex: Sex
  age: number
  heightCm: number
  weightKg: number
  bodyFatPercent?: number
  activityLevel: ActivityLevel
  goal?: Goal
}

export interface MetabolismResult {
  bmr: number
  method: 'katch-mcardle' | 'mifflin-st-jeor'
  tdee: number
  calorieTarget: number
}

export interface MacroTargets {
  dayType: CarbDayType
  calories: number
  protein: number
  carbs: number
  fats: number
}

export interface CarbCycleRequest {
  calorieTarget: number
  weightKg: number
  sequence?: CarbDayType[]
  proteinPerKg?: number
  fatFloorPerKg?: number
}

export interface CarbCyclePlan {
  sequence: CarbDayType[]
  days: MacroTargets[]
}
