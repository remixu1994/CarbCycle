import { NextRequest, NextResponse } from 'next/server'

import { getMessageById } from '@/server/repositories/message-repository'

const respond = (body: { error: string }, init?: ResponseInit) => NextResponse.json(body, init)

export async function GET(_request: NextRequest, context: { params: { messageId?: string } }) {
  const messageId = context.params.messageId?.trim()
  if (!messageId) {
    return respond({ error: 'messageId is required' }, { status: 400 })
  }

  try {
    const message = await getMessageById(messageId)
    if (!message?.contentJson) {
      return respond({ error: 'Attachment not found' }, { status: 404 })
    }

    const parsed = safeJsonParse(message.contentJson)
    const attachment = parseMealPhotoAttachment(parsed)
    if (!attachment) {
      return respond({ error: 'Attachment not found' }, { status: 404 })
    }

    const decoded = decodeDataUrl(attachment.dataUrl)
    if (!decoded) {
      return respond({ error: 'Invalid attachment payload' }, { status: 415 })
    }

    return new NextResponse(decoded.buffer, {
      status: 200,
      headers: {
        'Content-Type': decoded.mimeType,
        'Content-Length': decoded.buffer.length.toString(),
        'Cache-Control': 'public, max-age=300',
      },
    })
  } catch (error) {
    console.error('Failed to serve attachment', error)
    return respond({ error: 'Unable to fetch attachment' }, { status: 500 })
  }
}

const safeJsonParse = (value: string) => {
  try {
    return JSON.parse(value)
  } catch (error) {
    console.error('Invalid attachment json', error)
    return null
  }
}

const parseMealPhotoAttachment = (value: unknown) => {
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

  return { dataUrl }
}

const decodeDataUrl = (dataUrl: string) => {
  const match = dataUrl.match(/^data:(?<mime>[^;]+);base64,(?<data>.+)$/)
  if (!match?.groups?.mime || !match?.groups?.data) {
    return null
  }
  try {
    const buffer = Buffer.from(match.groups.data, 'base64')
    return { buffer, mimeType: match.groups.mime }
  } catch (error) {
    console.error('Failed to decode data url', error)
    return null
  }
}
