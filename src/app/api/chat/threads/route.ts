import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { createThread, listThreads } from '@/server/repositories/thread-repository'
import { ApiResponse } from '@/types/api'

const threadPayloadSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  userProfileId: z.string().min(10).max(64).optional(),
})

const respond = <T>(body: ApiResponse<T>, init?: ResponseInit) => NextResponse.json(body, init)

export async function POST(request: NextRequest) {
  try {
    const json = await request.json()
    const parsed = threadPayloadSchema.safeParse(json)
    if (!parsed.success) {
      return respond(
        {
          success: false,
          error: {
            code: 'INVALID_BODY',
            message: 'Invalid payload for thread creation',
            details: parsed.error.flatten(),
          },
        },
        { status: 400 },
      )
    }

    const thread = await createThread(parsed.data)
    return respond({ success: true, data: thread }, { status: 201 })
  } catch (error) {
    return respond(
      {
        success: false,
        error: {
          code: 'THREAD_CREATE_FAILED',
          message: 'Unable to create thread',
          details: error,
        },
      },
      { status: 500 },
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userProfileId = searchParams.get('userProfileId') ?? undefined
    if (userProfileId && (userProfileId.trim().length < 10 || userProfileId.trim().length > 64)) {
      return respond(
        {
          success: false,
          error: {
            code: 'INVALID_QUERY',
            message: 'userProfileId must be a CUID',
          },
        },
        { status: 400 },
      )
    }

    const data = await listThreads(userProfileId)
    return respond({ success: true, data })
  } catch (error) {
    return respond(
      {
        success: false,
        error: {
          code: 'THREAD_LIST_FAILED',
          message: 'Unable to list threads',
          details: error,
        },
      },
      { status: 500 },
    )
  }
}
