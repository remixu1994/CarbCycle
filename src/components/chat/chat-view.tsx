'use client'

import type { Dispatch, SetStateAction } from 'react'
import { useEffect, useMemo, useState } from 'react'

import { ApiResponse } from '@/types/api'

type ConversationThread = {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  archivedAt: string | null
}

type ChatMessageRecord = {
  id: string
  threadId: string
  role: 'user' | 'assistant' | 'system'
  kind: string
  contentText: string | null
  contentJson: Record<string, unknown> | null
  turnIndex: number
  createdAt: string
}

type NutritionSnapshotRecord = {
  id: string
  threadId: string
  messageId: string
  trainingType: string | null
  dayType: string | null
  targetCalories: number | null
  targetProteinG: number | null
  targetCarbsG: number | null
  targetFatG: number | null
  consumedCalories: number | null
  consumedProteinG: number | null
  consumedCarbsG: number | null
  consumedFatG: number | null
  remainingCalories: number | null
  remainingProteinG: number | null
  remainingCarbsG: number | null
  remainingFatG: number | null
  nextSuggestions: Record<string, unknown> | null
  createdAt: string
}

type ThreadDetail = ConversationThread & {
  messages: ChatMessageRecord[]
  snapshots: NutritionSnapshotRecord[]
}

const dayPlan = {
  day: 'Friday · High Carb',
  headline: 'Fuel heavy push session + protect CNS',
  macros: [
    { label: 'Calories', value: '2,450 kcal' },
    { label: 'Protein', value: '155 g' },
    { label: 'Carbs', value: '275 g' },
    { label: 'Fats', value: '60 g (floor locked)' },
  ],
  guidance: [
    'Front-load 45% carbs pre-lift',
    'Keep fats under 15g at breakfast',
    'Add 20g intra-workout carbs if HRV stays red',
  ],
}

const mealAnalysis = {
  meal: 'Lunch · Salmon rice bowl',
  macroBreakdown: ['Protein 42g', 'Carbs 55g', 'Fats 18g', 'Fiber 7g'],
  score: 'B+',
  notes: [
    'Plate under target carbs by 14%',
    'Add 60g berries or 1 slice wholegrain toast',
    'Hydration on track · 0.8L so far today',
  ],
}

const dailySummary = {
  readiness: { label: 'Load', value: '+11%', intent: 'Shift extra carbs to today' },
  weight: { label: 'Weight', value: '68.4 kg', delta: '▲ 0.2 kg vs weekly avg' },
  sleep: { label: 'Sleep', value: '6h 10m', delta: '▼ 45m vs goal' },
  callout:
    'Agent resurfaced carb map changes and recommended a lighter fat dinner to stabilize tomorrow’s low day.',
}

export function ChatView() {
  const [mounted, setMounted] = useState(false)
  const [threads, setThreads] = useState<ConversationThread[]>([])
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)
  const [threadDetail, setThreadDetail] = useState<ThreadDetail | null>(null)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    if (!mounted) return
    const bootstrap = async () => {
      setLoading(true)
      try {
        const fetchedThreads = await fetchThreads()
        if (fetchedThreads.length === 0) {
          const thread = await createThread()
          setThreads([thread])
          setActiveThreadId(thread.id)
        } else {
          setThreads(fetchedThreads)
          setActiveThreadId((current) => current ?? fetchedThreads[0]?.id ?? null)
        }
      } catch (err) {
        setError('无法加载会话。请稍后再试。')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    bootstrap()
  }, [mounted])

  useEffect(() => {
    if (!activeThreadId) {
      setThreadDetail(null)
      return
    }

    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const detail = await fetchThreadDetail(activeThreadId)
        if (!cancelled) {
          setThreadDetail(detail)
        }
      } catch (err) {
        if (!cancelled) {
          setError('无法获取消息记录。')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [activeThreadId])

  const handleSend = async () => {
    if (!input.trim() || !activeThreadId) return
    setSending(true)
    setError(null)
    const payload = {
      threadId: activeThreadId,
      role: 'user' as const,
      contentText: input.trim(),
    }

    try {
      const response = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const result = (await response.json()) as ApiResponse<{ message: ChatMessageRecord }>

      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.error?.message ?? '发送失败')
      }

      setInput('')
      await refreshActiveThread(activeThreadId, setThreadDetail, setThreads)
    } catch (err) {
      console.error(err)
      setError('发送失败，请稍后重试。')
    } finally {
      setSending(false)
    }
  }

  const handleCreateThread = async () => {
    setLoading(true)
    setError(null)
    try {
      const defaultTitle = `Session ${new Date().toLocaleString()}`
      const entered = typeof window !== 'undefined' ? window.prompt('新建会话标题', defaultTitle) : defaultTitle
      if (entered === null) {
        setLoading(false)
        return
      }
      const finalTitle = entered.trim().length > 0 ? entered.trim() : defaultTitle

      const newThread = await createThread(finalTitle)
      setThreads((prev) => [newThread, ...prev])
      setActiveThreadId(newThread.id)
    } catch (err) {
      console.error(err)
      setError('无法创建新的会话。')
    } finally {
      setLoading(false)
    }
  }

  const messages = threadDetail?.messages ?? []
  const lastSnapshot = threadDetail?.snapshots?.[0] ?? null
  const conversationHeading = useMemo(() => {
    if (!threadDetail) {
      return { title: 'FitTrack Session', subtitle: '加载中...' }
    }

    const updatedDate = new Date(threadDetail.updatedAt)
    return {
      title: threadDetail.title,
      subtitle: `上次同步 ${updatedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
    }
  }, [threadDetail])

  if (!mounted) {
    return <div suppressHydrationWarning className="min-h-screen bg-[#03050a]" />
  }

  return (
    <div
      suppressHydrationWarning
      className="grid min-h-screen grid-cols-[260px_minmax(0,1fr)_320px] bg-[#03050a] text-white"
    >
      <aside className="border-r border-white/10 bg-[#050910] px-4 py-6">
        <div className="mb-8">
          <p className="text-xs uppercase tracking-[0.4em] text-emerald-300">FitTrack Loop</p>
          <p className="mt-2 text-lg font-semibold text-white">Conversations</p>
        </div>
        <button
          className="mb-6 w-full rounded-2xl bg-emerald-400/90 px-4 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-slate-900 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={handleCreateThread}
          disabled={loading}
        >
          New Session
        </button>
        <div className="space-y-4">
          {threads.map((thread) => (
            <div
              key={thread.id}
              className={`rounded-2xl border p-4 transition ${
                activeThreadId === thread.id
                  ? 'border-emerald-300/60 bg-emerald-300/10'
                  : 'border-white/10 bg-white/5 hover:border-emerald-200/30'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <button
                  onClick={() => setActiveThreadId(thread.id)}
                  className="text-left"
                >
                  <p className="text-sm font-semibold text-white">{thread.title}</p>
                  <p className="mt-2 text-[11px] uppercase tracking-[0.35em] text-slate-400">
                    {formatRelative(new Date(thread.updatedAt))}
                  </p>
                </button>
                <button
                  onClick={() => handleDeleteThread(thread.id)}
                  className="text-xs uppercase tracking-[0.3em] text-slate-400 hover:text-rose-300"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
          {threads.length === 0 && !loading && (
            <p className="text-sm text-slate-400">暂无会话，点击上方按钮创建。</p>
          )}
        </div>
      </aside>

      <section className="flex flex-col border-r border-white/10">
        <header className="flex items-center justify-between border-b border-white/10 px-8 py-6">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-emerald-200">Live Agent</p>
            <h1 className="text-2xl font-semibold text-white">{conversationHeading.title}</h1>
            <p className="text-sm text-slate-400">{conversationHeading.subtitle}</p>
          </div>
          <span className="rounded-full bg-emerald-400/20 px-4 py-1 text-xs font-semibold text-emerald-200">Online</span>
        </header>

        <div className="flex-1 overflow-y-auto px-8 py-6">
          <div className="space-y-6">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex flex-col gap-2 text-sm ${
                  message.role === 'user' ? 'items-end text-right' : 'items-start'
                }`}
              >
                <div
                  className={`max-w-2xl rounded-3xl px-5 py-4 leading-relaxed shadow transition ${
                    message.role === 'user'
                      ? 'bg-emerald-400/20 text-emerald-50 shadow-emerald-500/20'
                      : 'bg-white/10 text-white shadow-black/25'
                  }`}
                >
                  {message.contentText ?? renderStructuredContent(message.contentJson)}
                </div>
                <span className="text-[11px] uppercase tracking-[0.3em] text-slate-400">
                  {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
            {messages.length === 0 && !loading && (
              <p className="text-sm text-slate-400">还没有消息，发送第一条吧。</p>
            )}
          </div>
        </div>

        <div className="border-t border-white/10 px-8 py-6">
          <div className="mb-4 rounded-2xl border border-dashed border-emerald-300/50 bg-emerald-300/5 px-4 py-3 text-sm text-emerald-100">
            <p className="font-semibold text-emerald-200">Upload meal photo</p>
            <p className="text-xs text-emerald-100/70">Drag & drop or click to attach for instant macro analysis.</p>
          </div>
          <div className="flex gap-3 rounded-2xl bg-white/5 px-4 py-3">
            <input
              type="text"
              placeholder="Share what you ate or how you feel…"
              className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-400 focus:outline-none"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  handleSend()
                }
              }}
            />
            <button
              className="rounded-full bg-emerald-400/90 px-5 py-2 text-xs font-semibold uppercase tracking-[0.4em] text-slate-900 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={handleSend}
              disabled={sending || !input.trim() || !activeThreadId}
            >
              Send
            </button>
          </div>
          {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}
        </div>
      </section>

      <aside className="flex flex-col gap-6 bg-[#050910] px-5 py-6">
        <ContextCard title="Day Plan" subtitle={lastSnapshot?.dayType ? `${lastSnapshot.dayType} carb` : '待生成'}>
          {lastSnapshot ? (
            <>
              <p className="text-sm text-slate-200">
                目标热量 {lastSnapshot.targetCalories ?? '—'} kcal，蛋白 {lastSnapshot.targetProteinG ?? '—'} g
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <MacroStat label="Carbs" value={formatValue(lastSnapshot.targetCarbsG, 'g')} />
                <MacroStat label="Fats" value={formatValue(lastSnapshot.targetFatG, 'g')} />
                <MacroStat label="Left Carbs" value={formatValue(lastSnapshot.remainingCarbsG, 'g')} />
                <MacroStat label="Left Fats" value={formatValue(lastSnapshot.remainingFatG, 'g')} />
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-400">尚未生成日计划。</p>
          )}
        </ContextCard>

        <ContextCard title="Meal Analysis" subtitle={lastSnapshot ? '最新分析' : '等待分析'}>
          {lastSnapshot ? (
            <>
              <p className="text-sm text-slate-200">
                已摄入 {formatValue(lastSnapshot.consumedCalories, 'kcal')} · 蛋白{' '}
                {formatValue(lastSnapshot.consumedProteinG, 'g')}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Tag value={`Carbs ${formatValue(lastSnapshot.consumedCarbsG, 'g')}`} />
                <Tag value={`Fats ${formatValue(lastSnapshot.consumedFatG, 'g')}`} />
                <Tag value={`Remain ${formatValue(lastSnapshot.remainingCalories, 'kcal')}`} />
              </div>
              {lastSnapshot.nextSuggestions && (
                <div className="mt-4 space-y-1 text-sm text-slate-200">
                  {Object.values(lastSnapshot.nextSuggestions).map((suggestion) => (
                    <p key={String(suggestion)}>• {String(suggestion)}</p>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-slate-400">上传餐食后将展示营养分析。</p>
          )}
        </ContextCard>

        <ContextCard title="Daily Summary" subtitle={threadDetail ? 'Live' : '等待数据'}>
          {threadDetail ? (
            <div className="space-y-3 text-sm text-slate-200">
              <SummaryStat label="更新" value={formatRelative(new Date(threadDetail.updatedAt))} annotation="Agent" />
              <SummaryStat
                label="消息数"
                value={threadDetail.messages.length.toString()}
                annotation="含AI建议"
              />
              <SummaryStat
                label="快照"
                value={(threadDetail.snapshots.length || 0).toString()}
                annotation="最新营养概览"
              />
            </div>
          ) : (
            <p className="text-sm text-slate-400">等待加载数据...</p>
          )}
        </ContextCard>
      </aside>
    </div>
  )
}

const fetchThreads = async (): Promise<ConversationThread[]> => {
  const response = await fetch('/api/chat/threads')
  const result = (await response.json()) as ApiResponse<ConversationThread[]>
  if (!response.ok || !result.success || !result.data) {
    throw new Error(result.error?.message ?? 'Failed to load threads')
  }
  return result.data
}

const createThread = async (title: string): Promise<ConversationThread> => {
  const payload = {
    title,
  }

  const response = await fetch('/api/chat/threads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const result = (await response.json()) as ApiResponse<ConversationThread>
  if (!response.ok || !result.success || !result.data) {
    throw new Error(result.error?.message ?? 'Failed to create thread')
  }

  return result.data
}

const fetchThreadDetail = async (threadId: string): Promise<ThreadDetail> => {
  const response = await fetch(`/api/chat/thread/${threadId}`)
  const result = (await response.json()) as ApiResponse<ThreadDetail>
  if (!response.ok || !result.success || !result.data) {
    throw new Error(result.error?.message ?? 'Failed to load thread')
  }
  return result.data
}

const refreshActiveThread = async (
  threadId: string,
  setThreadDetail: Dispatch<SetStateAction<ThreadDetail | null>>,
  setThreads: Dispatch<SetStateAction<ConversationThread[]>>,
) => {
  const detail = await fetchThreadDetail(threadId)
  setThreadDetail(detail)
  setThreads((prev) =>
    prev.map((thread) => (thread.id === detail.id ? { ...thread, updatedAt: detail.updatedAt } : thread)),
  )
}

const deleteThreadRequest = async (threadId: string) => {
  const response = await fetch(`/api/chat/thread/${threadId}`, { method: 'DELETE' })
  if (!response.ok) {
    const result = (await response.json()) as ApiResponse<null>
    throw new Error(result.error?.message ?? 'Failed to delete thread')
  }
}

const formatValue = (value: number | null | undefined, unit: string) => {
  if (typeof value !== 'number') return `— ${unit}`
  return `${value} ${unit}`
}

const formatRelative = (date: Date) => {
  const diffMs = Date.now() - date.getTime()
  const diffMinutes = Math.floor(diffMs / 60000)
  if (diffMinutes < 1) return '刚刚'
  if (diffMinutes < 60) return `${diffMinutes} 分钟前`
  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours} 小时前`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays} 天前`
}

const renderStructuredContent = (content: Record<string, unknown> | null) => {
  if (!content) return null
  return (
    <pre className="text-xs text-slate-200">
      {JSON.stringify(content, null, 2)}
    </pre>
  )
}

const MacroStat = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
    <p className="text-[11px] uppercase tracking-[0.35em] text-slate-400">{label}</p>
    <p className="mt-1 font-semibold text-white">{value}</p>
  </div>
)

const Tag = ({ value }: { value: string }) => (
  <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-slate-100">{value}</span>
)

type ContextCardProps = {
  title: string
  subtitle: string
  children: React.ReactNode
}

function ContextCard({ title, subtitle, children }: ContextCardProps) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-lg shadow-black/30">
      <p className="text-xs uppercase tracking-[0.35em] text-emerald-200">{title}</p>
      <p className="mt-1 text-sm font-semibold text-white">{subtitle}</p>
      <div className="mt-4">{children}</div>
    </div>
  )
}

type SummaryStatProps = {
  label: string
  value: string
  annotation: string
}

function SummaryStat({ label, value, annotation }: SummaryStatProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
      <p className="text-[11px] uppercase tracking-[0.35em] text-slate-400">{label}</p>
      <p className="mt-1 text-white">{value}</p>
      <p className="text-xs text-slate-400">{annotation}</p>
    </div>
  )
}
  const handleDeleteThread = async (threadId: string) => {
    if (!threads.some((thread) => thread.id === threadId)) {
      return
    }

    if (typeof window !== 'undefined') {
      const confirmDelete = window.confirm('确定要删除该会话吗？此操作无法撤销。')
      if (!confirmDelete) {
        return
      }
    }

    setLoading(true)
    setError(null)
    try {
      await deleteThreadRequest(threadId)
      let nextActive: string | null = null
      setThreads((prev) => {
        const updated = prev.filter((thread) => thread.id !== threadId)
        if (threadId === activeThreadId) {
          nextActive = updated[0]?.id ?? null
        }
        return updated
      })

      if (threadId === activeThreadId) {
        setThreadDetail(null)
        setActiveThreadId(nextActive)
      }
    } catch (err) {
      console.error(err)
      setError('删除会话失败，请稍后重试。')
    } finally {
      setLoading(false)
    }
  }
