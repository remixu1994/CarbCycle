import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { prisma } from '@/server/db/prisma'
import { createMessage } from '@/server/repositories/message-repository'
import { createSnapshot } from '@/server/repositories/snapshot-repository'
import { touchThread } from '@/server/repositories/thread-repository'
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

    await touchThread(parsed.data.threadId)

    return respond(
      {
        success: true,
        data: {
          message: deserializeMessage(createdMessage),
          snapshot,
        },
      },
      { status: 201 },
    )
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
