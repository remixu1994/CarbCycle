import { prisma } from '@/server/db/prisma'

export const createThread = async (input: { title: string; userProfileId?: string }) => {
  return prisma.conversationThread.create({
    data: {
      title: input.title,
      userProfileId: input.userProfileId,
    },
  })
}

export const getThreadById = async (threadId: string) => {
  return prisma.conversationThread.findUnique({
    where: { id: threadId },
    include: {
      messages: {
        orderBy: { turnIndex: 'asc' },
      },
      snapshots: {
        orderBy: { createdAt: 'desc' },
      },
    },
  })
}

export const listThreads = async (userProfileId?: string) => {
  return prisma.conversationThread.findMany({
    where: userProfileId
      ? {
          userProfileId,
        }
      : undefined,
    orderBy: { updatedAt: 'desc' },
  })
}

export const touchThread = async (threadId: string) => {
  return prisma.conversationThread.update({
    where: { id: threadId },
    data: { updatedAt: new Date() },
  })
}

export const deleteThread = async (threadId: string) => {
  return prisma.conversationThread.delete({
    where: { id: threadId },
  })
}
