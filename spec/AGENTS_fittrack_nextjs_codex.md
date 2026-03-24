# AGENTS.md

## Project
FitTrack 碳循环 Agent Web App

## Mission
你是本项目的实现型工程 Agent。你的目标是为 FitTrack 开发一个基于 Next.js + TypeScript + agent loop 的碳循环网页应用。
你必须优先交付“可运行、可验证、可迭代”的代码，而不是只输出方案。

---

## Product Goal
构建一个围绕“碳循环饮食建议”的网页应用，帮助用户：

1. 输入基础资料（性别、年龄、身高、体重、体脂、活动水平）
2. 计算 BMR、TDEE、每日热量目标
3. 根据训练类型生成高碳 / 中碳 / 低碳日建议
4. 记录每餐并获得宏量营养分析
5. 获得下一餐修正建议
6. 查看每日汇总与趋势

---

## Primary Stack
- Next.js App Router
- TypeScript
- React
- Server Components by default
- Client Components only where interactivity is required
- Route Handlers for backend endpoints
- Tailwind CSS for UI
- Zod for validation
- Zustand or React Context for lightweight client state
- Prisma + PostgreSQL for persistence when backend storage is needed

---

## Non-Negotiable Technical Rules

### 1. App Router First
项目必须基于 Next.js App Router 实现，不要回退到 Pages Router，除非某个功能有明确理由必须这样做。

### 2. TypeScript Strict
所有代码必须使用 TypeScript。
禁止引入 `any`，除非先写明原因并将其局限在最小范围。
优先使用：
- 明确的 interface / type
- Zod schema 推导类型
- 可判别联合类型

### 3. Server-First Architecture
默认使用 Server Components。
只有以下情况才使用 Client Components：
- 表单交互
- 本地状态
- 事件处理
- 浏览器 API
- 图表交互

### 4. Thin API Layer
所有服务端接口统一放在 `app/api/**/route.ts`。
Route Handler 只做：
- 参数接收
- 鉴权
- 校验
- 调用 domain service
- 返回结构化 JSON

不要把复杂业务逻辑堆在 route 文件里。

### 5. Domain Separation
把业务逻辑放到独立模块中，例如：
- `src/lib/nutrition/*`
- `src/lib/metabolism/*`
- `src/lib/carb-cycle/*`
- `src/lib/agent/*`

### 6. Build Small, Then Iterate
每次优先完成最小闭环：
- 能运行
- 能测试
- 能演示
- 能继续扩展

不要一次生成过大、过散、无法验证的改动。

---

## Agent Loop Working Mode

你必须按下面流程循环工作：

1. **理解当前任务**
   - 明确任务目标
   - 识别影响范围
   - 列出涉及的文件

2. **提出最小实现方案**
   - 先做最小可运行版本
   - 说明为什么这样拆分

3. **直接修改代码**
   - 优先交付代码，不要长篇空谈
   - 如果涉及多个文件，保证引用关系正确

4. **自检**
   - 类型检查
   - lint
   - 关键路径检查
   - 避免未使用变量、错误导入、路径错误

5. **输出结果**
   - 改了哪些文件
   - 实现了什么
   - 还有什么待做
   - 下一步最优先事项是什么

---

## Output Protocol
每次响应尽量遵循这个格式：

### Plan
简要说明本轮要做什么。

### Changes
按文件列出修改内容。

### Notes
说明关键设计决策、边界和取舍。

### Next
给出最合理的下一步。

如果任务足够明确，直接进入改代码，不要反复确认。

---

## Product Modules

### 1. Authentication
如果用户要求登录：
- 优先 Clerk 或 NextAuth
- 未接入登录前，允许先做 guest mode

### 2. Profile Module
维护用户基础数据：
- sex
- age
- height_cm
- weight_kg
- body_fat_percent
- activity_level
- goal

### 3. Metabolism Engine
必须实现：
- BMR calculation
- TDEE calculation
- calorie target calculation

优先支持：
- Katch-McArdle（体脂已知）
- Mifflin-St Jeor（体脂未知）

### 4. Carb Cycling Engine
必须实现：
- high / medium / low carb day mapping
- macro target generation
- fat floor guard
- calorie consistency checks

### 5. Meal Analysis Engine
支持：
- meal input
- macro estimation（先允许手工输入，后续可接食物库）
- meal score
- issue detection
- next meal correction

### 6. Daily Summary
展示：
- 今日目标 vs 实际
- 蛋白 / 碳水 / 脂肪完成度
- 剩余建议
- 当日评分

### 7. Trend / Adherence
后续可加入：
- 体重趋势
- 平台期识别
- 每周调整建议

---

## Recommended Folder Structure

```txt
app/
  (marketing)/
  dashboard/
    page.tsx
    profile/
      page.tsx
    planner/
      page.tsx
    meals/
      page.tsx
  api/
    profile/route.ts
    metabolism/calculate/route.ts
    carb-cycle/analyze/route.ts
    meals/analyze/route.ts

src/
  components/
    ui/
    forms/
    dashboard/
    charts/
  lib/
    agent/
      prompts.ts
      loop.ts
      actions.ts
    metabolism/
      formulas.ts
      calculate.ts
      types.ts
    carb-cycle/
      rules.ts
      calculate.ts
      score.ts
      types.ts
    nutrition/
      estimate.ts
      types.ts
    validators/
      profile.ts
      meal.ts
  server/
    db/
    repositories/
    services/
  types/
```

---

## API Conventions

### Response Shape
所有 API 返回统一结构：

```ts
type ApiResponse<T> = {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: unknown
  }
}
```

### Validation
所有输入都必须校验：
- route 层使用 Zod
- parse 失败返回 400
- 不允许静默吞掉错误

### Error Handling
- 用户错误：返回明确 message
- 系统错误：记录日志，返回通用错误
- 不要把 stack trace 暴露给客户端

---

## UI Rules

### Design Style
- 简洁、专业、偏产品化
- 健身/营养工具感，而不是花哨营销页
- 移动端优先，同时兼顾桌面端

### Component Rules
- 优先拆成可复用组件
- 表单统一使用可复用字段组件
- 数值展示统一格式化
- 避免在页面组件里堆积业务逻辑

### Accessibility
- 所有表单元素都要有 label
- 错误信息可读
- 颜色不是唯一状态提示

---

## State Management Rules
- 服务端数据优先走 server fetch
- 客户端轻状态才用 Zustand / useState
- 不要过早引入重量级状态库

---

## Database Rules
如果当前任务需要持久化：
- 优先 Prisma schema 先行
- 建立最少可用模型
- 不做过度抽象

建议核心表：
- User
- UserProfile
- DailyPlan
- MealLog
- DailySummary

---

## Testing Rules
至少覆盖这些核心纯函数：
- BMR calculation
- TDEE calculation
- carb day mapping
- macro allocation
- meal score calculation

优先为纯逻辑模块写单元测试。
UI 测试可后置。

---

## Performance Rules
- 默认减少客户端 JS
- 不把大块页面错误标记成 Client Component
- 只在必要时引入图表库
- 注意表单和列表的渲染成本

---

## Security Rules
- 环境变量只在服务端使用
- 不把私钥暴露到客户端
- 所有用户输入都做校验
- 未来若接 LLM / food API，必须通过服务端代理

---

## Code Quality Rules
必须做到：
- 命名清晰
- 单文件职责明确
- 函数短小
- 避免重复逻辑
- 避免魔法数字，提取常量
- 保持 imports 整洁

禁止：
- 无解释的 `any`
- 超大组件
- 把业务规则散落在 UI 组件中
- “先写死以后再说”但没有 TODO 注释

---

## Delivery Priorities
当需求不明确时，按以下优先级交付：

1. 可运行基础架构
2. 核心计算正确
3. API 结构稳定
4. 页面可用
5. 数据持久化
6. 美化与增强功能

---

## MVP Definition
第一阶段最小可用产品必须包含：

1. 首页 / Dashboard
2. 用户资料录入
3. BMR / TDEE / 热量目标计算
4. 高碳 / 中碳 / 低碳日推荐
5. 单餐录入与分析
6. 当日汇总

只有完成以上能力后，才继续：
- 趋势图
- 登录
- AI 对话
- 图像识别
- 高级 Agent loop

---

## Task Prioritization Heuristic
收到任务后优先判断它属于哪类：

- **Scaffold**：初始化项目或模块
- **Feature**：新增功能
- **Refactor**：整理结构但不改行为
- **Bugfix**：修复错误
- **DX**：改善开发体验
- **Test**：补测试

你必须根据类别选择最经济的实现方式。

---

## Definition of Done
一个任务完成前，至少满足：

- 代码可读
- 类型通过
- 结构合理
- 不破坏现有模块
- 返回结果可被前端消费
- 有清晰下一步

---

## When You Need to Make Assumptions
如果上下文不足：
1. 做最保守、最常见的工程假设
2. 继续推进最小实现
3. 在 Notes 中明确写出你的假设
不要因为信息不完整就停住。

---

## First Build Sequence
如果要从 0 到 1 搭建项目，按这个顺序：

1. 初始化 Next.js + TypeScript + Tailwind
2. 建立 app 路由和 dashboard 基础布局
3. 建 profile form
4. 实现 metabolism formulas
5. 建 carb-cycle engine
6. 建 route handlers
7. 建 planner UI
8. 建 meal analysis UI
9. 加数据库
10. 加测试
11. 再考虑 agent loop 自动化能力

---

## Agent-Specific Goal
这个项目中的“agent loop”不是聊天玩具。
它的目标是：
- 接收用户上下文
- 解析当前状态
- 调用计算模块
- 产出结构化建议
- 驱动页面状态更新

先把它实现成“规则驱动 agent”，再考虑接入 LLM。

---

## If LLM Is Added Later
若后续接入大模型：
- 仅让模型负责解释、总结、建议表达
- 关键数值计算仍然由本地规则引擎完成
- 不允许把 BMR/TDEE/宏量核心逻辑完全交给模型

---

## Final Instruction
优先交付代码。
优先交付最小闭环。
优先保证计算正确、结构稳定、类型安全。
不要为了“看起来聪明”而牺牲工程质量。
