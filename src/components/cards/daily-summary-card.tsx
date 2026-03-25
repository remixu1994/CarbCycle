export type SummaryMetric = {
  label: string
  value: string
  delta?: string
  intent?: string
}

export type DailySummaryCardContent = {
  readiness?: SummaryMetric
  weight?: SummaryMetric
  sleep?: SummaryMetric
  callout?: string
  actions?: string[]
}

export const DAILY_SUMMARY_FALLBACK: DailySummaryCardContent = {
  readiness: { label: 'Readiness', value: '+11 %', intent: 'Shift extra carbs today' },
  weight: { label: 'Weight', value: '68.4 kg', delta: '-0.2 kg vs avg' },
  sleep: { label: 'Sleep', value: '6 h 10 m', delta: '-45 m vs goal' },
  callout: "Agent recommends a lighter fat dinner so tomorrow's low day stays stable.",
}

export function DailySummaryCard({ content }: { content?: DailySummaryCardContent | null }) {
  const data = content ?? DAILY_SUMMARY_FALLBACK

  const metrics = [data.readiness, data.weight, data.sleep].filter(Boolean) as SummaryMetric[]
  const callout = data.callout ?? DAILY_SUMMARY_FALLBACK.callout
  const actions = data.actions ?? []

  return (
    <div className="w-full rounded-3xl border border-amber-300/40 bg-gradient-to-br from-amber-400/15 to-orange-900/10 p-5 text-left shadow-lg shadow-amber-500/30">
      <p className="text-xs uppercase tracking-[0.35em] text-amber-200">Daily Summary</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.35em] text-slate-300">{metric.label}</p>
            <p className="mt-1 text-lg font-semibold text-white">{metric.value}</p>
            {metric.delta && <p className="text-xs text-slate-400">{metric.delta}</p>}
            {metric.intent && <p className="text-xs text-amber-200">{metric.intent}</p>}
          </div>
        ))}
      </div>
      {callout && <p className="mt-4 text-sm text-slate-100">{callout}</p>}
      {actions.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-slate-300">
          {actions.map((action) => (
            <li key={action}>- {action}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
