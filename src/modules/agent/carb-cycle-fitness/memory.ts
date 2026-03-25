import type { ActivePlan, ConversationSnapshot, MemoryStore, UserProfile } from './types'

export class InMemoryStore implements MemoryStore {
  private profiles = new Map<string, UserProfile>()
  private plans = new Map<string, ActivePlan>()

  async loadUserProfile(userId: string): Promise<UserProfile | null> {
    // TODO: replace with Prisma or other persistence layer
    return this.profiles.get(userId) ?? null
  }

  async loadActivePlan(userId: string): Promise<ActivePlan | null> {
    return this.plans.get(userId) ?? null
  }

  async saveConversationSnapshot(payload: ConversationSnapshot): Promise<void> {
    // TODO: persist conversation summaries to SQLite
    if (payload.summary) {
      this.plans.set(payload.userId, {
        cycleType: 'high',
        updatedAt: new Date().toISOString(),
        targets: { note: payload.summary },
      })
    }
  }
}
