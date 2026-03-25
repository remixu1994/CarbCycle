import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { prisma } from '@/server/db/prisma'
import { createMessage, getMessagesForThread } from '@/server/repositories/message-repository'
import { createSnapshot } from '@/server/repositories/snapshot-repository'
import { touchThread } from '@/server/repositories/thread-repository'
import {
  streamAzureChatCompletion,
  type AzureChatMessage,
  type AzureMessageContentPart,
} from '@/server/services/azure-openai'
import { ApiResponse } from '@/types/api'

const messageRoleSchema = z.enum(['user', 'assistant', 'system'])
const messageKindSchema = z.enum([
  'text',
  'metric_card',
  'day_plan_card',
  'meal_analysis_card',
  'daily_summary_card',
  'event',
])

const trainingTypeSchema = z.enum(['lower', 'upper', 'rest'])
const dayTypeSchema = z.enum(['high', 'medium', 'low'])

const snapshotSchema = z
  .object({
    trainingType: trainingTypeSchema.optional(),
    dayType: dayTypeSchema.optional(),
    targetCalories: z.number().int().optional(),
    targetProteinG: z.number().int().optional(),
    targetCarbsG: z.number().int().optional(),
    targetFatG: z.number().int().optional(),
    consumedCalories: z.number().int().optional(),
    consumedProteinG: z.number().optional(),
    consumedCarbsG: z.number().optional(),
    consumedFatG: z.number().optional(),
    remainingCalories: z.number().int().optional(),
    remainingProteinG: z.number().optional(),
    remainingCarbsG: z.number().optional(),
    remainingFatG: z.number().optional(),
    nextSuggestions: z.record(z.unknown()).optional(),
  })
  .partial()

const messagePayloadSchema = z.object({
  threadId: z.string().min(10).max(64),
  role: messageRoleSchema,
  kind: messageKindSchema.optional(),
  contentText: z.string().min(1).optional(),
  contentJson: z.record(z.unknown()).optional(),
  snapshot: snapshotSchema.optional(),
})

const respond = <T>(body: ApiResponse<T>, init?: ResponseInit) => NextResponse.json(body, init)

const attachmentBaseUrl = (() => {
  const candidate =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.PUBLIC_APP_URL?.trim() ||
    process.env.APP_BASE_URL?.trim() ||
    (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : '')
  return candidate.replace(/\/$/, '')
})()

const canExposeAttachmentBase = (() => {
  if (!attachmentBaseUrl) return false
  try {
    const url = new URL(attachmentBaseUrl)
    const host = url.hostname.toLowerCase()
    const protocolValid = url.protocol === 'https:'
    const isLoopback = host === 'localhost' || host === '127.0.0.1' || host === '::1'
    const isPrivate =
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)

    return protocolValid && !isLoopback && !isPrivate
  } catch (error) {
    console.error('Invalid PUBLIC_APP_URL for attachments', error)
    return false
  }
})()

export async function POST(request: NextRequest) {
  try {
    const json = await request.json()
    const parsed = messagePayloadSchema.safeParse(json)
    if (!parsed.success) {
      return respond(
        {
          success: false,
          error: {
            code: 'INVALID_BODY',
            message: 'Invalid payload for message creation',
            details: parsed.error.flatten(),
          },
        },
        { status: 400 },
      )
    }

    const thread = await prisma.conversationThread.findUnique({
      where: { id: parsed.data.threadId },
    })

    if (!thread) {
      return respond(
        {
          success: false,
          error: {
            code: 'THREAD_NOT_FOUND',
            message: 'Thread not found',
          },
        },
        { status: 404 },
      )
    }

    if (!parsed.data.contentText && !parsed.data.contentJson && !parsed.data.snapshot) {
      return respond(
        {
          success: false,
          error: {
            code: 'EMPTY_MESSAGE',
            message: 'Message requires text, structured content, or a snapshot payload',
          },
        },
        { status: 400 },
      )
    }

    const createdMessage = await createMessage({
      threadId: parsed.data.threadId,
      role: parsed.data.role,
      kind: parsed.data.kind,
      contentText: parsed.data.contentText,
      contentJson: parsed.data.contentJson,
    })

    let snapshot = null
    if (parsed.data.snapshot) {
      const createdSnapshot = await createSnapshot({
        threadId: parsed.data.threadId,
        messageId: createdMessage.id,
        ...parsed.data.snapshot,
      })
      snapshot = deserializeSnapshot(createdSnapshot)
    }

    const initialMessage = deserializeMessage(createdMessage)

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder()
        const queue = (payload: StreamPayload) => {
          controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`))
        }

        queue({ type: 'user_message', message: initialMessage })
        if (snapshot) {
          queue({ type: 'snapshot', snapshot })
        }

        ;(async () => {
          try {
            const history = await getMessagesForThread(parsed.data.threadId)
            const azureMessages = history
              .map(toAzureChatMessage)
              .filter((message): message is AzureChatMessage => Boolean(message))

            if (azureMessages.length === 0) {
              queue({ type: 'error', error: 'No conversation context found.' })
              queue({ type: 'done' })
              controller.close()
              return
            }

            const finalText = await streamAzureChatCompletion(azureMessages, (token) => {
              if (token) {
                queue({ type: 'token', value: token })
              }
            })

            if (finalText.trim().length > 0) {
              const assistantRecord = await createMessage({
                threadId: parsed.data.threadId,
                role: 'assistant',
                kind: 'text',
                contentText: finalText,
              })
              queue({ type: 'assistant_message', message: deserializeMessage(assistantRecord) })
            } else {
              queue({ type: 'error', error: 'Assistant returned an empty response.' })
            }

            await touchThread(parsed.data.threadId)
            queue({ type: 'done' })
          } catch (error) {
            console.error('Failed to stream assistant reply', error)
            queue({ type: 'error', error: 'Failed to stream assistant reply.' })
          } finally {
            controller.close()
          }
        })()
      },
    })

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'application/jsonl; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    })
  } catch (error) {
    return respond(
      {
        success: false,
        error: {
          code: 'MESSAGE_CREATE_FAILED',
          message: 'Unable to create message',
          details: error,
        },
      },
      { status: 500 },
    )
  }
}

const deserializeMessage = (message: Awaited<ReturnType<typeof createMessage>>) => ({
  ...message,
  contentJson: message.contentJson ? JSON.parse(message.contentJson) : null,
})

const deserializeSnapshot = (snapshot: Awaited<ReturnType<typeof createSnapshot>>) => ({
  ...snapshot,
  nextSuggestions: snapshot.nextSuggestions ? JSON.parse(snapshot.nextSuggestions) : null,
})

type ThreadMessageRecord = Awaited<ReturnType<typeof getMessagesForThread>>[number]

type StreamPayload =
  | { type: 'user_message'; message: ReturnType<typeof deserializeMessage> }
  | { type: 'assistant_message'; message: ReturnType<typeof deserializeMessage> }
  | { type: 'snapshot'; snapshot: ReturnType<typeof deserializeSnapshot> }
  | { type: 'token'; value: string }
  | { type: 'error'; error: string }
  | { type: 'done' }

type MealPhotoAttachmentPayload = {
  type: 'meal_photo'
  dataUrl: string
  name?: string
  mimeType?: string
  size?: number
}

const toAzureChatMessage = (message: ThreadMessageRecord): AzureChatMessage | null => {
  const structured = message.contentJson ? safeJsonParse(message.contentJson) : null
  const mealPhoto = parseMealPhotoAttachment(structured)
  const textContent = extractContentText(message, structured)

  const role: AzureChatMessage['role'] = message.role === 'assistant' || message.role === 'system' ? message.role : 'user'

  if (mealPhoto) {
    const content: AzureMessageContentPart[] = []
    if (textContent) {
      content.push({ type: 'text', text: textContent })
    }
    const attachmentUrl = buildMealPhotoUrl(message.id, mealPhoto.dataUrl)
    if (attachmentUrl) {
      content.push({ type: 'image_url', image_url: { url: attachmentUrl } })
    }
    return content.length > 0 ? { role, content } : null
  }

  if (textContent) {
    return { role, content: textContent }
  }

  return null
}

const extractContentText = (message: ThreadMessageRecord, structured?: unknown) => {
  if (message.contentText?.trim()) {
    return message.contentText.trim()
  }

  const parsed = structured ?? (message.contentJson ? safeJsonParse(message.contentJson) : null)
  if (typeof parsed === 'string') {
    return parsed.trim()
  }

  const mealPhoto = parseMealPhotoAttachment(parsed)
  if (mealPhoto) {
    const label = mealPhoto.name?.trim() || mealPhoto.mimeType || 'meal photo'
    return `User uploaded a ${label} for macro analysis.`
  }

  if (parsed && typeof parsed === 'object') {
    return JSON.stringify(parsed)
  }

  return ''
}

const safeJsonParse = (value: string) => {
  try {
    return JSON.parse(value)
  } catch (error) {
    console.error('Unable to parse structured content for Azure payload', error)
    return value
  }
}

const parseMealPhotoAttachment = (value: unknown): MealPhotoAttachmentPayload | null => {
  if (!value || typeof value !== 'object') {
    return null
  }
  const record = value as Record<string, unknown>
  if (record.type !== 'meal_photo') {
    return null
  }
  const dataUrl = record.dataUrl
  if (typeof dataUrl !== 'string' || dataUrl.trim().length === 0) {
    return null
  }
  const attachment: MealPhotoAttachmentPayload = {
    type: 'meal_photo',
    dataUrl,
  }
  if (typeof record.name === 'string' && record.name.trim().length > 0) {
    attachment.name = record.name.trim()
  }
  if (typeof record.mimeType === 'string' && record.mimeType.trim().length > 0) {
    attachment.mimeType = record.mimeType.trim()
  }
  if (typeof record.size === 'number' && Number.isFinite(record.size)) {
    attachment.size = record.size
  }
  return attachment
}

const buildMealPhotoUrl = (messageId: string, fallbackDataUrl: string) => {
  if (canExposeAttachmentBase) {
    return `${attachmentBaseUrl}/api/chat/messages/${messageId}/attachment`
  }
  return fallbackDataUrl
}

