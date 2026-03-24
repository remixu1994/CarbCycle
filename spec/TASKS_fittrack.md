# TASKS.md

## 🎯 Goal
Bootstrap FitTrack carb cycling web app using Next.js + TypeScript + Agent architecture.

---

## Phase 1: Project Setup

### Task 1.1 Initialize Project
- Create Next.js (App Router) project
- Enable TypeScript
- Install TailwindCSS

### Task 1.2 Basic Structure
Create folders:
- app/dashboard
- src/lib
- src/components
- app/api

---

## Phase 2: Core Logic (CRITICAL)

### Task 2.1 Metabolism Engine
Create:
- src/lib/metabolism/formulas.ts

Implement:
- BMR (Katch-McArdle + Mifflin-St Jeor)
- TDEE calculation

---

### Task 2.2 Carb Cycle Engine
Create:
- src/lib/carb-cycle/calculate.ts

Implement:
- high / medium / low carb mapping
- macro calculation

---

### Task 2.3 Types
Create:
- src/types/nutrition.ts

---

## Phase 3: API Layer

### Task 3.1 Metabolism API
POST /api/metabolism/calculate

### Task 3.2 Carb Cycle API
POST /api/carb-cycle/analyze

---

## Phase 4: UI

### Task 4.1 Dashboard Page
- Basic layout

### Task 4.2 Profile Form
- Input user data

### Task 4.3 Planner Page
- Show daily macros

---

## Phase 5: Meal System

### Task 5.1 Meal Input
- Simple form

### Task 5.2 Meal Analysis
- Score + suggestions

---

## Phase 6: Agent Loop (V1)

Implement:
- input → compute → output suggestion

---

## Definition of Done
- Can input profile
- Can calculate BMR/TDEE
- Can generate carb plan
- Can analyze one meal

---

## Next Expansion
- Database
- Auth
- Charts
- AI layer
