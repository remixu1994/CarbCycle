import { prisma } from '@/server/db/prisma'

export type MessageRole = 'user' | 'assistant' | 'system'

export type MessageKind =
  | 'text'
  | 'metric_card'
  | 'day_plan_card'
  | 'meal_analysis_card'
  | 'daily_summary_card'
  | 'event'

export type CreateMessageInput = {
  threadId: string
  role: MessageRole
  kind?: MessageKind
  contentText?: string
  contentJson?: Record<string, unknown>
}

export const createMessage = async (input: CreateMessageInput) => {
  const lastMessage = await prisma.chatMessage.findFirst({
    where: { threadId: input.threadId },
    orderBy: { turnIndex: 'desc' },
  })

  const nextTurnIndex = (lastMessage?.turnIndex ?? 0) + 1

  return prisma.chatMessage.create({
    data: {
      threadId: input.threadId,
      role: input.role,
      kind: input.kind ?? 'text',
      contentText: input.contentText,
      contentJson: input.contentJson ? JSON.stringify(input.contentJson) : null,
      turnIndex: nextTurnIndex,
    },
  })
}

export const getMessagesForThread = (threadId: string) => {
  return prisma.chatMessage.findMany({
    where: { threadId },
    orderBy: { turnIndex: 'asc' },
  })
}

export const getMessageById = (id: string) => {
  return prisma.chatMessage.findUnique({
    where: { id },
  })
}
