export type MealAnalysisCardContent = {
  meal?: string
  macroBreakdown?: Array<string | { label: string; value: string }>
  score?: string
  notes?: string[]
}

export const MEAL_ANALYSIS_FALLBACK: MealAnalysisCardContent = {
  meal: 'Lunch / Salmon rice bowl',
  macroBreakdown: ['Protein 42 g', 'Carbs 55 g', 'Fats 18 g', 'Fiber 7 g'],
  score: 'B+',
  notes: [
    'Plate under target carbs by 14%',
    'Add 60 g berries or 1 slice wholegrain toast',
    'Hydration on track - 0.8 L logged',
  ],
}

export function MealAnalysisCard({ content }: { content?: MealAnalysisCardContent | null }) {
  const data = content ?? MEAL_ANALYSIS_FALLBACK
  const macroLines = (data.macroBreakdown?.length ? data.macroBreakdown : MEAL_ANALYSIS_FALLBACK.macroBreakdown) ?? []
  const notes = data.notes?.length ? data.notes : MEAL_ANALYSIS_FALLBACK.notes ?? []

  return (
    <div className="w-full rounded-3xl border border-indigo-400/40 bg-gradient-to-br from-indigo-500/10 to-cyan-800/10 p-5 text-left shadow-lg shadow-indigo-500/20">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-indigo-200">Meal Analysis</p>
          {data.meal && <p className="mt-2 text-base font-semibold text-white">{data.meal}</p>}
        </div>
        {data.score && (
          <div className="rounded-2xl border border-white/10 bg-white/10 px-3 py-1 text-center">
            <p className="text-[10px] uppercase tracking-[0.35em] text-slate-300">Score</p>
            <p className="text-lg font-semibold text-white">{data.score}</p>
          </div>
        )}
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-xs uppercase tracking-[0.3em] text-slate-200">
        {macroLines.map((entry) => {
          const label = typeof entry === 'string' ? entry : `${entry.label} ${entry.value}`
          return (
            <span key={label} className="rounded-full border border-white/15 px-3 py-1 text-emerald-50">
              {label}
            </span>
          )
        })}
      </div>
      <ul className="mt-4 space-y-2 text-sm text-slate-200">
        {notes.map((note) => (
          <li key={note} className="flex items-start gap-2">
            <span className="mt-1 inline-flex h-1.5 w-1.5 rounded-full bg-indigo-300" />
            <span>{note}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

