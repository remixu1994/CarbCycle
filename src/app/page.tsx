const agentMessages = [
  {
    id: 1,
    sender: 'agent',
    text: 'Pulled your latest profile—68kg, 22% body fat, moderate training load. Targeting 2.2g/kg protein.',
    timestamp: '08:14',
  },
  {
    id: 2,
    sender: 'user',
    text: 'Uploading lunch: salmon rice bowl with matcha.',
    timestamp: '08:16',
    attachment: 'salmon-bowl.jpg',
  },
  {
    id: 3,
    sender: 'agent',
    text: 'Reading the plate: 42g protein · 55g carbs · 18g fats. Trending 14% under carbs for today—add 60g berries next meal.',
    timestamp: '08:16',
  },
]

const capabilities = [
  {
    title: 'Profile Intelligence',
    body: 'Understands your biometrics, goals, and recovery windows to set live calorie targets.',
  },
  {
    title: 'Adaptive Carb Maps',
    body: 'Sequences high / medium / low days automatically based on training stress and sleep.',
  },
  {
    title: 'Meal Forensics',
    body: 'Breaks down every plate, flags macro drift, and tells you what to fix next.',
  },
]

const carbTimeline = [
  { day: 'MON', type: 'high', carbs: 265, protein: 150, fats: 60 },
  { day: 'TUE', type: 'medium', carbs: 210, protein: 150, fats: 70 },
  { day: 'WED', type: 'low', carbs: 150, protein: 150, fats: 80 },
  { day: 'THU', type: 'medium', carbs: 210, protein: 150, fats: 70 },
  { day: 'FRI', type: 'high', carbs: 275, protein: 155, fats: 60 },
  { day: 'SAT', type: 'medium', carbs: 200, protein: 145, fats: 75 },
  { day: 'SUN', type: 'low', carbs: 140, protein: 140, fats: 85 },
]

export default function Home() {
  return (
    <main className="min-h-screen bg-[#03050a] text-slate-100">
      <div className="relative overflow-hidden">
        <div
          className="absolute inset-0 -z-10 opacity-80"
          style={{
            backgroundImage:
              "linear-gradient(120deg, rgba(6,8,13,0.95) 20%, rgba(7,16,24,0.6) 60%), url('https://images.unsplash.com/photo-1507537509458-b8312d35a233?auto=format&fit=crop&w=1600&q=80')",
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#03050a] via-transparent to-[#04020a]" />
        <section className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 py-24 lg:flex-row">
          <div className="flex-1 space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-1 text-xs uppercase tracking-[0.3em] text-emerald-300/90">
              FitTrack Agent Loop
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.4em] text-slate-300">
                Carb Cycling Intelligence
              </p>
              <h1 className="mt-4 max-w-xl text-4xl font-semibold leading-tight text-white sm:text-5xl">
                One-on-one AI dietitian that adapts every plate, every training day.
              </h1>
              <p className="mt-6 max-w-lg text-base text-slate-200">
                FitTrack Agent keeps a rolling conversation with your body data—calculates BMR/TDEE, remaps carb
                days, and audits meals in seconds. Drop a photo or type a note, the loop handles the rest.
              </p>
            </div>
            <div className="flex flex-wrap gap-4">
              <button className="rounded-full bg-emerald-400 px-6 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-emerald-400/30 transition hover:translate-y-0.5 hover:bg-emerald-300">
                Start Session
              </button>
              <button className="rounded-full border border-white/30 px-6 py-3 text-sm font-semibold text-white transition hover:border-white">
                View Protocol
              </button>
            </div>
            <div className="flex items-center gap-3 text-xs uppercase tracking-[0.3em] text-slate-400">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
              Logged macros stay in sync across dashboard, planner, and meal log.
            </div>
          </div>

          <div className="flex-1">
            <div className="relative mx-auto max-w-lg rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-emerald-500/10 backdrop-blur">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">Live Agent</p>
                  <p className="text-lg font-semibold text-white">FitTrack Loop</p>
                </div>
                <span className="rounded-full bg-emerald-400/20 px-4 py-1 text-xs font-semibold text-emerald-200">
                  Online
                </span>
              </div>
              <div className="space-y-4">
                {agentMessages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex flex-col gap-2 text-sm ${
                      message.sender === 'user' ? 'items-end text-right' : 'items-start'
                    }`}
                  >
                    <div
                      className={`max-w-sm rounded-2xl px-4 py-3 leading-relaxed shadow ${
                        message.sender === 'user'
                          ? 'bg-emerald-400/20 text-emerald-50 shadow-emerald-500/20'
                          : 'bg-white/10 text-white shadow-black/20'
                      }`}
                    >
                      {message.text}
                      {message.attachment && (
                        <div className="mt-3 flex items-center gap-3 rounded-2xl border border-dashed border-white/30 px-3 py-2 text-xs text-slate-200">
                          <span className="h-10 w-10 rounded-xl bg-white/10" />
                          <div className="text-left">
                            <p className="font-semibold text-white">Meal photo</p>
                            <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400">
                              {message.attachment}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                    <span className="text-[11px] uppercase tracking-[0.3em] text-slate-400">{message.timestamp}</span>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-2xl border border-dashed border-emerald-300/50 bg-emerald-300/5 p-4 text-center text-sm text-emerald-100">
                <p className="font-semibold text-emerald-200">Upload meal photo</p>
                <p className="text-xs text-emerald-100/80">Drag & drop or tap to attach for instant macro analysis</p>
              </div>

              <div className="mt-4 flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-3">
                <input
                  type="text"
                  placeholder="Share what you ate or how you feel…"
                  className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-400 focus:outline-none"
                />
                <button className="rounded-full bg-emerald-400/90 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-slate-900 transition hover:bg-emerald-300">
                  Send
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="border-t border-white/10 bg-[#040710]">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="mb-10 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Agent Capabilities</p>
              <h2 className="mt-3 text-3xl font-semibold text-white">Designed as a coach, not a dashboard.</h2>
            </div>
            <span className="hidden rounded-full border border-white/20 px-5 py-2 text-xs uppercase tracking-[0.4em] text-slate-300 lg:inline-flex">
              Precision-first
            </span>
          </div>
          <div className="grid gap-8 lg:grid-cols-3">
            {capabilities.map((item) => (
              <div key={item.title} className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-black/30">
                <p className="text-sm uppercase tracking-[0.4em] text-emerald-200">{item.title}</p>
                <p className="mt-4 text-base text-slate-100">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-white/5 bg-[#03050a]">
        <div className="mx-auto grid max-w-6xl gap-12 px-6 py-20 lg:grid-cols-2">
          <div className="space-y-6 lg:sticky lg:top-8">
            <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Daily Dialogue</p>
            <h3 className="text-3xl font-semibold text-white">Agent keeps context as your week evolves.</h3>
            <p className="text-base text-slate-300">
              Scroll the transcript to see how macro corrections adapt when stress, training, or sleep shifts. Every log
              drives new carb sequences without leaving the conversation.
            </p>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-black/30">
              <div className="space-y-4 text-sm leading-relaxed text-slate-100">
                <p className="text-emerald-200">Agent · Thursday 06:10</p>
                <p>
                  Training load trending 11% higher vs plan. Sliding Friday into a high-carb day and boosting breakfast by
                  35g carbs to protect CNS recovery.
                </p>
                <p className="text-emerald-200">Agent · Saturday 09:02</p>
                <p>
                  Sleep dipped to 6h10m. Tighten Saturday dinner fats to 55g, keep protein steady. Expect weight to hold
                  flat while glycogen reloads.
                </p>
              </div>
            </div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 to-white/0 p-6 shadow-2xl shadow-emerald-500/10">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Macro Timeline</p>
                <p className="text-lg font-semibold text-white">Weekly Carb Cycle</p>
              </div>
              <span className="rounded-full bg-white/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-slate-200">
                Auto
              </span>
            </div>
            <div className="space-y-4">
              {carbTimeline.map((day) => (
                <div key={day.day} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
                  <div className="w-14 text-xs font-semibold text-slate-300">{day.day}</div>
                  <div
                    className={`rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.3em] ${
                      day.type === 'high'
                        ? 'bg-emerald-400/20 text-emerald-200'
                        : day.type === 'medium'
                          ? 'bg-indigo-400/20 text-indigo-200'
                          : 'bg-amber-400/20 text-amber-200'
                    }`}
                  >
                    {day.type} carb
                  </div>
                  <div className="ml-auto text-right text-xs text-slate-300">
                    <p>Carbs {day.carbs}g</p>
                    <p>Protein {day.protein}g · Fats {day.fats}g</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 px-4 py-5 text-sm text-slate-200">
              <p className="font-semibold text-white">Precision Guard</p>
              <p className="mt-2 text-slate-300">
                Fat floor locked at 0.8g/kg and protein never drops below 2g/kg. Agent reruns metabolism formulas every
                time you log meals or weight.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-white/5 bg-[#04070f]">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 px-6 py-16 text-center">
          <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Ready To Loop</p>
          <h4 className="text-3xl font-semibold text-white">Unlock your weekly protocol.</h4>
          <p className="max-w-2xl text-base text-slate-300">
            Start a session and the agent immediately calculates BMR, TDEE, and macro targets before your first meal arrives.
          </p>
          <button className="rounded-full bg-emerald-400 px-8 py-4 text-sm font-semibold uppercase tracking-[0.3em] text-slate-900 shadow-lg shadow-emerald-400/30 transition hover:bg-emerald-300">
            Enter Dashboard
          </button>
        </div>
      </section>
    </main>
  )
}
