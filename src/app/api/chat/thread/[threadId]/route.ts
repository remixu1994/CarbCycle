import { NextRequest, NextResponse } from 'next/server'

import { deleteThread, getThreadById } from '@/server/repositories/thread-repository'
import { ApiResponse } from '@/types/api'

const respond = <T>(body: ApiResponse<T>, init?: ResponseInit) => NextResponse.json(body, init)

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const segments = url.pathname.split('/').filter(Boolean)
  const threadId = segments[segments.length - 1]?.trim()
  if (!threadId) {
    console.error('Missing threadId param for /api/chat/thread route', { url: request.url })
    return respond(
      {
        success: false,
        error: {
          code: 'INVALID_PARAMS',
          message: 'threadId is required',
        },
      },
      { status: 400 },
    )
  }

  try {
    const thread = await getThreadById(threadId)
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

    return respond({ success: true, data: serializeThread(thread) })
  } catch (error) {
    return respond(
      {
        success: false,
        error: {
          code: 'THREAD_FETCH_FAILED',
          message: 'Unable to fetch thread',
          details: error,
        },
      },
      { status: 500 },
    )
  }
}

type ThreadWithRelations = NonNullable<Awaited<ReturnType<typeof getThreadById>>>

const serializeThread = (thread: ThreadWithRelations) => ({
  ...thread,
  messages: thread.messages.map((message) => ({
    ...message,
    contentJson: message.contentJson ? JSON.parse(message.contentJson) : null,
  })),
  snapshots: thread.snapshots.map((snapshot) => ({
    ...snapshot,
    nextSuggestions: snapshot.nextSuggestions ? JSON.parse(snapshot.nextSuggestions) : null,
  })),
})

export async function DELETE(request: NextRequest) {
  const url = new URL(request.url)
  const segments = url.pathname.split('/').filter(Boolean)
  const threadId = segments[segments.length - 1]?.trim()

  if (!threadId) {
    return respond(
      {
        success: false,
        error: {
          code: 'INVALID_PARAMS',
          message: 'threadId is required',
        },
      },
      { status: 400 },
    )
  }

  try {
    await deleteThread(threadId)
    return respond({ success: true }, { status: 200 })
  } catch (error) {
    return respond(
      {
        success: false,
        error: {
          code: 'THREAD_DELETE_FAILED',
          message: 'Unable to delete thread',
          details: error,
        },
      },
      { status: 500 },
    )
  }
}
