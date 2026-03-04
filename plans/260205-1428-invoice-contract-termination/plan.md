# Plan: Invoice & Contract Termination Feature
Created: 2026-02-05T14:28
Status: 🟡 Planning

## Overview
Implement invoice creation (long-term & short-term) and contract termination with status management.

## Tech Stack
- Frontend: React + TypeScript + Shadcn UI
- Backend: NestJS + MongoDB (Mongoose)
- Existing: Payment module ready for integration

## Phases

| Phase | Name | Status | Est. Files |
|-------|------|--------|------------|
| 01 | Schema Updates | ⬜ Pending | 3 |
| 02 | Contract Logic | ⬜ Pending | 4 |
| 03 | Invoice API | ⬜ Pending | 3 |
| 04 | Invoice Modal (FE) | ⬜ Pending | 4 |
| 05 | Terminate Modal (FE) | ⬜ Pending | 2 |
| 06 | Testing | ⬜ Pending | 2 |

## Key Decisions
- ✅ Room already has initialElectricIndex/initialWaterIndex
- ✅ Contract has currentElectricIndex/currentWaterIndex  
- 🆕 Add nextPaymentDate to Contract
- 🆕 Add adjustments, contractSnapshot to Invoice
- 🆕 Short-term auto-terminates on invoice

## Quick Commands
- View full plan: See `implementation_plan.md`
- Start Phase 1: `/code phase-01`
- Check progress: `/next`
