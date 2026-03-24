# FitTrack Chat UI Design Spec

## Product Direction
目标是做一个类似 GPT 的多轮对话式营养教练界面，但底层以碳循环规则引擎为核心，后续可接 LLM 解释层。

产品定位：
- 主界面像聊天
- 输出不仅是文字，还要有结构化卡片
- 支持连续上下文
- 支持“边聊边计算、边记录边给建议”

---

## Core UX Principles

1. 对话优先  
用户先“说”，系统再决定：
- 回复文本
- 更新当天状态
- 生成饮食建议
- 展示分析卡片

2. 结构化结果可视化  
不能只像普通聊天窗口。要把关键结果变成卡片：
- 今日类型：高碳 / 中碳 / 低碳
- 今日目标：热量 / 蛋白 / 碳水 / 脂肪
- 单餐分析
- 日总结
- 下一餐建议

3. 聊天是入口，Dashboard 是补充  
用户主要在聊天页使用产品。  
Dashboard 用来回看：
- 历史记录
- 体重趋势
- 当日达成情况
- 配置资料

---

## Information Architecture

### Primary Routes
- `/` Landing / redirect
- `/chat` 主对话页
- `/dashboard` 今日总览
- `/history` 历史会话 / 历史饮食
- `/profile` 用户资料
- `/settings` 模型 / 偏好设置

---

## Main Screen: /chat

### Layout
采用三栏或两栏自适应布局。

#### Desktop
- 左侧：会话列表 / 历史线程
- 中间：主对话区
- 右侧：上下文面板 / 今日状态卡

#### Mobile
- 默认只显示主对话区
- 左侧线程和右侧状态收进抽屉

---

## Chat Screen Structure

### 1. Sidebar
内容：
- New Chat
- Today Plan
- Recent Conversations
- Quick Actions
  - 开始今天计划
  - 记录早餐
  - 记录午餐
  - 查看今日剩余宏量
  - 重新计算目标

### 2. Main Conversation Panel
由以下区域组成：

#### Header
- App name / 当前线程标题
- 当前日类型 badge
- 模型状态（规则引擎 / AI增强）
- 用户菜单

#### Message List
消息类型：
- user message
- assistant text message
- assistant structured card
- system event message

#### Composer
输入区支持：
- 多行文本
- 快捷 action chips
- 图片上传（后续）
- Enter 发送 / Shift+Enter 换行

---

## Right Context Panel

显示当前对话关联的“营养状态”。

### Sections
1. 今日状态
- 高碳 / 中碳 / 低碳
- 热量目标
- 蛋白 / 碳水 / 脂肪目标

2. 今日已摄入
- 已吃热量
- 蛋白 / 碳水 / 脂肪进度条

3. 下一步建议
- 下一餐建议
- 今日剩余目标

4. 快速记录
- 早餐
- 午餐
- 晚餐
- 加餐

---

## Message Types

### A. User Message
普通文本气泡。

### B. Assistant Text Message
自然语言回复，像 GPT。

例：
“今天按中碳日执行。你午餐蛋白偏低，下一餐建议优先补 35g 蛋白，控制脂肪。”

### C. Metric Card
用于展示计算结果。

内容：
- BMR
- TDEE
- calorie target
- deficit

### D. Day Plan Card
用于展示今日目标。

内容：
- day type
- protein target
- carbs target
- fat target

### E. Meal Analysis Card
用于展示一餐分析。

内容：
- meal name
- estimated calories
- macros
- score
- issues
- suggestions

### F. Daily Summary Card
用于展示今日累计。

内容：
- target vs actual
- remaining macros
- adherence score

### G. Agent Event Message
不面向普通用户解释内部细节，只显示简短状态：
- 已识别今天为中碳日
- 已更新今日午餐
- 已生成下一餐建议

---

## Suggested Conversation Flow

### Flow 1: Start a day
用户：
“开始今天计划，我今天练胸。”

系统：
1. 识别 trainingType = upper
2. 计算 dayType = medium
3. 输出文本说明
4. 渲染 Day Plan Card
5. 更新右侧上下文面板

### Flow 2: Log meal
用户：
“早餐吃了两个鸡蛋，一杯牛奶，70g 燕麦。”

系统：
1. 解析食物
2. 估算宏量
3. 更新 summary
4. 输出 Meal Analysis Card
5. 输出下一步建议

### Flow 3: Ask for correction
用户：
“午饭吃多了，接下来怎么办？”

系统：
1. 基于当日剩余额度判断
2. 输出纠偏建议
3. 更新右侧 panel 的下一餐建议

---

## UI Component List

### Layout
- `AppShell`
- `ChatSidebar`
- `ChatHeader`
- `ChatPanel`
- `ContextPanel`
- `MobileDrawer`

### Chat
- `MessageList`
- `MessageBubble`
- `AssistantMessage`
- `Composer`
- `QuickActionChips`

### Cards
- `MetricCard`
- `DayTypeBadge`
- `MacroTargetCard`
- `MealAnalysisCard`
- `DailySummaryCard`
- `SuggestionCard`

### Forms
- `ProfileForm`
- `MealQuickLogForm`
- `TrainingTypeSelector`

---

## Design Language

### Tone
- 专业
- 干净
- 数据化
- 不花哨

### Visual Style
建议类似：
- ChatGPT 的简洁聊天主界面
- Linear 的清晰边界和密度
- 健身工具类产品的“仪表板感”

### Color Role Suggestions
- High carb: warm accent
- Medium carb: neutral / blue accent
- Low carb: green accent

不要过度依赖颜色，同时加文字 badge。

### Typography
- 标题：简洁强对比
- 正文：可读性优先
- 数值：等宽或半等宽更利于扫描

---

## Interaction Rules

### Message Behavior
- assistant 回复要分段，不要一大段
- 重要结果用卡片插入消息流
- 卡片可折叠，但默认展开

### Streaming
推荐支持流式输出：
- 先出自然语言说明
- 再依次插入 cards
- 最后更新右侧 panel

### Persistence
每轮对话应保存：
- user input
- assistant output
- extracted intent
- structured nutrition state delta

---

## Conversation State Model

```ts
type ConversationThread = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

type ChatMessage = {
  id: string;
  threadId: string;
  role: "user" | "assistant" | "system";
  kind: "text" | "metric_card" | "meal_card" | "summary_card" | "event";
  content: unknown;
  createdAt: string;
};

type NutritionContext = {
  dayType: "high" | "medium" | "low" | null;
  trainingType: "lower" | "upper" | "rest" | null;
  targets: {
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
  } | null;
  consumed: {
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
  };
  nextSuggestion: string[];
};
```

---

## Recommended UX for Multi-Turn Dialogue

### Context Retention
系统要记住同一 thread 中的：
- 当前日期计划
- 训练类型
- 已记录的餐
- 已计算的目标
- 用户偏好

### Clarification Strategy
不要频繁反问。
优先做合理推断，并明确说明：
- “我先按中碳日处理”
- “先按一份标准牛肉盖饭估算”

### Editable History
用户可以点开某条 meal card：
- 编辑食物
- 修正克数
- 重新计算

---

## MVP UI Scope

第一版只做：

1. `/chat`
2. 左侧线程列表
3. 主消息流
4. 底部输入框
5. 右侧上下文面板
6. 3 种结构化卡片
   - Day Plan Card
   - Meal Analysis Card
   - Daily Summary Card

不急着做：
- 复杂图表
- 头像系统
- 图片识别
- 多模型切换
- 复杂主题系统

---

## Suggested Build Order

1. 搭 `AppShell`
2. 搭 `/chat` 页面骨架
3. 先做静态消息流
4. 接入 `agent loop runtime`
5. 把返回结果映射成 message + cards
6. 做右侧 context panel
7. 再接持久化

---

## Technical Notes for Next.js

推荐目录：

```txt
app/
  chat/
    page.tsx
  dashboard/
    page.tsx
  api/
    agent/
      run/
        route.ts

src/
  components/
    chat/
      chat-sidebar.tsx
      chat-header.tsx
      message-list.tsx
      composer.tsx
      context-panel.tsx
    cards/
      day-plan-card.tsx
      meal-analysis-card.tsx
      daily-summary-card.tsx
  lib/
    agent/
    chat/
      message-mapper.ts
      thread-store.ts
```

---

## Codex Task Prompt

为 Codex 下达 UI 开发任务时，建议用这段：

“Build the `/chat` experience first.
Create a GPT-like multi-turn chat UI for the FitTrack carb cycling agent.
Use Next.js App Router, TypeScript, and Tailwind.
The chat screen must include:
1. left conversation sidebar
2. central message thread
3. bottom composer
4. right context panel
5. structured assistant cards for day plan, meal analysis, and daily summary

Keep the first version minimal but fully usable.
Use mock data first, then wire it to the existing agent loop runtime.”
