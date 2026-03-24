Add SQLite persistence with Prisma for the chat system.

Requirements:
1. Use Prisma + SQLite
2. Create models:
   - UserProfile
   - ConversationThread
   - ChatMessage
   - NutritionSnapshot
3. Add prisma client singleton at src/server/db/prisma.ts
4. Create route handlers:
   - POST /api/chat/threads
   - GET /api/chat/thread/[threadId]
   - POST /api/chat/messages
5. Persist:
   - user message
   - assistant message
   - structured nutrition snapshot
6. Keep the implementation minimal, typed, and App Router compatible.
7. Follow AGENTS.md strictly.



# example

## schema
```
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

enum MessageRole {
  user
  assistant
  system
}

enum MessageKind {
  text
  metric_card
  day_plan_card
  meal_analysis_card
  daily_summary_card
  event
}

enum TrainingType {
  lower
  upper
  rest
}

enum DayType {
  high
  medium
  low
}

model UserProfile {
  id               String   @id @default(cuid())
  displayName      String?
  sex              String?
  age              Int?
  heightCm         Float?
  weightKg         Float?
  bodyFatPercent   Float?
  activityLevel    String?
  goal             String?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  threads          ConversationThread[]
}

model ConversationThread {
  id               String   @id @default(cuid())
  userProfileId    String?
  title            String
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  archivedAt       DateTime?

  userProfile      UserProfile? @relation(fields: [userProfileId], references: [id], onDelete: SetNull)
  messages         ChatMessage[]
  snapshots        NutritionSnapshot[]

  @@index([userProfileId, updatedAt])
}

model ChatMessage {
  id               String      @id @default(cuid())
  threadId         String
  role             MessageRole
  kind             MessageKind @default(text)
  contentText      String?
  contentJson      Json?
  turnIndex        Int
  createdAt        DateTime    @default(now())

  thread           ConversationThread @relation(fields: [threadId], references: [id], onDelete: Cascade)
  snapshot         NutritionSnapshot?

  @@index([threadId, turnIndex])
  @@unique([threadId, turnIndex])
}

model NutritionSnapshot {
  id               String    @id @default(cuid())
  threadId         String
  messageId        String    @unique

  trainingType     TrainingType?
  dayType          DayType?

  targetCalories   Int?
  targetProteinG   Int?
  targetCarbsG     Int?
  targetFatG       Int?

  consumedCalories Int?      @default(0)
  consumedProteinG Float?    @default(0)
  consumedCarbsG   Float?    @default(0)
  consumedFatG     Float?    @default(0)

  remainingCalories Int?
  remainingProteinG Float?
  remainingCarbsG   Float?
  remainingFatG     Float?

  nextSuggestions  Json?
  createdAt        DateTime  @default(now())

  thread           ConversationThread @relation(fields: [threadId], references: [id], onDelete: Cascade)
  message          ChatMessage        @relation(fields: [messageId], references: [id], onDelete: Cascade)

  @@index([threadId, createdAt])
}
```

## directory
prisma/
  schema.prisma

src/server/db/
  prisma.ts

src/server/repositories/
  thread-repository.ts
  message-repository.ts
  snapshot-repository.ts

app/api/chat/threads/route.ts
app/api/chat/messages/route.ts
app/api/chat/thread/[threadId]/route.ts