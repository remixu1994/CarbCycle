import type { ReactNode } from 'react'

export type MacroTarget = {
  label: string
  value: string
  annotation?: string
}

export type DayPlanCardContent = {
  day?: string
  headline?: string
  macros?: MacroTarget[]
  guidance?: string[]
  trainingType?: string | null
  dayType?: string | null
  footer?: ReactNode
}

export const DAY_PLAN_FALLBACK: DayPlanCardContent = {
  day: 'Friday / High Carb',
  headline: 'Fuel heavy push session + protect CNS',
  macros: [
    { label: 'Calories', value: '2,450 kcal' },
    { label: 'Protein', value: '155 g' },
    { label: 'Carbs', value: '275 g' },
    { label: 'Fats', value: '60 g (min)' },
  ],
  guidance: [
    'Front-load 45% carbs pre-lift',
    'Keep fats under 15g at breakfast',
    'Add 20g intra-workout carbs if HRV stays red',
  ],
}

export type DayPlanCardProps = {
  content?: DayPlanCardContent | null
}

export function DayPlanCard({ content }: DayPlanCardProps) {
  const data = content ?? DAY_PLAN_FALLBACK
  const macros = data.macros?.length ? data.macros : DAY_PLAN_FALLBACK.macros!
  const guidance = data.guidance?.length ? data.guidance : DAY_PLAN_FALLBACK.guidance!

  return (
    <div className="w-full rounded-3xl border border-emerald-400/30 bg-gradient-to-br from-emerald-400/10 to-teal-900/10 p-5 text-left shadow-lg shadow-emerald-500/20">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.35em] text-emerald-200">
        <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
        {data.day ?? 'Day plan'}
      </div>
      {data.headline && <p className="mt-2 text-base font-semibold text-white">{data.headline}</p>}
      <div className="mt-4 grid grid-cols-2 gap-3">
        {macros.map((macro) => (
          <div key={macro.label} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
            <p className="text-[11px] uppercase tracking-[0.35em] text-slate-300">{macro.label}</p>
            <p className="mt-1 text-lg font-semibold text-white">{macro.value}</p>
            {macro.annotation && <p className="text-xs text-slate-400">{macro.annotation}</p>}
          </div>
        ))}
      </div>
      <ul className="mt-4 space-y-2 text-sm text-slate-200">
        {guidance.map((tip) => (
          <li key={tip} className="flex items-start gap-2">
            <span className="mt-1 inline-flex h-1.5 w-1.5 rounded-full bg-emerald-300" />
            <span>{tip}</span>
          </li>
        ))}
      </ul>
      {data.footer && <div className="mt-4 text-xs text-slate-400">{data.footer}</div>}
    </div>
  )
}

