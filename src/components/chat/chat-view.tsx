'use client'

import Image from 'next/image'
import type { Components } from 'react-markdown'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { ChangeEvent, ComponentProps, Dispatch, DragEvent, KeyboardEvent, ReactNode, SetStateAction } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { DailySummaryCard, type DailySummaryCardContent, type SummaryMetric } from '@/components/cards/daily-summary-card'
import { DayPlanCard, type DayPlanCardContent, type MacroTarget } from '@/components/cards/day-plan-card'
import { MealAnalysisCard, type MealAnalysisCardContent } from '@/components/cards/meal-analysis-card'
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

type StreamEvent =
  | { type: 'user_message'; message: ChatMessageRecord }
  | { type: 'assistant_message'; message: ChatMessageRecord }
  | { type: 'snapshot'; snapshot: NutritionSnapshotRecord }
  | { type: 'token'; value: string }
  | { type: 'error'; error?: string }
  | { type: 'done' }

const STRUCTURED_CARD_KINDS = new Set(['day_plan_card', 'meal_analysis_card', 'daily_summary_card'])

const STREAM_CHUNK_SIZE = 3
const STREAM_TYPING_DELAY = 25

const PERSONAL_INFO_TEMPLATE = `以下是我的个人信息：
- 性别：
- 年龄：
- 身高：
- 体重：
- 体脂率：
- 每周训练天数：
- 当前目标：

请根据这些情况给我一个碳循环营养策略。`

const ONBOARDING_ACTIONS = [
  {
    id: 'carb-plan',
    title: '制定碳循环计划',
    description: '根据训练周安排输出高/中/低碳日宏量和建议。',
    prompt: '我要制定碳循环计划，请按照高碳/中碳/低碳日拆分每日热量与三大营养素。',
  },
  {
    id: 'diet-analysis',
    title: '饮食计划分析',
    description: '贴上近期饮食或菜单，生成即时分析与补充建议。',
    prompt: '帮我分析这份饮食记录，并给出需要调整的地方与下一餐建议：',
  },
  {
    id: 'training-plan',
    title: '创建训练计划',
    description: '围绕当前周期，设计耐力/力量训练安排。',
    prompt: '结合我的目标与周期，生成未来一周的训练计划。',
  },
]

type MealPhotoAttachment = {
  type: 'meal_photo'
  dataUrl: string
  name?: string
  mimeType?: string
  size?: number
}

const MEAL_PHOTO_MAX_BYTES = 4 * 1024 * 1024

export function ChatView() {
  const [mounted, setMounted] = useState(false)
  const [threads, setThreads] = useState<ConversationThread[]>([])
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)
  const [threadDetail, setThreadDetail] = useState<ThreadDetail | null>(null)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [streamingAssistant, setStreamingAssistant] = useState<ChatMessageRecord | null>(null)
  const [mealPhotoAttachment, setMealPhotoAttachment] = useState<MealPhotoAttachment | null>(null)
  const [attachmentError, setAttachmentError] = useState<string | null>(null)
  const [newThreadModalOpen, setNewThreadModalOpen] = useState(false)
  const [newThreadTitle, setNewThreadTitle] = useState('')
  const [creatingThread, setCreatingThread] = useState(false)
  const messageInputRef = useRef<HTMLInputElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const messageListRef = useRef<HTMLDivElement | null>(null)
  const tokenQueueRef = useRef<string[]>([])
  const tokenTimerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const handle = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(handle)
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
        console.error(err)
        setError('Unable to load conversations. Please refresh and try again.')
      } finally {
        setLoading(false)
      }
    }

    void bootstrap()
  }, [mounted])

  useEffect(() => {
    if (!activeThreadId) {
      setThreadDetail(null)
      return
    }

    let cancelled = false
    const loadDetail = async () => {
      setLoading(true)
      try {
        const detail = await fetchThreadDetail(activeThreadId)
        if (!cancelled) {
          setThreadDetail(detail)
        }
      } catch (err) {
        console.error(err)
        if (!cancelled) {
          setError('Unable to load the selected session.')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadDetail()

    return () => {
      cancelled = true
    }
  }, [activeThreadId])

  const triggerAttachmentPicker = () => {
    fileInputRef.current?.click()
  }

  const clearAttachment = () => {
    setMealPhotoAttachment(null)
    setAttachmentError(null)
  }

  const validateAndStoreAttachment = async (file?: File | null) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setAttachmentError('Only image files are supported.')
      return
    }
    if (file.size > MEAL_PHOTO_MAX_BYTES) {
      setAttachmentError('Image must be smaller than 4 MB.')
      return
    }

    try {
      const dataUrl = await readFileAsDataUrl(file)
      setMealPhotoAttachment({
        type: 'meal_photo',
        dataUrl,
        name: file.name,
        mimeType: file.type,
        size: file.size,
      })
      setAttachmentError(null)
    } catch (attachmentError) {
      console.error('Failed to read attachment', attachmentError)
      setAttachmentError('Could not load the selected image.')
    }
  }

  const handleAttachmentChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    await validateAndStoreAttachment(file)
    event.target.value = ''
  }

  const handleAttachmentDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    const file = event.dataTransfer?.files?.[0]
    await validateAndStoreAttachment(file)
  }

  const handleAttachmentKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      triggerAttachmentPicker()
    }
  }

  const chunkToken = (value: string) => {
    const chars = Array.from(value)
    const result: string[] = []
    let buffer = ''
    for (const char of chars) {
      buffer += char
      if (buffer.length >= STREAM_CHUNK_SIZE) {
        result.push(buffer)
        buffer = ''
      }
    }
    if (buffer) {
      result.push(buffer)
    }
    return result
  }

  const enqueueStreamToken = (token: string, currentThreadId: string, turnIndex: number) => {
    if (!token) return
    tokenQueueRef.current.push(...chunkToken(token))

    const flush = () => {
      const next = tokenQueueRef.current.shift()
      if (!next) {
        tokenTimerRef.current = null
        return
      }
      setStreamingAssistant((prev) => {
        if (!prev) {
          return createStreamingAssistantMessage(currentThreadId, turnIndex, next)
        }
        return { ...prev, contentText: `${prev.contentText ?? ''}${next}` }
      })
      tokenTimerRef.current = setTimeout(flush, STREAM_TYPING_DELAY)
    }

    if (!tokenTimerRef.current) {
      tokenTimerRef.current = setTimeout(flush, STREAM_TYPING_DELAY)
    }
  }

  const resetStreamingState = () => {
    if (tokenTimerRef.current) {
      clearTimeout(tokenTimerRef.current)
      tokenTimerRef.current = null
    }
    tokenQueueRef.current = []
    setStreamingAssistant(null)
  }

  const handleSend = async () => {
    if ((!input.trim() && !mealPhotoAttachment) || !activeThreadId) return
    setSending(true)
    setError(null)
    resetStreamingState()

    const payload: {
      threadId: string
      role: 'user'
      contentText?: string
      contentJson?: MealPhotoAttachment
    } = {
      threadId: activeThreadId,
      role: 'user',
    }

    const text = input.trim()
    if (text) {
      payload.contentText = text
    }
    if (mealPhotoAttachment) {
      payload.contentJson = mealPhotoAttachment
    }

    const threadId = activeThreadId
    const nextTurnIndex = (threadDetail?.messages.length ?? 0) + 1
    let shouldRefresh = false

    const processEvent = (event: StreamEvent) => {
      switch (event.type) {
        case 'user_message':
          setThreadDetail((prev) => (prev ? { ...prev, messages: [...prev.messages, event.message] } : prev))
          break
        case 'assistant_message':
          resetStreamingState()
          setThreadDetail((prev) => (prev ? { ...prev, messages: [...prev.messages, event.message] } : prev))
          break
        case 'snapshot':
          setThreadDetail((prev) => (prev ? { ...prev, snapshots: [event.snapshot, ...(prev.snapshots ?? [])] } : prev))
          break
        case 'token':
          if (!threadId) return
          enqueueStreamToken(event.value, threadId, nextTurnIndex)
          break
        case 'error':
          setError(event.error ?? 'Assistant failed to respond.')
          break
        case 'done':
          shouldRefresh = true
          break
        default:
          break
      }
    }

    try {
      const response = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok || !response.body) {
        const errorText = await response.text()
        throw new Error(errorText || 'Failed to send message')
      }

      setInput('')
      clearAttachment()

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) continue
          let event: StreamEvent
          try {
            event = JSON.parse(trimmed) as StreamEvent
          } catch (parseError) {
            console.error('Failed to parse stream event', parseError, trimmed)
            continue
          }
          processEvent(event)
        }
      }

      if (shouldRefresh && threadId) {
        await refreshActiveThread(threadId, setThreadDetail, setThreads)
      }
    } catch (err) {
      console.error(err)
      setError('Could not stream assistant response.')
    } finally {
      setSending(false)
      setStreamingAssistant(null)
    }
  }
  const handleCreateThread = async (title?: string) => {
    setError(null)
    setLoading(true)
    setCreatingThread(true)
    try {
      const entered = title && title.trim().length > 0 ? title.trim() : defaultThreadTitle()

      const newThread = await createThread(entered)
      setThreads((prev) => [newThread, ...prev])
      setActiveThreadId(newThread.id)
      setNewThreadModalOpen(false)
    } catch (err) {
      console.error(err)
      setError('Unable to create a new session.')
    } finally {
      setLoading(false)
      setCreatingThread(false)
    }
  }

  const handleDeleteThread = async (threadId: string) => {
    if (!threads.some((thread) => thread.id === threadId)) {
      return
    }

    if (typeof window !== 'undefined') {
      const confirmDelete = window.confirm('Delete this session and its history?')
      if (!confirmDelete) {
        return
      }
    }

    setLoading(true)
    setError(null)
    try {
      await deleteThreadRequest(threadId)
      let nextActive: string | null = activeThreadId
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
      setError('Unable to delete the session.')
    } finally {
      setLoading(false)
    }
  }

  const baseMessages = threadDetail?.messages ?? []
  const messages = streamingAssistant ? [...baseMessages, streamingAssistant] : baseMessages
  const lastSnapshot = threadDetail?.snapshots?.[0] ?? null
  const defaultThreadTitle = () => `Session ${new Date().toLocaleString()}`
  const conversationHeading = useMemo(() => {
    if (!threadDetail) {
      return { title: 'FitTrack Session', subtitle: 'Waiting for your first check-in' }
    }

    const updatedDate = new Date(threadDetail.updatedAt)
    return {
      title: threadDetail.title,
      subtitle: `Updated ${updatedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
    }
  }, [threadDetail])

  useEffect(() => {
    const container = messageListRef.current
    if (!container) return
    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' })
  }, [messages.length, streamingAssistant?.contentText])

  useEffect(() => {
    return () => {
      if (tokenTimerRef.current) {
        clearTimeout(tokenTimerRef.current)
        tokenTimerRef.current = null
      }
      tokenQueueRef.current = []
    }
  }, [])

  if (!mounted) {
    return null
  }

  const showOnboarding = !loading && (threadDetail?.messages.length ?? 0) === 0

  const handleTemplateInsert = (value: string) => {
    setInput(value)
    requestAnimationFrame(() => {
      messageInputRef.current?.focus()
      messageInputRef.current?.setSelectionRange?.(value.length, value.length)
    })
  }

  return (
    <div
      suppressHydrationWarning
      className="grid h-screen min-h-0 grid-cols-[260px_minmax(0,1fr)_320px] overflow-hidden bg-[#03050a] text-white"
    >
      <aside className="custom-scrollbar border-r border-white/10 bg-[#050910] px-4 py-6 overflow-y-auto">
        <div className="mb-8">
          <p className="text-xs uppercase tracking-[0.4em] text-emerald-300">Carb Cycle</p>
          <p className="mt-2 text-lg font-semibold text-white">Conversations</p>
        </div>
        <button
          className="mb-6 w-full rounded-2xl bg-emerald-400/90 px-4 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-slate-900 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => {
            setNewThreadTitle(defaultThreadTitle())
            setNewThreadModalOpen(true)
          }}
          disabled={loading}
        >
          New Session
        </button>
        <div className="space-y-4">
          {threads.map((thread) => (
            <div
              key={thread.id}
              className={`rounded-2xl border p-4 transition ${activeThreadId === thread.id
                ? 'border-emerald-300/60 bg-emerald-300/10'
                : 'border-white/10 bg-white/5 hover:border-emerald-200/30'
                }`}
            >
              <div className="flex items-start justify-between gap-3">
                <button
                  className="flex-1 text-left"
                  onClick={() => {
                    setActiveThreadId(thread.id)
                    setError(null)
                  }}
                >
                  <p className="text-sm font-semibold text-white">{thread.title}</p>
                  <p className="text-xs text-slate-400">{formatRelative(new Date(thread.updatedAt))}</p>
                </button>
                <button
                  onClick={() => handleDeleteThread(thread.id)}
                  aria-label={`Delete ${thread.title}`}
                  title="Delete conversation"
                  className="rounded-full p-2 text-slate-400 transition hover:bg-white/10 hover:text-rose-300"
                >
                  <TrashIcon className="h-4 w-4" />
                  <span className="sr-only">Delete</span>
                </button>
              </div>
            </div>
          ))}
          {threads.length === 0 && !loading && (
            <p className="text-sm text-slate-400">No sessions yet. Start one to sync your nutrition plan.</p>
          )}
        </div>
      </aside>

      <section className="flex min-h-0 flex-col border-r border-white/10">
        <header className="flex items-center justify-between border-b border-white/10 px-8 py-6">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-emerald-200">Live Agent</p>
            <h1 className="text-2xl font-semibold text-white">{conversationHeading.title}</h1>
            <p className="text-sm text-slate-400">{conversationHeading.subtitle}</p>
          </div>
          <span className="rounded-full bg-emerald-400/20 px-4 py-1 text-xs font-semibold text-emerald-200">Online</span>
        </header>

        <div ref={messageListRef} className="custom-scrollbar flex-1 min-h-0 overflow-y-auto px-8 py-6">
          <div className="space-y-6">
            {showOnboarding && (
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-slate-200">
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.4em] text-emerald-200">开始</p>
                  <h2 className="text-xl font-semibold text-white">告诉 FitTrack 你的需求</h2>
                  <p className="text-slate-300">
                    请先补充个人信息（性别、年龄、身高、体重、体脂、训练频率、目标），这样推荐才准确。
                  </p>
                  <button
                    type="button"
                    onClick={() => handleTemplateInsert(PERSONAL_INFO_TEMPLATE)}
                    className="mt-2 inline-flex items-center rounded-full border border-emerald-300 bg-emerald-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-emerald-100 transition hover:border-emerald-200 hover:text-white"
                  >
                    填写个人信息示例
                  </button>
                </div>
                <div className="mt-6 grid gap-4 md:grid-cols-3">
                  {ONBOARDING_ACTIONS.map((action) => (
                    <button
                      key={action.id}
                      type="button"
                      onClick={() => handleTemplateInsert(action.prompt)}
                      className="rounded-2xl border border-white/10 bg-[#0b101c] px-4 py-3 text-left text-sm text-slate-200 transition hover:border-emerald-300 hover:bg-emerald-400/5"
                    >
                      <p className="text-base font-semibold text-white">{action.title}</p>
                      <p className="mt-2 text-xs text-slate-400">{action.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((message) => {
              const isUser = message.role === 'user'
              const isCard = STRUCTURED_CARD_KINDS.has(message.kind)
              return (
                <div
                  key={message.id}
                  className={`flex flex-col gap-2 text-sm ${isUser ? 'items-end text-right' : 'items-start'}`}
                >
                  <div
                    className={`${isCard ? 'w-full max-w-2xl' : 'inline-flex max-w-2xl flex-col'} ${isCard
                      ? ''
                      : `rounded-3xl px-5 py-4 leading-relaxed shadow transition ${isUser
                        ? 'bg-emerald-400/20 text-emerald-50 shadow-emerald-500/20'
                        : 'bg-white/10 text-white shadow-black/25'
                        }`
                      }`}
                  >
                    {renderMessageContent(message)}
                  </div>
                  <span className="text-[11px] uppercase tracking-[0.3em] text-slate-400">
                    {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              )
            })}
            {messages.length === 0 && !loading && (
              <p className="text-sm text-slate-400">No messages yet. Share a meal or energy cue to begin.</p>
            )}
          </div>
        </div>

        <div className="border-t border-white/10 px-8 py-6">
          <div
            role="button"
            tabIndex={0}
            onKeyDown={handleAttachmentKeyDown}
            onClick={triggerAttachmentPicker}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              void handleAttachmentDrop(event)
            }}
            className={`mb-4 rounded-2xl border border-dashed px-4 py-3 text-sm transition focus:outline-none focus:ring-2 focus:ring-emerald-400/70 ${mealPhotoAttachment ? 'border-emerald-400 bg-emerald-400/10 text-emerald-100' : 'border-emerald-300/50 bg-emerald-300/5 text-emerald-100'
              }`}
          >
            <p className="font-semibold text-emerald-200">
              {mealPhotoAttachment ? 'Meal photo attached' : 'Upload meal photo'}
            </p>
            <p className="text-xs text-emerald-100/70">Drag & drop or click to attach for instant macro analysis (max 4 MB).</p>
            {mealPhotoAttachment && (
              <div className="mt-3 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                <Image
                  src={mealPhotoAttachment.dataUrl}
                  alt={mealPhotoAttachment.name ?? 'Meal photo attachment'}
                  width={48}
                  height={48}
                  className="h-12 w-12 rounded-xl object-cover"
                  unoptimized
                />
                <div className="flex-1 text-left text-xs text-slate-200">
                  <p className="font-semibold text-white">{mealPhotoAttachment.name ?? 'Meal photo'}</p>
                  <p className="text-[11px] uppercase tracking-[0.3em] text-emerald-200">
                    {formatFileSize(mealPhotoAttachment.size)} | {mealPhotoAttachment.mimeType ?? 'image'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    clearAttachment()
                  }}
                  className="text-[11px] uppercase tracking-[0.3em] text-rose-200 transition hover:text-rose-100"
                >
                  Remove
                </button>
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              void handleAttachmentChange(event)
            }}
          />
          {attachmentError && <p className="-mt-3 mb-4 text-xs text-rose-300">{attachmentError}</p>}
          <div className="flex gap-3 rounded-2xl bg-white/5 px-4 py-3">
            <input
              ref={messageInputRef}
              type="text"
              placeholder="Share what you ate or how you feel..."
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
              disabled={sending || (!input.trim() && !mealPhotoAttachment) || !activeThreadId}
            >
              Send
            </button>
          </div>
          {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}
        </div>
      </section>

      <aside className="custom-scrollbar flex flex-col gap-6 overflow-y-auto bg-[#050910] px-5 py-6">
        <ContextCard title="Day Plan" subtitle={lastSnapshot?.dayType ? `${toTitleCase(lastSnapshot.dayType)} carb` : 'Awaiting target'}>
          {lastSnapshot ? (
            <>
              <p className="text-sm text-slate-200">
                Target {formatValue(lastSnapshot.targetCalories, 'kcal')} and keep protein near {formatValue(lastSnapshot.targetProteinG, 'g')}.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <MacroStat label="Carbs" value={formatValue(lastSnapshot.targetCarbsG, 'g')} />
                <MacroStat label="Fats" value={formatValue(lastSnapshot.targetFatG, 'g')} />
                <MacroStat label="Left Carbs" value={formatValue(lastSnapshot.remainingCarbsG, 'g')} />
                <MacroStat label="Left Fats" value={formatValue(lastSnapshot.remainingFatG, 'g')} />
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-400">No plan yet. The agent will set targets once you log your next meal.</p>
          )}
        </ContextCard>

        <ContextCard title="Meal Analysis" subtitle={lastSnapshot ? 'Latest log' : 'Awaiting meal'}>
          {lastSnapshot ? (
            <>
              <p className="text-sm text-slate-200">
                Consumed {formatValue(lastSnapshot.consumedCalories, 'kcal')} with protein at {formatValue(lastSnapshot.consumedProteinG, 'g')}.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Tag value={`Carbs ${formatValue(lastSnapshot.consumedCarbsG, 'g')}`} />
                <Tag value={`Fats ${formatValue(lastSnapshot.consumedFatG, 'g')}`} />
                <Tag value={`Remaining ${formatValue(lastSnapshot.remainingCalories, 'kcal')}`} />
              </div>
              {lastSnapshot.nextSuggestions && (
                <div className="mt-4 space-y-1 text-sm text-slate-200">
                  {Object.values(lastSnapshot.nextSuggestions).map((suggestion) => (
                    <p key={String(suggestion)}>- {String(suggestion)}</p>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-slate-400">Log a meal photo or description to unlock real-time macro coaching.</p>
          )}
        </ContextCard>

        <ContextCard title="Daily Summary" subtitle={threadDetail ? 'Live' : 'Standby'}>
          {threadDetail ? (
            <div className="space-y-3 text-sm text-slate-200">
              <SummaryStat label="Refreshed" value={formatRelative(new Date(threadDetail.updatedAt))} annotation="Agent" />
              <SummaryStat label="Messages" value={threadDetail.messages.length.toString()} annotation="AI + you" />
              <SummaryStat label="Snapshots" value={(threadDetail.snapshots.length || 0).toString()} annotation="Nutrition cards" />
            </div>
          ) : (
            <p className="text-sm text-slate-400">Session metrics will appear once messages begin flowing.</p>
          )}
        </ContextCard>
      </aside>
      {newThreadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#050910] p-6 shadow-2xl">
            <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">New Session</p>
            <h2 className="mt-2 text-xl font-semibold text-white">Name your session</h2>
            <p className="mt-1 text-sm text-slate-400">Give this conversation a label to find it later.</p>
            <form
              className="mt-5 space-y-4"
              onSubmit={(event) => {
                event.preventDefault()
                void handleCreateThread(newThreadTitle)
              }}
            >
              <div>
                <label htmlFor="new-thread-title" className="text-xs uppercase tracking-[0.35em] text-slate-400">
                  Session name
                </label>
                <input
                  id="new-thread-title"
                  type="text"
                  value={newThreadTitle}
                  onChange={(event) => setNewThreadTitle(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-emerald-300 focus:outline-none"
                  placeholder={defaultThreadTitle()}
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-3 text-sm">
                <button
                  type="button"
                  className="rounded-full px-4 py-2 text-slate-400 transition hover:text-white"
                  onClick={() => {
                    setNewThreadModalOpen(false)
                    setNewThreadTitle('')
                  }}
                  disabled={creatingThread}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-full bg-emerald-400 px-5 py-2 font-semibold uppercase tracking-[0.3em] text-slate-900 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={creatingThread}
                >
                  {creatingThread ? 'Creating…' : 'Start'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

const createStreamingAssistantMessage = (
  threadId: string,
  turnIndex: number,
  initialText = '',
): ChatMessageRecord => ({
  id: `streaming-${threadId}`,
  threadId,
  role: 'assistant',
  kind: 'text',
  contentText: initialText,
  contentJson: null,
  turnIndex,
  createdAt: new Date().toISOString(),
})
const fetchThreads = async (): Promise<ConversationThread[]> => {
  const response = await fetch('/api/chat/threads')
  const result = (await response.json()) as ApiResponse<ConversationThread[]>
  if (!response.ok || !result.success || !result.data) {
    throw new Error(result.error?.message ?? 'Failed to load threads')
  }
  return result.data
}

const createThread = async (title?: string): Promise<ConversationThread> => {
  const fallbackTitle = `Session ${new Date().toLocaleString()}`
  const payload = {
    title: title && title.trim().length > 0 ? title.trim() : fallbackTitle,
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
  setThreads((prev) => prev.map((thread) => (thread.id === detail.id ? { ...thread, updatedAt: detail.updatedAt } : thread)))
}

const deleteThreadRequest = async (threadId: string) => {
  const response = await fetch(`/api/chat/thread/${threadId}`, { method: 'DELETE' })
  if (!response.ok) {
    const result = (await response.json()) as ApiResponse<null>
    throw new Error(result.error?.message ?? 'Failed to delete thread')
  }
}

const renderMessageContent = (message: ChatMessageRecord) => {
  switch (message.kind) {
    case 'day_plan_card':
      return <DayPlanCard content={parseDayPlanContent(message.contentJson)} />
    case 'meal_analysis_card':
      return <MealAnalysisCard content={parseMealAnalysisContent(message.contentJson)} />
    case 'daily_summary_card':
      return <DailySummaryCard content={parseDailySummaryContent(message.contentJson)} />
    default: {
      const segments: ReactNode[] = []
      if (message.contentText) {
        segments.push(
          message.role === 'assistant' ? (
            <MarkdownContent key="markdown" text={message.contentText} />
          ) : (
            <p key="text">{message.contentText}</p>
          ),
        )
      }

      const mealPhoto = toMealPhotoAttachment(message.contentJson)
      if (mealPhoto) {
        segments.push(<MealPhotoAttachmentView key="meal-photo" attachment={mealPhoto} />)
      }

      if (!mealPhoto) {
        const structured = renderStructuredContent(message.contentJson)
        if (structured) {
          segments.push(<div key="structured">{structured}</div>)
        }
      }

      if (segments.length === 0) {
        return <span className="text-slate-300">No content provided.</span>
      }

      return segments.length === 1 ? segments[0]! : <div className="space-y-3">{segments}</div>
    }
  }
}

const parseDayPlanContent = (content: Record<string, unknown> | null): DayPlanCardContent | null => {
  if (!content) return null
  const day = typeof content.day === 'string' ? content.day : undefined
  const headline = typeof content.headline === 'string' ? content.headline : undefined
  const macros = toMacroTargets(content.macros)
  const guidance = toStringArray(content.guidance)
  const trainingType = typeof content.trainingType === 'string' ? content.trainingType : undefined
  const dayType = typeof content.dayType === 'string' ? content.dayType : undefined

  if (!day && !headline && !macros && !guidance) {
    return null
  }

  return { day, headline, macros, guidance, trainingType, dayType }
}

const parseMealAnalysisContent = (content: Record<string, unknown> | null): MealAnalysisCardContent | null => {
  if (!content) return null
  const meal = typeof content.meal === 'string' ? content.meal : undefined
  const macroBreakdown = toMealBreakdown(content.macroBreakdown)
  const score = typeof content.score === 'string' ? content.score : undefined
  const notes = toStringArray(content.notes)

  if (!meal && !macroBreakdown && !score && !notes) {
    return null
  }

  return { meal, macroBreakdown, score, notes }
}

const parseDailySummaryContent = (content: Record<string, unknown> | null): DailySummaryCardContent | null => {
  if (!content) return null
  const readiness = toSummaryMetric(content.readiness)
  const weight = toSummaryMetric(content.weight)
  const sleep = toSummaryMetric(content.sleep)
  const callout = typeof content.callout === 'string' ? content.callout : undefined
  const actions = toStringArray(content.actions)

  if (!readiness && !weight && !sleep && !callout && !actions) {
    return null
  }

  return { readiness, weight, sleep, callout, actions }
}

const toMacroTargets = (value: unknown): MacroTarget[] | undefined => {
  if (!Array.isArray(value)) return undefined
  const macros = value
    .map((entry) => {
      if (!isRecord(entry)) return null
      const labelRaw = entry['label']
      const valueRaw = entry['value']
      if (typeof labelRaw !== 'string' || typeof valueRaw !== 'string') {
        return null
      }
      const annotationRaw = entry['annotation']
      return {
        label: labelRaw,
        value: valueRaw,
        annotation: typeof annotationRaw === 'string' ? annotationRaw : undefined,
      }
    })
    .filter(Boolean) as MacroTarget[]

  return macros.length ? macros : undefined
}

const toMealBreakdown = (
  value: unknown,
): MealAnalysisCardContent['macroBreakdown'] | undefined => {
  if (!Array.isArray(value)) return undefined
  const breakdown = value
    .map((entry) => {
      if (typeof entry === 'string') {
        return entry
      }
      if (isRecord(entry)) {
        const labelRaw = entry['label']
        const valueRaw = entry['value']
        if (typeof labelRaw === 'string' && typeof valueRaw === 'string') {
          return { label: labelRaw, value: valueRaw }
        }
      }
      return null
    })
    .filter(Boolean)

  return breakdown.length ? (breakdown as MealAnalysisCardContent['macroBreakdown']) : undefined
}

const toStringArray = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) return undefined
  const list = value.filter((item): item is string => typeof item === 'string')
  return list.length ? list : undefined
}

const toSummaryMetric = (value: unknown): SummaryMetric | undefined => {
  if (!isRecord(value)) return undefined
  const labelRaw = value['label']
  const metricValueRaw = value['value']
  if (typeof labelRaw !== 'string' || typeof metricValueRaw !== 'string') return undefined
  const metric: SummaryMetric = { label: labelRaw, value: metricValueRaw }
  const deltaRaw = value['delta']
  if (typeof deltaRaw === 'string') {
    metric.delta = deltaRaw
  }
  const intentRaw = value['intent']
  if (typeof intentRaw === 'string') {
    metric.intent = intentRaw
  }
  return metric
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

const toTitleCase = (value?: string | null) => {
  if (!value) return ''
  return value.charAt(0).toUpperCase() + value.slice(1)
}

const formatValue = (value: number | null | undefined, unit: string) => {
  if (typeof value !== 'number') return `-- ${unit}`
  return `${value} ${unit}`
}

const formatRelative = (date: Date) => {
  const diffMs = Date.now() - date.getTime()
  const diffMinutes = Math.floor(diffMs / 60000)
  if (diffMinutes < 1) return 'just now'
  if (diffMinutes < 60) return `${diffMinutes} min ago`
  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours} hr ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays} d ago`
}

type ReactMarkdownCodeProps = ComponentProps<'code'> & {
  inline?: boolean
  node?: unknown
}

const markdownComponents: Components = {
  a: ({ node, ...props }) => (
    <a
      {...props}
      target="_blank"
      rel="noreferrer"
      className={`text-emerald-300 underline decoration-dotted underline-offset-4 hover:text-emerald-200 ${props.className ?? ''}`.trim()}
    />
  ),
  code({ inline, className, children, ...props }: ReactMarkdownCodeProps) {
    if (inline) {
      return (
        <code {...props} className={`markdown-inline-code ${className ?? ''}`.trim()}>
          {children}
        </code>
      )
    }
    return (
      <pre className="markdown-pre">
        <code {...props} className={className}>
          {children}
        </code>
      </pre>
    )
  },
}

const MarkdownContent = ({ text }: { text: string }) => (
  <div className="markdown-body">
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
      {text}
    </ReactMarkdown>
  </div>
)

const formatFileSize = (bytes?: number) => {
  if (!bytes || bytes <= 0) return '--'
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(1)} KB`
  return `${(kb / 1024).toFixed(1)} MB`
}

const renderStructuredContent = (content: Record<string, unknown> | null) => {
  if (!content) return null
  return <pre className="text-xs text-slate-200">{JSON.stringify(content, null, 2)}</pre>
}

const MealPhotoAttachmentView = ({ attachment }: { attachment: MealPhotoAttachment }) => (
  <div className="inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-slate-200">
    <Image
      src={attachment.dataUrl}
      alt={attachment.name ?? 'Meal photo attachment'}
      width={100}
      height={100}
      className="h-[100px] w-[100px] rounded-2xl border border-white/10 object-cover"
      unoptimized
    />
    <div className="min-w-0 text-left text-xs">
      <p className="font-semibold text-white">{attachment.name ?? 'Meal photo'}</p>
      {attachment.size ? (
        <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400">{formatFileSize(attachment.size)}</p>
      ) : null}
      <p className="mt-1 text-slate-400">附件预览</p>
    </div>
  </div>
)

const toMealPhotoAttachment = (value: Record<string, unknown> | null): MealPhotoAttachment | null => {
  if (!value) return null
  if (value['type'] !== 'meal_photo') return null
  const dataUrl = value['dataUrl']
  if (typeof dataUrl !== 'string' || dataUrl.length === 0) return null
  const attachment: MealPhotoAttachment = {
    type: 'meal_photo',
    dataUrl,
  }
  if (typeof value['name'] === 'string' && value['name'].length > 0) {
    attachment.name = value['name']
  }
  if (typeof value['mimeType'] === 'string' && value['mimeType'].length > 0) {
    attachment.mimeType = value['mimeType']
  }
  if (typeof value['size'] === 'number' && Number.isFinite(value['size'])) {
    attachment.size = value['size']
  }
  return attachment
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
  children: ReactNode
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

const TrashIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M3 6h18" />
    <path d="M8 6v-1.5A1.5 1.5 0 0 1 9.5 3h5A1.5 1.5 0 0 1 16 4.5V6" />
    <path d="M19 6v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
  </svg>
)

const readFileAsDataUrl = (file: File) => {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
      } else {
        reject(new Error('Invalid reader result'))
      }
    }
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}









